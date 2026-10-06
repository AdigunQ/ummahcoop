import Link from 'next/link'
import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canAccessWithPrivileges, PRIVILEGE_CODES } from '@/lib/access'
import { resolveContributionPlans } from '@/lib/contribution-plans'
import { savingsPeriod, shiftSavingsPeriod } from '@/lib/savings-change-policy'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { AdminHeading, AdminPanel, AdminStats } from '@/components/admin/admin-ui'
import { AdminCollection, AdminReviewItem } from '@/components/admin/admin-collection'
import { SavingsActionForm } from './ActionForm'
import { submitSavingsChange, cancelSavingsChangeAction, reviewSavingsChangeAction } from './actions'

function monthLabel(period: string) {
  return new Date(`${period}-01T12:00:00Z`).toLocaleDateString('en-NG', { timeZone: 'Africa/Lagos', month: 'long', year: 'numeric' })
}

export default async function SavingsChangesPage({ searchParams }: { searchParams?: Promise<{ view?: string }> }) {
  const params = await searchParams
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')
  const member = await prisma.user.findUnique({ where: { id: session.user.id }, select: {
    id: true, role: true, status: true, monthlyContribution: true, specialContribution: true,
  } })
  if (!member || member.status !== 'ACTIVE') redirect('/dashboard')
  const reviewing = params?.view !== 'member' && await canAccessWithPrivileges(member, PRIVILEGE_CODES.EDIT_MEMBERS)
  if (!reviewing && member.role !== 'MEMBER') redirect('/dashboard')
  const period = savingsPeriod(), minimum = shiftSavingsPeriod(period), maximum = shiftSavingsPeriod(period, 12)
  const requests = await prisma.savingsChangeRequest.findMany({
    where: reviewing ? {} : { userId: member.id },
    orderBy: [{ createdAt: 'desc' }],
    // Keep all pending requests visible; paginate the rendered lists below.
    include: { user: { select: { name: true, staffId: true, status: true } }, reviewedBy: { select: { name: true } } },
  })
  const [current] = await resolveContributionPlans([member], period)
  const pending = requests.filter(request => request.status === 'PENDING')
  const scheduled = requests.filter(request => request.status === 'APPROVED' && request.effectivePeriod! > period)
  const blocked = !reviewing && (pending.length > 0 || scheduled.length > 0)

  return (
    <div className="admin-page">
      <AdminHeading section={reviewing ? 'Requests' : 'My savings'} title={reviewing ? 'Savings change requests' : 'Change my monthly savings'}
        description={reviewing ? 'Review a member’s requested monthly amounts, then confirm when the change starts.' : 'Ask to increase or reduce your monthly thrift or special savings. Your admin must approve the change.'}
        actions={member.role === 'MEMBER' && reviewing ? <Link className="btn-secondary" href="/dashboard/savings-changes?view=member">My own savings</Link> : undefined} />
      {reviewing ? <AdminStats items={[
        { label: 'Awaiting review', value: String(pending.length) },
        { label: 'Scheduled changes', value: String(scheduled.length) },
      ]} /> : <AdminStats items={[
        { label: 'Current monthly thrift', value: formatCurrency(current.monthlyContribution || 0), note: monthLabel(period) },
        { label: 'Current monthly special', value: formatCurrency(current.specialContribution || 0), note: monthLabel(period) },
      ]} />}
      <p className="rounded-xl border border-accent/20 bg-accent/5 p-5 text-sm leading-7">
        This changes future monthly deductions, not money already saved. Changes start from next month or later,
        after admin approval. Saved monthly sheets and prepared payroll are never overwritten.
      </p>
      {!reviewing && <AdminPanel title="Request a new amount">
        {blocked ? <p className="p-5 leading-7">You already have a pending or scheduled change. See its status below.
          Pending requests can be cancelled before submitting another.</p> :
          <div className="p-5 sm:p-7"><SavingsActionForm action={submitSavingsChange} label="Send request for review">
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="space-y-2"><span className="block">New monthly thrift (naira)</span><input className="settings-input" name="thrift" type="number" required min="0" max="100000000" step="1" defaultValue={current.monthlyContribution || 0} /></label>
              <label className="space-y-2"><span className="block">New monthly special (naira)</span><input className="settings-input" name="special" type="number" required min="0" max="100000000" step="1" defaultValue={current.specialContribution || 0} /></label>
            </div>
            <p className="text-sm text-muted-foreground">Enter 0 for a plan you do not want. Keep at least one plan above zero.</p>
            <label className="block space-y-2"><span className="block">Requested start month</span><input className="settings-input" type="month" name="requestedPeriod" required min={minimum} max={maximum} defaultValue={minimum} /></label>
            <label className="block space-y-2"><span className="block">Reason (optional)</span><textarea name="reason" className="settings-input" rows={3} maxLength={1000} /></label>
          </SavingsActionForm></div>}
      </AdminPanel>}
      {[
        { title: reviewing ? 'Awaiting review' : 'Pending requests', rows: pending },
        { title: 'Request history', rows: requests.filter(request => request.status !== 'PENDING') },
      ].map(group => <AdminPanel key={group.title} title={group.title}>
        {!group.rows.length ? <p className="admin-empty">No requests here yet.</p> : <AdminCollection>
          {group.rows.map(request => <AdminReviewItem key={request.id}
            heading={reviewing ? request.user.name || 'Unnamed member' : `Requested ${monthLabel(request.requestedPeriod)}`}
            meta={reviewing ? `Staff ID ${request.user.staffId || 'Not set'} · ${formatDateTime(request.createdAt)}` : formatDateTime(request.createdAt)}
            status={request.status} searchText={`${request.user.name} ${request.user.staffId} ${request.status}`}>
            <dl className="grid gap-5 sm:grid-cols-2">
              <div><dt className="text-sm text-muted-foreground">Monthly thrift</dt><dd className="mt-1 font-semibold">{formatCurrency(request.previousThrift)} → {formatCurrency(request.requestedThrift)}</dd></div>
              <div><dt className="text-sm text-muted-foreground">Monthly special</dt><dd className="mt-1 font-semibold">{formatCurrency(request.previousSpecial)} → {formatCurrency(request.requestedSpecial)}</dd></div>
              <div><dt className="text-sm text-muted-foreground">Requested month</dt><dd>{monthLabel(request.requestedPeriod)}</dd></div>
              {request.effectivePeriod && <div><dt className="text-sm text-muted-foreground">Approved start month</dt><dd>{monthLabel(request.effectivePeriod)}{request.effectivePeriod <= period ? ' · In effect' : ' · Scheduled'}</dd></div>}
            </dl>
            {request.reason && <p className="mt-4">Member note: {request.reason}</p>}
            {request.reviewNote && <p className="mt-4">Admin note: {request.reviewNote}</p>}
            {request.reviewedAt && <p className="mt-4 text-sm text-muted-foreground">Reviewed by {request.reviewedBy?.name || 'Admin'} on {formatDateTime(request.reviewedAt)}</p>}
            {request.status === 'PENDING' && <div className="mt-6">
              {reviewing ? request.userId === member.id ? <p>Another authorised admin must review your own request.</p> :
                <SavingsActionForm action={reviewSavingsChangeAction} label="Approve and schedule" review>
                  <input type="hidden" name="requestId" value={request.id} />
                  <label className="block space-y-2"><span className="block">Effective month</span><input className="settings-input" type="month" name="effectivePeriod" required min={request.requestedPeriod > minimum ? request.requestedPeriod : minimum} max={maximum} defaultValue={request.requestedPeriod > minimum ? request.requestedPeriod : minimum} /></label>
                  <label className="block space-y-2"><span className="block">Review note (optional)</span><textarea className="settings-input" name="note" rows={2} maxLength={1000} /></label>
                </SavingsActionForm> : <SavingsActionForm action={cancelSavingsChangeAction} label="Cancel this request"><input type="hidden" name="requestId" value={request.id} /></SavingsActionForm>}
            </div>}
          </AdminReviewItem>)}
        </AdminCollection>}
      </AdminPanel>)}
    </div>
  )
}
