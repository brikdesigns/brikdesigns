#!/usr/bin/env node
// Self-test for the BDS exact-pin gate (brikdesigns#1228).
//
// The gate guards a silent failure — a caret spec passes every build today and
// only floats BDS forward on some future `npm install` — so the only thing that
// makes it worth having is that it fires. The cases pin `isExactPin` across the
// range shapes npm allows, and the last case runs the real CLI against a
// caret-spec fixture so the exit code stays honest.
//
// Plain node:assert, no framework. Run via `npm run test:lint:bds-pin`.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isExactPin, readSpec } from './lint-bds-pin.mjs';

const tests = [];
const failures = [];
const test = (name, fn) => tests.push({ name, fn });

test('exact version is a valid pin', () => {
  assert.equal(isExactPin('0.183.0'), true);
});
test('caret range is rejected', () => {
  assert.equal(isExactPin('^0.183.0'), false);
});
test('tilde range is rejected', () => {
  assert.equal(isExactPin('~0.183.0'), false);
});
test('wildcard patch is rejected', () => {
  assert.equal(isExactPin('0.183.x'), false);
});
test('"latest" is rejected', () => {
  assert.equal(isExactPin('latest'), false);
});
test('comparator range is rejected', () => {
  assert.equal(isExactPin('>=0.183.0'), false);
});
test('exact prerelease pin is accepted', () => {
  assert.equal(isExactPin('0.183.0-rc.1'), true);
});
test('non-string is rejected', () => {
  assert.equal(isExactPin(undefined), false);
});
test('the repo package.json keeps BDS exact-pinned', () => {
  assert.equal(isExactPin(readSpec()), true, 'package.json must keep @brikdesigns/bds exact-pinned');
});

test('the real gate fails on a floating spec (subprocess)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bds-pin-'));
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ dependencies: { '@brikdesigns/bds': '^0.183.0' } }),
  );
  const r = spawnSync(process.execPath, [path.resolve('scripts/lint-bds-pin.mjs')], {
    cwd: dir,
    encoding: 'utf8',
  });
  assert.equal(r.status, 1, `expected non-zero exit, got ${r.status}:\n${r.stdout}${r.stderr}`);
});

test('the real gate passes on the real package.json (subprocess)', () => {
  const r = spawnSync(process.execPath, ['scripts/lint-bds-pin.mjs'], { encoding: 'utf8' });
  assert.equal(r.status, 0, `gate failed on the repo:\n${r.stderr || r.stdout}`);
});

for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failures.push({ name, err });
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message.split('\n').join('\n    ')}`);
  }
}

console.log(`\nlint-bds-pin.test: ${tests.length - failures.length}/${tests.length} passed`);
process.exit(failures.length > 0 ? 1 : 0);
