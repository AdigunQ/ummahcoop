import { AdminHeading, AdminPanel } from '@/components/admin/admin-ui'
import { AdminCollection } from '@/components/admin/admin-collection'
import { AccessRecord } from '@/components/admin/access-record'
import { FormSelect } from '@/components/ui/smart-select'
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
  if (
    !session?.user?.id ||
    !(await canManageAdminAccess({ id: session.user.id, role: session.user.role }))
  ) {
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
  if (!(await canManageAdminAccess({ id: session.user.id, role: session.user.role })))
    redirect('/dashboard')

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
    <div className="admin-page">
      <AdminHeading
        section="Developer settings"
        title="Access & permissions"
        description="One member account. The right level of admin access."
        actions={
          <span className="admin-tag">
            <ShieldCheck size={14} />
            Developer only
          </span>
        }
      />
      {searchParams?.saved === '1' && (
        <p className="admin-success" role="status">
          Access updated successfully.
        </p>
      )}
      {searchParams?.error && (
        <p className="admin-error" role="alert">
          Could not update access. Please try again.
        </p>
      )}
      <div className="admin-role-guide">
        {Object.entries(ACCESS_BUNDLES).map(([key, bundle]) => (
          <div key={key}>
            <span>{bundle.privileges.length} permissions</span>
            <h2>{bundle.label}</h2>
            <p>{bundle.description}</p>
          </div>
        ))}
      </div>
      <AdminPanel
        title="Member access"
        note="Expand a member to review or change their permissions."
      >
        <AdminCollection>
          {members.map((member) => {
            const codes = member.privileges.map((p) => p.code)
            const bundle = resolveBundle(codes)
            return (
              <AccessRecord
                key={member.id}
                memberId={member.id}
                name={member.name || 'Unnamed member'}
                staffId={member.staffId}
                searchText={
                  (member.name || '') + ' ' + member.staffId + ' ' + ACCESS_BUNDLES[bundle].label
                }
                currentLabel={ACCESS_BUNDLES[bundle].label}
                currentBundle={bundle}
                codes={codes.map((code) => PRIVILEGE_LABELS[code as PrivilegeCode] || code)}
                options={Object.entries(ACCESS_BUNDLES).map(([value, b]) => ({
                  value,
                  label: b.label,
                  description: b.description,
                }))}
                action={updateAccessBundle}
              />
            )
          })}
        </AdminCollection>
      </AdminPanel>
    </div>
  )
}
