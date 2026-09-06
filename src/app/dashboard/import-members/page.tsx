import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { canAccessWithPrivileges, PRIVILEGE_CODES } from '@/lib/access'
import { AdminHeading } from '@/components/admin/admin-ui'
import { ImportWorkspace } from '@/components/admin/import-workspace'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import ImportMembersClient from './import-members-client'
import MonthlyMemberDataClient from './monthly-member-data-client'

export default async function ImportMembersPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.email) redirect('/login')
  if (
    !session.user.id ||
    !(await canAccessWithPrivileges(
      { id: session.user.id, role: session.user.role },
      PRIVILEGE_CODES.IMPORT_MEMBERS
    ))
  ) {
    redirect('/dashboard')
  }

  return (
    <div className="admin-page">
      <AdminHeading
        section="Data management"
        title="Import members"
        description="One workbook. Every month in the right place."
        actions={
          <Link href="/dashboard/member-data" className="btn-ghost">
            Open member data
            <ArrowUpRight size={15} />
          </Link>
        }
      />
      <ImportWorkspace workbook={<MonthlyMemberDataClient />} replace={<ImportMembersClient />} />
    </div>
  )
}
