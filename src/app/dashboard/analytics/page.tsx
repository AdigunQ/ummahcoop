import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { AdminAnalytics } from '@/components/dashboard/admin-analytics'
import { canAccessWithPrivileges, PRIVILEGE_CODES } from '@/lib/access'

export default async function AnalyticsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) redirect('/login')
  if (!session.user.id || !(await canAccessWithPrivileges({ id: session.user.id, role: session.user.role }, PRIVILEGE_CODES.VIEW_ANALYTICS))) {
    redirect('/dashboard')
  }

  return <AdminAnalytics />
}
