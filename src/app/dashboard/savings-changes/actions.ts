'use server'

import { getServerSession } from 'next-auth/next'
import { revalidatePath } from 'next/cache'
import { authOptions } from '@/lib/auth'
import { cancelSavingsChange, requestSavingsChange, reviewSavingsChange } from '@/lib/savings-change-requests'

async function perform(work: (userId: string) => Promise<unknown>, success: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: 'Please sign in again.' }
  try {
    await work(session.user.id)
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error) {
      return { error: 'The request changed or could not be saved. Refresh the page and try again.' }
    }
    return { error: error instanceof Error ? error.message : 'Could not save this request. Please try again.' }
  }
  revalidatePath('/dashboard', 'layout')
  return { success }
}

export async function submitSavingsChange(formData: FormData) {
  return perform(userId => requestSavingsChange(userId, {
    thrift: formData.get('thrift'), special: formData.get('special'),
    requestedPeriod: String(formData.get('requestedPeriod') || ''), reason: String(formData.get('reason') || ''),
  }), 'Your request has been sent to the admin for review. Your current deductions have not changed.')
}

export async function cancelSavingsChangeAction(formData: FormData) {
  return perform(userId => cancelSavingsChange(userId, String(formData.get('requestId') || '')), 'Request cancelled. Your savings plan is unchanged.')
}

export async function reviewSavingsChangeAction(formData: FormData) {
  const decision = String(formData.get('decision') || '')
  return perform(userId => reviewSavingsChange(userId, {
    requestId: String(formData.get('requestId') || ''), decision,
    effectivePeriod: String(formData.get('effectivePeriod') || ''), note: String(formData.get('note') || ''),
  }), decision === 'approve' ? 'Change approved and scheduled. Previous savings records are unchanged.' : 'Request declined. The savings plan is unchanged.')
}
