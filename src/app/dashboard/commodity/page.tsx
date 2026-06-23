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

  const itemName = String(formData.get('itemName') || '').trim()
  const preferredPrice = Number(formData.get('preferredPrice') || 0)
  const notes = String(formData.get('notes') || '').trim()

  if (!itemName) {
    return
  }

  await prisma.commodityRequest.create({
    data: {
      userId: session.user.id,
      itemCategory: itemName,
      itemModel: notes || 'Open Request',
      preferredBudget: Number.isFinite(preferredPrice) && preferredPrice >= 0 ? preferredPrice : 0,
      preferredMonths: 0,
      contactPreference: 'BOTH',
      notes,
      status: 'PENDING',
    },
  })

  revalidatePath('/dashboard/commodity')
}

async function cancelCommodityRequest(formData: FormData) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/dashboard')

  const requestId = String(formData.get('requestId') || '')
  if (!requestId) return

  await prisma.commodityRequest.updateMany({
    where: { id: requestId, userId: session.user.id, status: 'PENDING' },
    data: { status: 'CANCELLED' },
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
  const adminFeedback = String(formData.get('adminFeedback') || '').trim()
  // These fields are only sent from the full admin view (with Send Offer)
  const adminQuotedPrice = Number(formData.get('adminQuotedPrice') || 0)
  const adminApprovedMonths = Number(formData.get('adminApprovedMonths') || 0)

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

  // For "approve" without explicit price/month, use the member's preferredBudget
  let price = adminQuotedPrice
  let months = adminApprovedMonths

  if (action === 'approve' && (!Number.isFinite(price) || price <= 0)) {
    const request = await prisma.commodityRequest.findUnique({
      where: { id: requestId },
      select: { preferredBudget: true },
    })
    price = request?.preferredBudget ?? 0
    months = 6
  }

  if (!Number.isFinite(price) || price <= 0) {
    return
  }

  const finalMonths = Number.isFinite(months) && months >= 3 && months <= 24 ? months : 6
  const monthly = price / finalMonths

  await prisma.commodityRequest.update({
    where: { id: requestId },
    data: {
      status: action === 'offer' ? 'OFFERED' : 'APPROVED',
      adminQuotedPrice: price,
      adminApprovedMonths: finalMonths,
      adminMonthlyRepayment: monthly,
      adminFeedback: adminFeedback || (action === 'offer'
        ? 'Offer prepared. Contact member for agreement.'
        : 'Commodity request approved.'),
      reviewedBy,
      reviewedAt: now,
    },
  })

  revalidatePath('/dashboard/commodity')
}

export default async function CommodityPage({
  searchParams,
}: {
  searchParams: { review?: string }
}) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.email || !session.user.id) {
    redirect('/login')
  }

  const isMember = session.user.role === 'MEMBER'
  const canReviewCommodity = await canAccessWithPrivileges(
    { id: session.user.id, role: session.user.role },
    PRIVILEGE_CODES.REVIEW_COMMODITY
  )

  const showReview = searchParams.review === 'true'

  // --- GRANTED ACCESS: Review Commodity Requests (privileged members only) ---
  if (showReview && canReviewCommodity) {
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
          <h1 className="text-3xl font-bold text-gray-900">Commodity Review</h1>
          <p className="mt-1 text-gray-500">
            View member commodity requests. Accept or reject based on their preferred price.
          </p>
        </div>

        {/* Pending */}
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
                      {request.user?.department ? ` · ${request.user.department}` : ''}
                    </p>
                    <p className="mt-1 text-sm font-medium text-gray-800">{request.itemCategory}</p>
                    {request.preferredBudget > 0 && (
                      <p className="text-sm text-gray-600">
                        Member preferred price: <span className="font-semibold">{formatCurrency(request.preferredBudget)}</span>
                      </p>
                    )}
                    {request.notes && <p className="text-sm text-gray-500">Note: {request.notes}</p>}
                  </div>

                  <form action={reviewCommodityRequest} className="flex flex-wrap items-center gap-3">
                    <input type="hidden" name="requestId" value={request.id} />
                    <input
                      name="adminFeedback"
                      type="text"
                      placeholder="Optional feedback"
                      className="min-w-[200px] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
                    />
                    <div className="flex gap-2">
                      <button
                        name="action"
                        value="approve"
                        className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                        type="submit"
                      >
                        Accept
                      </button>
                      <button
                        name="action"
                        value="reject"
                        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
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

        {/* Recent decisions */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Decisions</h2>
          </div>
          {reviewed.length === 0 ? (
            <div className="px-6 py-10 text-center text-gray-500">No decisions yet.</div>
          ) : (
            <div className="divide-y divide-gray-200">
              {reviewed.map((request) => (
                <div key={request.id} className="flex flex-col gap-2 px-6 py-4 text-sm md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{request.user?.name || 'Unknown Member'}</p>
                    <p className="text-gray-500">{request.itemCategory}</p>
                    {request.adminQuotedPrice && (
                      <p className="text-gray-500">
                        Approved: {formatCurrency(request.adminQuotedPrice)} / {request.adminApprovedMonths || '-'} months
                      </p>
                    )}
                    {request.adminFeedback && (
                      <p className="text-xs text-gray-500">{request.adminFeedback}</p>
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

  // --- Pure admin view (ADMIN role) ---
  if (canReviewCommodity && !isMember) {
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
            Review requests. Quote pricing and repayment terms, then follow up.
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
                    <p className="text-sm font-medium text-gray-700">{request.itemCategory}</p>
                    {request.preferredBudget > 0 && (
                      <p className="text-sm text-gray-600">Member budget: {formatCurrency(request.preferredBudget)}</p>
                    )}
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
                    <p className="text-gray-500">{request.itemCategory}</p>
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

  // --- MEMBER VIEW: Commodity Request (Actions) ---
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
          Request items from the cooperative. Enter what you want and your preferred price.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Member submission form */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">New Commodity Request</h2>
          <form action={submitCommodityRequest} className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Item name <span className="text-rose-500">*</span>
              </label>
              <input
                name="itemName"
                type="text"
                placeholder="e.g. TV, Phone, Generator, Furniture"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Price willing to pay (₦)</label>
              <input
                name="preferredPrice"
                type="number"
                min={0}
                step={1000}
                placeholder="e.g. 150000"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Additional notes</label>
              <textarea
                name="notes"
                rows={3}
                placeholder="Model, colour, or any other details"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
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

        {/* Member's request history */}
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
                      <p className="text-sm font-semibold text-gray-900">{request.itemCategory || 'Commodity'}</p>
                      {request.preferredBudget > 0 && (
                        <p className="text-xs text-gray-600">Budget: {formatCurrency(request.preferredBudget)}</p>
                      )}
                      {request.notes && request.itemModel !== 'Open Request' && (
                        <p className="text-xs text-gray-500">{request.notes}</p>
                      )}
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
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-xs text-gray-400">Submitted: {formatDateTime(request.createdAt)}</p>
                    {request.status === 'PENDING' && (
                      <form action={cancelCommodityRequest}>
                        <input type="hidden" name="requestId" value={request.id} />
                        <button
                          type="submit"
                          className="text-xs text-rose-600 hover:text-rose-800 underline"
                        >
                          Cancel
                        </button>
                      </form>
                    )}
                  </div>
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
  const styles: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    OFFERED: 'bg-blue-100 text-blue-800',
    APPROVED: 'bg-green-100 text-green-800',
    REJECTED: 'bg-red-100 text-red-800',
    CANCELLED: 'bg-gray-100 text-gray-700',
  }

  return (
    <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  )
}
