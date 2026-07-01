// Hostname-keyed config. One entry per domain owned by Heiervang Technologies.
// Every domain serves the same animated frontend; only `title` / `headline` /
// `domain` / `owner` text varies. Customize per-domain copy here.
//
// Templated default: the uppercased hostname is the entire slam — one line,
// NAME.TLD together. retard.mx is the reference for a fully-bespoke entry
// (separate headline catchphrase + domain sub-line).

const OWNER = "is property of marksverdhei";

const T = (host, headline) => ({
  title: host,
  headline: headline ?? host.toUpperCase(),
  domain: "",
  owner: OWNER,
});

// Shared sprite pool for hover.dog / hoverboard.dog. main.js cycles through
// `mascots` on each pose-flip boundary. All entries here are native-RIGHT;
// `flipMascots: true` on the site config mirrors them at render so the dog
// faces LEFT on screen (matching the rightward-drifting ripple trail).
// hover_hover3m is the pre-mirrored variant of hover3 (the only native-left
// original in the set, flipped horizontally so it lines up with the rest).
const HOVER_DOG_MASCOTS = [
  // hover_hover4 is index 0 — it's the intro sprite shown for the full
  // single-sprite stretch before the 1/1 cycle kicks in.
  "hover_hover4", "hover_c854", "hover_c857", "hover_falling",
  "hover_haiv3", "hover_heihover", "hover_hover2", "hover_hover3m",
  "hover_dog-kickflip",
].map((s) => `/assets/hei/${s}.png`);

export const SITES = {
  // Fully-customized: the original.
  "retard.mx": {
    title: "retard.mx",
    headline: "GET BARKED",
    domain: "retard.mx",
    owner: OWNER,
  },

  // Templated — same frontend, per-domain text.
  "clanker.cam":              T("clanker.cam"),
  "clanker.foundation":       T("clanker.foundation"),
  // clanker.lifestyle: bespoke video-loop page — a Typhlosion-in-purple-ocean
  // Sora-style lofi clip fills the viewport, unmuted on first click. Dispatcher
  // routes mode:"clanker" to clanker.js (no mascot canvas, no beat clock).
  "clanker.lifestyle":        { ...T("clanker.lifestyle"), mode: "clanker" },
  "clanker.productions":      T("clanker.productions"),
  "clanker.surf":             T("clanker.surf"),
  "clanker.wiki":             T("clanker.wiki"),
  "cssus.live":               T("cssus.live"),
  "hei.ceo":                  T("hei.ceo"),
  "hei.codes":                T("hei.codes"),
  "hei.expert":               T("hei.expert"),
  "hei.tools":                T("hei.tools"),
  "heiervang.com":            T("heiervang.com"),
  "heiervang.tech":           T("heiervang.tech"),
  // hover.dog / hoverboard.dog: hoverboarding mascot, cycling through a 9-pose
  // pool on a beat-grid cadence that shifts across the song (see main.js
  // currentPose/flipCount — 1/4 → 1/1 → 1/2). Sprites face right as shipped
  // by the sprite-prep pipeline; the 1/1 segment alternates horizontal mirror
  // on each flip so they swap facing every bar.
  "hover.dog":                { ...T("hover.dog"),      mascots: HOVER_DOG_MASCOTS, flipMascots: true },
  "hoverboard.dog":           { ...T("hoverboard.dog"), mascots: HOVER_DOG_MASCOTS, flipMascots: true },
  "hyperpla.net":             T("hyperpla.net"),
  // bomboc.lat: bespoke beat-reactive page — fullscreen bomboclat image that
  // pulses on the 110.41 BPM of bombo.wav, with fire-particle flames rising
  // from below. The dispatcher in index.html routes mode:"bomboc" to bomboc.js
  // instead of main.js — different renderer, different audio, no mascot pool.
  "bomboc.lat":               { ...T("bomboc.lat"), mode: "bomboc" },
  "marku.sh":                 T("marku.sh"),
  "markus.consulting":        T("markus.consulting"),
  "markus.sh":                T("markus.sh"),
  "markus.solutions":         T("markus.solutions"),
  "markus.work":              T("markus.work"),
  "opensourcefriendly.dev":   T("opensourcefriendly.dev"),
  "ossfriendly.dev":          T("ossfriendly.dev"),
  "pkill.games":              T("pkill.games"),
  "pkill.io":                 T("pkill.io"),
  "pkill.live":               T("pkill.live"),
  "pkill.sh":                 T("pkill.sh"),
  "pkill.space":              T("pkill.space"),
  "pkill.team":               T("pkill.team"),
  "rugpull.in":               T("rugpull.in"),
  "savethe.click":            T("savethe.click"),
  "turingtest.fm":            T("turingtest.fm"),
  "turingtest.music":         T("turingtest.music"),
  // unleash.software intentionally NOT routed here — it serves the
  // install-remote.sh installer from the unleash repo's own GH Pages site.
};

// Dev fallback: when running on localhost / loopback / cf .pages.dev preview /
// gh-pages staging, render retard.mx so the page is testable without DNS.
const DEV_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", ""]);

export function configFor(hostname) {
  const isDev = DEV_HOSTS.has(hostname) ||
                hostname.endsWith(".pages.dev") ||
                hostname.endsWith(".github.io");
  // Dev affordance: ?host=foo.bar previews that domain's templated copy without
  // needing DNS. Only honored in dev contexts so a malicious link to a prod
  // domain can't reshape the page.
  if (isDev && typeof location !== "undefined") {
    const override = new URLSearchParams(location.search).get("host");
    if (override) {
      if (SITES[override]) return SITES[override];
      return T(override);
    }
  }
  const bare = hostname.replace(/^www\./, "");
  if (SITES[hostname]) return SITES[hostname];
  if (SITES[bare])     return SITES[bare];
  if (isDev) return SITES["retard.mx"];
  return {};
}
