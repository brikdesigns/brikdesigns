#!/usr/bin/env node
// Self-test for the section-id gate (brikdesigns#942).
//
// The gate guards an addressability failure — an un-identified <section> throws
// nothing and renders fine, it just can't be referenced — so the only thing
// that makes it worth having is that it fires. The cases below pin the parser
// (which has to survive multi-line tags, `style={{…}}`, and `>` inside JSX
// expressions) and the ratchet (new debt fails; paid debt below the baseline
// also fails, so the baseline can't overstate what's left). The last test runs
// the real gate as a subprocess so the fixtures and the repo stay honest.
//
// Plain node:assert, no framework. Run via `npm run test:lint:section-id`.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  sectionOpeningTags,
  isIdentified,
  unidentifiedCount,
  stripComments,
  SCAN_DIRS,
} from './lint-section-id.mjs';

const tests = [];
const failures = [];
const test = (name, fn) => tests.push({ name, fn });

test('a plain <section> is un-identified', () => {
  assert.equal(unidentifiedCount('<section className="page-section">x</section>'), 1);
});

test('data-section counts as identified', () => {
  assert.equal(unidentifiedCount('<section data-section="hero">x</section>'), 0);
});

test('aria-labelledby counts as identified', () => {
  assert.equal(unidentifiedCount('<section aria-labelledby="h1">x</section>'), 0);
});

test('the inline ignore marker counts as identified', () => {
  assert.equal(
    unidentifiedCount('<section className="skeleton" /* lint-section-id-ignore */>x</section>'),
    0
  );
});

test('a multi-line opening tag with style={{…}} and a ternary parses as one tag', () => {
  // The two hazards for a naive `<section[^>]*>` regex: a `>` living inside a
  // JSX expression, and attributes split across lines.
  const src = [
    '<section',
    '  key={n}',
    '  className={`page-section${a ? " x" : ""}`}',
    '  style={{ backgroundColor: c }}',
    '>',
    '  {a > b ? "y" : "z"}',
    '</section>',
  ].join('\n');
  const tags = sectionOpeningTags(src);
  assert.equal(tags.length, 1, 'expected exactly one opening tag');
  assert.ok(!isIdentified(tags[0]), 'the tag has no identifier');
  // The tag ends at its OWN closing `>` — the `a > b` in the body is not
  // swallowed in, and the body is not part of the captured tag.
  assert.ok(tags[0].endsWith('>'));
  assert.ok(!tags[0].includes('a > b'));
  assert.equal(unidentifiedCount(src), 1);
});

test('adding data-section to that same tag flips it to identified', () => {
  const src = [
    '<section',
    '  key={n}',
    '  data-section={`topic-${n}`}',
    '  style={{ backgroundColor: c }}',
    '>',
    '  {a > b ? "y" : "z"}',
    '</section>',
  ].join('\n');
  assert.equal(unidentifiedCount(src), 0);
});

test('multiple sibling sections are each counted', () => {
  const src =
    '<section className="a">1</section>' +
    '<section data-section="b">2</section>' +
    '<section className="c">3</section>';
  assert.equal(unidentifiedCount(src), 2);
});

test('a <section> written in a JSDoc block is not counted (#1420)', () => {
  // Two block files document what a BDS blueprint "renders its own <section>"
  // for, and the parser read both as real un-identified sections. Not cosmetic:
  // a phantom inflates a file's baseline allowance, so a genuinely un-identified
  // section added later hides behind it and the ratchet never fires.
  const src = [
    '/**',
    ' * CardGrid renders its own `<section>` plus the ADR-021 shell.',
    ' */',
    'export function Block() { return <section data-section="grid">x</section>; }',
  ].join('\n');
  assert.equal(unidentifiedCount(src), 0);
});

test('stripping comments does NOT disarm the ignore marker (#1420)', () => {
  // The escape hatch lives in a block comment inside the opening tag, so a
  // blanket strip would delete it and start failing the very file it exempts.
  const src = '<section className="skeleton" /* lint-section-id-ignore */>x</section>';
  assert.ok(stripComments(src).includes('lint-section-id-ignore'));
  assert.equal(unidentifiedCount(src), 0);
});

test('a phantom in a comment cannot mask a real un-identified section (#1420)', () => {
  // The regression the phantom enabled, stated directly: one documented mention
  // plus one real plain <section> must count 1, not 2.
  const src = [
    '/** This block renders its own <section> — see ADR-021. */',
    '<section className="page-section">real</section>',
  ].join('\n');
  assert.equal(unidentifiedCount(src), 1);
});

test('both scan dirs are declared, and the blocks tree is one of them (#1420)', () => {
  // The gate reported "clean" over a tree it never opened: every <section> on a
  // block-rendered landing route is emitted from src/components/blocks, so
  // /offers/brikdown rendered zero identifiers with no debt recorded anywhere.
  // Un-scanned is not grandfathered — grandfathered debt is counted and drains.
  assert.ok(Array.isArray(SCAN_DIRS));
  assert.ok(SCAN_DIRS.includes('src/app/(marketing)'));
  assert.ok(SCAN_DIRS.includes('src/components/blocks'));
});

test('the real gate passes on the real files', () => {
  const r = spawnSync(process.execPath, ['scripts/lint-section-id.mjs'], { encoding: 'utf8' });
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

console.log(`\nlint-section-id.test: ${tests.length - failures.length}/${tests.length} passed`);
process.exit(failures.length > 0 ? 1 : 0);
