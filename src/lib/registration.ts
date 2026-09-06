import { z } from 'zod'

const amountSchema = z.preprocess(
  (value) => {
    if (value === undefined || value === null || value === '') return undefined
    const amount = typeof value === 'string' ? Number(value.replace(/,/g, '')) : value
    return amount === 0 ? undefined : amount
  },
  z.number({ invalid_type_error: 'Enter a valid monthly amount' }).finite().positive('Monthly amount must be greater than zero').max(1_000_000_000, 'Monthly amount is too large').optional()
)

export const registerPayloadSchema = z.object({
  name: z.string().trim().min(1, 'Full name is required'),
  staffId: z.string().trim().min(1, 'Staff ID is required').regex(/^[a-zA-Z0-9-]+$/, 'Use only letters, numbers, or hyphens for your Staff ID'),
  phone: z.string().trim().optional(),
  savingsPlan: z.enum(['THRIFT', 'SPECIAL', 'BOTH'], { errorMap: () => ({ message: 'Choose a savings plan' }) }),
  thriftAmount: amountSchema,
  specialAmount: amountSchema,
  department: z.string().trim().optional(),
  bankName: z.string().trim().optional(),
  bankAccountNumber: z.string().trim().optional(),
  bankAccountName: z.string().trim().optional(),
  password: z.string().min(6, 'Use at least 6 characters'),
  confirmPassword: z.string().min(6, 'Confirm your password'),
}).superRefine((data, context) => {
  const usesThrift = data.savingsPlan === 'THRIFT' || data.savingsPlan === 'BOTH'
  const usesSpecial = data.savingsPlan === 'SPECIAL' || data.savingsPlan === 'BOTH'

  if (usesThrift && !data.thriftAmount) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['thriftAmount'], message: 'Monthly thrift amount is required' })
  }
  if (usesSpecial && !data.specialAmount) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['specialAmount'], message: 'Monthly special amount is required' })
  }
  if (data.password !== data.confirmPassword) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['confirmPassword'], message: 'Passwords do not match' })
  }
})
