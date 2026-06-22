# landing

Static placeholder pages for Heiervang Technologies domains.

One repo, one deploy, N domains. The browser reads `location.hostname` and looks
up the matching entry in `sites.js`. Add a new domain by appending to `SITES`
and pointing its DNS at this Cloudflare Pages project.

## Stack

- Plain HTML / CSS / ES modules — no build step.
- Audio via Web Audio API. Foreground PNG drifts on a `<canvas>` with a
  beat-locked color trail. Beats are detected live from the low-frequency band
  of whichever track plays, so the timing adapts to any audio.
- Hosted on Cloudflare Pages, deployed from this private GitHub repo on every
  push to `main`.

## Layout

```
index.html
style.css
main.js               # render loop, audio + beat detection
sites.js              # hostname → { title, blurb }
CNAME                 # primary custom domain (informational only on CF Pages)
assets/
  audio/hoverboard.mp3
  hei/hei_mask_*.png  # 8 color variants of the hei mascot
```

## Adding a domain

1. Add an entry to `SITES` in `sites.js`:
   ```js
   "example.com": { title: "example", blurb: "what this domain is for" },
   ```
2. In the Cloudflare Pages project, add `example.com` as a Custom Domain.
3. Cloudflare provisions the TLS cert. Done.

## Local preview

```sh
python3 -m http.server 8000
open http://localhost:8000
```

Click anywhere to start audio (browsers block autoplay with sound).
