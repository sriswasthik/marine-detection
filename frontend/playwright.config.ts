import { defineConfig } from '@playwright/test'

/**
 * End-to-end layout checks (npm run e2e). Starts its own Vite dev server in sample-data mode on a
 * port of its own, so a dev server already running on 5173 is left alone.
 */
const PORT = 5196

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    browserName: 'chromium',
    reducedMotion: 'reduce',
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { VITE_USE_MOCK: 'true', VITE_DEMO_FAST: 'false' },
  },
})
