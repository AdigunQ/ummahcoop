'use server'

import bcrypt from 'bcryptjs'
import { getServerSession } from 'next-auth/next'
import { revalidatePath } from 'next/cache'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

function readTextField(formData: FormData, field: string): string {
  return String(formData.get(field) || '').trim()
}

function updateTextField(
  formData: FormData,
  data: Record<string, unknown>,
  field: string,
  label: string,
  maxLength: number,
  required = false
): string | null {
  if (!formData.has(field)) return null

  const value = readTextField(formData, field)
  if (required && !value) return `${label} is required.`
  if (value.length > maxLength) return `${label} must be ${maxLength} characters or fewer.`

  data[field] = value || null
  return null
}

export async function updateProfile(formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: 'Unauthorized' }

  const email = normalizeEmail(readTextField(formData, 'email'))
  const data: Record<string, unknown> = {}

  if (formData.has('email')) {
    if (!email) {
      return { error: 'Please enter a valid email address.' }
    }

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

  const editableFields = [
    ['name', 'Name', 200, true],
    ['phone', 'Phone number', 40, false],
    ['department', 'Department', 200, false],
    ['organization', 'Organization', 200, false],
    ['station', 'Station', 200, false],
    ['gradeLevel', 'Grade level', 80, false],
    ['nextOfKinName', 'Next of Kin name', 200, false],
    ['nextOfKinPhone', 'Next of Kin phone', 40, false],
    ['nextOfKinEmail', 'Next of Kin email', 320, false],
    ['nextOfKinRelationship', 'Next of Kin relationship', 100, false],
  ] as const

  for (const [field, label, maxLength, required] of editableFields) {
    const error = updateTextField(formData, data, field, label, maxLength, required)
    if (error) return { error }
  }

  if (formData.has('nextOfKinEmail')) {
    const nextOfKinEmail = readTextField(formData, 'nextOfKinEmail')
    if (nextOfKinEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextOfKinEmail)) {
      return { error: 'Please enter a valid Next of Kin email address.' }
    }
  }

  const bankName = readTextField(formData, 'bankName')
  const bankAccountNumber = readTextField(formData, 'bankAccountNumber')
  const bankAccountName = readTextField(formData, 'bankAccountName')
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
  revalidatePath('/dashboard', 'layout')
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
