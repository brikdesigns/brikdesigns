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

/** One waiver line in `baseline.json`, addressed well enough to delete by hand. */
export interface BaselineEntry {
  /** Which half of the file it came from — `fingerprints*` or `routes*`. */
  scope: 'fingerprint' | 'selector';
  theme: Theme;
  routePath: string;
  ruleId: string;
  value: string;
}

/**
 * The reverse of `isWaived`: entries that waive NOTHING on this route + theme.
 *
 * ── Why this is asserted rather than reviewed (#1447) ───────────────────────
 *
 * `isWaived` answers "is this finding accepted debt". Until this existed,
 * nothing asked the other direction, so the file was on a one-way ratchet —
 * entries could only ever accumulate. Two things make an entry stop matching,
 * and they are indistinguishable in a diff:
 *
 *   1. The debt was PAID and nobody removed the line. The waiver now stands
 *      ready to re-accept the defect the moment it returns, silently.
 *   2. A token under the colour pair was RE-POINTED. #1361 chose a pair key
 *      over a selector key precisely so a waiver survives a DOM re-root — and
 *      it does. It does not survive the palette moving underneath it.
 *
 * (2) is not hypothetical. brik-bds `05f3d748` re-pointed
 * `--surface-accent-{hue}` onto the numeric Brand Kit ramp and took out SIX
 * colour-pair keys in `fill-distinctness.spec.ts`'s sibling list in one bump
 * (#1442) — five that moved, and one whose pair had crossed back over the 3:1
 * floor, leaving a waiver for a defect that no longer existed. `baseline.json`
 * is keyed the same way; only the luck of which primitives that release touched
 * kept it clean.
 *
 * The reverse-ratchet is settled policy elsewhere in this repo —
 * `scripts/card-class-baseline.json` states it for its grandfather list: "adding
 * an unbacked card without an entry fails, and leaving an entry for a name that
 * has since been converted or deleted also fails."
 *
 * Pure, and takes the findings rather than a page, so the self-test runs the
 * identical function against an injected stale entry.
 *
 * `findings` must be the SAME population `isWaived` is consulted for — the
 * blocking-impact set. Passing a wider set would call an entry live when it only
 * matches an advisory finding the gate never blocks on; passing a narrower one
 * would report a working waiver as stale.
 */
export function unmatchedEntries(
  compiled: CompiledBaseline,
  theme: Theme,
  routePath: string,
  findings: Finding[],
): BaselineEntry[] {
  const seenFingerprints = new Set<string>();
  const seenSelectors = new Set<string>();
  for (const f of findings) {
    const fingerprint = fingerprintOf(f);
    if (fingerprint !== null) seenFingerprints.add(`${f.ruleId} ${fingerprint}`);
    // A finding is matched by the selector half only when it has NO fingerprint
    // — that is the precedence `isWaived` applies, and the two must agree or an
    // entry could read live here and waive nothing there.
    else seenSelectors.add(`${f.ruleId} ${normalizeSelector(f.selector)}`);
  }

  const out: BaselineEntry[] = [];
  const sweep = (
    scope: BaselineEntry['scope'],
    source: Record<string, Record<string, Set<string>>>,
    seen: Set<string>,
  ) => {
    for (const [ruleId, values] of Object.entries(source[routePath] ?? {})) {
      for (const value of values) {
        if (!seen.has(`${ruleId} ${value}`)) {
          out.push({ scope, theme, routePath, ruleId, value });
        }
      }
    }
  };
  sweep('fingerprint', compiled.fingerprints[theme], seenFingerprints);
  sweep('selector', compiled.selectors[theme], seenSelectors);
  return out;
}

/**
 * Route keys in the baseline that no route in `audited` covers (#1447).
 *
 * `unmatchedEntries` is per-route, so it can only speak for routes the suite
 * actually visits. An entry parked under a route that was renamed or dropped
 * from `PUBLIC_ROUTES` is never evaluated by anything and rots in total
 * silence — the exact blind spot that let 89 of the file's 160 selector entries
 * (56%) stop matching before #1361 measured it.
 *
 * Live example of the rename shape: `/customers/*` became `/industries/*` in
 * #1406.
 */
export function orphanRoutes(baseline: BaselineFile, audited: Iterable<string>): string[] {
  const covered = new Set(audited);
  const keys: (keyof BaselineFile)[] = ['fingerprints', 'fingerprintsDark', 'routes', 'routesDark'];
  const orphans = new Set<string>();
  for (const key of keys) {
    for (const routePath of Object.keys(baseline[key] ?? {})) {
      if (!covered.has(routePath)) orphans.add(`${key}.${routePath}`);
    }
  }
  return [...orphans].sort();
}
