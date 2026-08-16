import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date))
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function generateReference(): string {
  const prefix = 'COOP'
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `${prefix}-${timestamp}-${random}`
}

export function calculateLoanDetails(principal: number, durationMonths: number, interestRate: number = 5) {
  const interest = principal * (interestRate / 100)
  const totalRepayable = principal + interest
  const monthlyPayment = totalRepayable / durationMonths
  
  return {
    principal,
    interest,
    totalRepayable,
    monthlyPayment,
    duration: durationMonths,
  }
}

export function getLoanEligibility(totalThriftSavings: number): number {
  // Keep this legacy helper aligned with the rule: thrift only, never special savings.
  return Math.max(0, Number(totalThriftSavings) || 0) * 2
}

export function getInitials(name: string | null): string {
  if (!name) return 'U'
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2)
}
