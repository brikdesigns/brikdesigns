#!/usr/bin/env node
// Self-test for the label-burst concurrency shape (brikdesigns#1443).
//
// `pr-task.sh` applies 3–4 labels per PR in one `gh pr edit`, and GitHub emits
// one `labeled` event per label. Any workflow carrying `labeled` in its
// `types:` therefore opens 4–5 runs inside two seconds on every PR. Under
// `cancel-in-progress: true` most of those die at the QUEUE stage — before any
// job starts — and a run cancelled there emits NO check-run. When the arbiter
// kills the newest of a same-second pair, the suite the ruleset reads reports
// nothing and the context reverts to `expected`, which only a new head SHA
// clears (#1421).
//
// Measured 2026-09-11 on PR #1448 (3 labels): 9 cancelled runs across the three
// `labeled`-triggered workflows, 3 each.
//
// This test pins the disposition of every `labeled`-triggered workflow, so the
// next edit has to state which side it is on rather than silently reverting a
// line. Run via `npm run test:label-burst-concurrency`.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WORKFLOWS = path.resolve(HERE, '..', '.github', 'workflows');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

/**
 * Workflows that take the `queue: max` treatment — they must never carry
 * `cancel-in-progress: true` again.
 *
 * The cost that earns a workflow a place here is its run duration: `queue: max`
 * serializes every run in the burst, so it is only affordable on a fast gate.
 * Durations measured 2026-09-11 from `gh run list --json createdAt,updatedAt`.
 */
const MUST_QUEUE = [
  { file: 'verify.yml', seconds: 80, required: true },
  { file: 'ac-close-gate.yml', seconds: 5, required: false },
  { file: 'pr-label-gate.yml', seconds: 2, required: false }, // pre-existing (brik-llm#2176)
];

/**
 * The documented exception, and why it is one.
 *
 * `visual-regression` runs ~1100s when its `changes` job says the diff is
 * relevant. Four serialized runs would be ~73 minutes of CI on every PR that
 * touches `src/`, so it keeps `cancel-in-progress` and keeps the residual latch
 * risk, which CLAUDE.md § "When a merge is refused…" now names as the ONE
 * remaining case the empty-commit step covers.
 *
 * If this ever becomes affordable — a faster compare, or a verdict that can be
 * reused across suites on one SHA — move it to MUST_QUEUE and narrow CLAUDE.md
 * to nothing. Do not move it without that, and do not delete this entry to make
 * the test pass.
 */
const DOCUMENTED_EXCEPTION = { file: 'visual-regression.yml', seconds: 1100 };

const read = (f) => fs.readFileSync(path.join(WORKFLOWS, f), 'utf8');

/** The workflow-level `concurrency:` block, as text. */
function concurrencyBlock(src) {
  const m = src.match(/^concurrency:\n((?:[ \t]+.*\n)+)/m);
  return m ? m[1] : null;
}

/** Does this workflow's `on.pull_request*.types` include `labeled`? */
function triggersOnLabeled(src) {
  return /^\s*types:.*\blabeled\b/m.test(src);
}

// ── The shape, per workflow ─────────────────────────────────────────────────

for (const { file, seconds, required } of MUST_QUEUE) {
  check(`${file} (~${seconds}s) is queue:max, not cancel-in-progress`, () => {
    const block = concurrencyBlock(read(file));
    assert.ok(block, `${file} must declare a workflow-level concurrency block`);
    assert.match(block, /queue:\s*max/, `${file} must set queue: max`);
    assert.match(
      block,
      /cancel-in-progress:\s*false/,
      `${file} must set cancel-in-progress: false — GitHub rejects the workflow if it is true alongside queue: max`,
    );
    if (required) {
      // A required context is the expensive case: a latch here cannot be waited
      // out, it blocks the merge until someone pushes a new head SHA.
      assert.doesNotMatch(block, /cancel-in-progress:\s*true/, `${file} is a REQUIRED context`);
    }
  });
}

check(`${DOCUMENTED_EXCEPTION.file} is the documented exception and still says so`, () => {
  // Not "it may keep cancel-in-progress" — it MUST, because moving it silently
  // would add ~73min of CI per PR and nothing else would notice until someone
  // watched a PR sit for an hour.
  const src = read(DOCUMENTED_EXCEPTION.file);
  const block = concurrencyBlock(src);
  assert.ok(block, 'visual-regression must declare a workflow-level concurrency block');
  assert.match(block, /cancel-in-progress:\s*true/);
  assert.doesNotMatch(block, /queue:\s*max/);

  const claude = fs.readFileSync(path.resolve(HERE, '..', 'CLAUDE.md'), 'utf8');
  assert.match(
    claude,
    /visual-regression/,
    'CLAUDE.md § "When a merge is refused…" must name the one gate that can still latch',
  );
  assert.match(claude, /--allow-empty/, 'the clearing step must survive for that one case');
});

// ── The invariant, across every workflow ────────────────────────────────────

check('every labeled-triggered workflow is on one list or the other', () => {
  // The point of the test. A NEW workflow that takes `labeled` inherits the
  // burst on day one, and nothing else in the repo would tell its author. Adding
  // one means deciding — queue it, or document why it is an exception — and
  // this assertion is where that decision gets recorded.
  const known = new Set([...MUST_QUEUE.map((w) => w.file), DOCUMENTED_EXCEPTION.file]);
  const unaccounted = fs
    .readdirSync(WORKFLOWS)
    .filter((f) => f.endsWith('.yml'))
    .filter((f) => triggersOnLabeled(read(f)))
    .filter((f) => !known.has(f));
  assert.deepEqual(
    unaccounted,
    [],
    `these workflows trigger on \`labeled\` and are on neither list — add them to MUST_QUEUE, or to DOCUMENTED_EXCEPTION with the run duration that justifies it: ${unaccounted.join(', ')}`,
  );
});

check('queue:max and cancel-in-progress:true never co-occur — GitHub rejects it', () => {
  // "The combination of `queue: max` and `cancel-in-progress: true` is not
  // allowed and will result in a workflow validation error"
  // (GitHub, workflow-syntax § concurrency, fetched 2026-09-11). A workflow that
  // fails validation does not run, and a required context that does not run is
  // the #1334 Pending trap — the exact failure this ticket must not cause.
  for (const f of fs.readdirSync(WORKFLOWS).filter((x) => x.endsWith('.yml'))) {
    const block = concurrencyBlock(read(f));
    if (!block) continue;
    const bad = /queue:\s*max/.test(block) && /cancel-in-progress:\s*true/.test(block);
    assert.equal(bad, false, `${f} combines queue: max with cancel-in-progress: true`);
  }
});

console.log(`\n${passed} checks passed`);
