#!/usr/bin/env npx tsx
/**
 * A11y Review — automated axe-core audit + keyboard + semantics check
 * Run: npx tsx scripts/a11y-review.ts [--base=http://localhost:3000]
 */

import { chromium } from 'playwright'
import AxeBuilder from '@axe-core/playwright'

const BASE = process.argv.find(a => a.startsWith('--base='))?.split('=')[1] || 'http://localhost:3000'
const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  phone: { width: 375, height: 812 },
}

const PAGES = ['/', '/login', '/register']

async function main() {
  const browser = await chromium.launch({ headless: true })
  const report: any[] = []
  let totalViolations = 0

  for (const path of PAGES) {
    for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
      const ctx = await browser.newContext({ viewport: vp })
      const page = await ctx.newPage()
      const url = BASE + path

      try { await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 }) } catch {
        report.push({ page: path, viewport: vpName, error: 'Navigation timeout' })
        await ctx.close(); continue
      }

      let axeResults
      try { axeResults = await new AxeBuilder({ page }).analyze() } catch {
        report.push({ page: path, viewport: vpName, error: 'Axe failed' })
        await ctx.close(); continue
      }

      const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
      const lang = await page.evaluate(() => document.documentElement.getAttribute('lang') || 'missing')
      const hasMain = await page.evaluate(() => !!document.querySelector('main'))
      const hasH1 = await page.evaluate(() => !!document.querySelector('h1'))
      const ariaHiddenCount = await page.evaluate(() => document.querySelectorAll('[aria-hidden="true"]').length)
      const focusableNoLabel = await page.evaluate(() => {
        const els = document.querySelectorAll('button:not([aria-label]):not(:has(> *))')
        return Array.from(els).filter(e => !e.textContent?.trim()).length
      })

      report.push({
        page: path,
        viewport: vpName,
        violations: axeResults.violations.map(v => `${v.id} (${v.impact}, ${v.nodes.length} nodes)`),
        violationCount: axeResults.violations.length,
        passes: axeResults.passes.length,
        hasOverflow,
        lang,
        hasMain,
        hasH1,
        ariaHiddenCount,
        unlabeledIconButtons: focusableNoLabel,
      })

      totalViolations += axeResults.violations.length
      await ctx.close()
    }
  }

  await browser.close()

  console.log('\n=== A11y Review ===\n')
  console.log(`Base URL: ${BASE}`)
  console.log(`Pages checked: ${PAGES.length} x ${Object.keys(VIEWPORTS).length} viewports = ${report.length} checks`)
  console.log(`Total violations: ${totalViolations}\n`)

  for (const r of report) {
    const icon = r.violationCount === 0 ? '✓' : '✗'
    console.log(`${icon} ${r.page.padEnd(12)} @ ${r.viewport.padEnd(8)} | ${r.violationCount} violations | lang=${r.lang} main=${r.hasMain} h1=${r.hasH1} overflow=${r.hasOverflow}`)
    if (r.violations?.length) {
      for (const v of r.violations) console.log(`    ${v}`)
    }
  }

  console.log(totalViolations === 0 ? '\n✓ All clear.\n' : `\n✗ ${totalViolations} violation(s) need attention.\n`)
  process.exit(totalViolations > 0 ? 1 : 0)
}

main()
