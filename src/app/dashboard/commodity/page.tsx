import { AdminSubmit } from '@/components/admin/admin-collection'
import { AdminHeading } from '@/components/admin/admin-ui'
import { AdminCollection, AdminReviewItem } from '@/components/admin/admin-collection'
import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { canAccessWithPrivileges, PRIVILEGE_CODES } from '@/lib/access'
import { getMemberFinanceSummary } from '@/lib/member-finance'
import CommodityClient from './CommodityClient'
import { StatusBadge } from '@/components/ui/overview'

async function submitCommodityRequest(formData: FormData) {
  'use server'

  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'MEMBER') {
    redirect('/dashboard')
  }

  const itemName = String(formData.get('itemName') || '').trim()
  const preferredPrice = Number(formData.get('preferredPrice') || 0)
  const notes = String(formData.get('notes') || '').trim()

  if (!itemName || itemName.length > 160)
    return { error: 'Enter an item name of up to 160 characters.' }
  if (!Number.isFinite(preferredPrice) || preferredPrice < 0)
    return { error: 'Enter a valid budget.' }
  if (notes.length > 2000) return { error: 'Keep your notes under 2,000 characters.' }

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
  revalidatePath('/dashboard')
  return { success: true }
}

async function cancelCommodityRequest(formData: FormData) {
  'use server'
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/dashboard')

  const requestId = String(formData.get('requestId') || '')
  if (!requestId) return { error: 'Request not found.' }

  const result = await prisma.commodityRequest.updateMany({
    where: { id: requestId, userId: session.user.id, status: 'PENDING' },
    data: { status: 'CANCELLED' },
  })
  if (!result.count) return { error: 'This request has already been reviewed or cancelled.' }
  revalidatePath('/dashboard/commodity')
  revalidatePath('/dashboard')
  return { success: true }
}

async function reviewCommodityRequest(formData: FormData) {
  'use server'

  const session = await getServerSession(authOptions)
  if (
    !session?.user?.id ||
    !(await canAccessWithPrivileges(
      { id: session.user.id, role: session.user.role },
      PRIVILEGE_CODES.REVIEW_COMMODITY
    ))
  ) {
    redirect('/dashboard')
  }

  const requestId = String(formData.get('requestId') || '')
  const action = String(formData.get('action') || '')
  const adminFeedback = String(formData.get('adminFeedback') || '').trim()
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
      adminFeedback:
        adminFeedback ||
        (action === 'offer'
          ? 'Offer prepared. Contact member for agreement.'
          : 'Commodity request approved.'),
      reviewedBy,
      reviewedAt: now,
    },
  })

  revalidatePath('/dashboard/commodity')
}

async function recordCommodityRepayment(formData: FormData) {
  'use server'

  const session = await getServerSession(authOptions)
  if (
    !session?.user?.id ||
    !(await canAccessWithPrivileges(
      { id: session.user.id, role: session.user.role },
      PRIVILEGE_CODES.REVIEW_COMMODITY
    ))
  ) {
    redirect('/dashboard')
  }

  const requestId = String(formData.get('requestId') || '').trim()
  const amount = Number(formData.get('amount') || 0)
  const notes = String(formData.get('notes') || '').trim()

  if (!requestId || !Number.isFinite(amount) || amount <= 0) return

  const request = await prisma.commodityRequest.findUnique({
    where: { id: requestId },
    select: { userId: true, status: true },
  })

  if (!request || request.status !== 'APPROVED') return

  await prisma.commodityRepayment.create({
    data: {
      userId: request.userId,
      commodityRequestId: requestId,
      amount,
      notes: notes || null,
    },
  })

  revalidatePath('/dashboard')
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

  // --- GRANTED ACCESS: Review Commodity Requests (privileged members) ---
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
          user: { select: { name: true, email: true, staffId: true } },
          repayments: { orderBy: { date: 'desc' } },
        },
      }),
    ])

    return (
      <div className="admin-page">
        <AdminHeading
          section="Requests"
          title="Commodity review"
          description="Review member requests, agreed prices and repayments."
        />

        <div className="rounded-xl border border-border bg-surface shadow-sm">
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-lg font-semibold text-foreground">Pending Requests</h2>
          </div>
          {pending.length === 0 ? (
            <div className="px-6 py-10 text-center text-muted-foreground">
              No pending commodity requests.
            </div>
          ) : (
            <div className="admin-queue">
              <AdminCollection>
                {pending.map((request) => (
                  <AdminReviewItem
                    key={request.id}
                    heading={request.user?.name || 'Unnamed member'}
                    meta={request.itemCategory}
                    status={request.status}
                    amount={
                      request.preferredBudget > 0
                        ? formatCurrency(request.preferredBudget)
                        : 'Awaiting quote'
                    }
                    searchText={
                      (request.user?.name || '') +
                      ' ' +
                      request.itemCategory +
                      ' ' +
                      (request.user?.email || '') +
                      ' ' +
                      (request.user?.staffId || '')
                    }
                  >
                    <div className="mb-3">
                      <p className="text-lg font-semibold text-foreground">
                        {request.user?.name || 'Unknown Member'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {request.user?.email} &middot; {request.user?.phone || 'No phone'} &middot;
                        Staff ID: {request.user?.staffId || 'N/A'}
                        {request.user?.department ? ` \u00b7 ${request.user.department}` : ''}
                      </p>
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {request.itemCategory}
                      </p>
                      {request.preferredBudget > 0 && (
                        <p className="text-sm text-muted-foreground">
                          Member preferred price:{' '}
                          <span className="font-semibold">
                            {formatCurrency(request.preferredBudget)}
                          </span>
                        </p>
                      )}
                      {request.notes && (
                        <p className="text-sm text-muted-foreground">Note: {request.notes}</p>
                      )}
                    </div>

                    <form
                      action={reviewCommodityRequest}
                      className="flex flex-wrap items-center gap-3"
                    >
                      <input type="hidden" name="requestId" value={request.id} />
                      <input
                        aria-label="Admin Feedback"
                        name="adminFeedback"
                        type="text"
                        placeholder="Optional feedback"
                        className="min-w-[200px] flex-1 rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary-500"
                      />
                      <div className="flex gap-2">
                        <AdminSubmit pendingLabel="Processing..."
                          name="action"
                          value="approve"
                          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                        >
                          Accept
                        </AdminSubmit>
                        <AdminSubmit pendingLabel="Processing..."
                          name="action"
                          value="reject"
                          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                        >
                          Reject
                        </AdminSubmit>
                      </div>
                    </form>
                  </AdminReviewItem>
                ))}
              </AdminCollection>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-surface shadow-sm">
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-lg font-semibold text-foreground">Recent Decisions</h2>
          </div>
          {reviewed.length === 0 ? (
            <div className="px-6 py-10 text-center text-muted-foreground">No decisions yet.</div>
          ) : (
            <div className="admin-queue">
              <AdminCollection>
                {reviewed.map((request) => (
                  <AdminReviewItem
                    key={request.id}
                    heading={request.user?.name || 'Unnamed member'}
                    meta={request.itemCategory}
                    status={request.status}
                    amount={
                      request.adminQuotedPrice != null
                        ? formatCurrency(request.adminQuotedPrice)
                        : 'Not quoted'
                    }
                    searchText={
                      (request.user?.name || '') +
                      ' ' +
                      request.itemCategory +
                      ' ' +
                      (request.user?.email || '') +
                      ' ' +
                      (request.user?.staffId || '')
                    }
                  >
                    <div>
                      <p className="font-medium text-foreground">
                        {request.user?.name || 'Unknown Member'}
                      </p>
                      <p className="text-muted-foreground">{request.itemCategory}</p>
                      {request.adminQuotedPrice && (
                        <p className="text-muted-foreground">
                          Approved: {formatCurrency(request.adminQuotedPrice)} /{' '}
                          {request.adminApprovedMonths || '-'} months
                        </p>
                      )}
                      {request.adminFeedback && (
                        <p className="text-xs text-muted-foreground">{request.adminFeedback}</p>
                      )}
                      {request.status === 'APPROVED' && (
                        <div className="mt-3 rounded-lg border border-border bg-surface-2 p-3">
                          <p className="text-xs text-muted-foreground">
                            Paid so far:{' '}
                            <span className="font-semibold text-foreground">
                              {formatCurrency(
                                request.repayments.reduce(
                                  (sum, repayment) => sum + repayment.amount,
                                  0
                                )
                              )}
                            </span>
                          </p>
                          <form
                            action={recordCommodityRepayment}
                            className="mt-2 flex flex-wrap gap-2"
                          >
                            <input type="hidden" name="requestId" value={request.id} />
                            <input
                              aria-label="Amount"
                              name="amount"
                              type="number"
                              min="1"
                              step="100"
                              placeholder="Repayment amount"
                              className="w-40 rounded-lg border border-border px-3 py-2 text-xs"
                              required
                            />
                            <input
                              aria-label="Notes"
                              name="notes"
                              type="text"
                              placeholder="Optional note"
                              className="min-w-[180px] flex-1 rounded-lg border border-border px-3 py-2 text-xs"
                            />
                            <AdminSubmit pendingLabel="Processing..."
                              className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground hover:bg-gray-700"
                            >
                              Record repayment
                            </AdminSubmit>
                          </form>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <StatusBadge status={request.status} />
                      <p className="text-xs text-muted-foreground mt-1">
                        {request.reviewedAt ? formatDateTime(request.reviewedAt) : '-'}
                      </p>
                    </div>
                  </AdminReviewItem>
                ))}
              </AdminCollection>
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
          user: { select: { name: true, email: true, staffId: true } },
          repayments: { orderBy: { date: 'desc' } },
        },
      }),
    ])

    return (
      <div className="admin-page">
        <div>
          <h1 className="page-title">Commodity Requests</h1>
          <p className="mt-1 text-muted-foreground">
            Review requests. Quote pricing and repayment terms, then follow up.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface shadow-sm">
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-lg font-semibold text-foreground">Pending Requests</h2>
          </div>
          {pending.length === 0 ? (
            <div className="px-6 py-10 text-center text-muted-foreground">
              No pending commodity requests.
            </div>
          ) : (
            <div className="admin-queue">
              <AdminCollection>
                {pending.map((request) => (
                  <AdminReviewItem
                    key={request.id}
                    heading={request.user?.name || 'Unnamed member'}
                    meta={request.itemCategory}
                    status={request.status}
                    amount={
                      request.preferredBudget > 0
                        ? formatCurrency(request.preferredBudget)
                        : 'Awaiting quote'
                    }
                    searchText={
                      (request.user?.name || '') +
                      ' ' +
                      request.itemCategory +
                      ' ' +
                      (request.user?.email || '') +
                      ' ' +
                      (request.user?.staffId || '')
                    }
                  >
                    <div className="mb-3">
                      <p className="text-lg font-semibold text-foreground">
                        {request.user?.name || 'Unknown Member'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {request.user?.email} &middot; {request.user?.phone || 'No phone'} &middot;
                        Staff ID: {request.user?.staffId || 'N/A'}
                      </p>
                      <p className="text-sm font-medium text-foreground">{request.itemCategory}</p>
                      {request.preferredBudget > 0 && (
                        <p className="text-sm text-muted-foreground">
                          Member budget: {formatCurrency(request.preferredBudget)}
                        </p>
                      )}
                      {request.notes && (
                        <p className="text-sm text-muted-foreground">
                          Member note: {request.notes}
                        </p>
                      )}
                    </div>

                    <form
                      action={reviewCommodityRequest}
                      className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4"
                    >
                      <input type="hidden" name="requestId" value={request.id} />
                      <input
                        aria-label="Admin Quoted Price"
                        name="adminQuotedPrice"
                        type="number"
                        min={1000}
                        step={1000}
                        placeholder="Quoted price"
                        className="rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary-500"
                      />
                      <input
                        aria-label="Admin Approved Months"
                        name="adminApprovedMonths"
                        type="number"
                        min={3}
                        max={24}
                        placeholder="Months"
                        className="rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary-500"
                      />
                      <input
                        aria-label="Admin Feedback"
                        name="adminFeedback"
                        type="text"
                        placeholder="Feedback / next steps"
                        className="rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary-500"
                      />
                      <div className="flex gap-2">
                        <AdminSubmit pendingLabel="Processing..."
                          name="action"
                          value="offer"
                          className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
                        >
                          Send Offer
                        </AdminSubmit>
                        <AdminSubmit pendingLabel="Processing..."
                          name="action"
                          value="approve"
                          className="rounded-lg bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-700"
                        >
                          Approve
                        </AdminSubmit>
                        <AdminSubmit pendingLabel="Processing..."
                          name="action"
                          value="reject"
                          className="rounded-lg bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700"
                        >
                          Reject
                        </AdminSubmit>
                      </div>
                    </form>
                  </AdminReviewItem>
                ))}
              </AdminCollection>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-surface shadow-sm">
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-lg font-semibold text-foreground">Recent Commodity Decisions</h2>
          </div>
          {reviewed.length === 0 ? (
            <div className="px-6 py-10 text-center text-muted-foreground">No decisions yet.</div>
          ) : (
            <div className="admin-queue">
              <AdminCollection>
                {reviewed.map((request) => (
                  <AdminReviewItem
                    key={request.id}
                    heading={request.user?.name || 'Unnamed member'}
                    meta={request.itemCategory}
                    status={request.status}
                    amount={
                      request.adminQuotedPrice != null
                        ? formatCurrency(request.adminQuotedPrice)
                        : 'Not quoted'
                    }
                    searchText={
                      (request.user?.name || '') +
                      ' ' +
                      request.itemCategory +
                      ' ' +
                      (request.user?.email || '') +
                      ' ' +
                      (request.user?.staffId || '')
                    }
                  >
                    <div>
                      <p className="font-medium text-foreground">
                        {request.user?.name || 'Unknown Member'}
                      </p>
                      <p className="text-muted-foreground">{request.itemCategory}</p>
                      {request.adminQuotedPrice && (
                        <p className="text-muted-foreground">
                          Offer: {formatCurrency(request.adminQuotedPrice)} /{' '}
                          {request.adminApprovedMonths || '-'} months
                          {request.adminMonthlyRepayment
                            ? ` (${formatCurrency(request.adminMonthlyRepayment)} monthly)`
                            : ''}
                        </p>
                      )}
                      {request.status === 'APPROVED' && (
                        <p className="text-muted-foreground">
                          Paid so far:{' '}
                          {formatCurrency(
                            request.repayments.reduce((sum, repayment) => sum + repayment.amount, 0)
                          )}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <StatusBadge status={request.status} />
                      <p className="text-xs text-muted-foreground mt-1">
                        {request.reviewedAt ? formatDateTime(request.reviewedAt) : '-'}
                      </p>
                    </div>
                  </AdminReviewItem>
                ))}
              </AdminCollection>
            </div>
          )}
        </div>
      </div>
    )
  }

  const member = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { staffId: true },
  })
  if (!member) redirect('/login')
  const requests = await prisma.commodityRequest.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      itemCategory: true,
      preferredBudget: true,
      notes: true,
      status: true,
      createdAt: true,
      adminQuotedPrice: true,
      adminApprovedMonths: true,
      adminMonthlyRepayment: true,
      adminFeedback: true,
      repayments: { orderBy: { date: 'desc' }, select: { id: true, amount: true, date: true } },
    },
  })
  const finance = await getMemberFinanceSummary(session.user.id, member.staffId)
  return (
    <CommodityClient
      requests={requests.map((request) => ({
        ...request,
        createdAt: request.createdAt.toISOString(),
        repayments: request.repayments.map((payment) => ({
          ...payment,
          date: payment.date.toISOString(),
        })),
      }))}
      totals={{
        collected: finance.commodityCollected,
        paid: finance.commodityPaid,
        outstanding: finance.commodityOutstanding,
        period: finance.ledgerPeriod,
      }}
      submitAction={submitCommodityRequest}
      cancelAction={cancelCommodityRequest}
    />
  )
}
