# landing

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
- Hosted on Cloudflare Pages (`heiervang-landing`). Currently deployed via
  `wrangler pages deploy` direct upload; git push is also wired but not the
  active path.

## Layout

```
index.html
style.css
main.js                    # render loop, audio playback, beat-locked color
sites.js                   # hostname → { title, headline, domain, owner }
_headers                   # CF Pages per-path cache policy
CNAME                      # informational on CF Pages
assets/
  audio/intro.flac         # boot hit (FLAC: lossless, 40% smaller than WAV,
  audio/loop.flac          # sample-exact loop boundaries — no Opus padding)
  fonts/press-start-2p-latin.woff2
  hei/hei_mask_original.png  # base mascot; runtime recolors via canvas
  hei/hei_hoverboard*.png    # hoverboard variants
  hei/favicon{.gif,.ico,-16,-32,-48,-64.png}
  hei/apple-touch-icon.png
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
`retard.mx` reference entry in `sites.js`.

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
