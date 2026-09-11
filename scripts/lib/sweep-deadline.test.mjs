#!/usr/bin/env node
// Self-test for the visual sweep's deadline guard (brikdesigns#887 AC 2).
//
// This decides whether a REQUIRED gate stops early, so each way it could stop
// being trustworthy gets a case:
//
//   - the guard defaults ON and aborts every local run at route 1 (unset env)
//   - a malformed or negative budget produces a deadline in the past
//   - the check fires AFTER the capture that overruns, not before it
//   - the report counts the remainder but does not name it
//   - the exit code collides with 1 (real regression) or 2 (tooling)
//
// Plain node:assert, no framework. Run via `npm run test:sweep-deadline`.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  EXIT_DID_NOT_FINISH,
  deadlineReport,
  isExpired,
  planUnits,
  resolveDeadlineMs,
} from './sweep-deadline.mjs';

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

// ── The guard is opt-in ─────────────────────────────────────────────────────

check('an unset budget disables the guard — a local sweep is never cut short', () => {
  assert.equal(resolveDeadlineMs(undefined), 0);
  assert.equal(isExpired({ deadlineMs: 0, startedAt: 0, now: 9_999_999 }), false);
});

check('a malformed or negative budget disables it rather than expiring instantly', () => {
  // `parseInt('abc')` is NaN and `deadline = NaN` would make every comparison
  // false by accident rather than by decision; a negative would abort route 1.
  for (const raw of ['', 'abc', '-1', '0']) {
    assert.equal(resolveDeadlineMs(raw), 0, `${JSON.stringify(raw)} must disable the guard`);
  }
});

check('a well-formed budget is honoured', () => {
  assert.equal(resolveDeadlineMs('1200000'), 1_200_000);
});

// ── The boundary ────────────────────────────────────────────────────────────

check('the check fires BEFORE the capture that would overrun, not after', () => {
  const deadlineMs = 1000;
  // At exactly the budget there is no runway left for the next unit, so the
  // sweep must stop. `>` here instead of `>=` admits one more capture past the
  // budget — which on this gate is a route that can take minutes.
  assert.equal(isExpired({ deadlineMs, startedAt: 0, now: 999 }), false);
  assert.equal(isExpired({ deadlineMs, startedAt: 0, now: 1000 }), true);
  assert.equal(isExpired({ deadlineMs, startedAt: 0, now: 1001 }), true);
});

check('elapsed is measured from the sweep start, not from zero', () => {
  assert.equal(isExpired({ deadlineMs: 500, startedAt: 10_000, now: 10_400 }), false);
  assert.equal(isExpired({ deadlineMs: 500, startedAt: 10_000, now: 10_500 }), true);
});

// ── The plan and the report ─────────────────────────────────────────────────

check('the plan enumerates theme × viewport × route in sweep order', () => {
  const plan = planUnits(['light', 'dark'], ['desktop', 'mobile'], ['home', 'plans']);
  assert.equal(plan.length, 8);
  assert.equal(plan[0], 'light/desktop: home');
  assert.equal(plan[1], 'light/desktop: plans');
  assert.equal(plan[2], 'light/mobile: home');
  assert.equal(plan.at(-1), 'dark/mobile: plans');
});

check('the report NAMES every unreached unit, never just a count', () => {
  const plan = planUnits(['light'], ['desktop'], ['home', 'plans', 'about']);
  const report = deadlineReport({ deadlineMs: 1_200_000, elapsedMs: 1_260_000, measured: 1, plan });
  assert.match(report, /reached 1 of 3 capture unit\(s\); 2 not reached/);
  assert.match(report, /· light\/desktop: plans/);
  assert.match(report, /· light\/desktop: about/);
  assert.doesNotMatch(report, /· light\/desktop: home/, 'a measured unit must not be listed as remaining');
});

check('the report states the budget and refuses the re-run reflex', () => {
  const plan = planUnits(['dark'], ['mobile'], ['home', 'plans']);
  const report = deadlineReport({ deadlineMs: 1_200_000, elapsedMs: 1_201_000, measured: 1, plan });
  assert.match(report, /budget 20\.0m/);
  assert.match(report, /20\.0m/);
  assert.match(report, /re-running unchanged will not help/i);
});

check('a deadline that fires on the last unit reports an empty remainder cleanly', () => {
  const plan = planUnits(['light'], ['desktop'], ['home']);
  const report = deadlineReport({ deadlineMs: 1000, elapsedMs: 1000, measured: 1, plan });
  assert.match(report, /reached 1 of 1 capture unit\(s\); 0 not reached/);
});

// ── The exit code ───────────────────────────────────────────────────────────

check('the did-not-finish code is distinct from regression (1) and tooling (2)', () => {
  assert.equal(EXIT_DID_NOT_FINISH, 3);
  assert.notEqual(EXIT_DID_NOT_FINISH, 1);
  assert.notEqual(EXIT_DID_NOT_FINISH, 2);
});

// ── The wiring, which the lib cannot assert about itself ────────────────────

check('visual-parity.mjs consults the deadline inside the sweep loop', () => {
  const src = fs.readFileSync(path.resolve(process.cwd(), 'scripts/visual-parity.mjs'), 'utf8');
  assert.match(src, /isExpired/, 'the sweep no longer checks the deadline at all');
  assert.match(src, /EXIT_DID_NOT_FINISH/, 'the sweep no longer exits with the did-not-finish code');
});

check('the workflow budget leaves headroom under the job cap', () => {
  // A budget at or above `timeout-minutes` is the bug this guard exists to
  // prevent, dressed as a fix: the cap still fires first and the job is still
  // cancelled with no verdict.
  const wf = fs.readFileSync(
    path.resolve(process.cwd(), '.github/workflows/visual-regression.yml'),
    'utf8',
  );
  const budget = wf.match(/SWEEP_DEADLINE_MS:\s*'?(\d+)'?/);
  const cap = wf.match(/timeout-minutes:\s*25/);
  assert.ok(budget, 'visual-regression.yml no longer sets SWEEP_DEADLINE_MS');
  assert.ok(cap, "the regression job's timeout-minutes: 25 moved — re-check the budget below it");
  const budgetMin = Number(budget[1]) / 60000;
  assert.ok(
    budgetMin < 25,
    `SWEEP_DEADLINE_MS is ${budgetMin}m against a 25m job cap — the cap would fire first and cancel the job`,
  );
  assert.ok(
    budgetMin <= 22,
    `SWEEP_DEADLINE_MS is ${budgetMin}m — leave at least 3m for the diff summary and report upload`,
  );
});

console.log(`\n${passed} checks passed.`);
