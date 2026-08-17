#!/usr/bin/env node
// Self-test for the hardcoded-literal gate (scripts/lib/hardcoded-values.mjs).
//
// Plain node:assert, no framework — mirrors lint-heading-case.test.mjs. Runs
// against fixture stylesheets so the detector + token resolver can't silently
// regress. Run via `npm run test:lint:hardcoded`.

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import assert from 'node:assert/strict';
import {
  resolveTokenValues,
  buildTokenIndex,
  lengthToPx,
  findHardcodedViolations,
} from './lib/hardcoded-values.mjs';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const FIX = (name) => path.join(__dirname, 'lint-hardcoded-fixtures', name);
const read = (name) => fs.readFileSync(FIX(name), 'utf8');

// Synthetic token sheet — includes a comment that would swallow the next real
// declaration if comments weren't stripped (the resolver regression guard).
const TOKENS = `
:root {
  --space-50: 2px;
  --space-100: 4px;
  --space-200: 8px;
  --space-400: 16px;
  --gap-tiny: var(--space-50);
  --gap-md: var(--space-200);
  --padding-lg: var(--space-400);
  --border-radius-200: 4px;
  --border-radius-400: 8px;
  --border-radius-sm: var(--border-radius-200);
  --border-radius-md: var(--border-radius-400);
  /* --gap-component: a note mentioning 12px that must not swallow the value */
  --gap-component: 12px;
}
:root[data-theme="dark"] {
  --gap-md: 999px;  /* later override must NOT win over the :root base */
}
`;

const index = buildTokenIndex(resolveTokenValues(TOKENS));

const tests = [];
const failures = [];
const test = (name, fn) => tests.push({ name, fn });
const cats = (vs) => vs.map((v) => `${v.category}:${v.prop}:${v.literal}`);

// ── resolver ─────────────────────────────────────────────────────────────────
test('resolveTokenValues follows var() indirection to a concrete value', () => {
  const r = resolveTokenValues(TOKENS);
  assert.equal(r.get('--gap-tiny'), '2px');
  assert.equal(r.get('--border-radius-sm'), '4px');
});

test('first (:root base) declaration wins over later overrides', () => {
  const r = resolveTokenValues(TOKENS);
  assert.equal(r.get('--gap-md'), '8px'); // not 999px
});

test('a commented pseudo-declaration does not swallow the real value', () => {
  const r = resolveTokenValues(TOKENS);
  assert.equal(r.get('--gap-component'), '12px');
});

test('lengthToPx normalises rem/em to px, rejects non-lengths', () => {
  assert.equal(lengthToPx('2px'), 2);
  assert.equal(lengthToPx('1rem'), 16);
  assert.equal(lengthToPx('0.5em'), 8);
  assert.equal(lengthToPx('4/3'), null);
  assert.equal(lengthToPx('0.2s'), null);
});

// ── detector: positives ──────────────────────────────────────────────────────
test('flags spacing/radius/colour/typography literals', () => {
  const v = findHardcodedViolations('positive.css', read('positive.css'), index);
  const c = cats(v);
  assert.ok(c.includes('spacing:gap:2px'), 'gap 2px');
  assert.ok(c.includes('radius:border-radius:8px'), 'radius 8px');
  assert.ok(c.includes('colour:color:#ff0000'), 'hex');
  assert.ok(c.includes('colour:background:rgba'), 'rgba');
  assert.ok(c.includes('typography:font-size:30px'), 'font-size');
  assert.ok(c.includes('typography:line-height:40px'), 'line-height');
});

test('exact-token literals carry a suggestion; unmatched ones flag a DS gap', () => {
  const v = findHardcodedViolations('positive.css', read('positive.css'), index);
  const gap2 = v.find((x) => x.literal === '2px' && x.category === 'spacing');
  assert.equal(gap2.suggestion, '--gap-tiny');
  assert.equal(gap2.dsGap, false);
  const pad90 = v.find((x) => x.literal === '90px');
  assert.equal(pad90.dsGap, true, '90px has no token → design-system gap');
  assert.equal(pad90.suggestion, null);
});

// ── detector: negatives ──────────────────────────────────────────────────────
test('does not flag tokens, zero, layout dims, or fluid primitives', () => {
  const v = findHardcodedViolations('negative.css', read('negative.css'), index);
  assert.deepEqual(v, [], `expected clean, got: ${JSON.stringify(cats(v))}`);
});

// ── detector: escape hatch ───────────────────────────────────────────────────
test('per-line ignore comment suppresses only its own line', () => {
  const v = findHardcodedViolations('escape-hatch.css', read('escape-hatch.css'), index);
  assert.deepEqual(cats(v), ['spacing:padding:5px'], 'only the un-ignored line flags');
});

// ── run ──────────────────────────────────────────────────────────────────────
for (const t of tests) {
  try {
    t.fn();
    console.log(`  ✓ ${t.name}`);
  } catch (err) {
    failures.push({ name: t.name, err });
    console.error(`  ✗ ${t.name}\n    ${err.message}`);
  }
}
if (failures.length) {
  console.error(`\nFAIL — ${failures.length}/${tests.length} test(s) failed.`);
  process.exit(1);
}
console.log(`\nOK — ${tests.length} tests passed.`);
