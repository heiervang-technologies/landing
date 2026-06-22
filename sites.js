// Hostname-keyed config. Add an entry per domain owned by Heiervang Technologies.
// Each entry can declare a `blurb` (utility one-liner) and a `title` (browser tab text).
// If neither is set, the page renders as a pure vibe page with no foreground card.

export const SITES = {
  "retard.mx": {
    title: "retard.mx",
    headline: "GET BARKED",
    domain: "retard.mx",
    owner: "is property of marksverdhei",
  },
};

// Dev fallback: when running on localhost / loopback / cf .pages.dev preview,
// render retard.mx so the page is testable without DNS. Real hostnames must
// be keyed in SITES explicitly.
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
