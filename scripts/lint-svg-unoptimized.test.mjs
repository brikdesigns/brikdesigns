#!/usr/bin/env node
// Self-test for the SVG-unoptimized guard (brikdesigns#830).
//
// The guard exists because the bug it catches is silent: an SVG <Image> without
// `unoptimized` builds, renders and deploys cleanly, then reddens a blocking
// visual-regression gate roughly 1 run in 28, on whichever route happened to be
// capturing when the decode lost. Nothing fails at author time. So the cases
// below are the ways the guard could stop firing:
//
//   - a plain `src="/x.svg"` is NOT detected (the original bug walks back in)
//   - a guarded one IS detected (false positive; someone deletes the check)
//   - the theme-ternary shape in MegaNav is skipped (the src is an expression,
//     not a string literal, and that is the exact usage #830 traced to)
//
// Fixtures are temp directories, so this asserts the rule rather than the state
// of the real tree — the repo passing today proves nothing about tomorrow.
// Plain node:assert, no framework. Run via `npm run test:lint:svg-unoptimized`.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  findUnguardedSvgImages,
  imageElements,
  isUnguardedSvgImage,
  tsxFiles,
} from './lint-svg-unoptimized.mjs';

const tests = [];
const failures = [];
const test = (name, fn) => tests.push({ name, fn });

/** Build a throwaway tree from `{ relativePath: contents }`. */
function fixture(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'brikdesigns-svgopt-'));
  for (const [rel, body] of Object.entries(files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body);
  }
  return root;
}

test('a bare SVG <Image> is flagged', () => {
  assert.equal(
    isUnguardedSvgImage('<Image src="/images/Brik-logo.svg" width={100} height={40} />'),
    true
  );
});

test('an SVG <Image> with unoptimized is not flagged', () => {
  assert.equal(
    isUnguardedSvgImage('<Image src="/images/Brik-logo.svg" unoptimized width={100} />'),
    false
  );
});

test('the MegaNav theme ternary is flagged — an expression src still names .svg', () => {
  // The exact shape #830 traced to: src is `{cond ? a : b}`, not a literal.
  const el =
    "<Image src={tintedLine ? '/images/Brik-logo_1-inverse.svg' : '/images/Brik-logo_1.svg'} priority />";
  assert.equal(isUnguardedSvgImage(el), true);
});

test('the same ternary with unoptimized is clean', () => {
  const el =
    "<Image src={tintedLine ? '/a-inverse.svg' : '/a.svg'} unoptimized priority />";
  assert.equal(isUnguardedSvgImage(el), false);
});

test('a raster <Image> is never flagged', () => {
  assert.equal(isUnguardedSvgImage('<Image src="/images/hero.webp" width={800} />'), false);
  assert.equal(isUnguardedSvgImage('<Image src="/images/hero.png" width={800} />'), false);
});

test('a multi-line <Image> is parsed as one element', () => {
  const source = `
    <Image
      src="/images/Brik-logo.svg"
      alt="Brik Designs logo"
      width={100}
    />
  `;
  const els = imageElements(source);
  assert.equal(els.length, 1);
  assert.equal(isUnguardedSvgImage(els[0]), true);
});

test('two <Image> elements in one file are counted separately', () => {
  const source =
    '<Image src="/a.svg" unoptimized />\n<Image src="/b.svg" />\n<Image src="/c.webp" />';
  const els = imageElements(source);
  assert.equal(els.length, 3);
  assert.equal(els.filter(isUnguardedSvgImage).length, 1);
});

test('a raw <img> is not checked — it never reaches the optimizer', () => {
  assert.deepEqual(imageElements('<img src="/logo.svg" />'), []);
});

test('findUnguardedSvgImages walks nested directories', () => {
  const root = fixture({
    'src/components/layout/Footer.tsx': '<Image src="/images/Brik-logo.svg" />',
    'src/components/ok/Fine.tsx': '<Image src="/images/ok.svg" unoptimized />',
    'src/lib/notjsx.ts': '<Image src="/images/ignored.svg" />',
  });
  const found = findUnguardedSvgImages(path.join(root, 'src'));
  assert.equal(found.length, 1);
  assert.match(found[0].file, /Footer\.tsx$/);
});

test('tsxFiles returns nothing for a missing dir', () => {
  assert.deepEqual(tsxFiles(path.join(os.tmpdir(), 'brikdesigns-svgopt-absent')), []);
});

test('the real repo tree is clean', () => {
  // The one state assertion: after this fix no SVG <Image> lacks the prop.
  assert.deepEqual(findUnguardedSvgImages('src'), []);
});

// ── CLI exit codes: what CI actually reads ───────────────────────────────────
const CLI = path.resolve('scripts/lint-svg-unoptimized.mjs');
const runCli = (cwd) => spawnSync(process.execPath, [CLI], { cwd, encoding: 'utf8' });

test('CLI exits 1 on a bare SVG <Image>', () => {
  const root = fixture({ 'src/components/Logo.tsx': '<Image src="/logo.svg" />' });
  const res = runCli(root);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /logo\.svg/);
  assert.match(res.stderr, /brikdesigns#830/);
});

test('CLI exits 0 once unoptimized is present', () => {
  const root = fixture({ 'src/components/Logo.tsx': '<Image src="/logo.svg" unoptimized />' });
  assert.equal(runCli(root).status, 0);
});

test('CLI exits 2 rather than passing vacuously with no .tsx', () => {
  const root = fixture({ 'src/lib/only.ts': 'export const x = 1;' });
  assert.equal(runCli(root).status, 2);
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
