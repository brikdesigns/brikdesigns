#!/usr/bin/env node
// Self-test for the axe route-coverage guard (brikdesigns#1360).
//
// The guard exists because the bug it catches is silent: adding a page.tsx ships
// a public route that no a11y gate audits, with no error at build or run time.
// So the only thing that makes the guard worth having is that it fires — and the
// cases below are the ways it could stop firing:
//
//   - a new static page.tsx missing from ROUTES is NOT flagged (the #1360 bug
//     walks straight back in)
//   - a dynamic [slug] route IS flagged (false positive on a family the spec
//     samples by hand — someone deletes the check rather than fight it)
//   - a ROUTES entry with no page.tsx IS flagged (false positive on the
//     redirect sources and dynamic representatives that legitimately live there)
//   - the parser silently matches nothing and the check passes vacuously
//
// Fixtures are temp directories, so this asserts the rule rather than the state
// of the real tree — the repo passing today proves nothing about tomorrow.
// Plain node:assert, no framework. Run via `npm run test:lint:axe-route-coverage`.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  staticMarketingRoutes,
  specRoutes,
  findUncoveredRoutes,
  MARKETING_DIR,
  SPEC_PATH,
} from './lint-axe-route-coverage.mjs';

const tests = [];
const failures = [];
const test = (name, fn) => tests.push({ name, fn });

/** Build a throwaway marketing tree: a list of route dirs, each given a page.tsx. */
function pagesFixture(routeDirs) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'brikdesigns-axecov-'));
  for (const d of routeDirs) {
    const abs = path.join(root, d);
    fs.mkdirSync(abs, { recursive: true });
    fs.writeFileSync(path.join(abs, 'page.tsx'), 'export default function P() { return null; }\n');
  }
  return root;
}

/** Build a throwaway spec file carrying a PUBLIC_ROUTES table. */
function specFixture(paths) {
  const file = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'brikdesigns-axespec-')),
    'public-routes.spec.ts'
  );
  const rows = paths.map((p) => `  { path: '${p}', name: 'X' },`).join('\n');
  fs.writeFileSync(file, `const PUBLIC_ROUTES = [\n${rows}\n];\n`);
  return file;
}

// ── route enumeration ────────────────────────────────────────────────────────

test('the group root itself is the / route', () => {
  const app = pagesFixture(['.']);
  assert.deepEqual(staticMarketingRoutes(app), ['/']);
});

test('named directories become their URL path', () => {
  const app = pagesFixture(['about', 'how-we-work', 'terms']);
  assert.deepEqual(staticMarketingRoutes(app), ['/about', '/how-we-work', '/terms']);
});

test('dynamic segments are skipped — the spec samples those by hand', () => {
  const app = pagesFixture(['blog', 'blog/[slug]', 'services/[a]/[b]']);
  assert.deepEqual(staticMarketingRoutes(app), ['/blog']);
});

test('catch-all and optional-catch-all segments are skipped too', () => {
  const app = pagesFixture(['docs/[...rest]', 'shop/[[...maybe]]', 'value']);
  assert.deepEqual(staticMarketingRoutes(app), ['/value']);
});

test('a nested route group is transparent to the URL', () => {
  const app = pagesFixture(['(legal)/terms']);
  assert.deepEqual(staticMarketingRoutes(app), ['/terms']);
});

test('a directory with no page.tsx is not a route', () => {
  const root = pagesFixture(['about']);
  fs.mkdirSync(path.join(root, '_components'), { recursive: true });
  fs.writeFileSync(path.join(root, '_components/Thing.tsx'), 'export const Thing = null;\n');
  assert.deepEqual(staticMarketingRoutes(root), ['/about']);
});

test('a missing marketing dir does not throw', () => {
  assert.deepEqual(staticMarketingRoutes(path.join(os.tmpdir(), 'brikdesigns-axecov-absent')), []);
});

// ── spec parsing ─────────────────────────────────────────────────────────────

test('specRoutes reads every path entry in order', () => {
  const spec = specFixture(['/', '/about', '/how-we-work']);
  assert.deepEqual(specRoutes(spec), ['/', '/about', '/how-we-work']);
});

test('a missing spec file does not throw', () => {
  assert.deepEqual(specRoutes(path.join(os.tmpdir(), 'brikdesigns-axespec-absent.ts')), []);
});

// ── the invariant ────────────────────────────────────────────────────────────

test('a static page missing from ROUTES is flagged — this IS #1360', () => {
  const app = pagesFixture(['about', 'how-we-work', 'terms']);
  const spec = specFixture(['/about']);
  assert.deepEqual(findUncoveredRoutes(app, spec), ['/how-we-work', '/terms']);
});

test('full coverage is clean', () => {
  const app = pagesFixture(['.', 'about', 'terms']);
  const spec = specFixture(['/', '/about', '/terms']);
  assert.deepEqual(findUncoveredRoutes(app, spec), []);
});

test('a ROUTES entry with no page.tsx is NOT flagged — the check is one-directional', () => {
  // The real spec's dynamic representatives (/customers/dental) and redirect
  // sources (/get-started) have no page.tsx of their own and must stay legal.
  const app = pagesFixture(['customers']);
  const spec = specFixture(['/customers', '/customers/dental', '/get-started']);
  assert.deepEqual(findUncoveredRoutes(app, spec), []);
});

test('the real repo tree is covered', () => {
  // The one state assertion: after #1360 no static marketing route is unaudited.
  assert.deepEqual(findUncoveredRoutes(MARKETING_DIR, SPEC_PATH), []);
});

test('the real spec carries /how-we-work and /terms', () => {
  const routes = specRoutes(SPEC_PATH);
  assert.ok(routes.includes('/how-we-work'), '/how-we-work missing from the axe route set');
  assert.ok(routes.includes('/terms'), '/terms missing from the axe route set');
});

// ── CLI exit codes: what CI actually reads ───────────────────────────────────
const CLI = path.resolve('scripts/lint-axe-route-coverage.mjs');
const runCli = (cwd) => spawnSync(process.execPath, [CLI], { cwd, encoding: 'utf8' });

/** A throwaway repo root with both real paths populated. */
function repoFixture(routeDirs, specPaths) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'brikdesigns-axerepo-'));
  for (const d of routeDirs) {
    const abs = path.join(root, MARKETING_DIR, d);
    fs.mkdirSync(abs, { recursive: true });
    fs.writeFileSync(path.join(abs, 'page.tsx'), 'export default function P() { return null; }\n');
  }
  if (specPaths) {
    fs.mkdirSync(path.join(root, path.dirname(SPEC_PATH)), { recursive: true });
    const rows = specPaths.map((p) => `  { path: '${p}', name: 'X' },`).join('\n');
    fs.writeFileSync(path.join(root, SPEC_PATH), `const PUBLIC_ROUTES = [\n${rows}\n];\n`);
  }
  return root;
}

test('CLI exits 1 on a static page missing from ROUTES', () => {
  const res = runCli(repoFixture(['about', 'how-we-work'], ['/about']));
  assert.equal(res.status, 1);
  assert.match(res.stderr, /\/how-we-work/);
  assert.match(res.stderr, /brikdesigns#1360/);
});

test('CLI prints a paste-ready ROUTES row for each gap', () => {
  const res = runCli(repoFixture(['terms'], ['/about']));
  assert.equal(res.status, 1);
  assert.match(res.stderr, /\{ path: '\/terms', name: '…' \},/);
});

test('CLI exits 0 on full coverage', () => {
  const res = runCli(repoFixture(['about', 'terms'], ['/about', '/terms']));
  assert.equal(res.status, 0);
});

test('CLI exits 2 rather than passing vacuously with no pages on disk', () => {
  const res = runCli(repoFixture([], ['/about']));
  assert.equal(res.status, 2);
  assert.match(res.stderr, /changed shape/);
});

test('CLI exits 2 rather than passing vacuously when the route table cannot be parsed', () => {
  const root = repoFixture(['about'], null);
  fs.mkdirSync(path.join(root, path.dirname(SPEC_PATH)), { recursive: true });
  fs.writeFileSync(path.join(root, SPEC_PATH), 'const PUBLIC_ROUTES = [];\n');
  const res = runCli(root);
  assert.equal(res.status, 2);
  assert.match(res.stderr, /renamed or restructured/);
});

// ── runner ───────────────────────────────────────────────────────────────────
let passed = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures.push({ name, err });
    console.log(`  FAIL ${name}`);
    console.log(`         ${err.message.split('\n')[0]}`);
  }
}
console.log(`\n${passed}/${tests.length} passed.`);
if (failures.length) {
  console.error('\nFailures:');
  for (const { name, err } of failures) {
    console.error(`  ${name}`);
    console.error(err.stack || err.message);
  }
  process.exit(1);
}
