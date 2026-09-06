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

test.describe('snoozing a reminder', () => {
  test('snoozing a plant moves it to Snoozed, and cancelling brings it back', async ({ page }) => {
    const db = makeFakeDb({
      plants: [
        {
          id: 'plant-basil',
          space_id: FAKE_SPACE_ID,
          name: 'בזיליקום',
          period_days: 7,
          next_due_date: isoDaysFromToday(-1), // overdue by a day
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

    const card = page.locator('.plant-card', { hasText: 'בזיליקום' })
    await expect(card).toBeVisible()
    await expect(page.getByText('באיחור')).toBeVisible()

    await card.getByRole('button', { name: /השהיית התזכורת/ }).click()

    const sheet = page.locator('.sheet', { hasText: 'השהיית תזכורת' })
    await expect(sheet).toBeVisible()
    await expect(sheet.getByText('בזיליקום')).toBeVisible()

    await sheet.getByRole('button', { name: 'שעה', exact: true }).click()

    // The sheet closes, the plant leaves the overdue list and lands in
    // "מושהה" instead, and the fake server actually received the snooze.
    await expect(sheet).toBeHidden()
    await expect(page.getByRole('heading', { name: 'מושהה' })).toBeVisible()
    const snoozedCard = page.locator('.plant-card', { hasText: 'בזיליקום' })
    await expect(snoozedCard).toContainText('מושהה עד')
    expect(db.snoozes.get('plant-basil')).toBeTruthy()

    // Cancelling brings it straight back to the overdue list.
    await snoozedCard.getByRole('button', { name: /ביטול ההשהיה/ }).click()
    await expect(page.getByText('באיחור')).toBeVisible()
    await expect(page.locator('.plant-card', { hasText: 'בזיליקום' })).not.toContainText('מושהה עד')
    expect(db.snoozes.has('plant-basil')).toBe(false)
  })

  test('a notification\'s Snooze action opens the picker for everything due', async ({ page }) => {
    const db = makeFakeDb({
      plants: [
        {
          id: 'plant-mint',
          space_id: FAKE_SPACE_ID,
          name: 'נענע',
          period_days: 3,
          next_due_date: isoDaysFromToday(0), // due today
          last_watered_date: null,
          last_watered_by: null,
          notes: null,
          created_by: FAKE_USER_ID,
          created_at: new Date().toISOString(),
        },
      ],
    })
    await seed(page, db)

    // The service worker's Snooze action opens the app with this query flag -
    // simulated here directly, since driving an actual push event needs a
    // real service worker lifecycle Playwright cannot trigger.
    await page.goto('/?snooze=1')

    const sheet = page.locator('.sheet', { hasText: 'השהיית תזכורת' })
    await expect(sheet).toBeVisible()
    await expect(sheet.getByText('נענע')).toBeVisible()

    // The flag is consumed - the query string is gone, so a later reload
    // will not reopen the sheet on its own.
    expect(new URL(page.url()).search).toBe('')
  })
})
