#!/usr/bin/env node
// Self-test for the heading title-case rule (brikdesigns#491).
//
// Exercises scripts/lib/heading-case.mjs against inline cases + a fixture file
// so the heuristic can't silently regress when its rules evolve. No test
// framework — plain node:assert. Run via `npm run test:lint:heading-case`.

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import assert from 'node:assert/strict';
import {
  titleCaseViolations,
  isExemptCopy,
  findHeadingViolations,
} from './lib/heading-case.mjs';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, 'lint-heading-case-fixtures', 'sample.tsx');

const tests = [];
const failures = [];
const test = (name, fn) => tests.push({ name, fn });

// ── titleCaseViolations ──────────────────────────────────────────────────────
test('flags lowercased major words', () => {
  assert.deepEqual(titleCaseViolations('What we do'), ['we', 'do']);
  assert.deepEqual(titleCaseViolations('Monthly subscription'), ['subscription']);
  assert.deepEqual(titleCaseViolations('Get in touch'), ['touch']); // "in" minor, ok
});

test('passes correctly title-cased headings', () => {
  for (const ok of [
    'Our Services',
    'Get in Touch',
    'The Value of Design',
    'What We Do With It', // "With" is 4 letters → major → capitalized
    'Common Challenges We Solve',
    'Website Terms and Conditions',
    'Book a Call With Brik Designs',
    'In 4 Steps',
  ]) {
    assert.deepEqual(titleCaseViolations(ok), [], `expected clean: ${ok}`);
  }
});

test('requires first and last words capitalized even if minor', () => {
  assert.deepEqual(titleCaseViolations('the Value'), ['the']); // first
  assert.deepEqual(titleCaseViolations('Value of'), ['of']);   // last
});

test('capitalizes both parts of a hyphenated compound', () => {
  assert.deepEqual(titleCaseViolations('Industries We Know Inside-Out'), []);
  assert.deepEqual(titleCaseViolations('inside-out'), ['inside', 'out']);
  assert.deepEqual(titleCaseViolations('Full-time Hassle'), ['time']);
});

test('ignores acronyms and numerals (no lowercase start)', () => {
  assert.deepEqual(titleCaseViolations('OSHA Compliance'), []);
  assert.deepEqual(titleCaseViolations('In 4 Steps'), []);
});

// ── isExemptCopy ─────────────────────────────────────────────────────────────
test('exempts conversational / status copy by trailing punctuation', () => {
  assert.equal(isExemptCopy('Message sent!'), true);
  assert.equal(isExemptCopy("Thanks! We'll be in touch."), true);
  assert.equal(isExemptCopy("You're registered!"), true);
  assert.equal(isExemptCopy('Not sure what you need yet?'), true);
  assert.equal(isExemptCopy('Our Services'), false);
});

// ── findHeadingViolations (extraction + scope guards on a real file) ──────────
test('fixture file yields exactly the two seeded violations', () => {
  const text = fs.readFileSync(FIXTURE, 'utf8');
  const v = findHeadingViolations(text, FIXTURE, new Set());
  const found = v.map((x) => x.text).sort();
  assert.deepEqual(found, ['Monthly subscription', 'What we do']);
});

test('allowlist suppresses an exact-match heading', () => {
  const text = '<h2>What we do</h2>';
  assert.equal(findHeadingViolations(text, 'x.tsx', new Set()).length, 1);
  assert.equal(findHeadingViolations(text, 'x.tsx', new Set(['What we do'])).length, 0);
});

test('interpolated and inline-ignored headings are skipped', () => {
  assert.equal(findHeadingViolations('<h2>{cmsTitle}</h2>', 'x.tsx', new Set()).length, 0);
  assert.equal(
    findHeadingViolations('<h2>iOS and beyond</h2> {/* lint-heading-case-ignore */}', 'x.tsx', new Set()).length,
    0
  );
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
