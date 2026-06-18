'use server'

import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { LOAN_POLICY } from '@/lib/constants'
import {
  LOAN_REQUEST_POLICY,
  getLoanLimit,
  hasLoanTenureElapsed,
  normalizeGuarantorStaffId,
  type LoanApplicationData,
} from '@/lib/loan-request'

const loanRequestSchema = z.object({
  loanType: z.string().trim().min(1),
  amount: z.coerce.number().positive(),
  duration: z.coerce.number().int().min(3).max(24),
  purpose: z.string().trim().min(1),
  guarantor1StaffId: z.string().trim().min(1),
  guarantor2StaffId: z.string().trim().min(1),
})

function buildApplicationNotes(application: LoanApplicationData) {
  const guarantorList = application.guarantors.map((guarantor) => `${guarantor.staffId} (${guarantor.name})`).join(', ')
  return [
    `Loan type: ${application.loan.type}`,
    `Requested by ${application.applicant.name} (${application.applicant.staffId})`,
    `Guarantors: ${guarantorList}`,
    `Requested amount: ${application.loan.amount.toLocaleString('en-NG')}`,
  ].join(' | ')
}

export async function submitLoanRequest(formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'MEMBER') {
    redirect('/dashboard')
  }

  const parsed = loanRequestSchema.safeParse({
    loanType: formData.get('loanType'),
    amount: formData.get('amount'),
    duration: formData.get('duration'),
    purpose: formData.get('purpose'),
    guarantor1StaffId: formData.get('guarantor1StaffId'),
    guarantor2StaffId: formData.get('guarantor2StaffId'),
  })

  if (!parsed.success) {
    return { error: 'Please complete all loan request fields.' }
  }

  const member = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      staffId: true,
      phone: true,
      department: true,
      bankName: true,
      bankAccountName: true,
      bankAccountNumber: true,
      createdAt: true,
      status: true,
      balance: true,
      specialBalance: true,
      monthlyContribution: true,
      loanBalance: true,
      loans: {
        where: { status: 'PENDING' },
        select: { id: true },
      },
    },
  })

  if (!member || !member.staffId) {
    return { error: 'Member record could not be loaded.' }
  }

  if (member.status !== 'ACTIVE') {
    return { error: 'Your account must be active before you can request a loan.' }
  }

  if (!hasLoanTenureElapsed(member.createdAt)) {
    return { error: 'You must have been on the platform for at least 6 months before requesting a loan.' }
  }

  const maxLoanAmount = getLoanLimit(member.balance)
  if (parsed.data.amount > maxLoanAmount) {
    return { error: `Requested amount exceeds your current loan limit of ${maxLoanAmount.toLocaleString('en-NG')}.` }
  }

  if (parsed.data.amount < LOAN_POLICY.minAmount) {
    return { error: 'Requested amount is too small.' }
  }

  if (member.loanBalance > 0 || member.loans.length > 0) {
    return { error: 'You cannot submit another loan while a request or balance is outstanding.' }
  }

  if (!member.bankName || !member.bankAccountNumber || !member.bankAccountName) {
    return { error: 'Add your bank details in your profile before requesting a loan.' }
  }

  const guarantorIds = [
    normalizeGuarantorStaffId(parsed.data.guarantor1StaffId),
    normalizeGuarantorStaffId(parsed.data.guarantor2StaffId),
  ]

  if (guarantorIds.some((id) => !id)) {
    return { error: 'Enter both guarantor Staff IDs.' }
  }

  if (guarantorIds[0] === member.staffId || guarantorIds[1] === member.staffId) {
    return { error: 'You cannot use your own Staff ID as a guarantor.' }
  }

  if (guarantorIds[0] === guarantorIds[1]) {
    return { error: 'Choose two different guarantors.' }
  }

  const guarantors = await prisma.user.findMany({
    where: {
      staffId: { in: guarantorIds },
      role: 'MEMBER',
      status: 'ACTIVE',
    },
    select: {
      staffId: true,
      name: true,
      phone: true,
      department: true,
    },
  })

  if (guarantors.length !== guarantorIds.length) {
    const found = new Set(guarantors.map((guarantor) => guarantor.staffId?.toUpperCase()))
    const missing = guarantorIds.filter((id) => !found.has(id))
    return { error: `Guarantor Staff ID${missing.length > 1 ? 's' : ''} ${missing.join(', ')} must belong to active members.` }
  }

  const guarantorsById = new Map(
    guarantors.map((guarantor) => [
      guarantor.staffId?.toUpperCase() || '',
      {
        staffId: guarantor.staffId || '',
        name: guarantor.name || 'Unnamed Member',
        department: guarantor.department || null,
        phone: guarantor.phone || null,
      },
    ])
  )

  const applicationData: LoanApplicationData = {
    applicant: {
      name: member.name || 'Unnamed Member',
      staffId: member.staffId,
      email: member.email,
      phone: member.phone,
      department: member.department,
      organization: 'Ummah Coop / FAAN',
      position: 'Member',
      bankName: member.bankName,
      bankAccountName: member.bankAccountName,
      bankAccountNumber: member.bankAccountNumber,
      thriftSavings: member.balance,
      specialSavings: member.specialBalance,
      monthlyContribution: member.monthlyContribution || 0,
      memberSince: member.createdAt.toISOString(),
    },
    loan: {
      type: parsed.data.loanType,
      amount: parsed.data.amount,
      durationMonths: parsed.data.duration,
      purpose: parsed.data.purpose,
    },
    guarantors: guarantorIds.map((staffId) => guarantorsById.get(staffId)!).filter(Boolean),
    policy: {
      maxLoanAmount,
      minimumTenureMonths: LOAN_REQUEST_POLICY.minTenureMonths,
      adminChargePercent: LOAN_REQUEST_POLICY.adminChargePercent,
    },
  }

  await prisma.loan.create({
    data: {
      userId: member.id,
      amount: parsed.data.amount,
      purpose: parsed.data.purpose,
      duration: parsed.data.duration,
      interestRate: LOAN_REQUEST_POLICY.adminChargePercent,
      status: 'PENDING',
      notes: buildApplicationNotes(applicationData),
      applicationData,
      disbursementBankName: member.bankName,
      disbursementAccountName: member.bankAccountName,
      disbursementAccountNumber: member.bankAccountNumber,
    },
  })

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/apply-loan')
  revalidatePath('/dashboard/my-loans')
  revalidatePath('/dashboard/loans')

  return { success: true }
}
