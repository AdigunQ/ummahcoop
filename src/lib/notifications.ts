type NewMemberRegistration = {
  name: string
  staffId: string
  savingsPlan: string
  thriftAmount: number
  specialAmount: number
  submittedAt: Date
}

function configuredAdminEmails(): string[] {
  return (process.env.ADMIN_NOTIFICATION_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
}

export async function notifyAdminsOfNewMember(member: NewMemberRegistration): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL
  const recipients = configuredAdminEmails()

  // Registration must remain available before an email provider is configured.
  if (!apiKey || !from || recipients.length === 0) {
    console.warn('New member email skipped: notification environment variables are not configured.')
    return
  }

  const submittedAt = member.submittedAt.toLocaleString('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Lagos',
  })

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: recipients,
      subject: `New Ummah Coop membership request: ${member.name}`,
      text: [
        'A new member has registered and is waiting for admin approval.',
        '',
        `Name: ${member.name}`,
        `Staff ID: ${member.staffId}`,
        `Savings plan: ${member.savingsPlan}`,
        `Monthly thrift savings: N${member.thriftAmount.toLocaleString('en-NG')}`,
        `Monthly special savings: N${member.specialAmount.toLocaleString('en-NG')}`,
        `Submitted: ${submittedAt}`,
        '',
        'Review the request in the Admin dashboard under Member Approvals.',
      ].join('\n'),
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Registration email failed (${response.status}): ${detail.slice(0, 200)}`)
  }
}
