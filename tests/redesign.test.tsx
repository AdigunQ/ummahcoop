import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { paginationState } from '../src/components/ui/pagination-state'
import { BalanceStrip, Pagination } from '../src/components/member/account-ui'
import { SmartSelect, FormSelect } from '../src/components/ui/smart-select'
import { AdminCollection, AdminReviewItem } from '../src/components/admin/admin-collection'
import { AdminDataTable } from '../src/components/admin/admin-data-table'
import { canOpenAdminRoute, canViewAdminOverview } from '../src/components/admin/overview-access'
import { AdminWorkspaceStart } from '../src/components/admin/workspace-start'
import { PRIVILEGE_CODES as P } from '../src/lib/privileges'
import { AuthShell } from '../src/components/public/auth-shell'
import { StatementDownload } from '../src/components/member/statement-download'
import DashboardLoading from '../src/app/dashboard/loading'
import NotFound from '../src/app/not-found'
import { selectPosition } from '../src/components/ui/select-position'

test('principal summaries distinguish the loan principal from administration charges', () => {
  const html = renderToStaticMarkup(
    <BalanceStrip collected={10000} paid={0} outstanding={10000}
      outstandingLabel="Principal outstanding" note="Charges are shown in loan details." />
  )
  assert.ok(html.includes('Principal outstanding'))
  assert.ok(html.includes('Charges are shown in loan details.'))
})

test('pagination stays on a real page after records are removed', () => {
  assert.deepEqual(paginationState(3, 8, 6), { page: 2, pages: 2, start: 6, end: 8 })
  assert.deepEqual(paginationState(4, 0, 12), { page: 1, pages: 1, start: 0, end: 0 })
  assert.equal(paginationState(0, 8, 6).page, 1)
  const html = renderToStaticMarkup(<Pagination page={3} total={8} size={6} onChange={() => {}} />)
  assert.ok(html.includes('7-8 of 8'))
  assert.match(html, /aria-label="Next page" disabled/)
})

test('dropdowns render without server layout-effect warnings and never submit forms', () => {
  const warnings: unknown[][] = []
  const warn = console.error
  console.error = (...args) => {
    warnings.push(args)
  }
  try {
    const html = renderToStaticMarkup(
      <SmartSelect
        name="staff"
        label="Staff ID"
        value="009709"
        onChange={() => {}}
        options={['009709']}
        required
      />
    )
    assert.ok(html.includes('value="009709"'))
    assert.match(html, /<button[^>]*type="button"/)
    assert.ok(html.includes('aria-required="true"'))
    assert.deepEqual(warnings, [])
  } finally {
    console.error = warn
  }
})

test('form select preserves an existing value not in the refreshed option list', () => {
  const html = renderToStaticMarkup(
    <FormSelect name="department" defaultValue="Existing department">
      <option value="Operations">Operations</option>
    </FormSelect>
  )
  assert.ok(html.includes('value="Existing department"'))
  assert.ok(html.includes('Existing department</span>'))
})

test('administrative shortcuts follow permissions, including commodity review', () => {
  assert.equal(canViewAdminOverview([P.APPROVE_MEMBERS]), false)
  assert.equal(canViewAdminOverview([P.VIEW_ANALYTICS]), true)
  assert.equal(canOpenAdminRoute('/dashboard/member-data', [P.VIEW_MEMBER_DATA]), true)
  assert.equal(canOpenAdminRoute('/dashboard/import-members', [P.VIEW_MEMBER_DATA]), false)
  assert.equal(canOpenAdminRoute('/dashboard/commodity?review=true', [P.REVIEW_COMMODITY]), true)
  assert.equal(canOpenAdminRoute('/dashboard/loans', []), false)
  assert.equal(canOpenAdminRoute('/dashboard/loans'), true)
})

test('limited staff see their permitted workspace, not the financial overview', () => {
  const html = renderToStaticMarkup(<AdminWorkspaceStart codes={[P.REVIEW_COMMODITY]} />)
  assert.ok(html.includes('/dashboard/commodity?review=true'))
  assert.ok(html.includes('/dashboard?view=member'))
  assert.ok(!html.includes('/dashboard/import-members'))
  assert.ok(!html.includes('Savings'))
})

test('review queues paginate instead of rendering every request', () => {
  const html = renderToStaticMarkup(
    <AdminCollection>
      {Array.from({ length: 12 }, (_, i) => (
        <AdminReviewItem key={i} heading={`Member ${i}`} searchText={`90000${i}`} status="PENDING">
          <p>Details</p>
        </AdminReviewItem>
      ))}
    </AdminCollection>
  )
  assert.equal((html.match(/class="admin-review-row"/g) || []).length, 8)
  assert.ok(html.includes('1-8 of 12'))
})

test('admin tables retain exact Staff IDs and paginate at twenty records', () => {
  const html = renderToStaticMarkup(
    <AdminDataTable
      columns={['Staff ID']}
      rows={Array.from({ length: 25 }, (_, i) => ({
        key: String(i),
        searchText: String(i),
        cells: [String(i).padStart(6, '0')],
      }))}
    />
  )
  assert.ok(html.includes('000001</td>'))
  assert.ok(!html.includes('000024</td>'))
  assert.ok(html.includes('1-20 of 25'))
})

test('readability scale keeps supporting text at 16px and normal text at 18px', async () => {
  const { readFileSync } = await import('node:fs')
  const { default: config } = await import('../tailwind.config')
  const size = config.theme?.extend?.fontSize as Record<string, [string, unknown]>
  assert.equal(size.xs[0], '1rem')
  assert.equal(size.base[0], '1.125rem')
  for (const file of [
    'src/app/globals.css',
    'src/app/admin-workspace.css',
    'src/app/auth-pages.css',
  ]) {
    const css = readFileSync(file, 'utf8')
    assert.doesNotMatch(css, /font-size:\s*(?:\d|1[0-5])px\b/)
    assert.doesNotMatch(css, /text-transform:\s*uppercase/)
  }
  const layout = readFileSync('src/app/layout.tsx', 'utf8')
  assert.ok(layout.includes('Source_Sans_3'))
  assert.ok(!layout.includes('maximumScale') && !layout.includes('userScalable: false'))
})

test('main text and muted text retain at least 4.5:1 contrast on both themes', async () => {
  const { readFileSync } = await import('node:fs')
  const css = readFileSync('src/app/globals.css', 'utf8')
  const luminance = (rgb: number[]) =>
    rgb
      .map((value) => {
        const channel = value / 255
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
      })
      .reduce((total, value, i) => total + value * [0.2126, 0.7152, 0.0722][i], 0)
  for (const selector of [':root', '.dark']) {
    const block = css.slice(css.indexOf(`${selector} {`)).split('}')[0]
    const color = (name: string) => {
      const match = block.match(new RegExp(`--${name}: ([\\d ]+);`))
      assert.ok(match, `Missing ${name}`)
      return luminance(match[1].split(' ').map(Number))
    }
    for (const foreground of ['fg', 'muted-fg']) {
      for (const background of ['bg', 'surface', 'surface-2']) {
        const light = color(foreground),
          dark = color(background)
        const ratio = (Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05)
        assert.ok(ratio >= 4.5, `${selector} ${foreground} on ${background}: ${ratio.toFixed(2)}`)
      }
    }
  }
})

test('authentication pages keep a named form region and home navigation in both layouts', () => {
  for (const registration of [false, true]) {
    const html = renderToStaticMarkup(
      <AuthShell registration={registration}>
        <form>
          <label>
            Staff ID
            <input name="staffId" />
          </label>
          <button type="submit">Continue</button>
        </form>
      </AuthShell>
    )
    assert.ok(html.includes(`data-page="${registration ? 'register' : 'login'}"`))
    assert.ok(html.includes('href="#auth-form"'))
    assert.ok(html.includes('aria-label="Back to home"'))
    assert.ok(
      html.includes(`aria-label="${registration ? 'Member registration' : 'Member sign in'}"`)
    )
    assert.equal((html.match(/<form>/g) || []).length, 1)
    assert.ok(html.includes('name="staffId"'))
  }
})

test('statement download is an explicit non-submitting button', () => {
  const html = renderToStaticMarkup(<StatementDownload />)
  assert.match(html, /type="button"/)
  assert.match(html, /aria-busy="false"/)
  assert.ok(!html.includes('<a '))
})

test('loading and missing-page states are readable and never invent balances', () => {
  const loading = renderToStaticMarkup(<DashboardLoading />)
  assert.ok(loading.includes('role="status"'))
  assert.ok(loading.includes('Loading your page'))
  assert.ok(!loading.includes('₦0'))
  const missing = renderToStaticMarkup(<NotFound />)
  assert.ok(missing.includes('href="/"'))
  assert.ok(missing.includes('This page is not available.'))
})

test('dropdowns anchor to their trigger and stay within a narrow viewport', () => {
  const above = selectPosition(
    { left: 220, top: 530, bottom: 580, width: 160 },
    { width: 390, height: 844 }
  )
  // There is sufficient room below at this height.
  assert.equal(above.top, 588)
  const bottom = selectPosition(
    { left: 220, top: 680, bottom: 730, width: 160 },
    { width: 390, height: 844 }
  )
  assert.equal(bottom.top, undefined)
  assert.equal(bottom.bottom, 844 - 680 + 8)
  assert.equal(bottom.width, 260)
  assert.ok(bottom.left + bottom.width <= 378)
  const narrow = selectPosition(
    { left: 16, top: 48, bottom: 100, width: 400 },
    { width: 240, height: 320 }
  )
  assert.equal(narrow.width, 216)
  assert.ok(narrow.maxHeight + (narrow.top || 0) <= 308)
})
