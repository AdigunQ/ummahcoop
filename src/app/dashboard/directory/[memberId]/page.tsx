import Link from 'next/link'
import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatCurrency } from '@/lib/utils'
import ConfirmDeleteButton from './confirm-delete-button'
import { canAccessWithPrivileges, PRIVILEGE_CODES } from '@/lib/access'
import { getMemberFinanceSummary } from '@/lib/member-finance'

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

function revalidateMemberViews(memberId?: string) {
  if (memberId) revalidatePath(`/dashboard/directory/${memberId}`)

  // Member data is read by many dashboard pages. Invalidate the dashboard
  // layout so no sibling page keeps an older server-rendered snapshot.
  revalidatePath('/dashboard', 'layout')
}

function snapshotNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = Number(String(value ?? '').replace(/[,₦\s]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function snapshotStaffId(value: unknown): string {
  const raw = String(value ?? '').trim().replace(/\s+/g, '').toUpperCase()
  return /^\d+$/.test(raw) ? raw.padStart(6, '0') : raw
}

function syncLatestSnapshotRows(
  rows: unknown,
  previousStaffId: string,
  staffId: string,
  monthlyContribution: number,
  specialContribution: number,
): Prisma.InputJsonValue {
  if (!Array.isArray(rows)) return rows as Prisma.InputJsonValue

  return rows.map((rawRow) => {
    if (!rawRow || typeof rawRow !== 'object' || Array.isArray(rawRow)) return rawRow

    const row = { ...(rawRow as Record<string, unknown>) }
    const rowStaffId = snapshotStaffId(row['Employee No.'] ?? row['Staff ID'])
    if (rowStaffId !== previousStaffId && rowStaffId !== staffId) return row

    if ('Employee No.' in row || !('Staff ID' in row)) row['Employee No.'] = staffId
    if ('Staff ID' in row) row['Staff ID'] = staffId
    if ('Monthly Saving' in row) row['Monthly Saving'] = monthlyContribution
    if ('Thrift Savings' in row) row['Thrift Savings'] = monthlyContribution
    if ('Special Saving' in row) row['Special Saving'] = specialContribution
    if ('Special Savings' in row) row['Special Savings'] = specialContribution
    if ('Amount' in row) row.Amount = monthlyContribution + specialContribution

    const total =
      monthlyContribution +
      specialContribution +
      snapshotNumber(row.Loan) +
      snapshotNumber(row['Management Fee']) +
      snapshotNumber(row.Commodity) +
      snapshotNumber(row['Monthly Fee'] ?? row.Charges) +
      snapshotNumber(row['Form Fee'] ?? row['New Member Fee'])

    if ('Total' in row) row.Total = total
    if ('Expected Total' in row) row['Expected Total'] = total
    return row
  }) as Prisma.InputJsonValue
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
  const savingsPlan = String(formData.get('savingsPlan') || '').trim()
  const organization = String(formData.get('organization') || '').trim()
  const station = String(formData.get('station') || '').trim()
  const gradeLevel = String(formData.get('gradeLevel') || '').trim()
  const nextOfKinName = String(formData.get('nextOfKinName') || '').trim()
  const nextOfKinPhone = String(formData.get('nextOfKinPhone') || '').trim()
  const nextOfKinEmail = String(formData.get('nextOfKinEmail') || '').trim()
  const nextOfKinRelationship = String(formData.get('nextOfKinRelationship') || '').trim()
  const balance = Number(formData.get('balance') || 0)
  const specialBalance = Number(formData.get('specialBalance') || 0)
  const rawLoanBalance = formData.get('loanBalance')
  const loanBalance = rawLoanBalance === null ? null : Number(rawLoanBalance || 0)
  const loanPrincipal = Number(formData.get('loanPrincipal') || 0)
  const commodityPrincipal = Number(formData.get('commodityPrincipal') || 0)
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
  if (loanBalance !== null && (!Number.isFinite(loanBalance) || loanBalance < 0)) {
    redirect(`/dashboard/directory/${encodeURIComponent(memberId)}?error=save_failed`)
  }
  if (!Number.isFinite(loanPrincipal) || loanPrincipal < 0) {
    redirect(`/dashboard/directory/${encodeURIComponent(memberId)}?error=save_failed`)
  }
  if (!Number.isFinite(commodityPrincipal) || commodityPrincipal < 0) {
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
      const existingMember = await tx.user.findUnique({
        where: { id: memberId },
        select: { staffId: true },
      })
      if (!existingMember) throw new Error('Member not found')

      await tx.user.update({
        where: { id: memberId },
        data: {
          staffId,
          department: department || null,
          savingsPlan: savingsPlan || null,
          organization: organization || null,
          station: station || null,
          gradeLevel: gradeLevel || null,
          nextOfKinName: nextOfKinName || null,
          nextOfKinPhone: nextOfKinPhone || null,
          nextOfKinEmail: nextOfKinEmail || null,
          nextOfKinRelationship: nextOfKinRelationship || null,
          monthlyContribution,
          specialContribution,
          balance,
          specialBalance,
          loanPrincipal,
          commodityPrincipal,
          totalContributions: balance + specialBalance,
          voucherEnabled,
          ...(loanBalance === null ? {} : { loanBalance }),
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

      const latestSnapshot = await tx.memberDataMonth.findFirst({
        orderBy: { period: 'desc' },
        select: { id: true, rows: true },
      })
      if (latestSnapshot) {
        await tx.memberDataMonth.update({
          where: { id: latestSnapshot.id },
          data: {
            rows: syncLatestSnapshotRows(
              latestSnapshot.rows,
              snapshotStaffId(existingMember.staffId),
              staffId,
              monthlyContribution,
              specialContribution,
            ),
          },
        })
      }
    })
  } catch {
    redirect(`/dashboard/directory/${encodeURIComponent(memberId)}?error=save_failed`)
  }

  revalidateMemberViews(memberId)
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

  revalidateMemberViews()
  redirect('/dashboard/directory?deleted=1')
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
      savingsPlan: true,
      organization: true,
      station: true,
      gradeLevel: true,
      nextOfKinName: true,
      nextOfKinPhone: true,
      nextOfKinEmail: true,
      nextOfKinRelationship: true,
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
    },
  })

  if (!member) redirect('/dashboard/directory')
  const financeSummary = await getMemberFinanceSummary(member.id, member.staffId)
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
          <p><span className="font-medium text-gray-800">Savings Plan:</span> {member.savingsPlan || 'N/A'}</p>
          <p><span className="font-medium text-gray-800">Organization:</span> {member.organization || 'N/A'}</p>
          <p><span className="font-medium text-gray-800">Station:</span> {member.station || 'N/A'}</p>
          <p><span className="font-medium text-gray-800">Grade Level:</span> {member.gradeLevel || 'N/A'}</p>
          <p><span className="font-medium text-gray-800">Phone:</span> {member.phone || 'N/A'}</p>
          <p><span className="font-medium text-gray-800">Next of Kin:</span> {member.nextOfKinName || 'N/A'}</p>
          <p><span className="font-medium text-gray-800">Next of Kin Phone:</span> {member.nextOfKinPhone || 'N/A'}</p>
          <p><span className="font-medium text-gray-800">Next of Kin Email:</span> {member.nextOfKinEmail || 'N/A'}</p>
          <p><span className="font-medium text-gray-800">Relationship:</span> {member.nextOfKinRelationship || 'N/A'}</p>
          <p><span className="font-medium text-gray-800">Bank:</span> {member.bankName || 'N/A'} / {member.bankAccountNumber || 'N/A'}</p>
          <p><span className="font-medium text-gray-800">Account Name:</span> {member.bankAccountName || 'N/A'}</p>
          <p><span className="font-medium text-gray-800">Current Savings:</span> {formatCurrency(member.balance)}</p>
          <p><span className="font-medium text-gray-800">Current Special Savings:</span> {formatCurrency(member.specialBalance || 0)}</p>
          <p><span className="font-medium text-gray-800">Original Loan Given:</span> {formatCurrency(financeSummary.loanCollected)}</p>
          <p><span className="font-medium text-gray-800">Loan Paid So Far:</span> {formatCurrency(financeSummary.loanPaid)}</p>
          <p><span className="font-medium text-gray-800">Loan Outstanding:</span> {formatCurrency(financeSummary.loanOutstanding)}</p>
          <p><span className="font-medium text-gray-800">Original Commodity Cost:</span> {formatCurrency(financeSummary.commodityCollected)}</p>
          <p><span className="font-medium text-gray-800">Commodity Paid So Far:</span> {formatCurrency(financeSummary.commodityPaid)}</p>
          <p><span className="font-medium text-gray-800">Commodity Outstanding:</span> {formatCurrency(financeSummary.commodityOutstanding)}</p>
          <p><span className="font-medium text-gray-800">Total Contributions:</span> {formatCurrency(member.totalContributions)}</p>
          <p><span className="font-medium text-gray-800">Status:</span> {member.status}</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Manual Correction</h2>
        <p className="mt-1 text-sm text-gray-500">
          Enter the original amounts given to the member. Monthly deductions are read from Member Data, then paid and outstanding amounts are calculated automatically.
        </p>
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
            <label className="mb-1 block text-sm font-medium text-gray-700">Savings Plan</label>
            <select
              name="savingsPlan"
              defaultValue={member.savingsPlan || ''}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
            >
              <option value="">Not selected</option>
              <option value="THRIFT">Thrift savings</option>
              <option value="SPECIAL">Special savings</option>
              <option value="BOTH">Thrift + Special</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Organization</label>
            <input
              name="organization"
              defaultValue={member.organization || ''}
              placeholder="e.g. FAAN"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Station</label>
            <input
              name="station"
              defaultValue={member.station || ''}
              placeholder="e.g. Lagos"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Staff Grade Level</label>
            <input
              name="gradeLevel"
              defaultValue={member.gradeLevel || ''}
              placeholder="e.g. 08"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
          </div>

          <div className="md:col-span-2">
            <h3 className="border-b border-gray-100 pb-2 text-sm font-semibold text-gray-800">Next of Kin</h3>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
            <input
              name="nextOfKinName"
              defaultValue={member.nextOfKinName || ''}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Phone number</label>
            <input
              name="nextOfKinPhone"
              defaultValue={member.nextOfKinPhone || ''}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Email address</label>
            <input
              type="email"
              name="nextOfKinEmail"
              defaultValue={member.nextOfKinEmail || ''}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Relationship</label>
            <input
              name="nextOfKinRelationship"
              defaultValue={member.nextOfKinRelationship || ''}
              placeholder="e.g. Spouse"
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
            <label className="mb-1 block text-sm font-medium text-gray-700">Original Loan Amount Given</label>
            <input
              type="number"
              min={0}
              step={1}
              name="loanPrincipal"
              defaultValue={financeSummary.loanPrincipal}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
            <p className="mt-1 text-xs text-gray-500">Do not enter the monthly deduction here.</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Original Commodity Cost</label>
            <input
              type="number"
              min={0}
              step={1}
              name="commodityPrincipal"
              defaultValue={financeSummary.commodityPrincipal}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
            <p className="mt-1 text-xs text-gray-500">Do not enter the monthly deduction here.</p>
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
