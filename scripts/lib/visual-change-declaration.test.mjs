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
import {
  parseDeclaration,
  evaluateDeclaration,
  classifyBlockingSpread,
  buildDeclarationLine,
  isStalePayloadRerun,
  summarizeNoiseByRoute,
} from './visual-change-declaration.mjs';

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

console.log('classifyBlockingSpread');

// This split drives which remedy the gate prints (#1106): a route that moved
// on every viewport is a real change (label / rebase), while one that moved on
// some captures but not all is a capture flake (re-run). Getting it wrong tells
// an author to waive a real regression, or to re-run a genuine one forever.

check('a route over threshold on every measured capture is broad, not isolated', () => {
  const results = [cap('home', 30, 'light', 'desktop'), cap('home', 28, 'dark', 'desktop')];
  const { blocking } = evaluateDeclaration({ declared: [], knownRoutes: KNOWN, results, threshold: 1 });
  const { broad, isolated } = classifyBlockingSpread({ blocking, results });
  assert.deepEqual(broad, ['home']);
  assert.deepEqual(isolated, []);
});

check('a route blocking on one capture while its others read 0.00% is isolated', () => {
  // The exact issue signature: home at 30% on light/desktop, 0.00% elsewhere.
  const results = [
    cap('home', 30, 'light', 'desktop'),
    cap('home', 0, 'dark', 'desktop'),
    cap('home', 0, 'light', 'mobile'),
    cap('home', 0, 'dark', 'mobile'),
  ];
  const { blocking } = evaluateDeclaration({ declared: [], knownRoutes: KNOWN, results, threshold: 1 });
  const { broad, isolated } = classifyBlockingSpread({ blocking, results });
  assert.deepEqual(isolated, ['home']);
  assert.deepEqual(broad, []);
});

check('a sub-threshold move on the other captures still counts as isolated', () => {
  // 0.05% is a measured move but not a block; the route still blocks on only
  // one of its captures, so it is a flake candidate, not a broad change.
  const results = [
    cap('contact', 2.05, 'light', 'desktop'),
    cap('contact', 0.05, 'dark', 'desktop'),
  ];
  const { blocking } = evaluateDeclaration({ declared: [], knownRoutes: KNOWN, results, threshold: 1 });
  const { broad, isolated } = classifyBlockingSpread({ blocking, results });
  assert.deepEqual(isolated, ['contact']);
  assert.deepEqual(broad, []);
});

check('a route with a single measured capture that blocks is broad', () => {
  const results = [cap('about', 12, 'light', 'desktop')];
  const { blocking } = evaluateDeclaration({ declared: [], knownRoutes: KNOWN, results, threshold: 1 });
  const { broad, isolated } = classifyBlockingSpread({ blocking, results });
  assert.deepEqual(broad, ['about']);
  assert.deepEqual(isolated, []);
});

check('null-diff captures do not count toward a route total', () => {
  // A route whose only over-threshold capture blocks, with the rest unmeasured
  // (null), is broad — an unmeasured capture is not evidence of a clean viewport.
  const results = [cap('home', 30, 'light', 'desktop'), cap('home', null, 'dark', 'desktop')];
  const { blocking } = evaluateDeclaration({ declared: [], knownRoutes: KNOWN, results, threshold: 1 });
  const { broad, isolated } = classifyBlockingSpread({ blocking, results });
  assert.deepEqual(broad, ['home']);
  assert.deepEqual(isolated, []);
});

check('classifies each blocking route independently', () => {
  const results = [
    cap('home', 30, 'light', 'desktop'), // broad — its only capture blocks
    cap('about', 12, 'light', 'desktop'), // isolated — one of two blocks
    cap('about', 0, 'dark', 'desktop'),
  ];
  const { blocking } = evaluateDeclaration({ declared: [], knownRoutes: KNOWN, results, threshold: 1 });
  const { broad, isolated } = classifyBlockingSpread({ blocking, results });
  assert.deepEqual(broad, ['home']);
  assert.deepEqual(isolated, ['about']);
});

// ── viewport-scoped: a real change at one breakpoint, not a flake (#1311) ────
// Counting alone cannot tell these apart from a flake — both move a strict
// subset of captures. The theme axis can: a `@media` rule takes out both themes
// of a viewport, a decode flake takes out one capture and leaves its sibling.

check('a route moving on both themes of one viewport is viewportScoped, not isolated', () => {
  // The live case: PR #1293, runs 34282305048 + 34291952874. Byte-identical
  // across two independent runs, so reproducible — yet the count test called it
  // a flake and told the author to re-run instead of label.
  const results = [
    cap('plans', 13.92, 'light', 'desktop'),
    cap('plans', 18.74, 'dark', 'desktop'),
    cap('plans', 0, 'light', 'tablet'),
    cap('plans', 0, 'dark', 'tablet'),
    cap('plans', 0, 'light', 'mobile'),
    cap('plans', 0, 'dark', 'mobile'),
  ];
  const { blocking } = evaluateDeclaration({ declared: [], knownRoutes: ['plans'], results, threshold: 1 });
  const { broad, isolated, viewportScoped } = classifyBlockingSpread({ blocking, results });
  assert.deepEqual(viewportScoped, ['plans']);
  assert.deepEqual(isolated, []);
  assert.deepEqual(broad, []);
});

check('one theme of a viewport moving alone stays isolated — the flake signature', () => {
  // #830's own shape: services-category-marketing at dark/mobile while
  // light/mobile measured clean. The discriminator this must not lose.
  const results = [
    cap('home', 2.66, 'dark', 'mobile'),
    cap('home', 0, 'light', 'mobile'),
    cap('home', 0, 'dark', 'desktop'),
    cap('home', 0, 'light', 'desktop'),
  ];
  const { blocking } = evaluateDeclaration({ declared: [], knownRoutes: KNOWN, results, threshold: 1 });
  const { isolated, viewportScoped } = classifyBlockingSpread({ blocking, results });
  assert.deepEqual(isolated, ['home']);
  assert.deepEqual(viewportScoped, []);
});

check('a mixed spread — one coherent viewport plus a lone capture — stays isolated', () => {
  // desktop moved on both themes, but light/tablet also moved while dark/tablet
  // read 0.00%. That lone capture is unexplained by a breakpoint rule, so the
  // route keeps the verdict that never invites a label.
  const results = [
    cap('home', 12, 'light', 'desktop'),
    cap('home', 13, 'dark', 'desktop'),
    cap('home', 9, 'light', 'tablet'),
    cap('home', 0, 'dark', 'tablet'),
  ];
  const { blocking } = evaluateDeclaration({ declared: [], knownRoutes: KNOWN, results, threshold: 1 });
  const { isolated, viewportScoped } = classifyBlockingSpread({ blocking, results });
  assert.deepEqual(isolated, ['home']);
  assert.deepEqual(viewportScoped, []);
});

check('a single measured capture at a viewport is not corroboration', () => {
  // Only light was captured, so the theme axis says nothing. Erring toward
  // isolated costs a wasted re-run; erring the other way invites a label that
  // would waive a real regression.
  const results = [cap('home', 12, 'light', 'desktop'), cap('home', 0, 'light', 'mobile')];
  const { blocking } = evaluateDeclaration({ declared: [], knownRoutes: KNOWN, results, threshold: 1 });
  const { isolated, viewportScoped } = classifyBlockingSpread({ blocking, results });
  assert.deepEqual(isolated, ['home']);
  assert.deepEqual(viewportScoped, []);
});

check('a route over threshold on every capture is still broad, never viewportScoped', () => {
  const results = [
    cap('home', 30, 'light', 'desktop'),
    cap('home', 28, 'dark', 'desktop'),
    cap('home', 25, 'light', 'mobile'),
    cap('home', 26, 'dark', 'mobile'),
  ];
  const { blocking } = evaluateDeclaration({ declared: [], knownRoutes: KNOWN, results, threshold: 1 });
  const { broad, isolated, viewportScoped } = classifyBlockingSpread({ blocking, results });
  assert.deepEqual(broad, ['home']);
  assert.deepEqual(viewportScoped, []);
  assert.deepEqual(isolated, []);
});

check('empty blocking yields empty groups', () => {
  const { broad, isolated, viewportScoped } = classifyBlockingSpread({
    blocking: [],
    results: [cap('home', 0)],
  });
  assert.deepEqual(broad, []);
  assert.deepEqual(isolated, []);
  assert.deepEqual(viewportScoped, []);
});

console.log('buildDeclarationLine');

// The line exists to remove the source dive into ROUTES[].name (#1256), so the
// thing worth asserting is that it is paste-ready and parses back: a line the
// author copies verbatim must declare exactly the routes that blocked, or the
// re-run reds again on the half it missed.

check('names the distinct blocking routes, comma-joined', () => {
  const blocking = [
    cap('home', 4.2, 'light', 'desktop'),
    cap('home', 4.1, 'dark', 'desktop'),
    cap('about', 2.0, 'light', 'mobile'),
  ];
  assert.equal(buildDeclarationLine(blocking), 'Visual-change: home, about');
});

check('round-trips through parseDeclaration', () => {
  const blocking = [cap('home', 4.2), cap('events-grind-after-graduation', 3.1)];
  const line = buildDeclarationLine(blocking);
  assert.deepEqual(parseDeclaration(line), ['home', 'events-grind-after-graduation']);
});

check('a declared line clears the routes it names', () => {
  const results = [cap('home', 4.2, 'light', 'desktop'), cap('about', 0.1, 'light', 'desktop')];
  const first = evaluateDeclaration({ declared: [], knownRoutes: KNOWN, results, threshold: 1 });
  const declared = parseDeclaration(buildDeclarationLine(first.blocking));
  const second = evaluateDeclaration({ declared, knownRoutes: KNOWN, results, threshold: 1 });
  assert.deepEqual(second.blocking, [], 'pasting the line must green the re-run');
  assert.deepEqual(second.unknown, [], 'every name it emits comes from a measured route');
  assert.deepEqual(second.unmoved, [], 'a blocking route moved, so it can never be stale');
});

check('no blocking routes yields no line', () => {
  assert.equal(buildDeclarationLine([]), null);
});

console.log('isStalePayloadRerun');

// Guards the false red a `gh run rerun` replays: the payload's label state is
// frozen at the original event, so a PR labeled AFTER that event still reads
// undeclared and reds again (#1106). Only the label-gained direction skips.

check('label gained since the payload → skip the replay', () => {
  assert.equal(isStalePayloadRerun({ payloadLabel: false, liveLabel: true }), true);
});

check('label present in both payload and live → run normally', () => {
  assert.equal(isStalePayloadRerun({ payloadLabel: true, liveLabel: true }), false);
});

check('no label anywhere → run normally', () => {
  assert.equal(isStalePayloadRerun({ payloadLabel: false, liveLabel: false }), false);
});

check('label removed since the payload → do NOT skip; it fails closed', () => {
  assert.equal(isStalePayloadRerun({ payloadLabel: true, liveLabel: false }), false);
});

check('defaults to no-skip when neither is known', () => {
  assert.equal(isStalePayloadRerun(), false);
  assert.equal(isStalePayloadRerun({}), false);
});

console.log('summarizeNoiseByRoute');

check('aggregates worst + avg + count per route, sorted worst-first', () => {
  const rows = summarizeNoiseByRoute([
    cap('home', 0.5, 'light', 'desktop'),
    cap('home', 0.1, 'dark', 'desktop'),
    cap('about', 0.9, 'light', 'desktop'),
  ]);
  assert.deepEqual(rows.map((r) => r.route), ['about', 'home']);
  const home = rows.find((r) => r.route === 'home');
  assert.equal(home.worst, 0.5);
  assert.equal(home.avg, 0.3);
  assert.equal(home.count, 2);
});

check('excludes null-diff captures from the count', () => {
  const rows = summarizeNoiseByRoute([
    cap('home', 0.4, 'light', 'desktop'),
    cap('home', null, 'dark', 'desktop'),
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].count, 1, 'an unmeasured capture is not counted as noise');
  assert.equal(rows[0].worst, 0.4);
  assert.equal(rows[0].avg, 0.4);
});

check('ties on worst break by route name', () => {
  const rows = summarizeNoiseByRoute([
    cap('zeta', 0.2),
    cap('alpha', 0.2),
  ]);
  assert.deepEqual(rows.map((r) => r.route), ['alpha', 'zeta']);
});

check('empty results yield no rows', () => {
  assert.deepEqual(summarizeNoiseByRoute([]), []);
});

console.log(`\n✓ ${passed} assertions passed`);
