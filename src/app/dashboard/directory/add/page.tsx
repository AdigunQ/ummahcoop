import Link from 'next/link'
import bcrypt from 'bcryptjs'
import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { authOptions } from '@/lib/auth'
import { getDefaultMemberPassword } from '@/lib/default-member-password'
import { prisma } from '@/lib/prisma'

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
  if (session?.user?.role !== 'ADMIN') redirect('/dashboard')

  const staffId = normalizeStaffId(String(formData.get('staffId') || ''))
  const name = String(formData.get('name') || '').trim()
  const phone = String(formData.get('phone') || '').trim()
  const monthlyContribution = Number(formData.get('monthlyContribution') || 0)
  const specialContribution = Number(formData.get('specialContribution') || 0)

  if (!staffId || !name || !phone) redirect('/dashboard/directory/add?error=invalid')
  if (!/^[A-Z0-9-]+$/.test(staffId)) redirect('/dashboard/directory/add?error=invalid')
  if (!Number.isFinite(monthlyContribution) || monthlyContribution <= 0) redirect('/dashboard/directory/add?error=invalid')
  if (!Number.isFinite(specialContribution) || specialContribution < 0) redirect('/dashboard/directory/add?error=invalid')

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

  let defaultPassword: string
  try {
    defaultPassword = getDefaultMemberPassword()
  } catch {
    redirect('/dashboard/directory/add?error=failed')
  }
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
          notes: 'Created by admin. New member fee (₦1,000) applies automatically in first report month.',
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

export default async function AddMemberPage({ searchParams }: { searchParams?: SearchParams }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) redirect('/login')
  if (session.user.role !== 'ADMIN') redirect('/dashboard')

  const error = mapError(searchParams?.error)
  const created = searchParams?.created === '1'

  return (
    <div className="animate-fadeIn space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Add new member</h1>
          <p className="mt-1 text-gray-500">
            Enter Feb-2026 style fields only. Registration date and new member fee are handled automatically.
          </p>
        </div>
        <Link
          href="/dashboard/directory"
          className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
        >
          Back to Update Member
        </Link>
      </div>

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

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <p className="font-semibold">Auto-handled fields</p>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>Registration date = current date/time</li>
          <li>Month Joined = auto from registration date</li>
          <li>New Member FEE = ₦1,000 in first report month</li>
          <li>Monthly Charges / Total are computed in report export</li>
        </ul>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <form action={createMember} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Staff ID</label>
            <input
              name="staffId"
              required
              placeholder="e.g. 001234"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
            <input
              name="name"
              required
              placeholder="Full name"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Thrift Savings</label>
            <input
              name="monthlyContribution"
              type="number"
              min={1}
              step={1}
              required
              defaultValue={10000}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Special Saving</label>
            <input
              name="specialContribution"
              type="number"
              min={0}
              step={1}
              defaultValue={0}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">Phone</label>
            <input
              name="phone"
              required
              placeholder="e.g. 08012345678"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
            >
              Add member
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
