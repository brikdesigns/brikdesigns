#!/usr/bin/env node
// Fails CI when a STATIC marketing page is missing from the axe gate's route set
// (`tests/a11y/public-routes.spec.ts` → PUBLIC_ROUTES).
//
// The route set is hand-maintained, so it drifts behind the app silently: adding
// `src/app/(marketing)/<name>/page.tsx` ships a public page that no gate ever
// audits, and nothing anywhere errors. brikdesigns#1360 is what that costs —
// /how-we-work and /terms had never been in the list, and the gap hid a real AA
// failure. `.hiw-cta__description` rendered white-on-poppy at --body-lg/400
// (3.78:1 against the 4.5:1 normal-text bar) and homepage.css even carried a code
// comment naming the consequence; the follow-up it asked for was never filed.
//
// The check is DELIBERATELY one-directional: every static page must appear in
// ROUTES, but ROUTES may carry entries with no page.tsx of their own. Two classes
// of legitimate extra exist and a bidirectional check would fail on both:
//
//   - dynamic-route representatives — `/services/brand/logo-design`,
//     `/customers/dental`, `/events/grind-after-graduation`. Enumerating a
//     [slug] family needs a CMS query, not a filesystem walk, so the spec samples
//     one instance per family by hand and that is the right shape.
//   - redirect sources — `/get-started` and `/free-marketing-analysis` are 308s
//     (next.config.mjs). Auditing a redirect lands axe on the target's content,
//     which is the anti-pattern the spec's own /industries/* comment records.
//     Filed separately; not this lint's business either way.
//
// So the invariant guarded here is coverage, not symmetry: a page that exists on
// disk is a page a visitor can reach, and every one of those gets audited.
//
// Usage:
//   npm run lint:axe-route-coverage
// Self-test:
//   npm run test:lint:axe-route-coverage

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

export const MARKETING_DIR = 'src/app/(marketing)';
export const SPEC_PATH = 'tests/a11y/public-routes.spec.ts';

const DYNAMIC_SEGMENT = /^\[.+\]$/;
const ROUTE_GROUP = /^\(.+\)$/;

/**
 * Static routes served by `page.tsx` files under `dir`, as URL paths.
 *
 * Route groups `(name)` are transparent to the URL and are unwrapped. Any route
 * containing a dynamic segment is skipped — those are the [slug] families the
 * spec samples by hand.
 */
export function staticMarketingRoutes(dir) {
  if (!fs.existsSync(dir)) return [];
  const routes = [];

  const walk = (abs, segments) => {
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        // A nested route group is still transparent to the URL.
        const next = ROUTE_GROUP.test(entry.name) ? segments : [...segments, entry.name];
        walk(path.join(abs, entry.name), next);
      } else if (entry.name === 'page.tsx' || entry.name === 'page.jsx') {
        if (segments.some((s) => DYNAMIC_SEGMENT.test(s))) continue;
        routes.push(`/${segments.join('/')}`);
      }
    }
  };

  walk(dir, []);
  return [...new Set(routes)].sort();
}

/** The `path:` values in the spec's route table. */
export function specRoutes(specPath) {
  if (!fs.existsSync(specPath)) return [];
  const src = fs.readFileSync(specPath, 'utf8');
  return [...src.matchAll(/path:\s*'([^']+)'/g)].map((m) => m[1]);
}

/** Static routes with no entry in the spec's route table. */
export function findUncoveredRoutes(dir, specPath) {
  const covered = new Set(specRoutes(specPath));
  return staticMarketingRoutes(dir).filter((r) => !covered.has(r));
}

function main() {
  const onDisk = staticMarketingRoutes(MARKETING_DIR);
  const inSpec = specRoutes(SPEC_PATH);

  // Either side coming back empty means the shape moved and every assertion
  // below would pass vacuously — the failure mode that makes a gate worthless.
  if (onDisk.length === 0) {
    console.error(
      `lint-axe-route-coverage: no static page.tsx found under ${MARKETING_DIR}/ — ` +
        `the app layout changed shape, so this check cannot assert anything.`
    );
    return 2;
  }
  if (inSpec.length === 0) {
    console.error(
      `lint-axe-route-coverage: no \`path: '…'\` entries found in ${SPEC_PATH} — ` +
        `the route table was renamed or restructured, so this check cannot ` +
        `assert anything. Update the parser in this script alongside it.`
    );
    return 2;
  }

  const uncovered = onDisk.filter((r) => !new Set(inSpec).has(r));
  if (uncovered.length > 0) {
    console.error(
      `lint-axe-route-coverage: ${uncovered.length} static marketing route(s) ` +
        `missing from the axe route set:`
    );
    for (const r of uncovered) console.error(`  ${r}`);
    console.error(
      `\n  Each is a public page no a11y gate audits. Add an entry to ` +
        `PUBLIC_ROUTES in ${SPEC_PATH}:\n` +
        uncovered.map((r) => `    { path: '${r}', name: '…' },`).join('\n') +
        `\n\n  A route set that drifts behind the app hides real violations — ` +
        `/how-we-work went unaudited long enough to ship a 3.78:1 AA failure. ` +
        `See brikdesigns#1360.`
    );
    return 1;
  }

  console.log(
    `lint-axe-route-coverage: clean — ${onDisk.length} static marketing route(s) ` +
      `all present in the axe route set (${inSpec.length} entries)`
  );
  return 0;
}

// Importable for the self-test; only the direct invocation exits.
if (process.argv[1] && import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
