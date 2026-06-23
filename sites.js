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
  // hover.dog / hoverboard.dog: the mascot rides a hoverboard. Two poses
  // alternate via a 2D rotation flip:
  //   - "ride"  = left-facing cruise              (hei_hoverboard.png)
  //   - "tre"   = arms-wide hype, right-facing    (hei_hoverboard_right.png)
  // Pose schedule (main.js drives the flips): "tre" during the intro hype,
  // "ride" through the drop, "tre" during the spiral segment, "ride" after.
  "hover.dog":                { ...T("hover.dog"),      mascot: "/assets/hei/hei_hoverboard.png", mascotAlt: "/assets/hei/hei_hoverboard_right.png" },
  "hoverboard.dog":           { ...T("hoverboard.dog"), mascot: "/assets/hei/hei_hoverboard.png", mascotAlt: "/assets/hei/hei_hoverboard_right.png" },
  "hyperpla.net":             T("hyperpla.net"),
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
