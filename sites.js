// Hostname-keyed config. Add an entry per domain owned by Heiervang Technologies.
// Each entry can declare a `blurb` (utility one-liner) and a `title` (browser tab text).
// If neither is set, the page renders as a pure vibe page with no foreground card.

export const SITES = {
  "retard.mx": {
    title: "hei",
    blurb: null,
  },
};

export function configFor(hostname) {
  return SITES[hostname] ?? SITES[hostname.replace(/^www\./, "")] ?? {};
}
