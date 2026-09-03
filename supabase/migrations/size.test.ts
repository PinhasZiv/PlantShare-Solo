import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// The Supabase SQL Editor truncates a pasted query at exactly 20,000
// characters, and says nothing about it. What you get instead is a parse error
// from wherever the cut landed - typically "unterminated dollar-quoted string",
// pointing at a line that is perfectly correct.
//
// This test is here because that failure is invisible from the code: the file
// is valid SQL, the tests pass, and it only breaks in someone else's browser
// during setup. So the length is asserted rather than trusted.

const HARD_LIMIT = 20_000
const BUDGET = 19_000

const migration = readFileSync(
  join(import.meta.dirname ?? __dirname, '0001_init.sql'),
  'utf8',
)

describe('the setup script fits in the Supabase SQL editor', () => {
  it(`is under ${BUDGET.toLocaleString()} characters`, () => {
    const headroom = BUDGET - migration.length
    expect(
      migration.length,
      `The setup script is ${migration.length.toLocaleString()} characters, ` +
        `${(-headroom).toLocaleString()} over the ${BUDGET.toLocaleString()} budget. ` +
        `Supabase silently truncates a pasted query at ${HARD_LIMIT.toLocaleString()} ` +
        `characters, so this has to come down - trim comments, or split the ` +
        `script and update SETUP.md to say so.`,
    ).toBeLessThan(BUDGET)
  })

  it('measures characters, not bytes - the limit counts characters', () => {
    // Hebrew is two bytes per character in UTF-8, so a byte count would be
    // wrong by about 8% here and would give a false sense of headroom.
    expect(Buffer.byteLength(migration, 'utf8')).toBeGreaterThan(migration.length)
  })

  it('still contains the placeholders a person has to fill in', () => {
    // A trim that removed these would leave the script running with nonsense
    // values instead of failing loudly.
    expect(migration).toContain('PASTE_PROJECT_REF_HERE')
    expect(migration).toContain('PASTE_VAPID_PRIVATE_KEY_HERE')
  })

  it('keeps the guard that catches an unfilled placeholder', () => {
    expect(migration).toContain("like 'PASTE_%'")
  })
})
