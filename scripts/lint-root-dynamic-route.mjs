#!/usr/bin/env node
// Fails CI when a DYNAMIC route segment sits directly under a route group root
// (`src/app/(marketing)/[slug]`).
//
// A root-level `[slug]` competes with every named marketing sibling, and Next.js
// resolves the named segment first — so a CMS row slugged `services` or `plans`
// renders the marketing page instead of the CMS content. No error, no warning,
// and `dynamicParams = false` bakes the collision at build time so it never
// reaches a runtime log either. That was live until brikdesigns#807 moved the
// landing route to `/offers/[slug]`.
//
// Why this shape and not a reserved-slug list: a list of forbidden slugs has to
// be kept in step with the named-route directories by hand, which is the same
// silent-drift bug one layer up — #807's own AC calls that out. Twelve named
// siblings existed when the issue was filed and thirteen when it was fixed
// (`value/` arrived in between, with nobody thinking about slug collisions).
// With every CMS template namespaced, no slug CAN collide, so the invariant
// worth guarding is structural: keep the group root free of dynamic segments and
// the collision class cannot return.
//
// Scope: route-group roots only. Dynamic segments nested inside a named
// namespace (`offers/[slug]`, `events/[slug]`, `blog/[slug]`) are the correct
// pattern and are what this protects.
//
// Usage:
//   npm run lint:root-dynamic-route
// Self-test:
//   npm run test:lint:root-dynamic-route

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

export const APP_DIR = 'src/app';
const DYNAMIC_SEGMENT = /^\[.+\]$/;

/** Route groups `(name)` — transparent to the URL, so their root IS the site root. */
export function routeGroups(appDir) {
  if (!fs.existsSync(appDir)) return [];
  return fs
    .readdirSync(appDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.startsWith('(') && e.name.endsWith(')'))
    .map((e) => path.join(appDir, e.name));
}

/** Dynamic segments directly inside any route group of `appDir`. */
export function findRootDynamicSegments(appDir) {
  return routeGroups(appDir).flatMap((group) =>
    fs
      .readdirSync(group, { withFileTypes: true })
      .filter((e) => e.isDirectory() && DYNAMIC_SEGMENT.test(e.name))
      .map((e) => path.join(group, e.name))
  );
}

function main() {
  const groups = routeGroups(APP_DIR);

  // No groups means the app layout changed shape and every check below would
  // pass vacuously — the failure mode that makes a gate worthless.
  if (groups.length === 0) {
    console.error(
      `lint-root-dynamic-route: no route groups found under ${APP_DIR}/ — ` +
        `the app layout changed shape, so this check cannot assert anything.`
    );
    return 2;
  }

  const findings = findRootDynamicSegments(APP_DIR);
  if (findings.length > 0) {
    console.error(
      `lint-root-dynamic-route: ${findings.length} dynamic segment(s) at a route-group root:`
    );
    for (const f of findings) console.error(`  ${f}`);
    console.error(
      '\n  A dynamic segment here competes with every named sibling and loses ' +
        'silently (Next.js resolves the named segment first). Nest it under a ' +
        'named namespace instead — /offers/[slug], /events/[slug] — and add a ' +
        'permanent redirect for any URL that was already published (Next emits ' +
        '308 for `permanent: true`). See brikdesigns#807.'
    );
    return 1;
  }

  console.log(
    `lint-root-dynamic-route: clean — ${groups.length} route group(s) checked, ` +
      `no dynamic segment at a group root`
  );
  return 0;
}

// Importable for the self-test; only the direct invocation exits.
if (process.argv[1] && import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
