import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { canAccessWithPrivileges, PRIVILEGE_CODES } from '@/lib/access'

async function submitCommodityRequest(formData: FormData) {
  'use server'

  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'MEMBER') {
    redirect('/dashboard')
  }

  const requestText = String(formData.get('requestText') || '').trim()

  if (!requestText) {
    return
  }

  await prisma.commodityRequest.create({
    data: {
      userId: session.user.id,
      itemCategory: 'Commodity request',
      itemModel: 'Open Request',
      preferredBudget: 0,
      preferredMonths: 0,
      contactPreference: 'BOTH',
      notes: requestText,
      status: 'PENDING',
    },
  })

  revalidatePath('/dashboard/commodity')
}

async function reviewCommodityRequest(formData: FormData) {
  'use server'

  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !(await canAccessWithPrivileges({ id: session.user.id, role: session.user.role }, PRIVILEGE_CODES.REVIEW_COMMODITY))) {
    redirect('/dashboard')
  }

  const requestId = String(formData.get('requestId') || '')
  const action = String(formData.get('action') || '')
  const adminQuotedPrice = Number(formData.get('adminQuotedPrice') || 0)
  const adminApprovedMonths = Number(formData.get('adminApprovedMonths') || 0)
  const adminFeedback = String(formData.get('adminFeedback') || '').trim()

  if (!requestId || !['offer', 'approve', 'reject'].includes(action)) {
    return
  }

  const reviewedBy = session.user.name || session.user.email || 'Admin'
  const now = new Date()

  if (action === 'reject') {
    await prisma.commodityRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        adminFeedback: adminFeedback || 'Request declined after review.',
        reviewedBy,
        reviewedAt: now,
      },
    })
    revalidatePath('/dashboard/commodity')
    return
  }

  if (!Number.isFinite(adminQuotedPrice) || adminQuotedPrice <= 0) {
    return
  }

  const months = Number.isFinite(adminApprovedMonths) && adminApprovedMonths >= 3 && adminApprovedMonths <= 24
    ? adminApprovedMonths
    : 6
  const monthly = adminQuotedPrice / months

  await prisma.commodityRequest.update({
    where: { id: requestId },
    data: {
      status: action === 'offer' ? 'OFFERED' : 'APPROVED',
      adminQuotedPrice,
      adminApprovedMonths: months,
      adminMonthlyRepayment: monthly,
      adminFeedback: adminFeedback || (action === 'offer'
        ? 'Offer prepared. Contact member for agreement.'
        : 'Commodity request approved on agreed terms.'),
      reviewedBy,
      reviewedAt: now,
    },
  })

  revalidatePath('/dashboard/commodity')
}

export default async function CommodityPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.email || !session.user.id) {
    redirect('/login')
  }

  if (await canAccessWithPrivileges({ id: session.user.id, role: session.user.role }, PRIVILEGE_CODES.REVIEW_COMMODITY)) {
    const [pending, reviewed] = await Promise.all([
      prisma.commodityRequest.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        include: {
          user: {
            select: {
              name: true,
              email: true,
              phone: true,
              staffId: true,
              department: true,
            },
          },
        },
      }),
      prisma.commodityRequest.findMany({
        where: { status: { in: ['OFFERED', 'APPROVED', 'REJECTED'] } },
        orderBy: { reviewedAt: 'desc' },
        take: 12,
        include: {
          user: { select: { name: true, email: true } },
        },
      }),
    ])

    return (
      <div className="animate-fadeIn space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Commodity Requests</h1>
          <p className="mt-1 text-gray-500">
            Review requests for TVs, phones, and other items. Quote pricing and repayment terms, then follow up by email/WhatsApp.
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Pending Requests</h2>
          </div>
          {pending.length === 0 ? (
            <div className="px-6 py-10 text-center text-gray-500">No pending commodity requests.</div>
          ) : (
            <div className="divide-y divide-gray-200">
              {pending.map((request) => (
                <div key={request.id} className="px-6 py-5">
                  <div className="mb-3">
                    <p className="text-lg font-semibold text-gray-900">{request.user?.name || 'Unknown Member'}</p>
                    <p className="text-sm text-gray-600">
                      {request.user?.email} · {request.user?.phone || 'No phone'} · Staff ID: {request.user?.staffId || 'N/A'}
                    </p>
                    <p className="text-sm text-gray-500">{request.itemCategory}</p>
                    {request.notes && <p className="text-sm text-gray-500">Member note: {request.notes}</p>}
                  </div>

                  <form action={reviewCommodityRequest} className="grid grid-cols-1 gap-3 md:grid-cols-4">
                    <input type="hidden" name="requestId" value={request.id} />
                    <input
                      name="adminQuotedPrice"
                      type="number"
                      min={1000}
                      step={1000}
                      placeholder="Quoted price"
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
                    />
                    <input
                      name="adminApprovedMonths"
                      type="number"
                      min={3}
                      max={24}
                      placeholder="Months"
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
                    />
                    <input
                      name="adminFeedback"
                      type="text"
                      placeholder="Feedback / next steps"
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
                    />
                    <div className="flex gap-2">
                      <button
                        name="action"
                        value="offer"
                        className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
                        type="submit"
                      >
                        Send Offer
                      </button>
                      <button
                        name="action"
                        value="approve"
                        className="rounded-lg bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-700"
                        type="submit"
                      >
                        Approve
                      </button>
                      <button
                        name="action"
                        value="reject"
                        className="rounded-lg bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700"
                        type="submit"
                      >
                        Reject
                      </button>
                    </div>
                  </form>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Commodity Decisions</h2>
          </div>
          {reviewed.length === 0 ? (
            <div className="px-6 py-10 text-center text-gray-500">No decisions yet.</div>
          ) : (
            <div className="divide-y divide-gray-200">
              {reviewed.map((request) => (
                <div key={request.id} className="flex flex-col gap-2 px-6 py-4 text-sm md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{request.user?.name || 'Unknown Member'}</p>
                    <p className="text-gray-500">{request.itemCategory} · {request.itemModel}</p>
                    {request.adminQuotedPrice && (
                      <p className="text-gray-500">
                        Offer: {formatCurrency(request.adminQuotedPrice)} / {request.adminApprovedMonths || '-'} months
                        {request.adminMonthlyRepayment ? ` (${formatCurrency(request.adminMonthlyRepayment)} monthly)` : ''}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <StatusBadge status={request.status} />
                    <p className="text-xs text-gray-500 mt-1">{request.reviewedAt ? formatDateTime(request.reviewedAt) : '-'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  const requests = await prisma.commodityRequest.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: 12,
  })

  return (
    <div className="animate-fadeIn space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Commodity Request</h1>
        <p className="mt-1 text-gray-500">
          Request anything you want from the cooperative. Your form goes directly to admin for review.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">New Commodity Request</h2>
          <form action={submitCommodityRequest} className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">What do you want?</label>
              <textarea
                name="requestText"
                rows={5}
                placeholder="Write exactly what you need. Admin will see it and follow up."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
            >
              Submit Commodity Request
            </button>
          </form>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">My Requests</h2>
          </div>
          {requests.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">No commodity requests yet.</div>
          ) : (
            <div className="divide-y divide-gray-200">
              {requests.map((request) => (
                <div key={request.id} className="px-6 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{request.itemCategory}</p>
                      {request.notes && <p className="text-xs text-gray-500">{request.notes}</p>}
                    </div>
                    <StatusBadge status={request.status} />
                  </div>
                  {request.adminQuotedPrice && (
                    <p className="mt-2 text-xs text-gray-600">
                      Admin offer: {formatCurrency(request.adminQuotedPrice)} over {request.adminApprovedMonths || '-'} months
                    </p>
                  )}
                  {request.adminFeedback && (
                    <p className="mt-1 text-xs text-gray-500">{request.adminFeedback}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-400">Submitted: {formatDateTime(request.createdAt)}</p>
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
    OFFERED: 'bg-blue-100 text-blue-800',
    APPROVED: 'bg-green-100 text-green-800',
    REJECTED: 'bg-red-100 text-red-800',
    CANCELLED: 'bg-gray-100 text-gray-700',
  }

  return (
    <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  )
}
