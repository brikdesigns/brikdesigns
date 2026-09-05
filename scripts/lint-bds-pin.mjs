#!/usr/bin/env node
// Fails CI when @brikdesigns/bds is not pinned to an EXACT version
// (brikdesigns#1228). Part of the Path A cost-cut freeze — see
// brikdesigns/brik-client-portal#3537. Until revenue validates, the site ships
// on what the pinned BDS already exports; it does not float onto newer churn.
//
// The freeze has two halves:
//   1. This script — the dependency spec must be an exact semver (no `^`, `~`,
//      range, `x`, `*`, or `latest`) so `npm ci` can never resolve a newer BDS.
//      Unit-tested in lint-bds-pin.test.mjs.
//   2. verify.yml's "BDS version-freeze guard" step — the pinned version itself
//      may not CHANGE without a `bds-unfreeze` label on the PR. That half is a
//      git-diff + label check in the workflow, not here (it needs the base ref).
//
// Why parse package.json rather than the lockfile: the spec is the intent. A
// caret in package.json is the hole through which a future `npm install` floats
// BDS forward, even if today's lockfile happens to be pinned.
//
// Usage:      npm run lint:bds-pin
// Self-test:  npm run test:lint:bds-pin

import fs from 'node:fs';
import url from 'node:url';

export const PKG_PATH = 'package.json';
export const DEP = '@brikdesigns/bds';

/** True iff `spec` is an exact semver pin — no range operators or wildcards. */
export function isExactPin(spec) {
  if (typeof spec !== 'string') return false;
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(spec.trim());
}

/** The declared @brikdesigns/bds spec, or undefined if absent. */
export function readSpec(pkgPath = PKG_PATH) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  return (
    (pkg.dependencies && pkg.dependencies[DEP]) ??
    (pkg.devDependencies && pkg.devDependencies[DEP])
  );
}

function main() {
  const spec = readSpec();
  if (spec === undefined) {
    console.error(`lint:bds-pin — ${DEP} not found in ${PKG_PATH}`);
    process.exit(1);
  }
  if (!isExactPin(spec)) {
    console.error(
      `lint:bds-pin — ${DEP} must be pinned to an exact version, got "${spec}".\n` +
        `The BDS freeze (Path A, brikdesigns/brik-client-portal#3537) forbids a ` +
        `floating range. Set it to an exact version, e.g. "0.183.0".`,
    );
    process.exit(1);
  }
  console.log(`lint:bds-pin — ${DEP} pinned exact at ${spec} ✓`);
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  main();
}
