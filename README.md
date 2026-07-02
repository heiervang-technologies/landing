# landing

<p align="center">
  <img src="assets/hei/favicon.gif" width="192" alt="hei mascot animating through the palette">
</p>

Static placeholder pages for Heiervang Technologies domains.

One repo, one deploy, N domains. The browser reads `location.hostname` and looks
up the matching entry in `sites.js`. Add a new domain by appending to `SITES`
and pointing its DNS at this Cloudflare Pages project.

## Stack

- Plain HTML / CSS / ES modules — no build step.
- Audio via Web Audio API: a one-shot `intro.flac` flows into a seamless
  `loop.flac`. The hei PNG drifts on a `<canvas>` with a beat-locked color
  trail; beats are derived from the loop's known tempo, so the slam lands on
  time without runtime FFT analysis.
- Pixel-art slam typography (Press Start 2P) with glitch + chromatic
  aberration layered via `::before` / `::after` on the headline.
- `prefers-reduced-motion` respected two ways: CSS swaps the slam/beat-pulse/
  glitch-jitter for a calm fade-in, and `main.js` skips the ~6.7s pre-drop
  build-up entirely, starting audio + visuals already in the steady-state
  loop.
- Hosted on Cloudflare Pages (`heiervang-landing`). Deployed via `wrangler
  pages deploy` direct upload — there is no GitHub-integrated build; merging
  to `main` does NOT redeploy by itself, a manual `wrangler pages deploy`
  from a checkout of `main` is required after each merge.
- Most domains render the mascot canvas (`main.js`). A few bespoke domains
  route to their own renderer instead, picked by `cfg.mode` in `sites.js`'s
  per-host entry: `bomboc.lat` → `bomboc.js` (beat-reactive image + fire
  particles, no mascot canvas), `clanker.lifestyle` → `clanker.js`
  (fullscreen video loop, no mascot canvas). `index.html`'s inline
  dispatcher script picks the entry module at load time.

## Layout

```
index.html
style.css
robots.txt
main.js                    # mascot-canvas render loop, audio, beat-locked color
bomboc.js                  # bomboc.lat: beat-reactive image + fire particles
clanker.js                 # clanker.lifestyle: fullscreen video loop
sites.js                   # hostname → { title, headline, domain, owner, mode }
_headers                   # CF Pages per-path cache policy
CNAME                      # informational on CF Pages
assets/
  audio/intro.flac         # main.js boot hit (FLAC: lossless, sample-exact
  audio/loop.flac          # loop boundaries — no Opus encoder padding)
  audio/bombo.opus         # bomboc.lat loop track (loopStart=2 samples to
                            # skip the source's own encoder-padding click)
  video/clanker.mp4        # clanker.lifestyle background loop
  video/clanker-poster.jpg
  fonts/press-start-2p-latin.woff2
  hei/hei_mask_original.png  # base mascot; runtime recolors via canvas
  hei/hover_*.png            # hover.dog / hoverboard.dog 9-sprite pool
  hei/favicon{.gif,.ico,-16,-32,-48}.png
  hei/apple-touch-icon.png
  bomboclat.webp            # bomboc.lat hero image
```

## Adding a domain

For a templated entry (uppercased hostname as the slam):

```js
"example.com": T("example.com"),
```

For a bespoke headline:

```js
"example.com": T("example.com", "CATCHPHRASE"),
```

For full control (separate title / headline / domain sub-line), see the
`retard.mx` reference entry in `sites.js`. For a fully bespoke renderer
(different page entirely, not just re-themed copy) see the `mode: "bomboc"` /
`mode: "clanker"` entries and the `mascots` / `flipMascots` keys used by
`hover.dog` — both documented inline in `sites.js`.

Then attach the domain to the `heiervang-landing` Pages project (creates
the CF zone if needed; flip Namecheap NS to Cloudflare; CF provisions TLS).

## Dev affordance

In dev contexts (localhost, `*.pages.dev`, `*.github.io`) you can preview
any domain's templated copy without DNS:

```
http://localhost:8000/?host=example.com
```

Only honored in dev — production hostnames can't be reshaped via query string.

## Local preview

```sh
python3 -m http.server 8000
open http://localhost:8000
```

Click anywhere to start audio (browsers block autoplay with sound).

## Smoke tests

```sh
npm install                 # one-time; pulls @playwright/test
npx playwright install      # one-time; pulls Chromium ~115 MB
npm test                    # boots a throwaway http.server + runs tests
npm run test:ui             # interactive UI mode for debugging a failing case
```

The tests cover the regressions that have shipped twice — page boots without
console errors, the audio gate transitions on a real gesture, the
`?autoplay=1` dev affordance still kicks the visual clock. They are **not**
part of the deploy: `npm` is dev-only tooling; the published site is still
the static HTML/CSS/JS in this repo.
