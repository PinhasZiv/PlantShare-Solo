import { createRequire } from 'node:module'
import { expect, test, type Page } from '@playwright/test'
import { FAKE_SPACE_ID, FAKE_USER_ID, installSupabaseMock, makeFakeDb, seedSession, type FakeDb, type FakePlant } from './support/mockSupabase'

// Every screen, in both themes, through axe-core's WCAG 2.2 AA rules - and
// every control big enough to hit with a thumb. Contrast is the one that
// slips: a colour that reads fine in one theme can fail in the other, which
// is how white text on the dark theme's pale green buttons went unnoticed.

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js')
const DANA = { id: '33333333-3333-4333-8333-333333333333', display_name: 'דנה', avatar_url: null, email: 'dana@example.com' }

function appToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date())
}

function shift(n: number): string {
  const [y, m, d] = appToday().split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

function plant(id: string, name: string, overrides: Partial<FakePlant> = {}): FakePlant {
  return {
    id, space_id: FAKE_SPACE_ID, name, period_days: 3, next_due_date: appToday(),
    last_watered_date: shift(-3), last_watered_by: FAKE_USER_ID, notes: null, created_by: FAKE_USER_ID,
    created_at: new Date(Date.now() - 30 * 86_400_000).toISOString(),
    ...overrides,
  }
}

/** A lived-in space: late, due, watered tonight and coming up. */
function garden(): FakeDb {
  const wateringEvents: FakeDb['wateringEvents'] = []
  for (let i = 1; i <= 8; i++) {
    wateringEvents.push({ id: `w${i}`, plant_id: i % 2 ? 'p-basil' : 'p-ficus', user_id: i % 3 ? FAKE_USER_ID : DANA.id, watered_on: shift(-i * 2), created_at: `${shift(-i * 2)}T17:00:00Z` })
  }
  wateringEvents.push({ id: 'w-today', plant_id: 'p-mint', user_id: FAKE_USER_ID, watered_on: appToday(), created_at: new Date().toISOString() })
  return makeFakeDb({
    otherPeople: [DANA],
    plants: [
      plant('p-ficus', 'פיקוס בסלון', { next_due_date: shift(-2), period_days: 7 }),
      plant('p-basil', 'בזיליקום', { period_days: 2 }),
      plant('p-mint', 'נענע במרפסת', { next_due_date: shift(2), last_watered_date: appToday(), period_days: 2 }),
      plant('p-cactus', 'קקטוס', { next_due_date: shift(9), period_days: 14 }),
    ],
    wateringEvents,
  })
}

async function open(page: Page, tab?: string) {
  await seedSession(page)
  await page.addInitScript(() => window.localStorage.setItem('plantshare.language', 'he'))
  await installSupabaseMock(page, garden())
  await page.goto('/')
  await expect(page.locator('.screen-header').first()).toBeVisible()
  if (tab) {
    await page.locator('nav').getByRole('button', { name: tab }).click()
    await expect(page.locator('.screen-header').first()).toBeVisible()
  }
  // Let the cards' entrance animation finish: axe measures contrast on what
  // is painted, and a card mid-fade is lighter than it will be.
  await page.waitForTimeout(600)
}

async function axeViolations(page: Page) {
  await page.addScriptTag({ path: AXE })
  return page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (context: Document, options: object) => Promise<{ violations: { id: string; help: string; nodes: { target: string[] }[] }[] }> } }).axe
    const result = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })
    return result.violations.map((v) => `${v.id}: ${v.help} -> ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
  })
}

/** Controls smaller than 44x44 - the thumb-sized minimum on a phone. */
async function smallTargets(page: Page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('button, a[href], select, summary, input[type=checkbox], input[type=radio]'))
      .filter((el) => {
        const box = el.getBoundingClientRect()
        return box.width > 0 && box.height > 0 && (box.width < 44 || box.height < 44)
      })
      .map((el) => {
        const box = el.getBoundingClientRect()
        return `${(el.getAttribute('aria-label') || el.textContent || el.className).trim().slice(0, 40)} (${Math.round(box.width)}x${Math.round(box.height)})`
      }),
  )
}

const SCREENS: [string, string | undefined][] = [
  ['tonight', undefined],
  ['plants', 'צמחים'],
  ['space', 'מרחב'],
  ['settings', 'הגדרות'],
]

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`${scheme} theme`, () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: scheme })

    for (const [name, tab] of SCREENS) {
      test(`the ${name} screen passes WCAG 2.2 AA and has thumb-sized controls`, async ({ page }) => {
        await open(page, tab)
        expect(await axeViolations(page)).toEqual([])
        expect(await smallTargets(page)).toEqual([])
      })
    }

    test('the watering history sheet passes WCAG 2.2 AA', async ({ page }) => {
      await open(page)
      await page.locator('.plant-main').first().click()
      await expect(page.locator('.sheet')).toBeVisible()
      await page.waitForTimeout(300)
      expect(await axeViolations(page)).toEqual([])
      expect(await smallTargets(page)).toEqual([])
    })

    test('the new-plant form passes WCAG 2.2 AA', async ({ page }) => {
      await open(page, 'צמחים')
      await page.locator('.fab').click()
      await expect(page.locator('.sheet')).toBeVisible()
      await page.waitForTimeout(300)
      expect(await axeViolations(page)).toEqual([])
      expect(await smallTargets(page)).toEqual([])
    })

    test('the snooze sheet passes WCAG 2.2 AA', async ({ page }) => {
      await open(page)
      await page.getByRole('button', { name: /השהיית/ }).first().click()
      await expect(page.locator('.sheet')).toBeVisible()
      await page.waitForTimeout(300)
      expect(await axeViolations(page)).toEqual([])
      expect(await smallTargets(page)).toEqual([])
    })
  })
}
