import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { AdminAnalytics } from '@/components/dashboard/admin-analytics'

export default async function AnalyticsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) redirect('/login')
  if (session.user.role !== 'ADMIN') redirect('/dashboard')

  return <AdminAnalytics />
}
