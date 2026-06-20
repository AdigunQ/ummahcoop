'use server'

import bcrypt from 'bcryptjs'
import { getServerSession } from 'next-auth/next'
import { revalidatePath } from 'next/cache'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

export async function updateProfile(formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: 'Unauthorized' }

  const email = normalizeEmail(String(formData.get('email') || ''))
  const phone = String(formData.get('phone') || '').trim()
  const bankName = String(formData.get('bankName') || '').trim()
  const bankAccountNumber = String(formData.get('bankAccountNumber') || '').trim()
  const bankAccountName = String(formData.get('bankAccountName') || '').trim()

  const data: any = {}
  if (email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { error: 'Please enter a valid email address.' }
    }

    const existingEmailOwner = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    })

    if (existingEmailOwner && existingEmailOwner.id !== session.user.id) {
      return { error: 'That email is already used by another account.' }
    }

    data.email = email
  }
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

export async function changePassword(formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: 'Unauthorized' }

  const currentPassword = String(formData.get('currentPassword') || '')
  const newPassword = String(formData.get('newPassword') || '')
  const confirmPassword = String(formData.get('confirmPassword') || '')

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: 'Please fill all password fields.' }
  }

  if (newPassword.length < 6) {
    return { error: 'New password must be at least 6 characters.' }
  }

  if (newPassword !== confirmPassword) {
    return { error: 'New passwords do not match.' }
  }

  if (newPassword === currentPassword) {
    return { error: 'New password must be different from current password.' }
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { password: true },
  })

  if (!user?.password) {
    return { error: 'Password change is unavailable for this account.' }
  }

  const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password)
  if (!isCurrentPasswordValid) {
    return { error: 'Current password is incorrect.' }
  }

  const passwordHash = await bcrypt.hash(newPassword, 10)
  await prisma.user.update({
    where: { id: session.user.id },
    data: { password: passwordHash },
  })

  revalidatePath('/dashboard/profile')
  return { success: true }
}
