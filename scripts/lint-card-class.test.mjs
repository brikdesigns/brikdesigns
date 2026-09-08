#!/usr/bin/env node
// Self-test for the card-class gate (brikdesigns#1260).
//
// The gate guards a silent failure — a hand-rolled `<div className="x-card">`
// renders fine, it just never becomes a `.bds-card` element, so the "Card chrome
// by band" rule never reaches it and card-treatment.spec.ts cannot see it. The
// only thing that makes the gate worth having is that it fires, and that it
// fires on the right things. The cases below pin the three judgement calls:
// which names read as cards, which of those are BLOCKS worth judging (not
// elements or modifiers), and whether a name is applied on a `<Card>`. The last
// test runs the real gate as a subprocess so the fixtures and the repo stay
// honest.
//
// Plain node:assert, no framework. Run via `npm run test:lint:card-class`.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  definedClasses,
  isCardName,
  isJudgedBlock,
  openingTags,
  appliedClasses,
  cardBackedClasses,
} from './lint-card-class.mjs';

const tests = [];
const failures = [];
const test = (name, fn) => tests.push({ name, fn });

// ── which names read as a card ────────────────────────────────────────────

test('`card` as a delimited word is a card name; a substring is not', () => {
  for (const yes of ['story-card', 'card-grid', 'blog_card', 'card']) {
    assert.ok(isCardName(yes), `${yes} should read as a card`);
  }
  for (const no of ['cardigan', 'discard', 'placard', 'scoreboard']) {
    assert.ok(!isCardName(no), `${no} should NOT read as a card`);
  }
});

// ── which card names are judged ───────────────────────────────────────────

test('only BEM blocks are judged — elements, modifiers and bds-* are not', () => {
  assert.ok(isJudgedBlock('story-card'), 'a plain block is judged');
  assert.ok(!isJudgedBlock('story-card__media'), 'an __element belongs to its block');
  assert.ok(!isJudgedBlock('service-card--flat'), 'a --modifier belongs to its block');
  assert.ok(!isJudgedBlock('bds-card'), 'bds-* is BDS-owned, not site-local');
  assert.ok(!isJudgedBlock('page-section'), 'a non-card name is never judged');
});

// ── reading definitions out of CSS ────────────────────────────────────────

test('classes are read from rule preludes, including inside @media', () => {
  const css = [
    '.blog-card { padding: 4px; }',
    '@media (max-width: 700px) { .value-card { padding: 2px; } }',
    '.a .story-card:hover, .b > .hiw-card { color: red; }',
  ].join('\n');
  const found = definedClasses(css);
  for (const n of ['blog-card', 'value-card', 'story-card', 'hiw-card', 'a', 'b']) {
    assert.ok(found.has(n), `expected to find .${n}`);
  }
});

test('a class name mentioned only in a comment is not a definition', () => {
  // The retired names in this repo live on as prose in replacement comments —
  // reading those as definitions would resurrect debt that was actually paid.
  const css = '/* `.lp-form-card` was the third copy; see .cta-card */\n.form-card { color: red; }';
  const found = definedClasses(css);
  assert.ok(found.has('form-card'));
  assert.ok(!found.has('lp-form-card'), 'a commented name is not defined');
  assert.ok(!found.has('cta-card'), 'a commented name is not defined');
});

// ── reading application out of TSX ────────────────────────────────────────

test('a multi-line <Card> with style={{…}} parses as one opening tag', () => {
  // The two hazards for a naive `<Card[^>]*>` regex: a `>` inside a JSX
  // expression, and attributes split across lines.
  const src = [
    '<Card',
    '  variant="outlined"',
    '  className="form-card form-card--accent"',
    '  style={{ borderTopColor: accent.bg }}',
    '>',
    '  {a > b ? "y" : "z"}',
    '</Card>',
  ].join('\n');
  const tags = openingTags(src, 'Card');
  assert.equal(tags.length, 1, 'expected exactly one opening tag');
  assert.ok(!tags[0].includes('a > b'), 'the body must not be swallowed into the tag');
  assert.ok(cardBackedClasses(src).has('form-card'));
});

test('a class on a <div> is applied but NOT card-backed', () => {
  const src = '<div className="value-card">x</div>';
  assert.ok(appliedClasses(src).has('value-card'), 'it is applied');
  assert.ok(!cardBackedClasses(src).has('value-card'), 'but not on a <Card>');
});

test('a template-literal / array className still counts as card-backed', () => {
  const src =
    '<Card preset="display" className={[`service-card--${t}`, extra].filter(Boolean).join(" ")}>x</Card>';
  assert.ok(cardBackedClasses(src).has('service-card'), 'the block inside the template counts');
});

test('<PricingCard> and <CardGrid> are not <Card>', () => {
  // `<Card\b` must not match a longer component name, or a PricingCard wrapper
  // would launder any class into "backed".
  const src =
    '<PricingCard className="plans-card-wrapper" /><CardGrid className="x-card">y</CardGrid>';
  assert.equal(openingTags(src, 'Card').length, 0, 'neither is a bare <Card>');
  assert.ok(!cardBackedClasses(src).has('plans-card-wrapper'));
  assert.ok(!cardBackedClasses(src).has('x-card'));
});

// ── the real gate on the real repo ────────────────────────────────────────

test('the real gate passes on the real files', () => {
  const r = spawnSync(process.execPath, ['scripts/lint-card-class.mjs'], { encoding: 'utf8' });
  assert.equal(r.status, 0, `gate failed on the repo:\n${r.stderr || r.stdout}`);
  assert.match(r.stdout, /clean/);
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

console.log(`\nlint-card-class.test: ${tests.length - failures.length}/${tests.length} passed`);
process.exit(failures.length > 0 ? 1 : 0);
