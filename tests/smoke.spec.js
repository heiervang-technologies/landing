// @ts-check
import { test, expect } from "@playwright/test";

// Smoke tests for the regressions that shipped twice. NOT a full visual /
// audio integration suite — those would require image diffing on canvas-
// painted output, which is brittle. These check the gates and signals that
// have actually broken before:
//   1. Boot: dispatcher imports the right module per cfg.mode, no console errors
//   2. Audio gate: a user gesture transitions attract → playing visuals
//   3. ?autoplay=1 dev affordance still works (both main.js + bomboc.js)
//   4. No double-scheduling when a burst of gesture events fires at once
//   5. prefers-reduced-motion skips the intro build-up (main.js)
//
// Tests use the ?host= dev override so we can exercise hover.dog (mascot pool
// + cfg.mascots) and bomboc.lat (mode:"bomboc" → bomboc.js) from localhost
// without touching DNS.

const PAGES = [
  { host: "hover.dog", title: "hover.dog", canvasId: "stage" },
  { host: "bomboc.lat", title: "bomboc.lat", canvasId: "stage" },
  { host: "clanker.cam", title: "clanker.cam", canvasId: "stage" },
];

for (const p of PAGES) {
  test(`boot: ${p.host} renders without console errors`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(`console: ${m.text()}`);
    });

    await page.goto(`/?host=${p.host}&autoplay=1`);
    await expect(page).toHaveTitle(p.title);

    // Canvas exists and is sized to the viewport (not the default 300x150)
    const dims = await page.evaluate((id) => {
      const c = document.getElementById(id);
      return c ? { w: c.width, h: c.height } : null;
    }, p.canvasId);
    expect(dims).not.toBeNull();
    expect(dims.w).toBeGreaterThan(300);

    // Give the boot path a moment to surface any post-load errors
    // (image decode, fetch failures, etc.)
    await page.waitForTimeout(1500);
    expect(errors, errors.join("\n")).toEqual([]);
  });
}

test("audio gate: hover.dog autoplay=1 hides attract + drops overlay", async ({ page }) => {
  // ?autoplay=1 is the dev affordance that kicks the visual clock without a
  // gesture. The visual gate test: attract hidden + overlay dropped means
  // tick() actually ran and we passed INTRO_END_S.
  await page.goto("/?host=hover.dog&autoplay=1");
  // Drop happens at INTRO_END_S ≈ 6.7s; allow generous margin for boot.
  await expect.poll(
    async () => page.evaluate(() => ({
      attractHidden: document.getElementById("attract")?.classList.contains("hidden"),
      overlayDropped: document.getElementById("overlay")?.classList.contains("dropped"),
    })),
    { timeout: 10_000 }
  ).toMatchObject({ attractHidden: true, overlayDropped: true });
});

test("audio gate: bomboc.lat autoplay=1 hides attract", async ({ page }) => {
  // bomboc.js has no intro/drop phase (unlike main.js) — the pulse + fire
  // field start immediately, so the only visible gate signal is #attract
  // hiding.
  await page.goto("/?host=bomboc.lat&autoplay=1");
  await expect.poll(
    async () => page.evaluate(() =>
      document.getElementById("attract")?.classList.contains("hidden")),
    { timeout: 10_000 }
  ).toBe(true);
});

// Regression test for a bug that shipped twice: a burst of near-simultaneous
// gesture events (pointerdown + keydown + touchstart, or just a fast double-
// click) re-entering beginPlay()/begin() before `visualsStarted` was set,
// double-scheduling the audio buffer sources — audible as stacked/phased
// playback. startAudioAt() schedules exactly 2 buffer sources (intro + loop)
// on a successful start; more than that means a second gesture won a race.
test("no stacking under gesture burst: hover.dog rapid clicks schedule audio once", async ({ page }) => {
  await page.addInitScript(() => {
    window.__bufferSourceCount = 0;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const origCreate = Ctx.prototype.createBufferSource;
    Ctx.prototype.createBufferSource = function (...args) {
      window.__bufferSourceCount++;
      return origCreate.apply(this, args);
    };
  });
  await page.goto("/?host=hover.dog");
  for (let i = 0; i < 5; i++) await page.mouse.click(50, 50);
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => window.__bufferSourceCount)).toBe(2);
});

// prefers-reduced-motion: main.js should start the visual+audio clock
// already past INTRO_END_S (the drop) instead of playing through the ~6.7s
// pre-drop build-up. Checked via the same signals as the audio-gate test,
// but on the very first poll after `?autoplay=1` — a t=0 boot would still be
// mid-intro (overlay not dropped yet) at that point.
test("reduced motion: hover.dog starts past the intro build-up", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?host=hover.dog&autoplay=1");
  await expect.poll(
    async () => page.evaluate(() =>
      document.getElementById("overlay")?.classList.contains("dropped")),
    { timeout: 2_000, intervals: [100] }
  ).toBe(true);
});
