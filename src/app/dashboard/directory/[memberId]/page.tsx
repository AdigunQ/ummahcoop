import { SectionedForm } from '@/components/ui/sectioned-form'
import { AdminHeading, AdminStats } from '@/components/admin/admin-ui'
import {
  DEPARTMENT_OPTIONS,
  GRADE_LEVEL_OPTIONS,
  ORGANIZATION_OPTIONS,
  STATION_OPTIONS,
} from '@/lib/profile-options'
import { FormSelect } from '@/components/ui/smart-select'
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
import { resolveContributionPlans } from '@/lib/contribution-plans'

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
  if (error === 'savings_history') return 'This member has savings-change review history and cannot be permanently deleted.'
  return 'Could not save this profile.'
}

function revalidateMemberViews(memberId?: string) {
  if (memberId) revalidatePath(`/dashboard/directory/${memberId}`)

  // Member data is read by many dashboard pages. Invalidate the dashboard
  // layout so no sibling page keeps an older server-rendered snapshot.
  revalidatePath('/dashboard', 'layout')
}

function snapshotStaffId(value: unknown): string {
  const raw = String(value ?? '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase()
  return /^\d+$/.test(raw) ? raw.padStart(6, '0') : raw
}

function syncLatestSnapshotRows(
  rows: unknown,
  previousStaffId: string,
  staffId: string
): Prisma.InputJsonValue {
  if (!Array.isArray(rows)) return rows as Prisma.InputJsonValue

  return rows.map((rawRow) => {
    if (!rawRow || typeof rawRow !== 'object' || Array.isArray(rawRow)) return rawRow

    const row = { ...(rawRow as Record<string, unknown>) }
    const rowStaffId = snapshotStaffId(row['Employee No.'] ?? row['Staff ID'])
    if (rowStaffId !== previousStaffId && rowStaffId !== staffId) return row

    if ('Employee No.' in row || !('Staff ID' in row)) row['Employee No.'] = staffId
    if ('Staff ID' in row) row['Staff ID'] = staffId
    return row
  }) as Prisma.InputJsonValue
}

async function updateMemberRecord(formData: FormData) {
  'use server'

  const session = await getServerSession(authOptions)
  if (
    !session?.user?.id ||
    !(await canAccessWithPrivileges(
      { id: session.user.id, role: session.user.role },
      PRIVILEGE_CODES.EDIT_MEMBERS
    ))
  )
    redirect('/dashboard')

  const memberId = String(formData.get('memberId') || '')
  const staffId = normalizeStaffId(String(formData.get('staffId') || ''))
  const department = String(formData.get('department') || '').trim()
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
          organization: organization || null,
          station: station || null,
          gradeLevel: gradeLevel || null,
          nextOfKinName: nextOfKinName || null,
          nextOfKinPhone: nextOfKinPhone || null,
          nextOfKinEmail: nextOfKinEmail || null,
          nextOfKinRelationship: nextOfKinRelationship || null,
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
        },
      })

      const latestSnapshot = await tx.memberDataMonth.findFirst({
        orderBy: { period: 'desc' },
        select: { id: true, rows: true },
      })
      if (latestSnapshot && snapshotStaffId(existingMember.staffId) !== staffId) {
        await tx.memberDataMonth.update({
          where: { id: latestSnapshot.id },
          data: {
            rows: syncLatestSnapshotRows(
              latestSnapshot.rows,
              snapshotStaffId(existingMember.staffId),
              staffId
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
  if (await prisma.savingsChangeRequest.count({ where: { userId: memberId } })) {
    redirect(`/dashboard/directory/${encodeURIComponent(memberId)}?error=savings_history`)
  }

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
  params: paramsInput,
  searchParams: searchParamsInput,
}: {
  params: Promise<{ memberId: string }>
  searchParams?: Promise<SearchParams>
}) {
  const searchParams = await searchParamsInput
  const params = await paramsInput

  const session = await getServerSession(authOptions)
  if (!session?.user?.email) redirect('/login')
  if (
    !session.user.id ||
    !(await canAccessWithPrivileges(
      { id: session.user.id, role: session.user.role },
      PRIVILEGE_CODES.EDIT_MEMBERS
    ))
  )
    redirect('/dashboard')
  const isFullAdmin = session.user.role === 'ADMIN'

  let member = await prisma.user.findUnique({
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
  ;[member] = await resolveContributionPlans([member])
  const financeSummary = await getMemberFinanceSummary(member.id, member.staffId)
  const justSaved = searchParams?.saved === '1'
  const saveError = mapSaveError(searchParams?.error)

  return (
    <div className="admin-page">
      <AdminHeading
        section="Members & data"
        title={member.name || 'Member profile'}
        description={`Staff ID ${member.staffId || 'Not assigned'} · Manage membership details and financial records.`}
        actions={
          <Link href="/dashboard/directory" className="btn-ghost">
            Back to directory
          </Link>
        }
      />
      {justSaved && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900"
        >
          Changes saved for {member.name || 'this member'}.
        </div>
      )}
      {saveError && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700"
        >
          {saveError}
        </div>
      )}
      <AdminStats
        items={[
          {
            label: 'Savings balance',
            value: formatCurrency(member.balance + member.specialBalance),
            note: `Thrift ${formatCurrency(member.balance)} · Special ${formatCurrency(member.specialBalance)}`,
          },
          {
            label: 'Loan outstanding',
            value: formatCurrency(financeSummary.loanOutstanding),
            note: `${formatCurrency(financeSummary.loanPaid)} repaid of ${formatCurrency(financeSummary.loanCollected)}`,
          },
          {
            label: 'Commodity outstanding',
            value: formatCurrency(financeSummary.commodityOutstanding),
            note: `${formatCurrency(financeSummary.commodityPaid)} repaid of ${formatCurrency(financeSummary.commodityCollected)}`,
          },
        ]}
      />
      <SectionedForm
        key={member.id}
        action={updateMemberRecord}
        hiddenFields={<input type="hidden" name="memberId" value={member.id} />}
        note="Review all amounts carefully. Saving updates this member's records."
        sections={[
          {
            id: 'employment',
            label: 'Membership & work',
            description: 'Keep this member’s staff details and employment information current.',
            content: (
              <>
                <EditField label="Staff ID" name="staffId" value={member.staffId || ''} required />
                <EditChoice
                  label="Organization"
                  name="organization"
                  value={member.organization || ''}
                  options={ORGANIZATION_OPTIONS}
                />
                <EditChoice
                  label="Department"
                  name="department"
                  value={member.department || ''}
                  options={DEPARTMENT_OPTIONS}
                />
                <EditChoice
                  label="Grade level"
                  name="gradeLevel"
                  value={member.gradeLevel || ''}
                  options={GRADE_LEVEL_OPTIONS}
                />
                <div className="sm:col-span-2">
                  <EditChoice
                    label="Station"
                    name="station"
                    value={member.station || ''}
                    options={STATION_OPTIONS}
                  />
                </div>
              </>
            ),
          },
          {
            id: 'kin',
            label: 'Next of kin',
            description: 'The person the cooperative can contact on behalf of this member.',
            content: (
              <>
                <EditField
                  label="Full name"
                  name="nextOfKinName"
                  value={member.nextOfKinName || ''}
                />
                <EditField
                  label="Relationship"
                  name="nextOfKinRelationship"
                  value={member.nextOfKinRelationship || ''}
                />
                <EditField
                  label="Phone number"
                  name="nextOfKinPhone"
                  value={member.nextOfKinPhone || ''}
                  type="tel"
                />
                <EditField
                  label="Email address"
                  name="nextOfKinEmail"
                  value={member.nextOfKinEmail || ''}
                  type="email"
                />
              </>
            ),
          },
          {
            id: 'savings',
            label: 'Savings',
            description:
              'Contribution amounts are monthly deductions. Savings balances are the amounts already held for this member. These are different values.',
            content: (
              <>
                <div><p className="text-sm text-muted-foreground">Current monthly thrift</p><p className="font-semibold">{formatCurrency(member.monthlyContribution || 0)}</p></div>
                <div><p className="text-sm text-muted-foreground">Current monthly special</p><p className="font-semibold">{formatCurrency(member.specialContribution || 0)}</p></div>
                <p className="sm:col-span-2 text-sm leading-7">Members can request a new monthly amount from their account.{' '}
                  <Link href="/dashboard/savings-changes" className="admin-inline-link">Review savings changes</Link>{' '}
                  to approve an effective month without changing past deductions.
                </p>
                <EditField
                  label="Thrift savings balance"
                  name="balance"
                  value={member.balance}
                  type="number"
                />
                <EditField
                  label="Special savings balance"
                  name="specialBalance"
                  value={member.specialBalance || 0}
                  type="number"
                />
                <div className="sm:col-span-2">
                  <label className="mb-2.5 block text-xs font-medium">Include in voucher</label>
                  <FormSelect
                    name="voucherEnabled"
                    aria-label="Include in voucher"
                    defaultValue={member.voucherEnabled ? 'true' : 'false'}
                  >
                    <option value="true">Yes, include this member</option>
                    <option value="false">No, exclude this member</option>
                  </FormSelect>
                </div>
              </>
            ),
          },
          {
            id: 'credit',
            label: 'Loans & commodity',
            description:
              'Record the original loan amount or commodity cost here, not a monthly deduction. Repayments come from Member Data; outstanding balances are calculated automatically.',
            content: (
              <>
                <EditField
                  label="Original loan amount given"
                  name="loanPrincipal"
                  value={financeSummary.loanPrincipal}
                  type="number"
                />
                <EditField
                  label="Original commodity cost"
                  name="commodityPrincipal"
                  value={financeSummary.commodityPrincipal}
                  type="number"
                />
                <div className="settings-note sm:col-span-2 !mt-0">
                  Monthly loan and commodity deductions are managed in Member Data. Do not subtract
                  repayments from the original amounts above.
                </div>
              </>
            ),
          },
        ]}
      />
      <details className="card p-5">
        <summary className="cursor-pointer text-sm font-medium">
          Contact & payout details{' '}
          <span className="ml-2 text-xs font-normal text-muted-foreground">View only</span>
        </summary>
        <dl className="mt-5 grid gap-5 text-sm sm:grid-cols-2">
          {[
            ['Phone', member.phone],
            ['Bank', member.bankName],
            ['Account number', member.bankAccountNumber],
            ['Account name', member.bankAccountName],
            ['Total contributions', formatCurrency(member.totalContributions)],
            ['Membership status', member.status],
          ].map(([label, value]) => (
            <div key={label || ''}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="mt-1.5">{value || 'Not provided'}</dd>
            </div>
          ))}
        </dl>
      </details>
      {isFullAdmin && (
        <details className="rounded-xl border border-rose-200 p-5">
          <summary className="cursor-pointer text-sm font-medium text-rose-700">
            Delete membership
          </summary>
          <p className="mt-3 text-xs leading-6 text-muted-foreground">
            Permanently delete this member and all associated records. This cannot be undone.
          </p>
          <form action={deleteMemberRecord} className="mt-4">
            <input type="hidden" name="memberId" value={member.id} />
            <ConfirmDeleteButton memberName={member.name || 'this member'} />
          </form>
        </details>
      )}
    </div>
  )
}
function EditField({
  label,
  name,
  value,
  type = 'text',
  required = false,
}: {
  label: string
  name: string
  value: string | number
  type?: string
  required?: boolean
}) {
  return (
    <div>
      <label htmlFor={`member-${name}`} className="mb-2.5 block text-xs font-medium">
        {label}
      </label>
      <input
        id={`member-${name}`}
        name={name}
        defaultValue={value}
        type={type}
        min={type === 'number' ? 0 : undefined}
        step={type === 'number' ? 1 : undefined}
        required={required}
        className="settings-input"
      />
    </div>
  )
}
function EditChoice({
  label,
  name,
  value,
  options,
}: {
  label: string
  name: string
  value: string
  options: readonly string[]
}) {
  return (
    <div>
      <p className="mb-2.5 text-xs font-medium">{label}</p>
      <FormSelect name={name} aria-label={label} defaultValue={value}>
        <option value="">Not provided</option>
        {value && !options.includes(value) && <option value={value}>{value}</option>}
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </FormSelect>
    </div>
  )
}
