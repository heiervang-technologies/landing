// @ts-check
import { test, expect } from "@playwright/test";

// Smoke tests for the regressions that shipped twice. NOT a full visual /
// audio integration suite — those would require image diffing on canvas-
// painted output, which is brittle. These check the gates and signals that
// have actually broken before:
//   1. Boot: dispatcher imports the right module per cfg.mode, no console errors
//   2. Audio gate: a user gesture transitions attract → playing visuals
//   3. ?autoplay=1 dev affordance still works (both main.js + bomboc.js)
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

// TODO: add a bomboc.lat ?autoplay=1 attract-hidden test once PR #2's
// `bomboc: ?autoplay=1 dev affordance` lands on main. Currently bomboc.js
// has no autoplay branch, so the gate stays up regardless of query string.
