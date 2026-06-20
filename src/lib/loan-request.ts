export const LOAN_REQUEST_POLICY = {
  minTenureMonths: 0,
  maxSavingsMultiplier: 2,
  adminChargePercent: 5,
} as const

export type LoanGuarantor = {
  staffId: string
  name: string
  department: string | null
  phone: string | null
}

export type LoanApplicationData = {
  applicant: {
    name: string
    staffId: string
    email: string
    phone: string | null
    department: string | null
    organization: string
    position: string
    bankName: string | null
    bankAccountName: string | null
    bankAccountNumber: string | null
    thriftSavings: number
    specialSavings: number
    monthlyContribution: number
    memberSince: string
  }
  loan: {
    type: string
    amount: number
    durationMonths: number
    purpose: string
  }
  guarantors: LoanGuarantor[]
  policy: {
    maxLoanAmount: number
    minimumTenureMonths: number
    adminChargePercent: number
  }
}

export function getLoanLimit(thriftSavings: number): number {
  return Math.max(0, thriftSavings) * LOAN_REQUEST_POLICY.maxSavingsMultiplier
}

export function hasLoanTenureElapsed(createdAt: Date, now = new Date()): boolean {
  return true
}

export function normalizeGuarantorStaffId(value: string): string {
  return value.trim().replace(/\s+/g, '').toUpperCase()
}

export function sanitizeLoanApplicationData(value: unknown): LoanApplicationData | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const data = value as Partial<LoanApplicationData>
  if (!data.applicant || !data.loan || !Array.isArray(data.guarantors) || !data.policy) {
    return null
  }

  return {
    applicant: {
      name: String(data.applicant.name || ''),
      staffId: String(data.applicant.staffId || ''),
      email: String(data.applicant.email || ''),
      phone: data.applicant.phone ?? null,
      department: data.applicant.department ?? null,
      organization: String(data.applicant.organization || ''),
      position: String(data.applicant.position || ''),
      bankName: data.applicant.bankName ?? null,
      bankAccountName: data.applicant.bankAccountName ?? null,
      bankAccountNumber: data.applicant.bankAccountNumber ?? null,
      thriftSavings: Number(data.applicant.thriftSavings || 0),
      specialSavings: Number(data.applicant.specialSavings || 0),
      monthlyContribution: Number(data.applicant.monthlyContribution || 0),
      memberSince: String(data.applicant.memberSince || ''),
    },
    loan: {
      type: String(data.loan.type || ''),
      amount: Number(data.loan.amount || 0),
      durationMonths: Number(data.loan.durationMonths || 0),
      purpose: String(data.loan.purpose || ''),
    },
    guarantors: data.guarantors
      .filter((guarantor): guarantor is LoanGuarantor => Boolean(guarantor) && typeof guarantor === 'object')
      .map((guarantor) => ({
        staffId: String(guarantor.staffId || ''),
        name: String(guarantor.name || ''),
        department: guarantor.department ?? null,
        phone: guarantor.phone ?? null,
      })),
    policy: {
      maxLoanAmount: Number(data.policy.maxLoanAmount || 0),
      minimumTenureMonths: Number(data.policy.minimumTenureMonths || LOAN_REQUEST_POLICY.minTenureMonths),
      adminChargePercent: Number(data.policy.adminChargePercent || LOAN_REQUEST_POLICY.adminChargePercent),
    },
  }
}
