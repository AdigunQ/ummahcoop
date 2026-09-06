'use client'

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Eye,
  EyeOff,
  HeartHandshake,
  Info,
  KeyRound,
  Loader2,
  LockKeyhole,
  MapPin,
  ShieldCheck,
  Undo2,
  UserRound,
} from 'lucide-react'
import { changePassword, updateProfile } from './actions'
import toast from 'react-hot-toast'
import { formatDate, getInitials } from '@/lib/utils'
import { SmartSelect } from '@/components/ui/smart-select'
import {
  DEPARTMENT_OPTIONS,
  GRADE_LEVEL_OPTIONS,
  ORGANIZATION_OPTIONS,
  STATION_OPTIONS,
} from '@/lib/profile-options'

type MemberProfile = {
  name: string | null
  email: string
  phone: string | null
  staffId: string | null
  department: string | null
  savingsPlan: string | null
  organization: string | null
  station: string | null
  gradeLevel: string | null
  nextOfKinName: string | null
  nextOfKinPhone: string | null
  nextOfKinEmail: string | null
  nextOfKinRelationship: string | null
  bankName: string | null
  bankAccountNumber: string | null
  bankAccountName: string | null
  createdAt: string
  totalContributions: number
  loanRequestedAmount: number
  loanRequestedCount: number
}
const fieldKeys = [
  'name',
  'email',
  'phone',
  'organization',
  'department',
  'station',
  'gradeLevel',
  'nextOfKinName',
  'nextOfKinPhone',
  'nextOfKinEmail',
  'nextOfKinRelationship',
  'bankName',
  'bankAccountNumber',
  'bankAccountName',
] as const
type FieldKey = (typeof fieldKeys)[number]
type Draft = Record<FieldKey, string>
type Tab = 'personal' | 'employment' | 'kin' | 'bank' | 'security'
const sections = [
  {
    id: 'personal',
    label: 'Personal information',
    short: 'Personal',
    icon: UserRound,
    description: 'The basics that make this account yours.',
    note: 'Your Staff ID stays the same. Use it to sign in, even if you change your contact details.',
  },
  {
    id: 'employment',
    label: 'Employment',
    short: 'Employment',
    icon: Building2,
    description: 'Tell us where you work.',
    note: 'Accurate work details help the cooperative manage your payroll contributions and contact your department.',
  },
  {
    id: 'kin',
    label: 'Next of kin',
    short: 'Next of kin',
    icon: HeartHandshake,
    description: 'Someone we can reach when it matters.',
    note: 'Please make sure your next of kin knows that you have shared their contact details with the cooperative.',
  },
  {
    id: 'bank',
    label: 'Bank account',
    short: 'Bank account',
    icon: CreditCard,
    description: 'Your destination for approved payouts.',
    note: 'Double-check these details. Approved loans and withdrawals are paid into this account.',
  },
  {
    id: 'security',
    label: 'Security',
    short: 'Security',
    icon: ShieldCheck,
    description: 'Keep your account in your hands.',
    note: 'Use a password that is unique to your cooperative account. Never share it with anyone.',
  },
] as const
const orgNames: Record<string, string> = {
  FAAN: 'Federal Airports Authority of Nigeria',
  AAAU: 'African Aviation and Aerospace University',
  NCAA: 'Nigerian Civil Aviation Authority',
  NCAT: 'Nigerian College of Aviation Technology',
  NAMA: 'Nigerian Airspace Management Agency',
  NiMet: 'Nigerian Meteorological Agency',
  NSIB: 'Nigerian Safety Investigation Bureau',
}
function makeDraft(member: MemberProfile): Draft {
  const result = Object.fromEntries(fieldKeys.map((key) => [key, member[key] || ''])) as Draft
  const staff = (member.staffId || '').toLowerCase()
  const email = result.email.toLowerCase()
  if (
    email.endsWith('@internal.ummahcoop') ||
    email === `${staff}@faan-ummah.coop` ||
    email === `${staff}@ummahcoop.org` ||
    email.startsWith(`member-${staff}@`)
  )
    result.email = ''
  return result
}

export default function ProfileView({
  member,
  mustChangePassword = false,
}: {
  member: MemberProfile
  mustChangePassword?: boolean
}) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>(mustChangePassword ? 'security' : 'personal')
  const [saved, setSaved] = useState<Draft>(() => makeDraft(member))
  const [draft, setDraft] = useState<Draft>(() => makeDraft(member))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedNotice, setSavedNotice] = useState(false)
  const changedKeys = fieldKeys.filter((key) => draft[key] !== saved[key])
  const dirty = changedKeys.length > 0
  const syncedMember = useRef(member)
  useEffect(() => {
    if (syncedMember.current === member || dirty || saving) return
    syncedMember.current = member
    const fresh = makeDraft(member)
    setSaved(fresh)
    setDraft(fresh)
  }, [member, dirty, saving])
  const section = sections.find((item) => item.id === tab)!
  const filled = [
    draft.name,
    draft.phone,
    draft.email,
    draft.organization,
    draft.department,
    draft.station,
    draft.gradeLevel,
    draft.nextOfKinName,
    draft.nextOfKinPhone,
    draft.bankName,
    draft.bankAccountNumber,
  ].filter(Boolean).length
  const completion = Math.round((filled / 11) * 100)
  function set(field: FieldKey, value: string) {
    setDraft((current) => ({ ...current, [field]: value }))
    setSavedNotice(false)
    setError('')
  }
  function discard() {
    setDraft({ ...saved })
    setError('')
    setSavedNotice(false)
  }
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!dirty || saving) return
    if (!draft.name.trim()) {
      setError('Please enter your full name.')
      setTab('personal')
      return
    }
    const data = new FormData()
    for (const key of changedKeys) data.set(key, draft[key])
    setSaving(true)
    setError('')
    try {
      const result = await updateProfile(data)
      if (result?.error) {
        setError(result.error)
        return
      }
      setSaved({ ...draft })
      setSavedNotice(true)
      toast.success('Your profile is up to date.')
      router.refresh()
    } catch {
      setError('Your changes could not be saved. Please try again.')
    } finally {
      setSaving(false)
    }
  }
  const input = (
    key: FieldKey,
    label: string,
    options: {
      type?: string
      placeholder?: string
      hint?: string
      required?: boolean
      span?: boolean
    } = {}
  ) => (
    <SettingsField
      key={key}
      label={label}
      hint={options.hint}
      className={options.span ? 'sm:col-span-2' : ''}
    >
      <input
        name={key}
        aria-label={label}
        data-testid={`profile-${key}-input`}
        type={options.type || 'text'}
        value={draft[key]}
        onChange={(event) => set(key, event.target.value)}
        placeholder={options.placeholder}
        required={options.required}
        disabled={saving}
        className="settings-input"
        autoComplete={
          key === 'email' ? 'email' : key === 'phone' ? 'tel' : key === 'name' ? 'name' : 'off'
        }
      />
    </SettingsField>
  )

  return (
    <div className="settings-workspace">
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            My account <ChevronRight className="mx-1 inline h-3 w-3" /> Settings
          </p>
          <h1 className="text-[2rem] font-semibold tracking-normal">Make yourself at home.</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your details, all in one place. Update them whenever life changes.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#e4ead8] text-sm font-semibold text-[#36513b]">
            {getInitials(member.name)}
          </span>
          <div>
            <p className="text-sm font-medium">{member.name || 'Member'}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Member since {formatDate(member.createdAt)}
            </p>
          </div>
        </div>
      </header>
      <nav className="settings-tabs" aria-label="Profile settings">
        {sections.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={mustChangePassword && item.id !== 'security'}
            onClick={() => {
              setTab(item.id)
              setError('')
            }}
            aria-current={tab === item.id ? 'page' : undefined}
            className={tab === item.id ? 'active' : ''}
          >
            <item.icon className="h-4 w-4" />
            <span>{item.short}</span>
          </button>
        ))}
      </nav>
      <div className="settings-body">
        <aside className="settings-context">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border bg-surface text-accent">
            <section.icon className="h-5 w-5" />
          </div>
          <h2 className="text-xl font-semibold tracking-normal">{section.label}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{section.description}</p>
          <div className="mt-8 hidden border-t pt-5 lg:block">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Profile completeness</span>
              <span className="font-medium">{completion}%</span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-accent transition-[width]"
                style={{ width: `${completion}%` }}
              />
            </div>
            <p className="mt-4 text-xs leading-6 text-muted-foreground">{section.note}</p>
          </div>
          <p className="mt-7 hidden items-center gap-2 text-xs text-muted-foreground lg:flex">
            <LockKeyhole className="h-3.5 w-3.5" /> Only visible to you and your cooperative.
          </p>
        </aside>
        {tab === 'security' ? (
          <PasswordSettings mustChangePassword={mustChangePassword} />
        ) : (
          <form onSubmit={save} className="settings-panel" data-testid="profile-settings-form">
            <div className="settings-form-content" key={tab}>
              {tab === 'personal' && (
                <>
                  <FormSection
                    title="A little about you"
                    description="Use your name as it appears on your staff records."
                  >
                    {input('name', 'Full name', { placeholder: 'Your full name', required: true })}
                    <SettingsField label="Staff ID" hint="Your permanent sign-in ID">
                      <div className="settings-input flex items-center justify-between !bg-surface-2 text-muted-foreground">
                        <span>{member.staffId || 'Not assigned'}</span>
                        <LockKeyhole className="h-3.5 w-3.5" />
                      </div>
                    </SettingsField>
                  </FormSection>
                  <FormSection
                    title="Stay connected"
                    description="Keep your contact details current so we can reach you."
                  >
                    {input('email', 'Email address', {
                      type: 'email',
                      placeholder: 'you@example.com',
                    })}
                    {input('phone', 'Phone number', { type: 'tel', placeholder: '0800 000 0000' })}
                  </FormSection>
                  <div className="settings-note">
                    <Info className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>
                      Your Staff ID is always your username. Updating your email or phone number
                      does not change how you sign in.
                    </p>
                  </div>
                </>
              )}
              {tab === 'employment' && (
                <>
                  <FormSection
                    title="Where you work"
                    description="Select your organization and department."
                  >
                    <SettingsField label="Organization" className="sm:col-span-2">
                      <SmartSelect
                        name="organization"
                        label="Organization"
                        value={draft.organization}
                        onChange={(value) => set('organization', value)}
                        options={[
                          ORGANIZATION_OPTIONS[0],
                          ...ORGANIZATION_OPTIONS.slice(1).sort((a, b) => a.localeCompare(b)),
                        ].map((value) => ({
                          value,
                          label: value,
                          description: orgNames[value],
                          badge: value.slice(0, 2),
                        }))}
                        placeholder="Find your organization"
                        disabled={saving}
                        data-testid="profile-organization-input"
                      />
                    </SettingsField>
                    <SettingsField label="Department" className="sm:col-span-2">
                      <SmartSelect
                        name="department"
                        label="Department"
                        value={draft.department}
                        onChange={(value) => set('department', value)}
                        options={DEPARTMENT_OPTIONS}
                        placeholder="Find your department"
                        disabled={saving}
                        data-testid="profile-department-input"
                      />
                    </SettingsField>
                  </FormSection>
                  <FormSection
                    title="Your posting"
                    description="Help us connect your membership to the right station."
                  >
                    <SettingsField label="Station" className="sm:col-span-2">
                      <SmartSelect
                        name="station"
                        label="Station"
                        value={draft.station}
                        onChange={(value) => set('station', value)}
                        options={STATION_OPTIONS.map((value) => ({
                          value,
                          label: value.split(' - ')[0],
                          description: value.split(' - ')[1],
                          badge: value.match(/\(([A-Z]+)\)/)?.[1],
                        }))}
                        placeholder="Search for your station"
                        disabled={saving}
                        data-testid="profile-station-input"
                      />
                    </SettingsField>
                    <SettingsField label="Grade level">
                      <SmartSelect
                        name="gradeLevel"
                        label="Grade level"
                        value={draft.gradeLevel}
                        onChange={(value) => set('gradeLevel', value)}
                        options={GRADE_LEVEL_OPTIONS.map((value) => ({
                          value,
                          label: `Grade level ${value}`,
                          badge: value,
                        }))}
                        placeholder="Select grade level"
                        disabled={saving}
                        data-testid="profile-grade-level-input"
                      />
                    </SettingsField>
                  </FormSection>
                </>
              )}
              {tab === 'kin' && (
                <>
                  <FormSection
                    title="Your trusted contact"
                    description="Who should we contact in an emergency?"
                  >
                    {input('nextOfKinName', 'Full name', { placeholder: 'Their full name' })}
                    {input('nextOfKinRelationship', 'Relationship', {
                      placeholder: 'e.g. Spouse, parent, sibling',
                    })}
                  </FormSection>
                  <FormSection
                    title="How to reach them"
                    description="Please provide a number they use regularly."
                  >
                    {input('nextOfKinPhone', 'Phone number', {
                      type: 'tel',
                      placeholder: '0800 000 0000',
                    })}
                    {input('nextOfKinEmail', 'Email address', {
                      type: 'email',
                      placeholder: 'Optional email address',
                    })}
                  </FormSection>
                  <div className="settings-note">
                    <HeartHandshake className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>These details are held by the cooperative for your membership records.</p>
                  </div>
                </>
              )}
              {tab === 'bank' && (
                <>
                  <div className="mb-7 flex items-start gap-4 rounded-xl bg-surface-2 p-5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-accent">
                      <CreditCard className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Your payout account</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Approved loans and withdrawals will be sent here. Make sure the account
                        belongs to you.
                      </p>
                    </div>
                  </div>
                  <FormSection
                    title="Bank details"
                    description="Enter your bank and account information."
                  >
                    {input('bankName', 'Bank name', { placeholder: 'Your bank name', span: true })}
                    {input('bankAccountNumber', 'Account number', {
                      placeholder: 'Your account number',
                    })}
                    {input('bankAccountName', 'Account holder name', {
                      placeholder: 'Name on the account',
                    })}
                  </FormSection>
                </>
              )}
            </div>
            <footer className="settings-savebar">
              <div className="min-w-0 flex-1">
                {error ? (
                  <p role="alert" className="text-xs text-rose-600">
                    {error}
                  </p>
                ) : dirty ? (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    {changedKeys.length} unsaved change{changedKeys.length !== 1 ? 's' : ''}
                  </p>
                ) : (
                  <p
                    role="status"
                    className="flex items-center gap-2 text-xs text-muted-foreground"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-accent" />
                    {savedNotice ? 'Changes saved' : 'No unsaved changes'}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={discard}
                disabled={!dirty || saving}
                className="settings-discard"
                data-testid="profile-discard"
              >
                Discard
              </button>
              <button
                type="submit"
                disabled={!dirty || saving}
                className="btn-primary !min-h-10 !py-2.5"
                data-testid="profile-save"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                {saving ? 'Saving...' : 'Save changes'}
              </button>
            </footer>
          </form>
        )}
      </div>
    </div>
  )
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="settings-section">
      <div className="mb-6">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">{children}</div>
    </section>
  )
}
function SettingsField({
  label,
  hint,
  children,
  className = '',
}: {
  label: string
  hint?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <div className="mb-2.5 text-xs font-medium">{label}</div>
      {children}
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function PasswordSettings({ mustChangePassword }: { mustChangePassword: boolean }) {
  const router = useRouter()
  const [values, setValues] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [visible, setVisible] = useState<Record<string, boolean>>({})
  const checks = [
    { label: 'At least 6 characters', done: values.newPassword.length >= 6 },
    {
      label: 'Different from your current password',
      done: !!values.newPassword && values.newPassword !== values.currentPassword,
    },
    {
      label: 'Both new passwords match',
      done: !!values.newPassword && values.newPassword === values.confirmPassword,
    },
  ]
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setError('')
    const data = new FormData()
    Object.entries(values).forEach(([key, value]) => data.set(key, value))
    try {
      const result = await changePassword(data)
      if (result?.error) {
        setError(result.error)
        return
      }
      setValues({ currentPassword: '', newPassword: '', confirmPassword: '' })
      toast.success('Password updated.')
      if (mustChangePassword) window.location.assign('/dashboard')
      else router.refresh()
    } catch {
      setError('Could not update your password. Please try again.')
    } finally {
      setSaving(false)
    }
  }
  return (
    <form onSubmit={submit} className="settings-panel">
      <div className="settings-form-content">
        <div className="mb-7 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-accent">
            <KeyRound className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-sm font-semibold">Change your password</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              A small step to keep your account protected.
            </p>
          </div>
        </div>
        {mustChangePassword && (
          <div className="settings-note mb-6">
            <Info className="h-4 w-4 shrink-0" />
            <p>Set a new password before continuing. Your initial password is your Staff ID.</p>
          </div>
        )}
        <div className="space-y-5">
          {(
            [
              ['currentPassword', 'Current password'],
              ['newPassword', 'New password'],
              ['confirmPassword', 'Confirm new password'],
            ] as const
          ).map(([key, label]) => (
            <SettingsField key={key} label={label}>
              <div className="relative">
                <input
                  name={key}
                  aria-label={label}
                  value={values[key]}
                  onChange={(event) => {
                    setValues((current) => ({ ...current, [key]: event.target.value }))
                    setError('')
                  }}
                  type={visible[key] ? 'text' : 'password'}
                  required
                  minLength={key === 'currentPassword' ? undefined : 6}
                  autoComplete={key === 'currentPassword' ? 'current-password' : 'new-password'}
                  className="settings-input !pr-12"
                  placeholder={label}
                  disabled={saving}
                />
                <button
                  type="button"
                  aria-label={`${visible[key] ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
                  onClick={() => setVisible((current) => ({ ...current, [key]: !current[key] }))}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {visible[key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </SettingsField>
          ))}
        </div>
        <div className="mt-6 space-y-2">
          {checks.map((check) => (
            <p
              key={check.label}
              className={`flex items-center gap-2 text-xs ${check.done ? 'text-accent' : 'text-muted-foreground'}`}
            >
              <CheckCircle2 className={`h-3.5 w-3.5 ${check.done ? '' : 'opacity-30'}`} />
              {check.label}
            </p>
          ))}
        </div>
      </div>
      <footer className="settings-savebar">
        <p role="alert" className="flex-1 text-xs text-rose-600">
          {error}
        </p>
        <button
          type="submit"
          disabled={saving || !values.currentPassword || checks.some((check) => !check.done)}
          className="btn-primary"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LockKeyhole className="h-4 w-4" />
          )}
          Update password
        </button>
      </footer>
    </form>
  )
}
