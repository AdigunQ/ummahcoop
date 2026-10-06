import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SavingsComparison } from '../src/app/dashboard/savings-changes/SavingsComparison'

test('savings review labels old and requested amounts separately for both plans and the total', () => {
  const html = renderToStaticMarkup(<SavingsComparison previousThrift={20000} previousSpecial={15000} requestedThrift={10000} requestedSpecial={25000} />)
  assert.equal((html.match(/Old monthly amount/g) || []).length, 3)
  assert.equal((html.match(/Requested monthly amount/g) || []).length, 3)
  assert.match(html, /Thrift savings.*Old monthly amount.*20,000.*Requested monthly amount.*10,000/)
  assert.match(html, /Special savings.*Old monthly amount.*15,000.*Requested monthly amount.*25,000/)
  assert.match(html, /Total monthly savings.*Old monthly amount.*35,000.*Requested monthly amount.*35,000/)
  assert.ok(html.includes('not the member&#x27;s saved balance'))
})

test('a plan that is not selected still shows its zero amount rather than a blank', () => {
  const html = renderToStaticMarkup(<SavingsComparison previousThrift={10000} previousSpecial={0} requestedThrift={20000} requestedSpecial={0} />)
  assert.match(html, /Special savings.*Old monthly amount.*₦0.*Requested monthly amount.*₦0/)
  assert.match(html, /Total monthly savings.*10,000.*20,000/)
})
