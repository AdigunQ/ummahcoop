'use server'

import { getServerSession } from 'next-auth/next'
import { revalidatePath } from 'next/cache'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function updateProfile(formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: 'Unauthorized' }

  const phone = String(formData.get('phone') || '').trim()
  const bankName = String(formData.get('bankName') || '').trim()
  const bankAccountNumber = String(formData.get('bankAccountNumber') || '').trim()
  const bankAccountName = String(formData.get('bankAccountName') || '').trim()

  const data: any = {}
  if (phone) data.phone = phone
  if (bankName) data.bankName = bankName
  if (bankAccountNumber) data.bankAccountNumber = bankAccountNumber
  if (bankAccountName) data.bankAccountName = bankAccountName

  if (Object.keys(data).length === 0) {
    return { error: 'Nothing to update' }
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data,
  })

  revalidatePath('/dashboard/profile')
  return { success: true }
}
