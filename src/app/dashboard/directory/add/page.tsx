import { AdminHeading } from '@/components/admin/admin-ui'
import Link from 'next/link'
import bcrypt from 'bcryptjs'
import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { authOptions } from '@/lib/auth'
import { getInitialMemberPassword } from '@/lib/default-member-password'
import { prisma } from '@/lib/prisma'
import { canAccessWithPrivileges, PRIVILEGE_CODES } from '@/lib/access'

type SearchParams = {
  created?: string
  error?: string
}

function buildMemberEmail(staffId: string): string {
  const domain = (process.env.MEMBER_EMAIL_DOMAIN || 'faan-ummah.coop').trim().replace(/^@/, '')
  return `${staffId.toLowerCase()}@${domain.toLowerCase()}`
}

function normalizeStaffId(input: string): string {
  return input.trim().replace(/\s+/g, '').toUpperCase()
}

function mapError(error?: string): string | null {
  if (!error) return null
  if (error === 'invalid') return 'Please fill all required fields correctly.'
  if (error === 'duplicate_staff') return 'Staff ID already exists.'
  if (error === 'duplicate_email') return 'Generated email already exists for this Staff ID.'
  return 'Could not create member. Please try again.'
}

async function createMember(formData: FormData) {
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

  const staffId = normalizeStaffId(String(formData.get('staffId') || ''))
  const name = String(formData.get('name') || '').trim()
  const phone = String(formData.get('phone') || '').trim()
  const monthlyContribution = Number(formData.get('monthlyContribution') || 0)
  const specialContribution = Number(formData.get('specialContribution') || 0)

  if (!staffId || !name || !phone) redirect('/dashboard/directory/add?error=invalid')
  if (!/^[A-Z0-9-]+$/.test(staffId)) redirect('/dashboard/directory/add?error=invalid')
  if (!Number.isFinite(monthlyContribution) || monthlyContribution <= 0)
    redirect('/dashboard/directory/add?error=invalid')
  if (!Number.isFinite(specialContribution) || specialContribution < 0)
    redirect('/dashboard/directory/add?error=invalid')

  const email = buildMemberEmail(staffId)

  const existingByStaffId = await prisma.user.findUnique({
    where: { staffId },
    select: { id: true },
  })
  if (existingByStaffId) redirect('/dashboard/directory/add?error=duplicate_staff')

  const existingByEmail = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  })
  if (existingByEmail) redirect('/dashboard/directory/add?error=duplicate_email')

  const defaultPassword = getInitialMemberPassword(staffId)
  const passwordHash = await bcrypt.hash(defaultPassword, 10)

  const now = new Date()
  const effectiveStartDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          staffId,
          phone,
          password: passwordHash,
          role: 'MEMBER',
          status: 'ACTIVE',
          monthlyContribution,
          specialContribution,
          balance: 0,
          specialBalance: 0,
          totalContributions: 0,
          loanBalance: 0,
          voucherEnabled: true,
        },
      })

      await tx.voucher.create({
        data: {
          userId: user.id,
          fullName: user.name || 'Unnamed Member',
          staffId,
          department: 'N/A',
          monthlyDeduction: monthlyContribution + specialContribution,
          effectiveStartDate,
          status: 'GENERATED',
          notes:
            'Created by admin. New member fee (₦1,000) applies automatically in first report month.',
        },
      })
    })
  } catch {
    redirect('/dashboard/directory/add?error=failed')
  }

  revalidatePath('/dashboard/directory')
  revalidatePath('/dashboard/member-data')
  revalidatePath('/dashboard/vouchers')
  revalidatePath('/dashboard/finance-report')
  revalidatePath('/dashboard')
  redirect('/dashboard/directory/add?created=1')
}

export default async function AddMemberPage({ searchParams: searchParamsInput }: { searchParams?: Promise<SearchParams> }) {
  const searchParams = await searchParamsInput

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

  const error = mapError(searchParams?.error)
  const created = searchParams?.created === '1'

  return (
    <div className="admin-page">
      <AdminHeading
        section="Members & data"
        title="Add a member"
        description="Set up membership details and monthly contribution plans."
        actions={
          <Link href="/dashboard/directory" className="btn-ghost">
            Back to directory
          </Link>
        }
      />
      {created && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Member created successfully.
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <details className="admin-panel admin-form-note">
        <summary>How registration dates and fees are set</summary>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>Registration date = current date/time</li>
          <li>Month Joined = auto from registration date</li>
          <li>New Member FEE = ₦1,000 in first report month</li>
          <li>Monthly Charges / Total are computed in report export</li>
        </ul>
      </details>

      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <form action={createMember} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Staff ID</label>
            <input
              aria-label="Staff Id"
              name="staffId"
              required
              placeholder="e.g. 001234"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Name</label>
            <input
              aria-label="Name"
              name="name"
              required
              placeholder="Full name"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Thrift Savings</label>
            <input
              aria-label="Monthly Contribution"
              name="monthlyContribution"
              type="number"
              min={1}
              step={1}
              required
              defaultValue={10000}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Special Saving</label>
            <input
              aria-label="Special Contribution"
              name="specialContribution"
              type="number"
              min={0}
              step={1}
              defaultValue={0}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-foreground">Phone</label>
            <input
              aria-label="Phone"
              name="phone"
              required
              placeholder="e.g. 08012345678"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-black"
            >
              Add member
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
