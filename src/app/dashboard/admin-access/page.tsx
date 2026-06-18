import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  ACCESS_BUNDLES,
  PRIVILEGE_LABELS,
  canManageAdminAccess,
  type AccessBundleKey,
  type PrivilegeCode,
} from '@/lib/access'

type SearchParams = {
  saved?: string
  error?: string
}

function resolveBundle(codes: string[]): AccessBundleKey {
  const codeSet = new Set(codes)

  if (ACCESS_BUNDLES.DEVELOPER.privileges.every((code) => codeSet.has(code))) {
    return 'DEVELOPER'
  }

  if (ACCESS_BUNDLES.EXCO_MANAGER.privileges.every((code) => codeSet.has(code))) {
    return 'EXCO_MANAGER'
  }

  if (ACCESS_BUNDLES.EXCO_VIEWER.privileges.every((code) => codeSet.has(code))) {
    return 'EXCO_VIEWER'
  }

  return 'MEMBER'
}

async function updateAccessBundle(formData: FormData) {
  'use server'

  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !(await canManageAdminAccess({ id: session.user.id, role: session.user.role }))) {
    redirect('/dashboard')
  }

  const memberId = String(formData.get('memberId') || '')
  const bundle = String(formData.get('bundle') || 'MEMBER') as AccessBundleKey
  if (!memberId || !ACCESS_BUNDLES[bundle]) {
    redirect('/dashboard/admin-access?error=invalid')
  }

  const selectedPrivileges = ACCESS_BUNDLES[bundle].privileges

  await prisma.$transaction(async (tx) => {
    await tx.memberPrivilege.deleteMany({
      where: {
        userId: memberId,
      },
    })

    for (const code of selectedPrivileges) {
      await tx.memberPrivilege.create({
        data: {
          userId: memberId,
          code,
          grantedById: session.user.id,
          note: `Granted ${ACCESS_BUNDLES[bundle].label} bundle`,
        },
      })
    }
  })

  revalidatePath('/dashboard/admin-access')
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/directory')
  redirect('/dashboard/admin-access?saved=1')
}

export default async function AdminAccessPage({ searchParams }: { searchParams?: SearchParams }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')
  if (!(await canManageAdminAccess({ id: session.user.id, role: session.user.role }))) redirect('/dashboard')

  const members = await prisma.user.findMany({
    where: {
      role: 'MEMBER',
      status: { in: ['ACTIVE', 'PENDING', 'SUSPENDED'] },
    },
    orderBy: [{ name: 'asc' }, { staffId: 'asc' }],
    select: {
      id: true,
      name: true,
      staffId: true,
      department: true,
      status: true,
      privileges: {
        select: {
          code: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Developer control</p>
          <h1 className="mt-2 text-3xl font-bold text-gray-950">Admin Access</h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-600">
            Grant Exco access to existing members without creating separate admin accounts. Everyone still signs in
            with their normal Staff ID and password.
          </p>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <ShieldCheck className="mb-1 h-5 w-5" />
          Only Developer access can change these roles.
        </div>
      </div>

      {searchParams?.saved === '1' && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Access updated successfully.
        </div>
      )}

      {searchParams?.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Could not update access. Please try again.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Object.entries(ACCESS_BUNDLES).map(([key, bundle]) => (
          <div key={key} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-gray-950">{bundle.label}</p>
            <p className="mt-1 text-xs leading-5 text-gray-500">{bundle.description}</p>
            <p className="mt-3 text-xs font-medium text-gray-700">
              {bundle.privileges.length} permission{bundle.privileges.length === 1 ? '' : 's'}
            </p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-950">Assign Access To Members</h2>
          <p className="mt-1 text-sm text-gray-500">Use Exco Viewer for read-only access and Exco Manager for the one read/write admin.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-3">Member</th>
                <th className="px-5 py-3">Current Access</th>
                <th className="px-5 py-3">Permissions</th>
                <th className="px-5 py-3">Change Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {members.map((member) => {
                const codes = member.privileges.map((privilege) => privilege.code)
                const currentBundle = resolveBundle(codes)
                return (
                  <tr key={member.id} className="align-top">
                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-950">{member.name || 'Unnamed member'}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {member.staffId || 'No Staff ID'} · {member.department || 'No department'} · {member.status}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        {ACCESS_BUNDLES[currentBundle].label}
                      </span>
                    </td>
                    <td className="max-w-md px-5 py-4">
                      {codes.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {codes.map((code) => (
                            <span key={code} className="rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-700">
                              {PRIVILEGE_LABELS[code as PrivilegeCode] || code}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">Member access only</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <form action={updateAccessBundle} className="flex min-w-64 gap-2">
                        <input type="hidden" name="memberId" value={member.id} />
                        <select
                          name="bundle"
                          defaultValue={currentBundle}
                          className="min-w-44 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
                        >
                          {Object.entries(ACCESS_BUNDLES).map(([key, bundle]) => (
                            <option key={key} value={key}>
                              {bundle.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="submit"
                          className="rounded-lg bg-gray-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-black"
                        >
                          Save
                        </button>
                      </form>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
