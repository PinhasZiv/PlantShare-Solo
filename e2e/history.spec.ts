import { expect, test } from '@playwright/test'
import {
  FAKE_SPACE_ID,
  FAKE_USER_ID,
  installSupabaseMock,
  makeFakeDb,
  seedSession,
  type FakeDb,
} from './support/mockSupabase'

/** A date `offset` days from "today" as the app itself sees it - the fake
 *  profile's own timezone, which runs ahead of UTC late in the evening. */
function isoDaysFromToday(offset: number): string {
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date()).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + offset)).toISOString().slice(0, 10)
}

async function seed(page: import('@playwright/test').Page, db: FakeDb) {
  await seedSession(page)
  await page.addInitScript(() => window.localStorage.setItem('plantshare.language', 'he'))
  await installSupabaseMock(page, db)
}

test.describe('watering history', () => {
  test('shows who watered a plant and when, from both Tonight and Plants, and survives the day passing', async ({
    page,
  }) => {
    const db = makeFakeDb({
      plants: [
        {
          id: 'plant-basil',
          space_id: FAKE_SPACE_ID,
          name: 'בזיליקום',
          period_days: 7,
          next_due_date: isoDaysFromToday(6),
          last_watered_date: isoDaysFromToday(0),
          last_watered_by: FAKE_USER_ID,
          notes: null,
          created_by: FAKE_USER_ID,
          created_at: new Date().toISOString(),
        },
      ],
      otherPeople: [
        { id: 'other-user-id', display_name: 'Dana Cohen', avatar_url: null, email: 'dana@example.com' },
      ],
      wateringEvents: [
        {
          id: 'event-today',
          plant_id: 'plant-basil',
          user_id: FAKE_USER_ID,
          watered_on: isoDaysFromToday(0),
          created_at: new Date().toISOString(),
        },
        {
          // A week-old watering - long past the "watered today" badge, which is
          // exactly the case this feature exists for: it should still show up.
          id: 'event-last-week',
          plant_id: 'plant-basil',
          user_id: 'other-user-id',
          watered_on: isoDaysFromToday(-7),
          created_at: new Date(Date.now() - 7 * 86_400_000).toISOString(),
        },
      ],
    })
    await seed(page, db)
    await page.goto('/')

    // Tonight: a watered plant sits behind the collapsed "watered this
    // evening" disclosure - open it before tapping the card, which opens
    // History, not the (removed, for this card) Water action.
    await page.locator('.completed-summary').click()
    const tonightCard = page.locator('.plant-card', { hasText: 'בזיליקום' })
    await expect(tonightCard).toBeVisible()
    await tonightCard.locator('.plant-main').click()

    const sheet = page.locator('.sheet', { hasText: 'היסטוריית ההשקיה' })
    await expect(sheet).toBeVisible()
    await expect(sheet.getByText('הושקה על ידך')).toBeVisible()
    await expect(sheet.getByText('הושקה על ידי Dana')).toBeVisible()
    await sheet.getByRole('button', { name: 'סגירה' }).click()
    await expect(sheet).toBeHidden()

    // Plants: tapping the card also opens History now (not Edit) - editing
    // moved to its own pencil icon. Watered plants collapse behind their own
    // disclosure here too.
    await page.getByRole('button', { name: 'צמחים' }).click()
    await page.locator('.completed-summary').click()
    const plantsCard = page.locator('.plant-card', { hasText: 'בזיליקום' })
    await plantsCard.locator('.plant-main').click()
    const sheet2 = page.locator('.sheet', { hasText: 'היסטוריית ההשקיה' })
    await expect(sheet2).toBeVisible()
    await expect(sheet2.getByText('הושקה על ידי Dana')).toBeVisible()
    await sheet2.getByRole('button', { name: 'סגירה' }).click()
    await expect(sheet2).toBeHidden()

    // The pencil icon still reaches the edit form.
    await plantsCard.getByRole('button', { name: 'עריכת בזיליקום' }).click()
    await expect(page.locator('.sheet', { hasText: 'עריכת צמח' })).toBeVisible()
  })

  test('says so when a plant has never been watered', async ({ page }) => {
    const db = makeFakeDb({
      plants: [
        {
          id: 'plant-mint',
          space_id: FAKE_SPACE_ID,
          name: 'נענע',
          period_days: 3,
          next_due_date: isoDaysFromToday(2),
          last_watered_date: null,
          last_watered_by: null,
          notes: null,
          created_by: FAKE_USER_ID,
          created_at: new Date().toISOString(),
        },
      ],
    })
    await seed(page, db)
    await page.goto('/')
    await page.getByRole('button', { name: 'צמחים' }).click()

    await page.locator('.plant-card', { hasText: 'נענע' }).locator('.plant-main').click()
    await expect(page.getByText('עוד לא הושקה אף פעם.')).toBeVisible()
  })

  test('sums up the last sixty days above the list: on time, late, and how often in practice', async ({ page }) => {
    // Every 4 days; the third of these came two days late.
    const waterings = [0, -4, -8, -14, -18].map((offset, i) => ({
      id: `w${i}`,
      plant_id: 'plant-fern',
      user_id: FAKE_USER_ID,
      watered_on: isoDaysFromToday(offset),
      prev_next_due_date: isoDaysFromToday(offset === -8 ? -10 : offset),
      created_at: new Date(Date.now() + offset * 86_400_000).toISOString(),
    }))
    // An old one, outside the window - in the list, not in the count.
    waterings.push({ ...waterings[0], id: 'old', watered_on: isoDaysFromToday(-90), prev_next_due_date: isoDaysFromToday(-95), created_at: new Date(Date.now() - 90 * 86_400_000).toISOString() })
    const db = makeFakeDb({
      plants: [
        {
          id: 'plant-fern',
          space_id: FAKE_SPACE_ID,
          name: 'שרך',
          period_days: 4,
          next_due_date: isoDaysFromToday(4),
          last_watered_date: isoDaysFromToday(0),
          last_watered_by: FAKE_USER_ID,
          notes: null,
          created_by: FAKE_USER_ID,
          created_at: new Date().toISOString(),
        },
      ],
      wateringEvents: waterings,
    })
    await seed(page, db)
    await page.goto('/')
    await page.getByRole('button', { name: 'צמחים' }).click()
    await page.locator('.completed-summary').click()
    await page.locator('.plant-card', { hasText: 'שרך' }).locator('.plant-main').click()

    const sheet = page.locator('.sheet', { hasText: 'היסטוריית ההשקיה' })
    await expect(sheet.locator('.history-summary')).toHaveText('ב-60 הימים האחרונים: 4 בזמן · 1 באיחור · בפועל כל 4 ימים')
    await expect(sheet.locator('.history-row')).toHaveCount(6)
  })
})
