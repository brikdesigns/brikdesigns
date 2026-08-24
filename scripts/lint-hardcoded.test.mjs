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
  findMalformedWaivers,
  KNOWN_LINTERS,
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
  /* Mirrors the real BDS shape: a dense numeric scale, only some steps of
     which have a semantic alias. 4px radius / 3px border are the off-alias
     steps that used to report as design-system gaps. */
  --border-radius-100: 4px;
  --border-radius-200: 8px;
  --border-radius-400: 12px;
  --border-radius-sm: var(--border-radius-200);
  --border-radius-md: var(--border-radius-400);
  --border-width-50: 1px;
  --border-width-100: 2px;
  --border-width-200: 3px;
  --border-width-sm: var(--border-width-50);
  --border-width-md: var(--border-width-100);
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
  assert.equal(r.get('--border-radius-sm'), '8px');
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

// The index must cover a family's whole numeric scale, not just its handful of
// semantic aliases — matching aliases alone reported every off-alias step as a
// design-system gap and sent the burn-down to invent tokens BDS already ships.
test('off-alias scale steps resolve to a token, not a design-system gap', () => {
  assert.deepEqual(index.radius.get(4), ['--border-radius-100']);
  assert.deepEqual(index.border.get(3), ['--border-width-200']);

  const v = findHardcodedViolations('positive.css', read('positive.css'), index);
  const bw3 = v.find((x) => x.category === 'border-width' && x.literal === '3px');
  assert.equal(bw3.dsGap, false, '3px border-width → --border-width-200');
  assert.equal(bw3.suggestion, '--border-width-200');
});

test('a semantic alias still outranks the numeric step it resolves to', () => {
  const v = findHardcodedViolations('positive.css', read('positive.css'), index);
  const r8 = v.find((x) => x.category === 'radius' && x.literal === '8px');
  assert.equal(r8.suggestion, '--border-radius-sm', 'alias preferred over --border-radius-200');
});

// A rule written on one line used to be skipped whole: the `;`-split chunk is
// `.foo { gap: 7px`, whose property name fails the `^[a-z-]+$` guard. The
// pseudo-class case was worse — `a:hover { gap: 2px` parsed as prop `a`, so it
// failed silently rather than visibly.
test('flags literals in single-line rules', () => {
  const v = findHardcodedViolations('positive.css', read('positive.css'), index);
  const c = cats(v);
  assert.ok(c.includes('spacing:gap:7px'), 'single-line rule');
  assert.ok(c.includes('spacing:gap:6px'), 'first of two decls on one line');
  assert.ok(c.includes('radius:border-radius:8px'), 'second of two decls on one line');
  assert.ok(c.includes('radius:border-radius:12px'), 'no trailing semicolon');
});

test('a selector colon is not mistaken for the declaration colon', () => {
  const v = findHardcodedViolations('positive.css', read('positive.css'), index);
  // Both 2px gaps — the multi-line one at the top and the pseudo-class
  // single-liner — must report `gap`. A leaked selector fragment (`a`, `.foo {
  // gap`) is the failure this guards, and it shows up as a wrong `prop`.
  const twos = v.filter((x) => x.literal === '2px' && x.category === 'spacing');
  assert.equal(twos.length, 2, 'multi-line + single-line pseudo');
  for (const t of twos) {
    assert.equal(t.prop, 'gap', `prop is gap, got "${t.prop}"`);
    assert.equal(t.suggestion, '--gap-tiny');
  }
  // No violation anywhere may carry a property the CSS parser wouldn't accept.
  for (const x of v) {
    assert.match(x.prop, /^(--)?[a-z][a-z-]*$/, `implausible property "${x.prop}"`);
  }
});

// ── detector: semantic-token definitions ─────────────────────────────────────
test('flags a raw colour written straight into a semantic token', () => {
  const v = findHardcodedViolations('positive.css', read('positive.css'), index);
  const c = cats(v);
  assert.ok(c.includes('token-definition:--surface-negative:#fdeaea'), 'hex in semantic token');
  assert.ok(c.includes('token-definition:--text-negative:rgb'), 'rgb() in semantic token');
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

// ── waiver form ──────────────────────────────────────────────────────────────
// A waiver must name the linter it suppresses. A bare `bds-lint-ignore` does
// not satisfy IGNORE_RE, so it reads as a disposition while suppressing nothing
// — two shipped that way in blocks.css (#996).
test('a bare bds-lint-ignore is reported as malformed', () => {
  const css = '.a { gap: 3px; /* bds-lint-ignore — bare */ }\n';
  assert.deepEqual(
    findMalformedWaivers('bare.css', css).map((m) => m.line),
    [1]
  );
});

test('each known linter name is accepted', () => {
  for (const name of KNOWN_LINTERS) {
    const css = `.a { gap: 3px; /* bds-lint-ignore ${name} — reason */ }\n`;
    assert.deepEqual(findMalformedWaivers('ok.css', css), [], `${name} should be accepted`);
  }
});

test('an unknown linter name is reported as malformed', () => {
  const css = '.a { gap: 3px; /* bds-lint-ignore made-up-gate — reason */ }\n';
  assert.equal(findMalformedWaivers('unknown.css', css).length, 1);
});

test('a known name is not matched as a prefix of a longer word', () => {
  const css = '.a { gap: 3px; /* bds-lint-ignore hardcodedish — reason */ }\n';
  assert.equal(
    findMalformedWaivers('prefix.css', css).length,
    1,
    '`hardcodedish` must not pass as `hardcoded`'
  );
});

test('a correctly-formed waiver still suppresses the literal it names', () => {
  const css = '.a { padding: 5px; /* bds-lint-ignore hardcoded — reason */ }\n';
  assert.deepEqual(findMalformedWaivers('paired.css', css), []);
  assert.deepEqual(findHardcodedViolations('paired.css', css, index), []);
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
