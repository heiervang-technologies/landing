// Hostname-keyed config. One entry per domain owned by Heiervang Technologies.
// Every domain serves the same animated frontend; only `title` / `headline` /
// `domain` / `owner` text varies. Customize per-domain copy here.
//
// Defaults: headline = domain (so the slam-in animation has something to land
// on), domain = "" (we hide the redundant second line on templated domains —
// keep the original retard.mx entry as the reference for fully-customized copy).

const OWNER = "is property of marksverdhei";

const T = (host, headline = host) => ({
  title: host,
  headline,
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
  "cssus.live":               T("cssus.live"),
  "heiervang.com":            T("heiervang.com"),
  "heiervang.tech":           T("heiervang.tech"),
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
  "unleash.software":         T("unleash.software"),
};

// Dev fallback: when running on localhost / loopback / cf .pages.dev preview /
// gh-pages staging, render retard.mx so the page is testable without DNS.
const DEV_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", ""]);

export function configFor(hostname) {
  const bare = hostname.replace(/^www\./, "");
  if (SITES[hostname]) return SITES[hostname];
  if (SITES[bare])     return SITES[bare];
  if (DEV_HOSTS.has(hostname) ||
      hostname.endsWith(".pages.dev") ||
      hostname.endsWith(".github.io")) {
    return SITES["retard.mx"];
  }
  return {};
}
