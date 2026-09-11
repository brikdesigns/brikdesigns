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
  blockingSignature,
  formatSignature,
  parseSignature,
  compareAttemptSignatures,
  decideEffectiveBlocking,
  isStalePayloadRerun,
  isTruncatedCapture,
  isPartialCapture,
  isViewportHeightRender,
  classifyCaptureHeights,
  isUsableCapture,
  countUsableCaptures,
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

console.log('isTruncatedCapture');

// The compare step pads the shorter capture with white and diffs it, which is
// right for a real height delta and wrong for a capture that never finished.
// These two cases are the boundary between those readings — get it wrong in one
// direction and a truncation reports as a regression (#1314), in the other and
// #830's 24px page-shift measurement stops working.

check('a viewport-height capture against a full-page reference is truncated', () => {
  // The live case: PR #1312, run 34396746728, home [light/desktop].
  assert.equal(isTruncatedCapture(12722, 800), true);
});

check('truncation is symmetric — either side may be the short one', () => {
  assert.equal(isTruncatedCapture(800, 12722), true);
});

check('the 24px page-shift case is NOT truncation — it must keep diffing', () => {
  // #830's #861 comment: 9000 vs 8976 measured 15.83% and that reading is the
  // finding, not a bug. Erroring here would delete the evidence.
  assert.equal(isTruncatedCapture(9000, 8976), false);
});

check('identical heights are not truncation', () => {
  assert.equal(isTruncatedCapture(12722, 12722), false);
});

check('exactly half is not truncation — the boundary is strict', () => {
  assert.equal(isTruncatedCapture(1000, 500), false);
  assert.equal(isTruncatedCapture(1000, 499), true);
});

check('a large but plausible layout delta stays a diff', () => {
  // A third of the page appearing is a real change to measure, not a failure.
  assert.equal(isTruncatedCapture(9000, 6000), false);
});

check('a non-positive height is not truncation — the existence check owns that', () => {
  // wfOk/nlOk already fail a missing capture; a zero here must not double-report
  // it as truncation with a nonsense ratio.
  assert.equal(isTruncatedCapture(12722, 0), false);
  assert.equal(isTruncatedCapture(0, 0), false);
});

check('the ratio is overridable', () => {
  assert.equal(isTruncatedCapture(1000, 900, 0.95), true);
  assert.equal(isTruncatedCapture(1000, 900, 0.5), false);
});

check('a truncated capture cannot reach blocking — diffPct is null', () => {
  // The chain that matters: diffScreenshots returns no diffPct for a truncation,
  // and evaluateDeclaration filters on `diffPct !== null`, so the gate can never
  // offer a `Visual-change:` line that would waive an uncaptured route.
  const results = [cap('home', null, 'light', 'desktop'), cap('home', 0, 'dark', 'desktop')];
  const { blocking, waived, unmoved } = evaluateDeclaration({
    declared: [],
    knownRoutes: KNOWN,
    results,
    threshold: 1,
  });
  assert.deepEqual(blocking, []);
  assert.deepEqual(waived, []);
  assert.deepEqual(unmoved, []);
  assert.equal(buildDeclarationLine(blocking), null);
});

console.log('isPartialCapture — the PNG against the DOM that produced it (#1358)');

// Nothing compared the screenshot to the DOM before this, so the only signal a
// capture had gone wrong was a height mismatch between the two SIDES — which
// cannot tell a short capture of a tall page from a faithful capture of a short
// page. Every occurrence on record turned out to be the latter.

check('a PNG far shorter than the document is partial', () => {
  assert.equal(isPartialCapture(1024, 8485), true);
});

check('a PNG matching the document is NOT partial — the error-boundary case', () => {
  // The run-34486548222 capture: 768x1024 of a document that really was 1024px.
  assert.equal(isPartialCapture(1024, 1024), false);
});

check('sub-pixel rounding is absorbed — fullPage rounds to whole device pixels', () => {
  assert.equal(isPartialCapture(8484, 8485), false);
  assert.equal(isPartialCapture(8477, 8485), false);
  assert.equal(isPartialCapture(8476, 8485), true);
});

check('a PNG TALLER than the document is not partial', () => {
  // Rounding can go the other way; only a shortfall is a failure.
  assert.equal(isPartialCapture(8486, 8485), false);
});

check('a non-positive height is not partial — handled by the existence check', () => {
  assert.equal(isPartialCapture(0, 8485), false);
  assert.equal(isPartialCapture(1024, 0), false);
});

console.log('isViewportHeightRender / classifyCaptureHeights (#1358)');

const VIEWPORTS = { desktop: 800, tablet: 1024, mobile: 812 };

check('all three recorded occurrences classify as app-error, not truncation', () => {
  // Every one landed on EXACTLY its raw viewport height. A partial capture
  // lands on an arbitrary height; three-for-three on the viewport is the page.
  const recorded = [
    { name: 'home [light/desktop] (#830)', short: 800, tall: 12722, vp: VIEWPORTS.desktop },
    { name: 'industry-dental [dark/tablet] (#1358)', short: 1024, tall: 8485, vp: VIEWPORTS.tablet },
    { name: 'fma [dark/mobile] (#1317)', short: 812, tall: 2741, vp: VIEWPORTS.mobile },
  ];
  for (const { name, short, tall, vp } of recorded) {
    assert.equal(
      isViewportHeightRender(short, vp, tall), true,
      `${name} should read as a viewport-height render`,
    );
    assert.equal(
      classifyCaptureHeights({ referenceHeight: short, buildHeight: tall, viewportHeight: vp }).kind,
      'app-error',
      `${name} must not be called truncated`,
    );
  }
});

check('a genuinely partial capture is still classified truncated', () => {
  // Short, but nowhere near the viewport height — the pre-#1358 catch-all has
  // to keep firing, or an unrecognised shape diffs against white padding.
  const verdict = classifyCaptureHeights({
    referenceHeight: 3200, buildHeight: 12722, viewportHeight: VIEWPORTS.desktop,
  });
  assert.equal(verdict.kind, 'truncated');
});

check('a legitimately short page is called NEITHER', () => {
  // Both sides about one viewport tall: a real short route, not a failure.
  assert.equal(isViewportHeightRender(800, VIEWPORTS.desktop, 812), false);
  assert.equal(
    classifyCaptureHeights({
      referenceHeight: 800, buildHeight: 812, viewportHeight: VIEWPORTS.desktop,
    }),
    null,
  );
});

check('a real height delta is still a diff, not a failure', () => {
  // #830/#861 traced a 15.83% red to a 24px page shift by padding and diffing.
  // That measurement has to keep working.
  assert.equal(
    classifyCaptureHeights({
      referenceHeight: 12722, buildHeight: 12698, viewportHeight: VIEWPORTS.desktop,
    }),
    null,
  );
});

check('the short side is named, so the summary can say which deployment errored', () => {
  const refShort = classifyCaptureHeights({
    referenceHeight: 1024, buildHeight: 8485, viewportHeight: VIEWPORTS.tablet,
  });
  assert.equal(refShort.side, 'reference');
  const buildShort = classifyCaptureHeights({
    referenceHeight: 8485, buildHeight: 1024, viewportHeight: VIEWPORTS.tablet,
  });
  assert.equal(buildShort.side, 'build');
  assert.equal(buildShort.kind, 'app-error');
});

check('an unknown viewport height degrades to truncated, never to a pass', () => {
  // A caller that forgets to pass the viewport must not silently lose the gate.
  const verdict = classifyCaptureHeights({ referenceHeight: 1024, buildHeight: 8485 });
  assert.equal(verdict.kind, 'truncated');
});

console.log('isUsableCapture / countUsableCaptures');

// The summary's headline number. It counted FILES, so a truncated capture —
// which since #1314 writes its file and then fails the run — read as complete:
// run 34402425891 attempt 1 printed `✓ 84/84 captures complete` two lines under
// `✗ 1 capture(s) failed` (#1317). The cases below are the ways that could come
// back, and the last one is the point: every capture-failure class has to be
// decided here rather than at the call site.

const capture = (over = {}) => ({ nlOk: true, wfOk: true, truncated: false, appError: false, ...over });

check('a capture with both sides and no truncation is usable', () => {
  assert.equal(isUsableCapture(capture()), true);
});

check('a truncated capture is NOT usable — the #1317 regression', () => {
  assert.equal(isUsableCapture(capture({ truncated: true })), false);
});

check('a missing capture side is not usable', () => {
  assert.equal(isUsableCapture(capture({ nlOk: false })), false);
  assert.equal(isUsableCapture(capture({ wfOk: false })), false);
});

check('UPDATE_BASELINES waives the reference side, never truncation', () => {
  const authoring = { updateBaselines: true };
  assert.equal(isUsableCapture(capture({ wfOk: false }), authoring), true);
  assert.equal(isUsableCapture(capture({ wfOk: false, nlOk: false }), authoring), false);
  // Authoring a baseline from a half-captured page is the worst case of all:
  // it bakes the truncation into the reference every later run compares to.
  assert.equal(isUsableCapture(capture({ wfOk: false, truncated: true }), authoring), false);
});

check('the counter reproduces the run this issue was filed from', () => {
  // 84 captures, one of them truncated (`fma [dark/mobile]`, 2741px vs 812px).
  const results = Array.from({ length: 84 }, (_, i) => capture({ truncated: i === 41 }));
  assert.equal(countUsableCaptures(results), 83, 'the truncated capture must not count');
});

check('a clean run still counts every capture — no under-reporting', () => {
  const results = Array.from({ length: 84 }, () => capture());
  assert.equal(countUsableCaptures(results), 84);
});

check('an absent field is not a pass — defaults refuse rather than assume', () => {
  assert.equal(isUsableCapture({}), false);
  assert.equal(countUsableCaptures([]), 0);
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

console.log('blockingSignature / formatSignature / parseSignature');

check('signature is the sorted set of route|theme|viewport keys', () => {
  assert.deepEqual(
    blockingSignature([
      cap('blog', 5, 'dark', 'mobile'),
      cap('blog', 5, 'dark', 'tablet'),
      cap('home', 5, 'light', 'desktop'),
    ]),
    ['blog|dark|mobile', 'blog|dark|tablet', 'home|light|desktop'],
  );
});

check('signature dedupes identical keys', () => {
  assert.deepEqual(
    blockingSignature([cap('home', 5), cap('home', 9)]),
    ['home|light|desktop'],
  );
});

check('format then parse round-trips a set', () => {
  const sig = ['blog|dark|mobile', 'home|light|desktop'];
  assert.equal(formatSignature(sig), 'blog|dark|mobile;home|light|desktop');
  assert.deepEqual(parseSignature(formatSignature(sig)), sig);
});

check('an empty set formats to (none) and parses back to []', () => {
  assert.equal(formatSignature([]), '(none)');
  assert.deepEqual(parseSignature('(none)'), []);
});

check('a blank/absent value parses to null, distinct from the empty set', () => {
  assert.equal(parseSignature(''), null, 'no prior attempt to read');
  assert.equal(parseSignature('   '), null);
  assert.equal(parseSignature(undefined), null);
  assert.equal(parseSignature(null), null);
  assert.deepEqual(parseSignature('(none)'), [], 'prior attempt blocked nothing');
});

console.log('compareAttemptSignatures');

check('identical sets → same verdict, whole set deterministic, no flapping', () => {
  const sig = ['plans|dark|desktop', 'plans|light|desktop'];
  const r = compareAttemptSignatures(sig, sig);
  assert.equal(r.verdict, 'same');
  assert.deepEqual(r.deterministic.sort(), sig);
  assert.deepEqual(r.flapping, []);
});

check('the #1330 repro — zero overlap → different, nothing deterministic', () => {
  // attempt 1 blocked one light capture; attempt 2 blocked seven dark ones.
  const prior = ['blog|light|tablet'];
  const current = [
    'blog|dark|mobile',
    'blog|dark|tablet',
    'blog|dark|desktop',
    'services|dark|mobile',
    'services|dark|tablet',
    'home|dark|tablet',
    'home|dark|mobile',
  ];
  const r = compareAttemptSignatures(prior, current);
  assert.equal(r.verdict, 'different');
  assert.deepEqual(r.deterministic, [], 'no capture blocked in both attempts');
  assert.equal(r.flapping.length, 8, 'all eight are capture-side and cleared');
});

check('a real regression sharing a head SHA with a flake keeps its deterministic captures', () => {
  // `plans` blocks on both attempts (real); `blog` flakes on only one.
  const prior = ['plans|dark|desktop', 'plans|light|desktop', 'blog|light|tablet'];
  const current = ['plans|dark|desktop', 'plans|light|desktop', 'home|dark|mobile'];
  const r = compareAttemptSignatures(prior, current);
  assert.equal(r.verdict, 'different');
  assert.deepEqual(
    r.deterministic.sort(),
    ['plans|dark|desktop', 'plans|light|desktop'],
    'the reproduced regression is NOT cleared by the coincident flake',
  );
  assert.deepEqual(r.flapping, ['blog|light|tablet', 'home|dark|mobile'].sort());
});

check('a flake that appears only on the later attempt is cleared', () => {
  // attempt 1 clean, attempt 2 blocked — the build is deterministically clean,
  // so attempt 2's blocks are capture-side.
  const r = compareAttemptSignatures([], ['blog|dark|mobile']);
  assert.equal(r.verdict, 'different');
  assert.deepEqual(r.deterministic, []);
  assert.deepEqual(r.flapping, ['blog|dark|mobile']);
});

console.log('decideEffectiveBlocking (the set that exits the process)');

const routeKeys = (list) => list.map((r) => `${r.route}|${r.theme}|${r.viewport}`).sort();

check('attempt 1 → no comparison, the whole set gates', () => {
  const blocking = [cap('blog', 5, 'dark', 'mobile'), cap('home', 9, 'light', 'desktop')];
  const d = decideEffectiveBlocking({ blocking, runAttempt: 1, priorSignatureRaw: '' });
  assert.equal(d.crossAttempt, null);
  assert.equal(d.effectiveBlocking.length, 2, 'nothing narrows a first attempt');
});

check('attempt 2 with no recoverable prior signature fails CLOSED', () => {
  const blocking = [cap('blog', 5, 'dark', 'mobile')];
  // A lookup miss on attempt 2 must NOT pass the run — it gates on the full set.
  const d = decideEffectiveBlocking({ blocking, runAttempt: 2, priorSignatureRaw: '' });
  assert.equal(d.crossAttempt, null, 'no prior signature = no comparison');
  assert.equal(d.effectiveBlocking.length, 1, 'blocking stands rather than passing');
});

check('the #1330 case — pure flake across two attempts → empty gate, run passes', () => {
  const prior = 'blog|light|tablet';
  const blocking = [
    cap('blog', 34, 'dark', 'mobile'),
    cap('services', 18, 'dark', 'mobile'),
    cap('home', 7, 'dark', 'tablet'),
  ];
  const d = decideEffectiveBlocking({ blocking, runAttempt: 2, priorSignatureRaw: prior });
  assert.equal(d.crossAttempt.verdict, 'different');
  assert.deepEqual(d.effectiveBlocking, [], 'no capture reproduced → nothing gates → green');
});

check('a reproduced regression keeps gating on attempt 2 (same signature)', () => {
  const sig = 'plans|dark|desktop;plans|light|desktop';
  const blocking = [cap('plans', 18, 'dark', 'desktop'), cap('plans', 14, 'light', 'desktop')];
  const d = decideEffectiveBlocking({ blocking, runAttempt: 2, priorSignatureRaw: sig });
  assert.equal(d.crossAttempt.verdict, 'same');
  assert.equal(d.effectiveBlocking.length, 2, 'an identical set is real — it still blocks');
});

check('a real regression coincident with a flake narrows to the reproduced captures', () => {
  const prior = 'plans|dark|desktop;plans|light|desktop;blog|light|tablet';
  const blocking = [
    cap('plans', 18, 'dark', 'desktop'), // reproduced → keeps gating
    cap('plans', 14, 'light', 'desktop'), // reproduced → keeps gating
    cap('home', 7, 'dark', 'mobile'), // new this attempt → capture-side, cleared
  ];
  const d = decideEffectiveBlocking({ blocking, runAttempt: 2, priorSignatureRaw: prior });
  assert.equal(d.crossAttempt.verdict, 'different');
  assert.deepEqual(
    routeKeys(d.effectiveBlocking),
    ['plans|dark|desktop', 'plans|light|desktop'],
    'the coincident flake never rides the real regression to green',
  );
});

// The QA-hardening cases: clearing needs BOTH signals — cross-attempt flap AND
// intra-run isolation. Magnitude alone (a near-threshold real change jittering
// across 1%) must never be mistaken for a flake. These pass real `results` so
// classifyBlockingSpread computes a genuine spread rather than defaulting to
// isolated on an empty set.
check('a near-threshold REAL change that flapped across attempts is NOT cleared (moved both themes)', () => {
  // `plans/desktop` moved on BOTH themes this attempt → viewportScoped, not
  // isolated. Attempt 1 (prior) only caught the dark theme, so light|desktop is
  // "new" this attempt — set-membership alone would wrongly clear it.
  const results = [
    cap('plans', 1.3, 'dark', 'desktop'),
    cap('plans', 1.1, 'light', 'desktop'),
    cap('plans', 0, 'dark', 'mobile'),
    cap('plans', 0, 'light', 'mobile'),
  ];
  const blocking = results.filter((r) => r.diffPct > 1);
  const d = decideEffectiveBlocking({
    blocking,
    results,
    runAttempt: 2,
    priorSignatureRaw: 'plans|dark|desktop',
  });
  assert.equal(d.crossAttempt.verdict, 'different', 'the set did change between attempts');
  assert.deepEqual(d.cleared, [], 'a change on both themes is not isolated → not capture-side');
  assert.deepEqual(
    routeKeys(d.effectiveBlocking),
    ['plans|dark|desktop', 'plans|light|desktop'],
    'the real change keeps gating rather than being waived as a flake',
  );
});

check('an isolated capture that flapped IS cleared (sibling theme at 0.00%)', () => {
  // `blog/mobile` moved on dark only; its light sibling read 0.00% → isolated.
  // Attempt 1 (prior) blocked nothing, so this is new + isolated → both signals.
  const results = [
    cap('blog', 34, 'dark', 'mobile'),
    cap('blog', 0, 'light', 'mobile'),
  ];
  const blocking = results.filter((r) => r.diffPct > 1);
  const d = decideEffectiveBlocking({
    blocking,
    results,
    runAttempt: 2,
    priorSignatureRaw: '(none)',
  });
  assert.equal(d.crossAttempt.verdict, 'different');
  assert.deepEqual(routeKeys(d.cleared), ['blog|dark|mobile']);
  assert.deepEqual(d.effectiveBlocking, [], 'isolated + flapped → capture-side → run passes');
});

console.log(`\n✓ ${passed} assertions passed`);
