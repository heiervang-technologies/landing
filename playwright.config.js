// @ts-check
import { defineConfig, devices } from "@playwright/test";

// Smoke tests only — fast feedback on the bugs that actually shipped twice
// (audio mute on bfcache, click-to-play regressions). Tests run against a
// throwaway python http.server so the prod deploy stays pure-static. The
// `?autoplay=1` dev affordance in main.js / bomboc.js lets us skip the
// gesture gate in headless mode.
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // 1 local retry: the suite now downloads a 60MB video (clanker.lifestyle
  // tests) under full parallelism against a single-process dev http.server,
  // which flakes ~1-in-4 locally under this box's ambient load (unrelated
  // Chromium instances + resource contention, not a real bug) — masks that
  // environmental timing noise without hiding a genuine regression, since a
  // real bug fails consistently across a retry too.
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:18091",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    // python http.server matches what main.js / README assume in dev. No
    // build step — just serve the repo root directly.
    command: "python3 -m http.server 18091 --bind 127.0.0.1",
    url: "http://127.0.0.1:18091/index.html",
    reuseExistingServer: !process.env.CI,
    timeout: 10_000,
  },
});
