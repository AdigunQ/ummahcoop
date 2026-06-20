'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2,
  CalendarDays,
  Check,
  CreditCard,
  HandCoins,
  Hash,
  Landmark,
  Mail,
  Pencil,
  PhoneCall,
  Save,
  ShieldCheck,
  User,
  X,
} from 'lucide-react'
import { changePassword, updateProfile } from './actions'
import toast from 'react-hot-toast'
import { formatCurrency, formatDate, getInitials } from '@/lib/utils'

type MemberProfile = {
  name: string | null
  email: string
  phone: string | null
  staffId: string | null
  department: string | null
  bankName: string | null
  bankAccountNumber: string | null
  bankAccountName: string | null
  createdAt: string
  totalContributions: number
  loanRequestedAmount: number
  loanRequestedCount: number
}

export default function ProfileView({
  member,
  mustChangePassword = false,
}: {
  member: MemberProfile
  mustChangePassword?: boolean
}) {
  const router = useRouter()
  const [isEditingBank, setIsEditingBank] = useState(false)
  const [isEditingPhone, setIsEditingPhone] = useState(false)
  const [isEditingEmail, setIsEditingEmail] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(mustChangePassword)
  const displayEmail = isGeneratedMemberEmail(member.email, member.staffId) ? 'Not set' : member.email

  async function handleSave(formData: FormData) {
    const res = await updateProfile(formData)
    if (res?.error) {
      toast.error(res.error)
    } else {
      toast.success('Profile updated')
      setIsEditingBank(false)
      setIsEditingPhone(false)
      setIsEditingEmail(false)
      router.refresh()
    }
  }

  async function handlePasswordChange(formData: FormData) {
    const res = await changePassword(formData)
    if (res?.error) {
      toast.error(res.error)
    } else {
      toast.success('Password changed')
      setIsChangingPassword(false)
      router.refresh()
      if (mustChangePassword) {
        window.location.assign('/dashboard')
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Identity strip */}
      <section className="card relative overflow-hidden p-6 sm:p-7">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/[0.07] via-transparent to-transparent" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/15 text-xl font-semibold text-accent">
              {getInitials(member.name)}
            </div>
            <div>
              <p className="label-eyebrow">Profile</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">{member.name || 'Member'}</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">{displayEmail}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Chip icon={Hash} label={`ID · ${member.staffId || 'N/A'}`} />
            <Chip icon={Building2} label={member.department || 'No dept.'} />
            <Chip icon={CalendarDays} label={formatDate(member.createdAt)} />
          </div>
        </div>
      </section>

      {/* KPI cards */}
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          icon={CalendarDays}
          label="Joined"
          value={formatDate(member.createdAt)}
          note="Membership start date"
          tone="slate"
        />
        <StatCard
          icon={Landmark}
          label="Total contributed"
          value={formatCurrency(member.totalContributions)}
          note="Thrift + special savings"
          tone="emerald"
        />
        <StatCard
          icon={HandCoins}
          label="Loan requested"
          value={formatCurrency(member.loanRequestedAmount)}
          note={
            member.loanRequestedCount > 0
              ? `${member.loanRequestedCount} request${member.loanRequestedCount === 1 ? '' : 's'} so far`
              : 'No loan requests yet'
          }
          tone="indigo"
        />
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Personal */}
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: 'rgb(var(--border))' }}>
            <div>
              <p className="label-eyebrow">Identity</p>
              <h2 className="mt-1 text-base font-semibold tracking-tight">Personal information</h2>
            </div>
          </div>

          <div className="divide-y" style={{ borderColor: 'rgb(var(--border))' }}>
            <Row icon={User} label="Name" value={member.name || 'N/A'} />
            <form action={handleSave}>
              <div className="flex items-center gap-3 px-5 py-3.5">
                <Mail className="h-4 w-4 flex-none text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Email</span>
                <div className="ml-auto flex flex-1 items-center justify-end gap-2">
                  {isEditingEmail ? (
                    <>
                      <input
                        name="email"
                        type="email"
                        data-testid="profile-email-input"
                        defaultValue={displayEmail === 'Not set' ? '' : member.email}
                        placeholder="name@example.com"
                        className="input-base !py-2 !text-sm sm:max-w-[240px]"
                        required
                      />
                      <button
                        type="submit"
                        data-testid="profile-email-save"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 transition hover:bg-emerald-500/25 dark:text-emerald-400"
                      >
                        <Save className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingEmail(false)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/15 text-rose-600 transition hover:bg-rose-500/25 dark:text-rose-400"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="truncate text-sm font-semibold">{displayEmail}</span>
                      <button
                        type="button"
                        onClick={() => setIsEditingEmail(true)}
                        data-testid="profile-email-edit"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border text-muted-foreground transition hover:border-ring/40 hover:text-foreground"
                        style={{ borderColor: 'rgb(var(--border))' }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </form>
            <Row icon={Hash} label="Staff ID" value={member.staffId || 'N/A'} />
            <Row icon={Building2} label="Department" value={member.department || 'N/A'} />

            <form action={handleSave}>
              <div className="flex items-center gap-3 px-5 py-3.5">
                <PhoneCall className="h-4 w-4 flex-none text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Phone</span>
                <div className="ml-auto flex flex-1 items-center justify-end gap-2">
                  {isEditingPhone ? (
                    <>
                      <input
                        name="phone"
                        data-testid="profile-phone-input"
                        defaultValue={member.phone || ''}
                        className="input-base !py-2 !text-sm sm:max-w-[200px]"
                        required
                      />
                      <button
                        type="submit"
                        data-testid="profile-phone-save"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 transition hover:bg-emerald-500/25 dark:text-emerald-400"
                      >
                        <Save className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingPhone(false)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/15 text-rose-600 transition hover:bg-rose-500/25 dark:text-rose-400"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm font-semibold">{member.phone || 'N/A'}</span>
                      <button
                        type="button"
                        onClick={() => setIsEditingPhone(true)}
                        data-testid="profile-phone-edit"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border text-muted-foreground transition hover:border-ring/40 hover:text-foreground"
                        style={{ borderColor: 'rgb(var(--border))' }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </form>
          </div>
        </section>

        {/* Bank */}
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: 'rgb(var(--border))' }}>
            <div>
              <p className="label-eyebrow">Payout</p>
              <h2 className="mt-1 text-base font-semibold tracking-tight">Bank details</h2>
            </div>
            {!isEditingBank && (
              <button
                onClick={() => setIsEditingBank(true)}
                data-testid="profile-bank-edit"
                className="btn-ghost !py-1.5 !px-3 !text-xs"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
            )}
          </div>

          {isEditingBank ? (
            <form action={handleSave} className="space-y-4 p-5 animate-fadeIn">
              <Field label="Bank name">
                <input
                  name="bankName"
                  data-testid="profile-bank-name-input"
                  defaultValue={member.bankName || ''}
                  className="input-base"
                  required
                />
              </Field>
              <Field label="Account number">
                <input
                  name="bankAccountNumber"
                  data-testid="profile-bank-account-number-input"
                  defaultValue={member.bankAccountNumber || ''}
                  className="input-base font-mono"
                  required
                />
              </Field>
              <Field label="Account name">
                <input
                  name="bankAccountName"
                  data-testid="profile-bank-account-name-input"
                  defaultValue={member.bankAccountName || ''}
                  className="input-base"
                  required
                />
              </Field>
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  data-testid="profile-bank-save"
                  className="btn-primary flex-1 !py-2.5 !text-sm"
                >
                  <Check className="h-4 w-4" />
                  Save changes
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingBank(false)}
                  className="btn-ghost !py-2.5 !px-4 !text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="divide-y" style={{ borderColor: 'rgb(var(--border))' }}>
              <Row icon={Landmark} label="Bank" value={member.bankName || 'Not set'} />
              <Row icon={CreditCard} label="Account no." value={member.bankAccountNumber || 'Not set'} mono />
              <Row icon={User} label="Account name" value={member.bankAccountName || 'Not set'} />
            </div>
          )}
        </section>
      </div>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: 'rgb(var(--border))' }}>
          <div>
            <p className="label-eyebrow">Security</p>
            <h2 className="mt-1 text-base font-semibold tracking-tight">Password</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {mustChangePassword
                ? 'Please change your first-time Staff ID password before using the rest of the dashboard.'
                : 'Members added manually can sign in first with Staff ID as password, then change it here.'}
            </p>
          </div>
          {!isChangingPassword && !mustChangePassword && (
            <button
              type="button"
              onClick={() => setIsChangingPassword(true)}
              className="btn-ghost !py-1.5 !px-3 !text-xs"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Change
            </button>
          )}
        </div>

        {mustChangePassword && (
          <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900">
            Your current password is still your Staff ID. Enter your Staff ID as the current password, then choose a new password.
          </div>
        )}

        {isChangingPassword ? (
          <form action={handlePasswordChange} className="grid gap-4 p-5 md:grid-cols-3">
            <Field label="Current password">
              <input
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                className="input-base"
                required
              />
            </Field>
            <Field label="New password">
              <input
                name="newPassword"
                type="password"
                autoComplete="new-password"
                minLength={6}
                className="input-base"
                required
              />
            </Field>
            <Field label="Confirm password">
              <input
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={6}
                className="input-base"
                required
              />
            </Field>
            <div className="flex gap-2 md:col-span-3">
              <button type="submit" className="btn-primary !py-2.5 !text-sm">
                <Check className="h-4 w-4" />
                Save password
              </button>
              <button
                type="button"
                onClick={() => setIsChangingPassword(false)}
                className={`btn-ghost !py-2.5 !px-4 !text-sm ${mustChangePassword ? 'hidden' : ''}`}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="flex items-center gap-3 px-5 py-4 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4 flex-none text-muted-foreground" />
            <span>Your password protects member dashboard access and loan request submission.</span>
          </div>
        )}
      </section>
    </div>
  )
}

function isGeneratedMemberEmail(email: string, staffId: string | null) {
  if (!staffId) return false
  const normalizedEmail = email.trim().toLowerCase()
  const normalizedStaffId = staffId.trim().replace(/\s+/g, '').toLowerCase()

  return (
    normalizedEmail === `${normalizedStaffId}@faan-ummah.coop` ||
    normalizedEmail === `${normalizedStaffId}@ummahcoop.org` ||
    normalizedEmail.startsWith(`member-${normalizedStaffId}@`)
  )
}

function Row({ icon: Icon, label, value, mono }: { icon: any; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <Icon className="h-4 w-4 flex-none text-muted-foreground" />
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`ml-auto truncate text-sm font-semibold ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  )
}

function Chip({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
      style={{ borderColor: 'rgb(var(--border))' }}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  note,
  tone,
}: {
  icon: any
  label: string
  value: string
  note: string
  tone: 'emerald' | 'indigo' | 'slate'
}) {
  const tones: Record<typeof tone, string> = {
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    indigo: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    slate: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
  }

  return (
    <div className="card card-hover p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="label-eyebrow">{label}</p>
          <p className="mt-2 truncate text-xl font-semibold tracking-tight">{value}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{note}</p>
        </div>
        <div className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}
