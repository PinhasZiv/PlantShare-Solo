import { existsSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

// Runs against `vite dev` with a fake Supabase project so the suite never
// touches the real backend: VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY below
// point at a host that only exists inside each test's own page.route()
// mocks (see e2e/support/supabase.ts), never a real API.
const sandboxChromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH || '/opt/pw-browsers/chromium'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5183',
    trace: 'retain-on-failure',
    // Matches the fake profile's own timezone, so "today" in the browser is
    // the same day the app and the tests count from.
    timezoneId: 'Asia/Jerusalem',
    // Some sandboxes have a working Chromium at this fixed path that does not
    // match this exact @playwright/test version - use it there instead of
    // downloading one. It does not exist on a normal machine or a GitHub
    // Actions runner, where `npx playwright install` puts the matching
    // browser in Playwright's own cache, so it is only used when present.
    ...(existsSync(sandboxChromiumPath) ? { launchOptions: { executablePath: sandboxChromiumPath } } : {}),
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -- --port 5183 --strictPort',
    url: 'http://localhost:5183',
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_SUPABASE_URL: 'https://fake-project.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'fake-anon-key',
      VITE_VAPID_PUBLIC_KEY: 'BPplaceholder0000000000000000000000000000000000000000000000000000000000',
    },
  },
})
