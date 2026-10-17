import { expect, test, type Page } from '@playwright/test'
import { FAKE_SPACE_ID, FAKE_USER_ID, installSupabaseMock, makeFakeDb, seedSession, type FakeDb, type FakePlant } from './support/mockSupabase'

// The top of the Tonight screen: how much of tonight's watering is done, and
// the household's streak - days in a row with no plant left for later. And
// the cards themselves: short, with the details a tap away.

function appToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date())
}

function shift(n: number): string {
  const [y, m, d] = appToday().split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

function plant(id: string, name: string, overrides: Partial<FakePlant> = {}): FakePlant {
  return {
    id, space_id: FAKE_SPACE_ID, name, period_days: 1, next_due_date: appToday(),
    last_watered_date: shift(-1), last_watered_by: FAKE_USER_ID, notes: null, created_by: FAKE_USER_ID,
    // Noon on the day six days back - the same calendar day in Jerusalem.
    created_at: `${shift(-6)}T09:00:00Z`,
    ...overrides,
  }
}

/** Watered on its due date every day from six days ago through yesterday. */
function onTimeEveryDay(plantId: string): FakeDb['wateringEvents'] {
  return [6, 5, 4, 3, 2, 1].map((n) => ({
    id: `w-${plantId}-${n}`, plant_id: plantId, user_id: FAKE_USER_ID,
    watered_on: shift(-n), created_at: `${shift(-n)}T16:00:00Z`, prev_next_due_date: shift(-n),
  }))
}

async function seed(page: Page, db: FakeDb) {
  await seedSession(page)
  await page.addInitScript(() => window.localStorage.setItem('plantshare.language', 'he'))
  await installSupabaseMock(page, db)
}

async function water(page: Page, name: string) {
  await page.getByRole('button', { name: `סימון ${name} כמושקה` }).click()
}

test('shows how much of tonight is watered, and updates as plants get water', async ({ page }) => {
  const db = makeFakeDb({
    plants: [
      plant('a', 'בזיליקום'),
      plant('b', 'פיקוס'),
      plant('c', 'נענע', { last_watered_date: appToday(), next_due_date: shift(1) }),
    ],
  })
  await seed(page, db)
  await page.goto('/')

  const progress = page.locator('.tonight-progress')
  await expect(progress).toContainText('1 מתוך 3 הושקו הערב')
  await expect(progress).toContainText('עוד 2 והערב סגור')

  await water(page, 'בזיליקום')
  await expect(progress).toContainText('2 מתוך 3 הושקו הערב')
  await expect(progress).toContainText('עוד אחד והערב סגור')
})

test("counts the household's streak, and tonight joins it once tonight is cleared", async ({ page }) => {
  await seed(page, makeFakeDb({ plants: [plant('basil', 'בזיליקום')], wateringEvents: onTimeEveryDay('basil') }))
  await page.goto('/')

  const progress = page.locator('.tonight-progress')
  await expect(progress).toContainText('רצף של 6 ימים')

  await water(page, 'בזיליקום')
  await expect(progress).toContainText('כל הצמחים של הערב הושקו')
  await expect(progress).toContainText('רצף של 7 ימים')
})

test('a plant watered late breaks the streak on the days it waited', async ({ page }) => {
  // Watered every day, except that four days ago it waited and got water
  // the next day: the streak runs from three days ago.
  const waterings = onTimeEveryDay('basil').filter((row) => row.watered_on !== shift(-4))
  waterings.find((row) => row.watered_on === shift(-3))!.prev_next_due_date = shift(-4)
  await seed(page, makeFakeDb({ plants: [plant('basil', 'בזיליקום')], wateringEvents: waterings }))
  await page.goto('/')

  await expect(page.locator('.tonight-progress')).toContainText('רצף של 3 ימים')
})

test('a plant still waiting from yesterday leaves no streak to show', async ({ page }) => {
  await seed(
    page,
    makeFakeDb({
      plants: [plant('basil', 'בזיליקום'), plant('ficus', 'פיקוס', { next_due_date: shift(-1), period_days: 7 })],
      wateringEvents: onTimeEveryDay('basil'),
    }),
  )
  const history = page.waitForResponse((response) => response.url().includes('watering_events') && response.url().includes('space_id'))
  await page.goto('/')
  await history
  const progress = page.locator('.tonight-progress')
  await expect(progress).toContainText('מתוך')
  await page.waitForTimeout(300)
  await expect(progress).not.toContainText('רצף')
})

test('a card says only how long until it needs water; how often and when are in its details', async ({ page }) => {
  const db = makeFakeDb({
    plants: [
      plant('basil', 'בזיליקום'),
      plant('cactus', 'קקטוס', { next_due_date: shift(3), period_days: 14, notes: 'מעט מים' }),
      plant('fern', 'שרך', { next_due_date: shift(1), period_days: 3 }),
    ],
  })
  await seed(page, db)
  await page.goto('/')

  // Tonight's list says it once, in its heading - not on every card.
  const dueGroup = page.locator('.plant-group', { hasText: 'להשקיה היום' })
  const basil = dueGroup.locator('.plant-card', { hasText: 'בזיליקום' })
  await expect(basil).toBeVisible()
  await expect(basil.locator('.badge-due')).toHaveCount(0)
  await expect(basil).not.toContainText('כל יום')

  await page.locator('nav').getByRole('button', { name: 'צמחים' }).click()
  const cactus = page.locator('.plant-card', { hasText: 'קקטוס' })
  await expect(cactus.locator('.plant-countdown')).toHaveText('עוד 3 ימים')
  await expect(cactus).not.toContainText('פעם בשבועיים')
  await expect(page.locator('.plant-card', { hasText: 'שרך' }).locator('.plant-countdown')).toHaveText('מחר')

  await cactus.locator('.plant-main').click()
  const details = page.locator('.plant-details')
  await expect(details).toContainText('פעם בשבועיים')
  await expect(details).toContainText('בעוד 3 ימים')
  await expect(details).toContainText('מעט מים')
})
