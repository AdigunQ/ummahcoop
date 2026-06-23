import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatCurrency, formatDateTime } from '@/lib/utils'

function resolveBank(
  useProfileBank: boolean,
  formData: FormData,
  profile: { bankName: string | null; bankAccountNumber: string | null; bankAccountName: string | null }
) {
  if (useProfileBank) {
    if (!profile.bankName || !profile.bankAccountNumber || !profile.bankAccountName) return null
    return {
      bankName: profile.bankName,
      bankAccountNumber: profile.bankAccountNumber,
      bankAccountName: profile.bankAccountName,
    }
  }

  const bankName = String(formData.get('payoutBankName') || '').trim()
  const bankAccountNumber = String(formData.get('payoutAccountNumber') || '').trim()
  const bankAccountName = String(formData.get('payoutAccountName') || '').trim()
  if (!bankName || !bankAccountName || bankAccountNumber.length < 10) return null
  return { bankName, bankAccountNumber, bankAccountName }
}

async function requestAccountClosure(formData: FormData) {
  'use server'

  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'MEMBER') {
    redirect('/dashboard')
  }

  const consent = String(formData.get('consent') || '')
  const reason = String(formData.get('reason') || '').trim()
  const useProfileBank = String(formData.get('useProfileBank') || 'yes') === 'yes'
  if (consent !== 'yes') return

  const member = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      status: true,
      balance: true,
      loanBalance: true,
      bankName: true,
      bankAccountNumber: true,
      bankAccountName: true,
      loans: {
        where: { status: 'APPROVED', balance: { gt: 0 } },
        select: { id: true },
      },
    },
  })
  if (!member) return
  if (member.loanBalance > 0 || member.loans.length > 0) return

  const existing = await prisma.withdrawal.findFirst({
    where: {
      userId: member.id,
      type: 'FULL_DISCONTINUATION',
      status: { in: ['PENDING', 'APPROVED'] },
    },
    select: { id: true },
  })
  if (existing) return

  const payout = resolveBank(useProfileBank, formData, member)
  if (!payout) return

  await prisma.withdrawal.create({
    data: {
      userId: member.id,
      type: 'FULL_DISCONTINUATION',
      requestedAmount: member.balance,
      reason:
        reason ||
        'Member requested full membership discontinuation. Member understands settlement can take up to 3 months after admin approval.',
      status: 'PENDING',
      useProfileBank,
      payoutBankName: payout.bankName,
      payoutAccountNumber: payout.bankAccountNumber,
      payoutAccountName: payout.bankAccountName,
    },
  })

  revalidatePath('/dashboard/delete-account')
  revalidatePath('/dashboard/withdrawals')
}

export default async function DeleteAccountPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !session.user.email) redirect('/login')
  if (session.user.role !== 'MEMBER') redirect('/dashboard')

  const member = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      bankName: true,
      bankAccountNumber: true,
      bankAccountName: true,
      balance: true,
      loanBalance: true,
      withdrawals: {
        where: { type: 'FULL_DISCONTINUATION' },
        orderBy: { requestedAt: 'desc' },
        take: 6,
      },
    },
  })
  if (!member) redirect('/login')

  const outstandingLoan = member.loanBalance > 0
  const hasPendingClosure = member.withdrawals.some((w) => w.status === 'PENDING')

  return (
    <div className="animate-fadeIn space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Delete Account</h1>
        <p className="mt-1 text-gray-500">
          Request full membership withdrawal. You must clear all outstanding loans first.
        </p>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        <p className="font-semibold">Important terms</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>You must pay all outstanding loans before account closure request can proceed.</li>
          <li>After admin approval, settlement can take up to 3 months.</li>
          <li>Your outstanding savings balance will be paid to your selected bank account.</li>
        </ul>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Closure Request Form</h2>
          <p className="mt-1 text-sm text-gray-500">
            Current savings balance: {formatCurrency(member.balance)} · Outstanding loan: {formatCurrency(member.loanBalance)}
          </p>
          {outstandingLoan && (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              You cannot submit account deletion while loan balance is outstanding.
            </p>
          )}
          {hasPendingClosure && (
            <p className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
              You already have an active closure request under review.
            </p>
          )}

          <form action={requestAccountClosure} className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Payout Account Choice</label>
              <select
                name="useProfileBank"
                defaultValue="yes"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
                disabled={outstandingLoan || hasPendingClosure}
              >
                <option value="yes">Use profile bank account</option>
                <option value="no">Enter a new payout account</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Profile bank: {member.bankName || 'N/A'} / {member.bankAccountNumber || 'N/A'} / {member.bankAccountName || 'N/A'}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <input
                name="payoutBankName"
                type="text"
                placeholder="New bank name"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
                disabled={outstandingLoan || hasPendingClosure}
              />
              <input
                name="payoutAccountNumber"
                type="text"
                placeholder="New account number"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
                disabled={outstandingLoan || hasPendingClosure}
              />
              <input
                name="payoutAccountName"
                type="text"
                placeholder="New account name"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
                disabled={outstandingLoan || hasPendingClosure}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Reason</label>
              <textarea
                name="reason"
                rows={3}
                placeholder="Optional reason for account closure"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
                disabled={outstandingLoan || hasPendingClosure}
              />
            </div>

            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                name="consent"
                value="yes"
                className="mt-1 h-4 w-4 rounded border-gray-300"
                disabled={outstandingLoan || hasPendingClosure}
              />
              I consent to full membership withdrawal, understand the up-to-3-month settlement timeline, and confirm my payout bank details are correct.
            </label>

            <button
              type="submit"
              disabled={outstandingLoan || hasPendingClosure}
              className="w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              Submit Account Deletion Request
            </button>
          </form>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Closure Request History</h2>
          </div>
          {member.withdrawals.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">No account closure request yet.</div>
          ) : (
            <div className="divide-y divide-gray-200">
              {member.withdrawals.map((row) => (
                <div key={row.id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-900">{formatCurrency(row.requestedAmount)}</p>
                    <StatusBadge status={row.status} />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Requested: {formatDateTime(row.requestedAt)}</p>
                  {row.reviewedAt && <p className="text-xs text-gray-500">Reviewed: {formatDateTime(row.reviewedAt)}</p>}
                  {row.closureDate && <p className="text-xs text-gray-500">Settlement target date: {formatDateTime(row.closureDate)}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    APPROVED: 'bg-green-100 text-green-800',
    REJECTED: 'bg-red-100 text-red-800',
  }
  return (
    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  )
}
