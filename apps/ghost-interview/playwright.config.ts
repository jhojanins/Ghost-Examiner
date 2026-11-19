import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const DEFENSE_PORT = 4174; // ghost-defense: the axe matrix (spec a task 38) and its own e2e tests

/**
 * End-to-end test of the Day 5 slice (task 28): builds the app, serves the production build with
 * `vite preview`, and runs Chromium against it. The servers stop when the tests end. A second
 * server builds and serves ghost-defense, for the axe matrix (spec a task 38) and the tests in
 * apps/ghost-defense/e2e (ghost-defense-live task 10), which run as their own project.
 * Run from the repo root with `pnpm e2e`.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0, // a flaky test is a bug (testing-strategy skill)
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}/interview/`,
    locale: 'en-US',
    reducedMotion: 'no-preference',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'ghost-defense',
      testDir: '../ghost-defense/e2e',
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${DEFENSE_PORT}/defense/` },
    },
  ],
  webServer: [
    {
      // Runs in this file's folder (Playwright's default for webServer).
      command: `pnpm build && pnpm exec vite preview --port ${PORT} --strictPort`,
      url: `http://localhost:${PORT}/interview/`,
      reuseExistingServer: false, // always test a fresh build
      timeout: 120_000,
    },
    {
      command: `pnpm build && pnpm exec vite preview --port ${DEFENSE_PORT} --strictPort`,
      cwd: '../ghost-defense',
      url: `http://localhost:${DEFENSE_PORT}/defense/`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
