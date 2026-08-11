#!/usr/bin/env node
// Self-test for the visual-change declaration (brikdesigns#856).
//
// This logic decides whether a blocking gate blocks, so the only thing that
// makes it worth having is that it still fires. The cases below are the ways it
// could stop firing — each one is a way the waiver could quietly become an
// allowlist:
//
//   - an undeclared route stops blocking (the regression gate is off)
//   - a stale declaration stops failing (the waiver never gets pruned)
//   - a typo'd route name silently waives nothing while reading as a waiver
//   - a fenced example in a PR body waives a route by being quoted
//
// Plain node:assert, no framework. Run via `npm run test:visual-change`.

import assert from 'node:assert/strict';
import { parseDeclaration, evaluateDeclaration } from './visual-change-declaration.mjs';

const KNOWN = ['home', 'about', 'events-grind-after-graduation'];
let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

const cap = (route, diffPct, theme = 'light', viewport = 'desktop') => ({
  route,
  theme,
  viewport,
  diffPct,
});

console.log('parseDeclaration');

check('reads a single route', () => {
  assert.deepEqual(parseDeclaration('Visual-change: home'), ['home']);
});

check('reads a comma list and trims', () => {
  assert.deepEqual(
    parseDeclaration('blah\nVisual-change:  home ,  about \nmore'),
    ['home', 'about'],
  );
});

check('is case-insensitive on the key', () => {
  assert.deepEqual(parseDeclaration('visual-change: home'), ['home']);
  assert.deepEqual(parseDeclaration('VISUAL-CHANGE: home'), ['home']);
});

check('accumulates across lines and dedupes', () => {
  assert.deepEqual(
    parseDeclaration('Visual-change: home\nVisual-change: about, home'),
    ['home', 'about'],
  );
});

check('ignores a declaration inside a fenced block', () => {
  const body = ['Docs say:', '```', 'Visual-change: home', '```', 'end'].join('\n');
  assert.deepEqual(parseDeclaration(body), []);
});

check('still reads a declaration after a closed fence', () => {
  const body = ['```', 'Visual-change: about', '```', 'Visual-change: home'].join('\n');
  assert.deepEqual(parseDeclaration(body), ['home']);
});

check('empty and missing bodies declare nothing', () => {
  assert.deepEqual(parseDeclaration(''), []);
  assert.deepEqual(parseDeclaration(null), []);
  assert.deepEqual(parseDeclaration(undefined), []);
});

console.log('evaluateDeclaration');

check('an undeclared route over threshold blocks', () => {
  const r = evaluateDeclaration({
    declared: [],
    knownRoutes: KNOWN,
    results: [cap('home', 12), cap('about', 0)],
    threshold: 1,
  });
  assert.equal(r.blocking.length, 1);
  assert.equal(r.blocking[0].route, 'home');
  assert.equal(r.waived.length, 0);
});

check('a declared route over threshold is waived, not blocking', () => {
  const r = evaluateDeclaration({
    declared: ['home'],
    knownRoutes: KNOWN,
    results: [cap('home', 12), cap('about', 0)],
    threshold: 1,
  });
  assert.equal(r.blocking.length, 0);
  assert.equal(r.waived.length, 1);
  assert.equal(r.unmoved.length, 0);
});

check('declaring one route does not waive another', () => {
  const r = evaluateDeclaration({
    declared: ['home'],
    knownRoutes: KNOWN,
    results: [cap('home', 12), cap('about', 9)],
    threshold: 1,
  });
  assert.deepEqual(r.blocking.map((c) => c.route), ['about']);
  assert.deepEqual(r.waived.map((c) => c.route), ['home']);
});

check('a declared route that measured 0.00% everywhere is stale', () => {
  const r = evaluateDeclaration({
    declared: ['about'],
    knownRoutes: KNOWN,
    results: [cap('home', 0), cap('about', 0, 'light'), cap('about', 0, 'dark')],
    threshold: 1,
  });
  assert.deepEqual(r.unmoved, ['about']);
  assert.deepEqual(r.underThreshold, []);
});

// The #880 regression. The first version derived `unmoved` from the
// over-threshold set, so a real change too small to clear the threshold failed
// for being honestly declared. These are PR #877's actual measurements: three
// labels moved from uppercase to Title Case on one route.
check('a declared route that moved but stayed under threshold is NOT stale', () => {
  const r = evaluateDeclaration({
    declared: ['events-grind-after-graduation'],
    knownRoutes: [...KNOWN, 'events-grind-after-graduation'],
    results: [
      cap('events-grind-after-graduation', 0.02, 'light', 'desktop'),
      cap('events-grind-after-graduation', 0.02, 'dark', 'desktop'),
      cap('events-grind-after-graduation', 0.04, 'light', 'tablet'),
      cap('events-grind-after-graduation', 0.04, 'dark', 'tablet'),
      cap('events-grind-after-graduation', 0.05, 'light', 'mobile'),
      cap('events-grind-after-graduation', 0.05, 'dark', 'mobile'),
    ],
    threshold: 1,
  });
  assert.deepEqual(r.unmoved, [], 'a sub-threshold change is still a change');
  assert.deepEqual(r.underThreshold, ['events-grind-after-graduation']);
  assert.equal(r.waived.length, 0, 'nothing was over threshold, so nothing was waived');
  assert.equal(r.blocking.length, 0);
});

check('a route both over and under threshold counts as waived, not under', () => {
  const r = evaluateDeclaration({
    declared: ['home'],
    knownRoutes: KNOWN,
    results: [cap('home', 0.3, 'light'), cap('home', 12, 'dark')],
    threshold: 1,
  });
  assert.deepEqual(r.waived.map((c) => c.theme), ['dark']);
  assert.deepEqual(r.underThreshold, []);
  assert.deepEqual(r.unmoved, []);
});

check('an undeclared sub-threshold move is silent — not reported, not blocking', () => {
  const r = evaluateDeclaration({
    declared: [],
    knownRoutes: KNOWN,
    results: [cap('home', 0.04)],
    threshold: 1,
  });
  assert.deepEqual(r.underThreshold, []);
  assert.equal(r.blocking.length, 0);
  assert.deepEqual(r.unmoved, []);
});

check('a route that moved in only one theme is not stale', () => {
  const r = evaluateDeclaration({
    declared: ['home'],
    knownRoutes: KNOWN,
    results: [cap('home', 0, 'light'), cap('home', 40, 'dark')],
    threshold: 1,
  });
  assert.deepEqual(r.unmoved, []);
  assert.equal(r.waived.length, 1);
});

check('a declared route with no measurement is not stale', () => {
  // A capture that produced no comparison already fails the SELF_MODE guard
  // upstream; it must not ALSO read as a stale declaration.
  const r = evaluateDeclaration({
    declared: ['home'],
    knownRoutes: KNOWN,
    results: [cap('home', null), cap('about', 0)],
    threshold: 1,
  });
  assert.deepEqual(r.unmoved, []);
});

check('an unknown route name is reported and waives nothing', () => {
  const r = evaluateDeclaration({
    declared: ['hom'],
    knownRoutes: KNOWN,
    results: [cap('home', 12)],
    threshold: 1,
  });
  assert.deepEqual(r.unknown, ['hom']);
  assert.deepEqual(r.unmoved, []);
  assert.deepEqual(r.blocking.map((c) => c.route), ['home']);
});

check('a null diff never blocks', () => {
  const r = evaluateDeclaration({
    declared: [],
    knownRoutes: KNOWN,
    results: [cap('home', null)],
    threshold: 1,
  });
  assert.equal(r.blocking.length, 0);
});

check('exactly at the threshold does not block', () => {
  const r = evaluateDeclaration({
    declared: [],
    knownRoutes: KNOWN,
    results: [cap('home', 1)],
    threshold: 1,
  });
  assert.equal(r.blocking.length, 0);
});

console.log(`\n✓ ${passed} assertions passed`);
