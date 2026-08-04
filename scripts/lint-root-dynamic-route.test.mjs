#!/usr/bin/env node
// Self-test for the root-dynamic-route guard (brikdesigns#807).
//
// The guard exists because the bug it catches is silent: a dynamic segment at a
// route-group root loses to every named sibling with no error at build or run
// time. So the only thing that makes the guard worth having is that it fires —
// and the cases below are the ways it could stop firing:
//
//   - a root `[slug]` is NOT detected (the original bug walks back in)
//   - a correctly nested `offers/[slug]` IS detected (false positive; someone
//     deletes the check rather than fight it)
//   - a route group other than `(marketing)` is skipped (the URL root is the
//     group root for every group, not just the one that had the bug)
//
// Fixtures are temp directories, so this asserts the rule rather than the state
// of the real tree — the repo passing today proves nothing about tomorrow.
// Plain node:assert, no framework. Run via `npm run test:lint:root-dynamic-route`.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { findRootDynamicSegments, routeGroups } from './lint-root-dynamic-route.mjs';

const tests = [];
const failures = [];
const test = (name, fn) => tests.push({ name, fn });

/** Build a throwaway `app/` tree from a list of directory paths. */
function fixture(dirs) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'brikdesigns-rootdyn-'));
  for (const d of dirs) fs.mkdirSync(path.join(root, d), { recursive: true });
  return root;
}

test('a dynamic segment at the group root is flagged', () => {
  const app = fixture(['(marketing)/[slug]', '(marketing)/about']);
  const found = findRootDynamicSegments(app);
  assert.equal(found.length, 1);
  assert.match(found[0], /\(marketing\)\/\[slug\]$/);
});

test('a namespaced dynamic segment is not flagged', () => {
  // The shape #807 moved to, plus its two namespaced precedents.
  const app = fixture([
    '(marketing)/offers/[slug]',
    '(marketing)/events/[slug]',
    '(marketing)/marketing/[slug]',
    '(marketing)/services',
  ]);
  assert.deepEqual(findRootDynamicSegments(app), []);
});

test('every route group is checked, not just (marketing)', () => {
  const app = fixture(['(marketing)/about', '(legal)/[doc]']);
  const found = findRootDynamicSegments(app);
  assert.equal(found.length, 1);
  assert.match(found[0], /\(legal\)\/\[doc\]$/);
});

test('catch-all and optional-catch-all segments count too', () => {
  const app = fixture(['(marketing)/[...rest]', '(shop)/[[...maybe]]']);
  assert.equal(findRootDynamicSegments(app).length, 2);
});

test('a non-group directory at the app root is not a group root', () => {
  // `src/app/api/[id]` is a real route, not a marketing-root collision.
  const app = fixture(['api/[id]', '(marketing)/about']);
  assert.deepEqual(findRootDynamicSegments(app), []);
});

test('routeGroups finds nothing when the layout has no groups', () => {
  // The vacuous-pass case the CLI turns into exit 2.
  const app = fixture(['about', 'blog']);
  assert.deepEqual(routeGroups(app), []);
});

test('a missing app dir does not throw', () => {
  assert.deepEqual(routeGroups(path.join(os.tmpdir(), 'brikdesigns-rootdyn-absent')), []);
});

test('the real repo tree is clean', () => {
  // The one state assertion: after #807 there is no group-root dynamic segment.
  assert.deepEqual(findRootDynamicSegments('src/app'), []);
});

// ── CLI exit codes: what CI actually reads ───────────────────────────────────
const CLI = path.resolve('scripts/lint-root-dynamic-route.mjs');
const runCli = (cwd) => spawnSync(process.execPath, [CLI], { cwd, encoding: 'utf8' });

test('CLI exits 1 on a group-root dynamic segment', () => {
  const root = fixture([]);
  fs.mkdirSync(path.join(root, 'src/app/(marketing)/[slug]'), { recursive: true });
  const res = runCli(root);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /\[slug\]/);
  assert.match(res.stderr, /brikdesigns#807/);
});

test('CLI exits 0 on a namespaced dynamic segment', () => {
  const root = fixture([]);
  fs.mkdirSync(path.join(root, 'src/app/(marketing)/offers/[slug]'), { recursive: true });
  const res = runCli(root);
  assert.equal(res.status, 0);
});

test('CLI exits 2 rather than passing vacuously with no route groups', () => {
  const root = fixture([]);
  fs.mkdirSync(path.join(root, 'src/app/about'), { recursive: true });
  const res = runCli(root);
  assert.equal(res.status, 2);
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
