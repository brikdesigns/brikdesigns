/**
 * Baseline matching for the a11y gate — keyed on the violation, not the
 * selector (#1361).
 *
 * The old matcher waived accepted debt by CSS selector, so any DOM change
 * re-rooted axe's selector and the ratchet read the same already-accepted
 * violation as new. `baseline.json` recorded the cost in its own `_comment`:
 * 21 hand-maintenance passes (7 RE-INDEX, 8 EXPANSION, 6 BURN-DOWN) and a
 * 13,090-character changelog inside a JSON string value.
 *
 * Measured against `staging--brikdesigns.netlify.app` on 2026-09-10, every
 * serious/critical finding on all 21 routes × both themes — 211 nodes — was
 * `color-contrast` under one of two colour pairs:
 *
 *   210  #ffffff on #e35335   accepted brand debt (#1263 / brik-bds#479)
 *     1  #27ae60 on #bef4d4   `.bds-badge`, /how-we-work, dark theme
 *
 * So the identity of the accepted debt is the colour pair, and a fingerprint
 * of it survives every DOM change. 89 of the file's 160 selector entries (56%)
 * had already stopped matching anything.
 *
 * Scope of the fingerprint is deliberately ROUTE-scoped, not site-wide:
 * a new route that renders white-on-poppy body copy still fails and needs a
 * deliberate entry. That preserves the reasoning at `public-routes.spec.ts`'s
 * brand-CTA predicate — a per-route list is what stops a waiver rotting into a
 * rubber stamp for every page added later.
 * OPERATOR SAID 2026-09-10 (chat, #1361 build session, choosing between a
 * route-scoped fingerprint and a site-wide predicate): "Route-scoped
 * fingerprint (Recommended)".
 *
 * The selector path is kept for rules that carry no colour (none today), so a
 * future non-contrast finding still has an escape hatch.
 */

export type Theme = 'light' | 'dark';

export interface Finding {
  ruleId: string;
  selector: string;
  failureSummary: string;
}

/** route → ruleId → fingerprint[], e.g. `{"/": {"color-contrast": ["#ffffff on #e35335"]}}` */
export type RouteFingerprints = Record<string, Record<string, string[]>>;

/** route → ruleId → selector[] — the legacy escape hatch, colourless rules only. */
export type RouteSelectors = Record<string, Record<string, string[]>>;

export interface BaselineFile {
  fingerprints?: RouteFingerprints;
  fingerprintsDark?: RouteFingerprints;
  routes?: RouteSelectors;
  routesDark?: RouteSelectors;
}

export interface CompiledBaseline {
  fingerprints: Record<Theme, Record<string, Record<string, Set<string>>>>;
  selectors: Record<Theme, Record<string, Record<string, Set<string>>>>;
}

/**
 * Axe emits positional indices like `:nth-child(3)` to point at a specific
 * node, but the underlying violation is usually identical across siblings
 * (e.g. five service cards with the same low-contrast subtext style).
 * Stripping these indices on both sides collapses repeats into one canonical
 * entry per underlying violation. See issue #40 thread.
 */
export function normalizeSelector(selector: string): string {
  return selector.replace(/:nth-child\(\d+\)/g, '').replace(/:nth-of-type\(\d+\)/g, '');
}

/**
 * The colour pair axe names in a `color-contrast` failure summary, as
 * `"<fg> on <bg>"`. Returns null when the summary carries no pair — which is
 * every non-contrast rule, and also a contrast finding axe could not resolve
 * a background for.
 *
 * Hex is lower-cased so `#FFFFFF` and `#ffffff` are one fingerprint. Axe emits
 * 6- or 8-digit hex (the 8-digit form carries alpha), both accepted.
 */
export function contrastFingerprint(failureSummary: string): string | null {
  const match = /foreground color: (#[0-9a-f]{6}(?:[0-9a-f]{2})?), background color: (#[0-9a-f]{6}(?:[0-9a-f]{2})?)/i.exec(
    failureSummary,
  );
  if (!match) return null;
  return `${match[1].toLowerCase()} on ${match[2].toLowerCase()}`;
}

/** The stable identity of a finding, or null when it has none. */
export function fingerprintOf(finding: Finding): string | null {
  if (finding.ruleId !== 'color-contrast') return null;
  return contrastFingerprint(finding.failureSummary);
}

/**
 * A well-formed fingerprint entry. A typo'd entry silently waives nothing
 * while reading in review as a waiver, so the self-test asserts this over the
 * real `baseline.json` rather than trusting the shape.
 */
export function isWellFormedFingerprint(value: string): boolean {
  return /^#[0-9a-f]{6}([0-9a-f]{2})? on #[0-9a-f]{6}([0-9a-f]{2})?$/.test(value);
}

function index(source: RouteFingerprints | RouteSelectors, normalize: (v: string) => string) {
  const out: Record<string, Record<string, Set<string>>> = {};
  for (const [route, rules] of Object.entries(source)) {
    out[route] = {};
    for (const [ruleId, values] of Object.entries(rules)) {
      out[route][ruleId] = new Set(values.map(normalize));
    }
  }
  return out;
}

export function compileBaseline(baseline: BaselineFile): CompiledBaseline {
  const identity = (v: string) => v.toLowerCase();
  return {
    fingerprints: {
      light: index(baseline.fingerprints ?? {}, identity),
      dark: index(baseline.fingerprintsDark ?? {}, identity),
    },
    selectors: {
      light: index(baseline.routes ?? {}, normalizeSelector),
      dark: index(baseline.routesDark ?? {}, normalizeSelector),
    },
  };
}

/**
 * True when the finding is already-accepted debt on this route and theme.
 *
 * Fingerprint first: a contrast finding matches on its colour pair regardless
 * of where axe rooted the selector this run. The selector path only decides
 * findings that have no fingerprint.
 */
export function isWaived(
  compiled: CompiledBaseline,
  theme: Theme,
  routePath: string,
  finding: Finding,
): boolean {
  const fingerprint = fingerprintOf(finding);
  if (fingerprint !== null) {
    return compiled.fingerprints[theme][routePath]?.[finding.ruleId]?.has(fingerprint) ?? false;
  }
  return (
    compiled.selectors[theme][routePath]?.[finding.ruleId]?.has(normalizeSelector(finding.selector)) ??
    false
  );
}
