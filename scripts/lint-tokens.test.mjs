#!/usr/bin/env node
// Test runner for the service-token family rule.
//
// Exercises scripts/lib/canonical-tokens.mjs against fixtures in
// scripts/lint-tokens-fixtures/. Asserts violation counts and shape so the
// rule itself can't silently regress when its heuristics evolve.
//
// No test framework — plain node:assert. Run via `npm run test:lint:tokens`.

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import assert from 'node:assert/strict';
import {
  findFamilyViolations,
  classifySelector,
  lastSimpleSelectors,
} from './lib/canonical-tokens.mjs';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, 'lint-tokens-fixtures');

const tests = [];
const failures = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function run() {
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
  if (failures.length > 0) {
    console.error('\nFailures:');
    for (const { name, err } of failures) {
      console.error(`  ${name}`);
      console.error(err.stack || err.message);
    }
    process.exit(1);
  }
}

function readFixture(name) {
  return fs.readFileSync(path.join(FIXTURES, name), 'utf8');
}

// ── classifySelector ────────────────────────────────────────────────────────

test('classifySelector: section is surface', () => {
  assert.equal(classifySelector('.hero-section'), 'surface');
});

test('classifySelector: hero is surface', () => {
  assert.equal(classifySelector('.hero'), 'surface');
});

test('classifySelector: callout is surface', () => {
  assert.equal(classifySelector('.audience-callout'), 'surface');
});

test('classifySelector: tag is component', () => {
  assert.equal(classifySelector('.service-tag'), 'component');
});

test('classifySelector: badge is component', () => {
  assert.equal(classifySelector('.audience-badge--brand'), 'component');
});

test('classifySelector: btn is component', () => {
  assert.equal(classifySelector('.cta-btn-primary'), 'component');
});

test('classifySelector: pill is component', () => {
  assert.equal(classifySelector('.service-pill'), 'component');
});

test('classifySelector: :root is theme', () => {
  assert.equal(classifySelector(':root'), 'theme');
});

test('classifySelector: :root[data-theme="dark"] is theme', () => {
  assert.equal(classifySelector(':root[data-theme="dark"]'), 'theme');
});

test('classifySelector: @media is at-rule', () => {
  assert.equal(classifySelector('@media (min-width: 768px)'), 'at-rule');
});

test('classifySelector: descendant uses LAST simple selector', () => {
  assert.equal(classifySelector('.hero .tag'), 'component');
  assert.equal(classifySelector('.tag-list .hero-section'), 'surface');
});

test('classifySelector: comma-list with mixed types is mixed', () => {
  assert.equal(classifySelector('.hero, .tag'), 'mixed');
});

test('classifySelector: comma-list of same type collapses', () => {
  assert.equal(classifySelector('.hero, .section'), 'surface');
  assert.equal(classifySelector('.tag, .badge, .pill'), 'component');
});

test('classifySelector: neutral selector gets no opinion', () => {
  assert.equal(classifySelector('.foo'), 'neutral');
  assert.equal(classifySelector('div'), 'neutral');
});

test('classifySelector: single branch with both keywords is mixed', () => {
  assert.equal(classifySelector('.hero-tag'), 'mixed');
});

// ── lastSimpleSelectors ─────────────────────────────────────────────────────

test('lastSimpleSelectors: descendant', () => {
  assert.deepEqual(lastSimpleSelectors('.hero .btn'), ['.btn']);
});

test('lastSimpleSelectors: comma-list', () => {
  assert.deepEqual(lastSimpleSelectors('.hero, .tag'), ['.hero', '.tag']);
});

test('lastSimpleSelectors: pseudo classes stripped', () => {
  assert.deepEqual(lastSimpleSelectors('.btn:hover'), ['.btn']);
  assert.deepEqual(lastSimpleSelectors('.btn:not(.disabled)'), ['.btn']);
});

test('lastSimpleSelectors: attribute selectors stripped', () => {
  assert.deepEqual(lastSimpleSelectors('.btn[disabled]'), ['.btn']);
});

// ── findFamilyViolations: positive fixture (zero violations) ────────────────

test('positive fixture: zero violations', () => {
  const text = readFixture('family-positive.css');
  const v = findFamilyViolations('family-positive.css', text);
  assert.equal(
    v.length,
    0,
    `Expected 0 violations, got ${v.length}:\n${JSON.stringify(v, null, 2)}`
  );
});

// ── findFamilyViolations: negative fixture (6 violations) ───────────────────

test('negative fixture: exactly 6 violations', () => {
  const text = readFixture('family-negative.css');
  const v = findFamilyViolations('family-negative.css', text);
  assert.equal(v.length, 6, `Expected 6 violations, got ${v.length}`);
});

test('negative fixture: case 1 — section selector flagged as expecting surface', () => {
  const text = readFixture('family-negative.css');
  const v = findFamilyViolations('family-negative.css', text);
  const case1 = v.find((x) => x.selector === '.hero-section');
  assert.ok(case1, 'expected violation for .hero-section');
  assert.equal(case1.classification, 'surface');
  assert.equal(case1.actualFamily, 'background');
  assert.equal(case1.expectedFamily, 'surface');
  assert.equal(case1.suggestedToken, '--surface-service-marketing');
});

test('negative fixture: case 3 — tag selector flagged as expecting background', () => {
  const text = readFixture('family-negative.css');
  const v = findFamilyViolations('family-negative.css', text);
  const case3 = v.find((x) => x.selector === '.service-tag');
  assert.ok(case3, 'expected violation for .service-tag');
  assert.equal(case3.classification, 'component');
  assert.equal(case3.actualFamily, 'surface');
  assert.equal(case3.expectedFamily, 'background');
  assert.equal(case3.suggestedToken, '--background-service-marketing');
});

test('negative fixture: case 6 — surface-tone-suffix still gets a suggestion with same suffix', () => {
  // CASE 6 uses --background-service-brand-light on a hero-band (surface).
  // The lint flags it; the suggestion should swap family but preserve the slug+suffix.
  const text = readFixture('family-negative.css');
  const v = findFamilyViolations('family-negative.css', text);
  const case6 = v.find((x) => x.selector === 'section.hero-band');
  assert.ok(case6, 'expected violation for section.hero-band');
  assert.equal(case6.actualFamily, 'background');
  assert.equal(case6.expectedFamily, 'surface');
  // The slug capture includes the -light suffix
  assert.equal(case6.suggestedToken, '--surface-service-brand-light');
});

// ── findFamilyViolations: escape hatch ──────────────────────────────────────

test('escape-hatch fixture: pragma suppresses, unsuppressed flags', () => {
  const text = readFixture('family-escape-hatch.css');
  const v = findFamilyViolations('family-escape-hatch.css', text);
  assert.equal(v.length, 1, `Expected 1 violation, got ${v.length}`);
  assert.equal(v[0].selector, '.hero-section-unsuppressed');
});

// ── findFamilyViolations: cascade-setter carve-out ──────────────────────────

test('cascade setter: --custom-var defining a service token value is exempt', () => {
  // The wrapper is classified as surface (via 'wrap' keyword), but it's
  // defining --background-inverse for a downstream CTA, not painting itself.
  const text = `
    .hero-wrap {
      --background-inverse: var(--background-service-marketing-inverse);
    }
  `;
  const v = findFamilyViolations('inline.css', text);
  assert.equal(v.length, 0, `Expected 0 violations, got ${v.length}`);
});

test('cascade setter: direct paint with same token on same element WOULD flag', () => {
  // Sanity check — the wrapper would still be caught if it tried to paint
  // ITSELF with the wrong family. The carve-out is for LHS=custom-property only.
  const text = `
    .hero-wrap {
      background: var(--background-service-marketing);
    }
  `;
  const v = findFamilyViolations('inline.css', text);
  assert.equal(v.length, 1, `Expected 1 violation, got ${v.length}`);
  assert.equal(v[0].actualFamily, 'background');
  assert.equal(v[0].expectedFamily, 'surface');
});

// ── findFamilyViolations: real-world consumer patterns (audit #117) ─────────

test('real-world fixture: zero violations on canonical consumer patterns', () => {
  // Mirrors the patterns currently shipped in src/ (TSX inline styles
  // equivalents, audited under brikdesigns#117). If this ever fails, the
  // heuristic regressed against a pattern we already shipped.
  const text = readFixture('family-real-world.css');
  const v = findFamilyViolations('family-real-world.css', text);
  assert.equal(
    v.length,
    0,
    `Expected 0 violations on real-world patterns, got ${v.length}:\n${JSON.stringify(v, null, 2)}`
  );
});

// ── findFamilyViolations: line numbers point at the var() ───────────────────

test('line numbers: violations report the line of the var() ref', () => {
  const text = readFixture('family-negative.css');
  const v = findFamilyViolations('family-negative.css', text);
  // Case 1's `background:` declaration is on line 8 of the fixture.
  const case1 = v.find((x) => x.selector === '.hero-section');
  assert.equal(case1.line, 8, `Expected line 8, got ${case1.line}`);
  assert.ok(
    case1.snippet.includes('var(--background-service-marketing)'),
    `Expected snippet to include the var() ref, got: ${case1.snippet}`
  );
});

run();
