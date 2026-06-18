import Link from 'next/link'
import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatCurrency } from '@/lib/utils'
import ConfirmDeleteButton from './confirm-delete-button'
import { MANAGEABLE_PRIVILEGES, PRIVILEGE_LABELS, canAccessWithPrivileges, PRIVILEGE_CODES } from '@/lib/access'

type SearchParams = {
  saved?: string
  error?: string
}

function normalizeStaffId(input: string): string {
  return input.trim().replace(/\s+/g, '').toUpperCase()
}

function mapSaveError(error?: string): string | null {
  if (!error) return null
  if (error === 'invalid_staff') return 'Staff ID must contain only letters, numbers, or hyphen.'
  if (error === 'duplicate_staff') return 'Staff ID already belongs to another member.'
  if (error === 'save_failed') return 'Could not save this profile. Please try again.'
  return 'Could not save this profile.'
}

async function updateMemberRecord(formData: FormData) {
  'use server'

  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !(await canAccessWithPrivileges({ id: session.user.id, role: session.user.role }, PRIVILEGE_CODES.EDIT_MEMBERS))) redirect('/dashboard')

  const memberId = String(formData.get('memberId') || '')
  const staffId = normalizeStaffId(String(formData.get('staffId') || ''))
  const monthlyContribution = Number(formData.get('monthlyContribution') || 0)
  const specialContribution = Number(formData.get('specialContribution') || 0)
  const department = String(formData.get('department') || '').trim()
  const balance = Number(formData.get('balance') || 0)
  const specialBalance = Number(formData.get('specialBalance') || 0)
  const loanBalance = Number(formData.get('loanBalance') || 0)
  const voucherEnabled = String(formData.get('voucherEnabled') || 'true') === 'true'

  if (!memberId) redirect('/dashboard/directory')
  if (!staffId || !/^[A-Z0-9-]+$/.test(staffId)) {
    redirect(`/dashboard/directory/${encodeURIComponent(memberId)}?error=invalid_staff`)
  }
  if (!Number.isFinite(monthlyContribution) || monthlyContribution < 0) {
    redirect(`/dashboard/directory/${encodeURIComponent(memberId)}?error=save_failed`)
  }
  if (!Number.isFinite(specialContribution) || specialContribution < 0) {
    redirect(`/dashboard/directory/${encodeURIComponent(memberId)}?error=save_failed`)
  }
  if (!Number.isFinite(balance) || balance < 0) {
    redirect(`/dashboard/directory/${encodeURIComponent(memberId)}?error=save_failed`)
  }
  if (!Number.isFinite(specialBalance) || specialBalance < 0) {
    redirect(`/dashboard/directory/${encodeURIComponent(memberId)}?error=save_failed`)
  }
  if (!Number.isFinite(loanBalance) || loanBalance < 0) {
    redirect(`/dashboard/directory/${encodeURIComponent(memberId)}?error=save_failed`)
  }

  const conflictingStaffId = await prisma.user.findFirst({
    where: {
      staffId,
      NOT: { id: memberId },
    },
    select: { id: true },
  })
  if (conflictingStaffId) {
    redirect(`/dashboard/directory/${encodeURIComponent(memberId)}?error=duplicate_staff`)
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: memberId },
        data: {
          staffId,
          department: department || null,
          monthlyContribution,
          specialContribution,
          balance,
          specialBalance,
          loanBalance,
          totalContributions: balance + specialBalance,
          voucherEnabled,
        },
      })

      await tx.voucher.updateMany({
        where: { userId: memberId },
        data: {
          staffId,
          department: department || 'N/A',
          monthlyDeduction: monthlyContribution + specialContribution,
        },
      })
    })
  } catch {
    redirect(`/dashboard/directory/${encodeURIComponent(memberId)}?error=save_failed`)
  }

  revalidatePath(`/dashboard/directory/${memberId}`)
  revalidatePath('/dashboard/directory')
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/vouchers')
  revalidatePath('/dashboard/finance-report')
  revalidatePath('/dashboard/member-data')
  redirect(`/dashboard/directory/${encodeURIComponent(memberId)}?saved=1`)
}

async function deleteMemberRecord(formData: FormData) {
  'use server'

  const session = await getServerSession(authOptions)
  if (session?.user?.role !== 'ADMIN') redirect('/dashboard')

  const memberId = String(formData.get('memberId') || '')
  if (!memberId) redirect('/dashboard/directory?deleteError=1')

  const deleted = await prisma.user.deleteMany({
    where: {
      id: memberId,
      role: 'MEMBER',
    },
  })

  if (deleted.count < 1) {
    redirect('/dashboard/directory?deleteError=1')
  }

  revalidatePath('/dashboard/directory')
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/vouchers')
  revalidatePath('/dashboard/finance-report')
  revalidatePath('/dashboard/member-data')
  redirect('/dashboard/directory?deleted=1')
}

async function updateMemberPrivileges(formData: FormData) {
  'use server'

  const session = await getServerSession(authOptions)
  if (session?.user?.role !== 'ADMIN') redirect('/dashboard')

  const memberId = String(formData.get('memberId') || '')
  if (!memberId) redirect('/dashboard/directory')

  const selectedPrivileges = MANAGEABLE_PRIVILEGES.filter((code) => String(formData.get(code) || '') === 'on')

  try {
    await prisma.$transaction(async (tx) => {
      await tx.memberPrivilege.deleteMany({
        where: {
          userId: memberId,
          code: { notIn: selectedPrivileges },
        },
      })

      for (const code of selectedPrivileges) {
        await tx.memberPrivilege.upsert({
          where: {
            userId_code: {
              userId: memberId,
              code,
            },
          },
          update: {
            grantedById: session.user.id,
            note: 'Granted from admin member editor',
          },
          create: {
            userId: memberId,
            code,
            grantedById: session.user.id,
            note: 'Granted from admin member editor',
          },
        })
      }
    })
  } catch {
    redirect(`/dashboard/directory/${encodeURIComponent(memberId)}?error=save_failed`)
  }

  revalidatePath(`/dashboard/directory/${memberId}`)
  revalidatePath('/dashboard/directory')
  revalidatePath('/dashboard')
  redirect(`/dashboard/directory/${encodeURIComponent(memberId)}?saved=1`)
}

export default async function MemberProfileEditorPage({
  params,
  searchParams,
}: {
  params: { memberId: string }
  searchParams?: SearchParams
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) redirect('/login')
  if (!session.user.id || !(await canAccessWithPrivileges({ id: session.user.id, role: session.user.role }, PRIVILEGE_CODES.EDIT_MEMBERS))) redirect('/dashboard')
  const isFullAdmin = session.user.role === 'ADMIN'

  const member = await prisma.user.findUnique({
    where: { id: params.memberId },
      select: {
      id: true,
      name: true,
      staffId: true,
      phone: true,
      department: true,
      bankName: true,
      bankAccountNumber: true,
      bankAccountName: true,
      monthlyContribution: true,
      specialContribution: true,
      balance: true,
      specialBalance: true,
      totalContributions: true,
      loanBalance: true,
      status: true,
      voucherEnabled: true,
      privileges: {
        select: {
          code: true,
        },
      },
    },
  })

  if (!member) redirect('/dashboard/directory')
  const justSaved = searchParams?.saved === '1'
  const saveError = mapSaveError(searchParams?.error)

  return (
    <div className="animate-fadeIn space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Member Profile (Admin Edit)</h1>
          <p className="mt-1 text-gray-500">Open any member profile and manually correct savings/loan records.</p>
        </div>
        <Link
          href="/dashboard/directory"
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Back to Directory
        </Link>
      </div>

      {searchParams?.saved === '1' && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Saved changes for {member.name || 'member'}.
        </div>
      )}
      {saveError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {saveError}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">{member.name || 'Unnamed Member'}</h2>
        <div className="mt-4 grid grid-cols-1 gap-2 text-sm text-gray-600 md:grid-cols-2">
          <p><span className="font-medium text-gray-800">Staff ID:</span> {member.staffId || 'N/A'}</p>
          <p><span className="font-medium text-gray-800">Department:</span> {member.department || 'N/A'}</p>
          <p><span className="font-medium text-gray-800">Phone:</span> {member.phone || 'N/A'}</p>
          <p><span className="font-medium text-gray-800">Bank:</span> {member.bankName || 'N/A'} / {member.bankAccountNumber || 'N/A'}</p>
          <p><span className="font-medium text-gray-800">Account Name:</span> {member.bankAccountName || 'N/A'}</p>
          <p><span className="font-medium text-gray-800">Current Savings:</span> {formatCurrency(member.balance)}</p>
          <p><span className="font-medium text-gray-800">Current Special Savings:</span> {formatCurrency(member.specialBalance || 0)}</p>
          <p><span className="font-medium text-gray-800">Current Loan Balance:</span> {formatCurrency(member.loanBalance)}</p>
          <p><span className="font-medium text-gray-800">Total Contributions:</span> {formatCurrency(member.totalContributions)}</p>
          <p><span className="font-medium text-gray-800">Status:</span> {member.status}</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Manual Correction</h2>
        <form action={updateMemberRecord} className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <input type="hidden" name="memberId" value={member.id} />

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Staff ID</label>
            <input
              name="staffId"
              required
              defaultValue={member.staffId || ''}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm uppercase outline-none focus:border-primary-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Department</label>
            <input
              name="department"
              defaultValue={member.department || ''}
              placeholder="e.g. Operations"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Monthly Savings Amount</label>
            <input
              type="number"
              min={0}
              step={1}
              name="monthlyContribution"
              defaultValue={member.monthlyContribution || 0}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Special Savings Amount</label>
            <input
              type="number"
              min={0}
              step={1}
              name="specialContribution"
              defaultValue={member.specialContribution || 0}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Savings Balance</label>
            <input
              type="number"
              min={0}
              step={1}
              name="balance"
              defaultValue={member.balance}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Special Savings Balance</label>
            <input
              type="number"
              min={0}
              step={1}
              name="specialBalance"
              defaultValue={member.specialBalance || 0}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Loan Status Amount (Outstanding)</label>
            <input
              type="number"
              min={0}
              step={1}
              name="loanBalance"
              defaultValue={member.loanBalance}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Include in Voucher</label>
            <select
              name="voucherEnabled"
              defaultValue={member.voucherEnabled ? 'true' : 'false'}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
            >
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors ${
                justSaved ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-gray-900 hover:bg-black'
              }`}
            >
              Save
            </button>
          </div>
        </form>

        {isFullAdmin && (
        <div className="mt-6 border-t border-gray-100 pt-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-gray-800">Special access</p>
              <p className="mt-1 text-xs text-gray-500">Grant targeted access to a member without making them a full admin.</p>
            </div>
          </div>

          <form action={updateMemberPrivileges} className="mt-4 space-y-4">
            <input type="hidden" name="memberId" value={member.id} />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {MANAGEABLE_PRIVILEGES.map((code) => (
                <label
                  key={code}
                  className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700"
                >
                  <input
                    type="checkbox"
                    name={code}
                    defaultChecked={member.privileges?.some((privilege) => privilege.code === code)}
                    className="mt-1 h-4 w-4 rounded border-gray-300"
                  />
                  <span>
                    <span className="block font-medium text-gray-900">{PRIVILEGE_LABELS[code]}</span>
                    <span className="block text-xs text-gray-500">{code}</span>
                  </span>
                </label>
              ))}
            </div>
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-black"
            >
              Save access
            </button>
          </form>
        </div>
        )}

        {isFullAdmin && (
        <div className="mt-6 border-t border-red-100 pt-5">
          <p className="text-sm font-medium text-gray-800">Danger Zone</p>
          <p className="mt-1 text-xs text-gray-500">Delete this member and all associated records.</p>
          <form action={deleteMemberRecord} className="mt-3">
            <input type="hidden" name="memberId" value={member.id} />
            <ConfirmDeleteButton memberName={member.name || 'this member'} />
          </form>
        </div>
        )}
      </div>
    </div>
  )
}
