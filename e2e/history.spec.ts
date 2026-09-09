import { expect, test } from '@playwright/test'
import {
  FAKE_SPACE_ID,
  FAKE_USER_ID,
  installSupabaseMock,
  makeFakeDb,
  seedSession,
  type FakeDb,
} from './support/mockSupabase'

function isoDaysFromToday(offset: number): string {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
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

    // Tonight: the plant is watered today, tapping its card opens History -
    // not the (removed, for this card) Water action.
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
    // moved to its own pencil icon.
    await page.getByRole('button', { name: 'צמחים' }).click()
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
})
