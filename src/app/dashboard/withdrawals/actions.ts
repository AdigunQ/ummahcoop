'use server'

import { getServerSession } from 'next-auth/next'
import { revalidatePath } from 'next/cache'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function submitWithdrawalRequest(formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: 'Unauthorized' }

  const source = String(formData.get('source') || 'SPECIAL_SAVINGS')
  const reason = String(formData.get('reason') || '').trim()

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  })

  if (!user) return { error: 'User not found' }

  if (source !== 'SPECIAL_SAVINGS') {
    return { error: 'Thrift savings withdrawals are only available through full membership closure.' }
  }

  if (new Date().getMonth() !== 9) {
    return { error: 'Special savings withdrawal is only available in October.' }
  }

  const requestedAmount = user.specialBalance
  if (requestedAmount <= 0) {
    return { error: 'No special savings balance available for withdrawal.' }
  }
  const maxAllowed = requestedAmount

  // Check pending requests
  const pending = await prisma.withdrawal.findFirst({
    where: { userId: user.id, status: 'PENDING' }
  })
  if (pending) return { error: 'You already have a pending request.' }

  await prisma.withdrawal.create({
    data: {
      userId: user.id,
      type: 'PARTIAL', // We treat both as partial for now logic-wise
      source: 'SPECIAL_SAVINGS',
      requestedAmount,
      maxAllowedAtRequest: maxAllowed,
      reason,
      status: 'PENDING',
      useProfileBank: true,
      payoutBankName: user.bankName,
      payoutAccountNumber: user.bankAccountNumber,
      payoutAccountName: user.bankAccountName,
    },
  })

  revalidatePath('/dashboard/withdrawals')
  return { success: true }
}
