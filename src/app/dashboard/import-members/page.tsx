import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { canAccessWithPrivileges, PRIVILEGE_CODES } from '@/lib/access'
import ImportMembersClient from './import-members-client'
import MonthlyMemberDataClient from './monthly-member-data-client'

export default async function ImportMembersPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.email) redirect('/login')
  if (!session.user.id || !(await canAccessWithPrivileges({ id: session.user.id, role: session.user.role }, PRIVILEGE_CODES.IMPORT_MEMBERS))) {
    redirect('/dashboard')
  }

  return (
    <div className="animate-fadeIn space-y-10">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Excel Imports</h1>
        <p className="mt-1 text-gray-500">Upload one workbook for monthly member snapshots, or replace all members from a spreadsheet.</p>
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Monthly Member Data (Single Workbook Import)</h2>
          <p className="mt-1 text-sm text-gray-500">
            Upload one Excel file containing multiple sheets. The importer auto-detects month sheets, normalizes field variations
            across sheets, applies member-fee logic, and saves each month in one import.
          </p>
        </div>
        <MonthlyMemberDataClient />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Replace Members (Danger Zone)</h2>
          <p className="mt-1 text-sm text-gray-500">
            This will delete every current member and replace them with the members from your uploaded Excel file.
          </p>
        </div>
        <ImportMembersClient />
      </section>
    </div>
  )
}
