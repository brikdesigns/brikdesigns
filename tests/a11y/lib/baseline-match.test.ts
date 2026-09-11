#!/usr/bin/env npx tsx
// Self-test for the a11y baseline matcher (brikdesigns#1361).
//
// This logic decides whether a blocking gate blocks, so the only thing that
// makes it worth having is that it still fires correctly. The cases below are
// the ways it could stop being trustworthy — each one is a way the waiver could
// quietly become an allowlist, or a way an accepted violation could start
// failing the gate for no reason:
//
//   - a re-rooted selector re-fails an already-accepted violation (the #1361 bug)
//   - a different colour pair on a waived route slips through (waiver too wide)
//   - a waiver on route A silently covers route B (route scoping lost)
//   - a light-theme waiver covers the dark theme (theme scoping lost)
//   - a typo'd fingerprint reads as a waiver but matches nothing
//   - baseline.json regains React-generated ids, which cannot be stable
//
// Plain node:assert, no framework. Run via `npm run test:a11y-baseline`.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  compileBaseline,
  contrastFingerprint,
  fingerprintOf,
  isWaived,
  isWellFormedFingerprint,
  normalizeSelector,
  orphanRoutes,
  unmatchedEntries,
  type BaselineFile,
  type Finding,
} from './baseline-match';

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

/** A real axe color-contrast failureSummary, copied from a live run. */
const summary = (fg: string, bg: string) =>
  `Fix any of the following:\n  Element has insufficient color contrast of 3.78 (foreground color: ${fg}, background color: ${bg}, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1`;

const finding = (selector: string, fg = '#ffffff', bg = '#e35335'): Finding => ({
  ruleId: 'color-contrast',
  selector,
  failureSummary: summary(fg, bg),
});

console.log('contrastFingerprint');

check('reads the pair axe names in the summary', () => {
  assert.equal(contrastFingerprint(summary('#ffffff', '#e35335')), '#ffffff on #e35335');
});

check('lower-cases hex so #FFFFFF and #ffffff are one fingerprint', () => {
  assert.equal(contrastFingerprint(summary('#FFFFFF', '#E35335')), '#ffffff on #e35335');
});

check('accepts the 8-digit hex axe emits when alpha is present', () => {
  assert.equal(contrastFingerprint(summary('#ffffffcc', '#e35335')), '#ffffffcc on #e35335');
});

check('returns null when the summary names no pair', () => {
  assert.equal(contrastFingerprint('Element has no alt text'), null);
  assert.equal(contrastFingerprint(''), null);
});

check('returns null for a non-contrast rule even if a pair is quoted', () => {
  assert.equal(
    fingerprintOf({ ruleId: 'image-alt', selector: 'img', failureSummary: summary('#ffffff', '#e35335') }),
    null,
  );
});

console.log('normalizeSelector');

check('strips positional indices on both sides (#40)', () => {
  assert.equal(
    normalizeSelector('.story-card:nth-child(3) > .bds-button:nth-of-type(1)'),
    '.story-card > .bds-button',
  );
});

console.log('isWaived — the #1361 defect');

// AC 1: the real historical churn recorded in baseline.json's own _comment.
// RE-INDEX 2026-08-16 (#938 services-taxonomy): swapping ServiceLineCards for
// HomePlanCards on the customer-stories route gave the plan cards the same
// `.bds-card--outlined.bds-card--padding-md.bds-card--interactive` classes the
// pre-existing story-list "Read Story" cards carry, so axe re-rooted the story-
// card CTA selector. Same button, same 3.78:1 white-on-#e35335, new string —
// and the old matcher read it as a new violation.
const CHURNED_BEFORE = '.bds-card--link.story-card.bds-card > .bds-card-footer > .bds-button--md';
const CHURNED_AFTER =
  '.bds-card--outlined.bds-card--padding-md.bds-card--interactive:nth-child(2) > .bds-card-footer > .bds-button--md';

const fingerprintBaseline = compileBaseline({
  fingerprints: { '/results': { 'color-contrast': ['#ffffff on #e35335'] } },
  fingerprintsDark: { '/how-we-work': { 'color-contrast': ['#27ae60 on #bef4d4'] } },
});

check('#938 re-root: old and new selectors resolve to the same waiver', () => {
  assert.equal(isWaived(fingerprintBaseline, 'light', '/results', finding(CHURNED_BEFORE)), true);
  assert.equal(isWaived(fingerprintBaseline, 'light', '/results', finding(CHURNED_AFTER)), true);
});

check('a React-generated id is waived like any other selector', () => {
  assert.equal(
    isWaived(fingerprintBaseline, 'light', '/results', finding('#_R_2alt9flb_-tab-dental')),
    true,
  );
});

check('#938 re-root: the old key really was unstable, indices stripped and all', () => {
  // Why the fingerprint is needed at all. Index-stripping (#40) was the right
  // instinct applied to one symptom; it does not survive a class-set change.
  assert.notEqual(normalizeSelector(CHURNED_BEFORE), normalizeSelector(CHURNED_AFTER));
  assert.equal(fingerprintOf(finding(CHURNED_BEFORE)), fingerprintOf(finding(CHURNED_AFTER)));
});

console.log('isWaived — the waiver stays narrow');

check('a different colour pair on a waived route still fails', () => {
  assert.equal(
    isWaived(fingerprintBaseline, 'light', '/results', finding('.x', '#767676', '#ffffff')),
    false,
  );
});

check('a waived pair on an unwaived route still fails', () => {
  assert.equal(isWaived(fingerprintBaseline, 'light', '/terms', finding('.x')), false);
});

check('a light waiver does not cover the dark theme', () => {
  assert.equal(isWaived(fingerprintBaseline, 'dark', '/results', finding('.x')), false);
});

check('a dark waiver does not cover the light theme', () => {
  const green = finding('.bds-badge', '#27ae60', '#bef4d4');
  assert.equal(isWaived(fingerprintBaseline, 'dark', '/how-we-work', green), true);
  assert.equal(isWaived(fingerprintBaseline, 'light', '/how-we-work', green), false);
});

check('a different rule on a waived route still fails', () => {
  const other: Finding = { ruleId: 'link-name', selector: '.x', failureSummary: 'Element has no title' };
  assert.equal(isWaived(fingerprintBaseline, 'light', '/results', other), false);
});

console.log('isWaived — the colourless escape hatch');

check('a rule with no fingerprint still matches by selector', () => {
  const compiled = compileBaseline({ routes: { '/terms': { 'link-name': ['.footer > a:nth-child(2)'] } } });
  const link: Finding = { ruleId: 'link-name', selector: '.footer > a', failureSummary: 'Element has no title' };
  assert.equal(isWaived(compiled, 'light', '/terms', link), true);
});

check('a contrast finding never falls back to the selector path', () => {
  // Otherwise the unstable key comes back through the escape hatch.
  const compiled = compileBaseline({ routes: { '/results': { 'color-contrast': [CHURNED_BEFORE] } } });
  assert.equal(isWaived(compiled, 'light', '/results', finding(CHURNED_BEFORE)), false);
});

console.log('the real baseline.json');

const BASELINE_PATH = path.join(process.cwd(), 'tests/a11y/baseline.json');
const real: BaselineFile = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));

const allFingerprints = (['fingerprints', 'fingerprintsDark'] as const).flatMap((key) =>
  Object.entries(real[key] ?? {}).flatMap(([route, rules]) =>
    Object.entries(rules).flatMap(([ruleId, values]) =>
      values.map((value) => ({ key, route, ruleId, value })),
    ),
  ),
);

check('every fingerprint is well-formed — a typo waives nothing while reading as a waiver', () => {
  assert.notEqual(allFingerprints.length, 0, 'baseline.json carries no fingerprints at all');
  for (const { key, route, ruleId, value } of allFingerprints) {
    assert.ok(
      isWellFormedFingerprint(value),
      `${key}.${route}.${ruleId}: "${value}" is not "<#fg> on <#bg>"`,
    );
  }
});

check('every fingerprint rule is one that produces a fingerprint', () => {
  for (const { key, route, ruleId } of allFingerprints) {
    assert.equal(ruleId, 'color-contrast', `${key}.${route}: "${ruleId}" emits no colour pair`);
  }
});

// AC 2. React generates ids like `#_R_2alt9flb_-tab-dental`, which change
// between renders — a baseline entry keyed on one is unstable by construction.
check('no selector entry carries a React-generated id (AC 2)', () => {
  const selectors = (['routes', 'routesDark'] as const).flatMap((key) =>
    Object.entries(real[key] ?? {}).flatMap(([route, rules]) =>
      Object.entries(rules).flatMap(([ruleId, values]) => values.map((v) => `${key}.${route}.${ruleId}: ${v}`)),
    ),
  );
  const generated = selectors.filter((s) => /#_R_/.test(s));
  assert.deepEqual(generated, [], `React-generated ids are not stable keys:\n${generated.join('\n')}`);
});

// AC 3. The 13,090-character changelog moved to tests/a11y/README.md; this
// keeps it from growing back inside a JSON string value.
check('no narrative changelog lives in a JSON string value (AC 3)', () => {
  const raw = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')) as Record<string, unknown>;
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== 'string') continue;
    assert.ok(
      value.length <= 400,
      `${key} is ${value.length} chars — the burn-down narrative belongs in tests/a11y/README.md`,
    );
  }
});

// ── The reverse ratchet (#1447) ─────────────────────────────────────────────
//
// `isWaived` is tested above for every way it could waive too much or too
// little. These test the other direction — an entry that waives nothing — which
// nothing asked until #1442 took out six colour-pair keys in the sibling list in
// one BDS bump.

console.log('\nunmatchedEntries');

const waivedBaseline: BaselineFile = {
  fingerprints: { '/': { 'color-contrast': ['#ffffff on #e35335'] } },
  fingerprintsDark: { '/': { 'color-contrast': ['#ffffff on #e35335'] } },
};

check('is silent when the entry matches a live finding', () => {
  const compiled = compileBaseline(waivedBaseline);
  assert.deepEqual(unmatchedEntries(compiled, 'light', '/', [finding('.a')]), []);
});

check('reports the entry when the pair moved under it (the #1442 shape)', () => {
  const compiled = compileBaseline(waivedBaseline);
  // Same element, same rule — a re-pointed token, so a DIFFERENT background.
  const moved = unmatchedEntries(compiled, 'light', '/', [
    finding('.a', '#ffffff', '#dad0f2'),
  ]);
  assert.equal(moved.length, 1);
  assert.equal(moved[0].value, '#ffffff on #e35335');
  assert.equal(moved[0].scope, 'fingerprint');
  assert.equal(moved[0].routePath, '/');
});

check('reports the entry when the debt was paid and the finding is gone', () => {
  const compiled = compileBaseline(waivedBaseline);
  const gone = unmatchedEntries(compiled, 'light', '/', []);
  assert.equal(gone.length, 1, 'an empty finding set leaves every entry unmatched');
});

check('stays route-scoped — a live finding on / does not keep /about alive', () => {
  const compiled = compileBaseline({
    fingerprints: {
      '/': { 'color-contrast': ['#ffffff on #e35335'] },
      '/about': { 'color-contrast': ['#ffffff on #e35335'] },
    },
  });
  assert.deepEqual(unmatchedEntries(compiled, 'light', '/', [finding('.a')]), []);
  assert.equal(unmatchedEntries(compiled, 'light', '/about', []).length, 1);
});

check('stays theme-scoped — a light match does not keep the dark entry alive', () => {
  const compiled = compileBaseline(waivedBaseline);
  assert.deepEqual(unmatchedEntries(compiled, 'light', '/', [finding('.a')]), []);
  assert.equal(unmatchedEntries(compiled, 'dark', '/', []).length, 1);
});

// The precedence in `isWaived` is fingerprint-first: a finding that HAS a
// colour pair is never matched by the selector half. If these two disagreed, an
// entry could read live here and waive nothing there — a green gate over a dead
// waiver, which is the whole defect class inverted.
check('agrees with isWaived on precedence — a contrast finding never feeds the selector half', () => {
  const compiled = compileBaseline({
    routes: { '/': { 'color-contrast': ['.a'] } },
  });
  const f = finding('.a');
  assert.equal(isWaived(compiled, 'light', '/', f), false, 'guards the premise');
  assert.equal(unmatchedEntries(compiled, 'light', '/', [f]).length, 1);
});

check('matches a colourless finding through the selector half', () => {
  const compiled = compileBaseline({ routes: { '/': { 'link-name': ['.a'] } } });
  const colourless: Finding = { ruleId: 'link-name', selector: '.a', failureSummary: '' };
  assert.equal(isWaived(compiled, 'light', '/', colourless), true, 'guards the premise');
  assert.deepEqual(unmatchedEntries(compiled, 'light', '/', [colourless]), []);
});

check('collapses axe positional indices the same way isWaived does', () => {
  const compiled = compileBaseline({ routes: { '/': { 'link-name': ['.a .b'] } } });
  const nth: Finding = { ruleId: 'link-name', selector: '.a:nth-child(3) .b', failureSummary: '' };
  assert.deepEqual(unmatchedEntries(compiled, 'light', '/', [nth]), []);
});

console.log('\norphanRoutes');

check('reports a baseline route the suite never visits', () => {
  // #1406 verbatim: /customers/dental became /industries/dental.
  const orphans = orphanRoutes(
    { fingerprints: { '/customers/dental': { 'color-contrast': ['#ffffff on #e35335'] } } },
    ['/', '/industries/dental'],
  );
  assert.deepEqual(orphans, ['fingerprints./customers/dental']);
});

check('is silent when every baseline route is audited', () => {
  assert.deepEqual(orphanRoutes(waivedBaseline, ['/', '/about']), []);
});

check('reads the dark and selector halves too, not only fingerprints', () => {
  const orphans = orphanRoutes(
    {
      fingerprintsDark: { '/gone': { 'color-contrast': ['#ffffff on #e35335'] } },
      routesDark: { '/also-gone': { 'link-name': ['.a'] } },
    },
    ['/'],
  );
  assert.deepEqual(orphans, ['fingerprintsDark./gone', 'routesDark./also-gone']);
});

// Over the REAL file, not a fixture — the same standard the well-formedness and
// React-id checks above already hold it to. A route-level orphan needs no
// browser to detect, so there is no reason to wait for the Playwright run.
check('the real baseline.json has no orphan route (checked against the audited set)', () => {
  const audited = [
    ...new Set([
      ...Object.keys(real.fingerprints ?? {}),
      ...Object.keys(real.fingerprintsDark ?? {}),
      ...Object.keys(real.routes ?? {}),
      ...Object.keys(real.routesDark ?? {}),
    ]),
  ];
  // Self-referential by construction, so it only proves the function runs over
  // the real shape. The authoritative check is the Playwright test in
  // public-routes.spec.ts, which holds it against PUBLIC_ROUTES — the list
  // cannot be imported here without loading @playwright/test.
  assert.deepEqual(orphanRoutes(real, audited), []);
});

console.log(`\n${passed} checks passed.`);
