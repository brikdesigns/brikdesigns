#!/usr/bin/env node
// Self-test for the latched-required-context detector (brikdesigns#1421).
//
// This tells a blocked session whether to push an empty commit, so the cases
// that matter are the ones where a wrong answer is expensive:
//
//   - a REAL red reported as a latch, which would send someone to push a new
//     head SHA over a genuine regression
//   - an in-flight run reported as a latch, which trains the empty-commit
//     reflex on a check that was about to go green on its own
//   - the refuted hypothesis creeping back: a cancelled check-run is NOT a
//     latch, and #1410 merged with three of them
//   - ordering taken from the API's response order rather than by run id —
//     the whole defect happens inside one second, so timestamps cannot order it
//
// The four PR fixtures are transcribed from live API responses on 2026-09-11
// (`GET /actions/runs?head_sha=…` and `GET /commits/{sha}/check-runs`); the
// suite and run ids are the real ones so a reader can go re-fetch them.
//
// Plain node:assert, no framework. Run via `npm run test:latched-context`.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ACCEPTED_CONCLUSIONS,
  FAILING,
  LATCHED,
  NEVER_RAN,
  OK,
  PENDING,
  REQUIRED_CONTEXTS,
  analyzeContext,
  byRunId,
  clearingStep,
  reportLines,
} from './latched-context.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

const VR = 329381174; // the live workflow_id of "Visual regression (staging vs deploy-preview)"

const run = (id, suite, conclusion, workflow_id = VR) => ({
  id,
  check_suite_id: suite,
  workflow_id,
  status: conclusion === null ? 'in_progress' : 'completed',
  conclusion,
});
const cr = (suite, conclusion, name = 'regression') => ({
  name,
  check_suite_id: suite,
  status: conclusion === null ? 'in_progress' : 'completed',
  conclusion,
});

// ── Fixture: #1417 head 614fbf87 — the reported defect ──────────────────────
// Four Visual-regression runs. The newest by id (34610413327) was cancelled at
// the queue stage and emitted nothing; two older suites are green.
const PR1417 = {
  runs: [
    run(34610408127, 93756910947, 'success'),
    run(34610412534, 93756923326, 'cancelled'),
    run(34610412793, 93756924032, 'success'),
    run(34610413327, 93756925615, 'cancelled'),
  ],
  checkRuns: [cr(93756910947, 'success'), cr(93756924032, 'success')],
};

// ── Fixture: #1414 head 78d8087c — the second occurrence, same shape ────────
const PR1414 = {
  runs: [
    run(34609554341, 93754502032, 'cancelled'),
    run(34609556388, 93754508581, 'cancelled'),
    run(34609556696, 93754509397, 'cancelled'),
    run(34609556824, 93754509799, 'cancelled'),
    run(34609558793, 93754515661, 'success'),
    run(34609558941, 93754516151, 'cancelled'),
  ],
  checkRuns: [
    cr(93754515661, 'success'),
    cr(93754509799, 'cancelled'),
    cr(93754502032, 'cancelled'),
  ],
};

// ── Fixture: #1410 head 91d3d9d4 — merged WITH three cancelled check-runs ───
const PR1410 = {
  runs: [
    run(34603234413, 93736735837, 'cancelled'),
    run(34603238247, 93736744121, 'cancelled'),
    run(34603241222, 93736752826, 'cancelled'),
    run(34603247553, 93736769504, 'success'),
  ],
  checkRuns: [
    cr(93736769504, 'success'),
    cr(93736752826, 'cancelled'),
    cr(93736744121, 'cancelled'),
    cr(93736735837, 'cancelled'),
  ],
};

// ── Fixture: #1407 head ac0dba08 — 0-check-run cancelled suites, but not newest
// Two of its Visual-regression runs (93592586750, 93592587230) were cancelled
// before emitting anything, exactly like #1417's. It merged, because the NEWEST
// suite was the one that succeeded. This is the discriminator.
const PR1407 = {
  runs: [
    run(34548431801, 93592584625, 'cancelled'),
    run(34548432642, 93592586750, 'cancelled'),
    run(34548432837, 93592587230, 'cancelled'),
    run(34548432935, 93592587464, 'cancelled'),
    run(34548433475, 93592588952, 'success'),
  ],
  checkRuns: [
    cr(93592588952, 'success'),
    cr(93592587464, 'cancelled'),
    cr(93592584625, 'cancelled'),
  ],
};

const verdictOf = (fixture, context = 'regression') =>
  analyzeContext({ context, ...fixture }).verdict;

// ── The reported defect, and the discriminator ──────────────────────────────

check('#1417 614fbf87 is LATCHED — newest suite emitted nothing, two greens behind it', () => {
  const r = analyzeContext({ context: 'regression', ...PR1417 });
  assert.equal(r.verdict, LATCHED);
  assert.equal(r.newestRun.id, 34610413327);
  assert.equal(r.newestRun.check_suite_id, 93756925615);
  assert.equal(r.reportingRun, null);
  assert.deepEqual(r.acceptedSuites.sort(), [93756910947, 93756924032]);
});

check('#1414 78d8087c is LATCHED too — the second live occurrence, same day', () => {
  const r = analyzeContext({ context: 'regression', ...PR1414 });
  assert.equal(r.verdict, LATCHED);
  assert.equal(r.newestRun.id, 34609558941);
});

check('#1407 is OK — it HAS 0-check-run cancelled suites, they just are not newest', () => {
  // The one that separates #1407 (merged) from #1417 (refused). If this ever
  // reports LATCHED the detector has stopped keying on "newest" and is keying
  // on "any empty suite exists", which would fire on most PRs in this repo.
  assert.equal(verdictOf(PR1407), OK);
  const emptySuites = PR1407.runs.filter(
    (r) => !PR1407.checkRuns.some((c) => c.check_suite_id === r.check_suite_id),
  );
  assert.equal(emptySuites.length, 2, 'fixture must retain its two empty cancelled suites');
});

check('#1410 is OK — a cancelled CHECK-RUN does not latch (the refuted hypothesis)', () => {
  // #1421 filed this hypothesis and struck it: three PRs merged the same day
  // carrying cancelled `regression` check-runs. Locked in so nobody re-derives
  // it from the ticket title.
  assert.equal(verdictOf(PR1410), OK);
  assert.equal(PR1410.checkRuns.filter((c) => c.conclusion === 'cancelled').length, 3);
});

// ── The expensive wrong answers ─────────────────────────────────────────────

// ── `skipped` is a pass, not a red (the defect this detector shipped with) ──

check('a skipped newest run is OK — skipped is the normal state of a path-filtered gate', () => {
  // The bug: the first version treated any non-`success` conclusion as FAILING,
  // so `axe=skipped` on #1434 printed "This is a REAL red — fix the failure" on
  // a PR whose only blocker was a latched `verify` two lines below. Every gate
  // in this repo is path-filtered (CLAUDE.md § "When adding a CI gate"), so the
  // wrong verdict fired on an ordinary PR, not an exotic one.
  const fixture = {
    runs: [run(1, 100, 'skipped')],
    checkRuns: [cr(100, 'skipped', 'axe')],
  };
  const r = analyzeContext({ context: 'axe', ...fixture });
  assert.equal(r.verdict, OK);
  const lines = reportLines(r).join('\n');
  assert.match(lines, /skipped, which the ruleset accepts/);
  assert.doesNotMatch(lines, /REAL red/);
  assert.doesNotMatch(lines, /--allow-empty/);
});

check('the accepted set is exactly what GitHub documents — success, skipped, neutral', () => {
  // "Required status checks must have a `successful`, `skipped`, or `neutral`
  // status" (about-protected-branches, fetched 2026-09-11). Confirmed live the
  // same day: #1438 merged with mockup=skipped + regression=skipped, #1429 with
  // those plus verify=skipped. Pinned so nobody narrows it back to `success`.
  assert.deepEqual([...ACCEPTED_CONCLUSIONS].sort(), ['neutral', 'skipped', 'success']);
  for (const c of ['failure', 'timed_out', 'action_required', 'cancelled', 'stale']) {
    assert.equal(ACCEPTED_CONCLUSIONS.has(c), false, `${c} must not be accepted`);
  }
});

check('an older SKIPPED run still makes a silent newest suite a LATCH, not NEVER_RAN', () => {
  // The same hardcoded `success` appeared twice. Fixing only the verdict guard
  // would leave a path-filtered gate's latch reported as "nothing to diagnose
  // here" — the exact silence #1421 exists to break.
  const fixture = {
    runs: [run(1, 100, 'skipped'), run(2, 200, 'cancelled')],
    checkRuns: [cr(100, 'skipped', 'axe')],
  };
  const r = analyzeContext({ context: 'axe', ...fixture });
  assert.equal(r.verdict, LATCHED);
  assert.deepEqual(r.acceptedSuites, [100]);
});

check('a REAL red is FAILING, never LATCHED — an empty commit must not be offered', () => {
  const fixture = {
    runs: [run(1, 100, 'success'), run(2, 200, 'failure')],
    checkRuns: [cr(100, 'success'), cr(200, 'failure')],
  };
  const r = analyzeContext({ context: 'regression', ...fixture });
  assert.equal(r.verdict, FAILING);
  assert.notEqual(r.verdict, LATCHED);
  const lines = reportLines(r).join('\n');
  assert.match(lines, /REAL red/);
  assert.doesNotMatch(lines, /--allow-empty/, 'the clearing step must not appear on a real red');
});

check('an in-flight newest run is PENDING — do not train the empty-commit reflex', () => {
  const fixture = {
    runs: [run(1, 100, 'success'), run(2, 200, null)],
    checkRuns: [cr(100, 'success'), cr(200, null)],
  };
  const r = analyzeContext({ context: 'regression', ...fixture });
  assert.equal(r.verdict, PENDING);
  assert.doesNotMatch(reportLines(r).join('\n'), /--allow-empty/);
});

check('newest suite silent AND nothing green is NEVER_RAN, not a latch', () => {
  // A gate that has not reported at all is the ordinary "still queued" state.
  // Calling it a latch would fire on every PR in its first minute.
  const fixture = {
    runs: [run(1, 100, 'cancelled'), run(2, 200, 'cancelled')],
    checkRuns: [cr(100, 'cancelled')],
  };
  assert.equal(verdictOf(fixture), NEVER_RAN);
});

check('a context nothing emitted is NEVER_RAN — no workflow to attribute it to', () => {
  const fixture = { runs: [run(1, 100, 'success')], checkRuns: [cr(100, 'success', 'verify')] };
  assert.equal(verdictOf(fixture, 'regression'), NEVER_RAN);
});

// ── NEVER_RAN must not claim "no check-run" over check-runs that exist ──────

check('NEVER_RAN over rejected check-runs counts them instead of denying them', () => {
  // #1444. The line read "no check-run on this SHA" on #1433 head 615c34d6,
  // which carried two `regression` check-runs (cancelled + skipped). A reader
  // who checks `gh api …/check-runs` finds the tool contradicting the API and
  // stops trusting every other verdict — a hand-off the same afternoon said
  // exactly that. The burst makes this reachable at will: #1443 measured 12
  // cancelled runs per PR, so an all-cancelled context is ordinary here.
  const fixture = {
    runs: [run(1, 100, 'cancelled'), run(2, 200, 'cancelled')],
    checkRuns: [cr(100, 'cancelled'), cr(100, 'cancelled')],
  };
  const r = analyzeContext({ context: 'regression', ...fixture });
  assert.equal(r.verdict, NEVER_RAN);
  assert.equal(r.emitted.length, 2);
  const lines = reportLines(r).join('\n');
  assert.match(lines, /2 check-run\(s\) on this SHA \(cancelled×2\)/);
  assert.doesNotMatch(lines, /no check-run on this SHA/, 'must not deny check-runs that exist');
  assert.doesNotMatch(lines, /--allow-empty/, 'NEVER_RAN is not a latch — offer no empty commit');
});

check('NEVER_RAN with genuinely nothing emitted keeps the plain line', () => {
  // The other half of the same verdict. Silence is still silence, and padding
  // it with a zero-count tally would make the common case noisier to read.
  const fixture = { runs: [run(1, 100, 'success')], checkRuns: [cr(100, 'success', 'verify')] };
  const r = analyzeContext({ context: 'regression', ...fixture });
  assert.equal(r.verdict, NEVER_RAN);
  assert.deepEqual(r.emitted, []);
  assert.match(reportLines(r).join('\n'), /no check-run on this SHA/);
});

check('every verdict carries acceptedSuites — no stale greenSuites key survives', () => {
  // #1439 renamed greenSuites → acceptedSuites but missed the early return, so
  // the one path that reaches it handed back a key no caller reads. Pin the
  // shape rather than the rename, so the next one cannot half-land either.
  const nothing = analyzeContext({
    context: 'regression',
    runs: [run(1, 100, 'success')],
    checkRuns: [cr(100, 'success', 'verify')],
  });
  for (const r of [nothing, analyzeContext({ context: 'regression', ...PR1417 })]) {
    assert.ok(Array.isArray(r.acceptedSuites), `${r.verdict} must expose acceptedSuites`);
    assert.equal('greenSuites' in r, false, `${r.verdict} must not expose greenSuites`);
  }
  const src = fs.readFileSync(path.join(HERE, 'latched-context.mjs'), 'utf8');
  assert.doesNotMatch(src, /greenSuites/, 'the old key must be gone from the module');
});

// ── Ordering ────────────────────────────────────────────────────────────────

check('newest is by run id, not response order — the API returns newest-first', () => {
  // `GET /actions/runs` hands back newest-first. Feeding #1417 in that order
  // must not flip the verdict; if it does, the detector is reading [0] or [-1]
  // of whatever it was given.
  const reversed = { runs: [...PR1417.runs].reverse(), checkRuns: [...PR1417.checkRuns].reverse() };
  assert.equal(verdictOf(reversed), LATCHED);
  assert.equal(byRunId(reversed.runs).at(-1).id, 34610413327);
  assert.equal(byRunId(PR1417.runs).at(-1).id, 34610413327);
});

check('created_at cannot order these — the contended runs share one second', () => {
  // Both #1417 runs 34610412793 (survived) and 34610413327 (cancelled) report
  // created_at 2026-09-11T14:29:19Z. Any implementation that sorts on the
  // timestamp is picking arbitrarily, so the module must not expose one.
  const src = fs.readFileSync(path.join(HERE, 'latched-context.mjs'), 'utf8');
  assert.doesNotMatch(src, /sort\([^)]*created_at/, 'never order runs by created_at');
});

check('runs from another workflow do not shift which run counts as newest', () => {
  // A later-id run belonging to a DIFFERENT workflow must not be mistaken for
  // the newest run of the owning one — otherwise every PR looks latched as soon
  // as any other gate starts after the regression gate finishes.
  const fixture = {
    runs: [run(1, 100, 'success'), run(9999, 900, 'cancelled', 555555)],
    checkRuns: [cr(100, 'success')],
  };
  assert.equal(verdictOf(fixture), OK);
});

// ── The clearing step, and the live list it covers ──────────────────────────

check('the clearing step is an empty commit + push, and never `gh run rerun`', () => {
  // #1417 re-ran the older cancelled run to green (attempt 2, 14:50:45Z) and
  // the 14:52:46Z merge was still refused: the suite the ruleset reads had no
  // run in it to re-run. Offering rerun here would repeat that hour.
  const steps = clearingStep('regression').join('\n');
  assert.match(steps, /git commit --allow-empty/);
  assert.match(steps, /git push/);
  assert.doesNotMatch(steps, /gh run rerun/);
});

check('the diagnosed contexts match the live ruleset script — no silent five-of-six', () => {
  const src = fs.readFileSync(path.join(REPO, 'scripts', 'apply-staging-ruleset.sh'), 'utf8');
  const block = src.match(/REQUIRED_CONTEXTS=\(([^)]*)\)/);
  assert.ok(block, 'REQUIRED_CONTEXTS array not found in apply-staging-ruleset.sh');
  const live = block[1].split('\n').map((l) => l.trim()).filter(Boolean).sort();
  assert.deepEqual([...REQUIRED_CONTEXTS].sort(), live);
});

check('CLAUDE.md carries the clearing step where a blocked session will find it', () => {
  // AC 3. The remedy is a documented step, so the doc IS the deliverable and a
  // silent revert of it is the way this ticket regresses.
  const md = fs.readFileSync(path.join(REPO, 'CLAUDE.md'), 'utf8');
  assert.match(md, /#1421/, 'CLAUDE.md must cite the ticket');
  assert.match(md, /--allow-empty/, 'CLAUDE.md must name the clearing step');
  assert.match(md, /latched-context\.mjs/, 'CLAUDE.md must name the detector');
});

console.log(`\n${passed} checks passed`);
