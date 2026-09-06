import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { PRIVILEGE_ROUTE_MAP } from '@/lib/privileges'
import { AdminHeading, AdminPanel } from './admin-ui'

export function AdminWorkspaceStart({ codes }: { codes: string[] }) {
  return <div className="admin-page">
    <AdminHeading section="Administration" title="Your workspace" description="Open an area covered by your permissions." actions={<Link className="btn-ghost" href="/dashboard?view=member">Member account</Link>} />
    <AdminPanel title="Available areas">
      <div className="admin-decision-list">{PRIVILEGE_ROUTE_MAP.filter((entry) => codes.includes(entry.code)).map((entry) => <Link key={entry.href} href={entry.href === '/dashboard/commodity' ? `${entry.href}?review=true` : entry.href}><span>{entry.label}</span><ArrowUpRight size={16}/></Link>)}</div>
    </AdminPanel>
  </div>
}
