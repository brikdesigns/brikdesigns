/**
 * Why a required context reads `expected` while a green check-run sits on the
 * head SHA (brikdesigns#1421).
 *
 * Observed on #1417: `gh pr merge` and the REST merge endpoint both refused
 * with `Required status check "regression" is expected.` while `gh pr checks`
 * showed all six required contexts passing. The ruleset agreed with the merge
 * endpoint and not with the rollup — rule-suites `4037728674` (14:41:03Z) and
 * `4037909746` (14:52:46Z) both record `required_status_checks: fail` with that
 * exact detail string, the second one taken when the SHA carried TWO
 * successful `regression` check-runs.
 *
 * The discriminator is which check-SUITE the newest run of the owning workflow
 * landed in. `visual-regression.yml` sets `concurrency: cancel-in-progress`
 * keyed on `github.ref`, so a burst of same-SHA PR events all contend. When
 * the arbiter cancels a run at the QUEUE stage — before any job starts — that
 * run's check-suite emits no check-run at all. If the cancelled one happens to
 * be the newest, the context has no report from the suite the ruleset is
 * looking at, and reverts to `expected`. Earlier successful check-runs on the
 * same SHA do not substitute, and neither does re-running an older run to
 * green: #1417's re-run (`34610408127` attempt 2) went green at 14:50:45Z and
 * the 14:52:46Z merge was still refused.
 *
 * Measured, 40 most recent merged PRs into `staging` (45 head SHAs,
 * 2026-09-01 → 2026-09-11): 45 of 45 merged heads had the newest
 * `Visual regression` check-suite at `success` with exactly one `regression`
 * check-run in it. Not one merged on a head whose newest suite reported
 * nothing. The two SHAs in that window whose newest suite was cancelled with
 * zero check-runs — #1417 `614fbf87`, #1414 `78d8087c` — are both SHAs the PR
 * had to move off.
 *
 * The refuted hypothesis is kept as a test, not a comment: a cancelled
 * check-run does NOT latch the context. #1410 merged with three cancelled
 * `regression` check-runs on its head SHA, because the newest suite was the
 * one that succeeded. Cancellation only bites when it happens early enough to
 * leave the suite empty.
 *
 * Neither half is ours to configure away. `POST /repos/{owner}/{repo}/pulls`
 * accepts no `labels` parameter (GitHub REST, fetched 2026-09-11), so labels
 * are always a second call and `gh pr edit --add-label a --add-label b` emits
 * one `labeled` event per label — three of them, same second, on #1417. And
 * the concurrency docs say the newest queued run "will take its place", which
 * is precisely what does not happen when two runs are created in the same
 * second. So this module detects the state and names the one step that clears
 * it, rather than pretending a workflow edit prevents it.
 *
 * Pure functions over API-shaped data; `latched-context.test.mjs` covers the
 * cases offline. The CLI at the bottom is the thing a blocked session runs.
 */

/** The context is reported by the newest suite and it passed. Merge should work. */
export const OK = 'ok';
/** The newest suite is still reporting. Wait, do not push anything. */
export const PENDING = 'pending';
/** The newest suite reported a real red. Fix it — an empty commit hides nothing here. */
export const FAILING = 'failing';
/** No check-run for this context anywhere on the SHA. Not the #1421 shape. */
export const NEVER_RAN = 'never-ran';
/** The #1421 shape: newest suite reported nothing, an older suite is green. */
export const LATCHED = 'latched';

/**
 * Sort runs oldest → newest by numeric id.
 *
 * `GET /actions/runs` returns newest-first and `created_at` has one-second
 * resolution — the whole defect lives inside a single second, so timestamps
 * cannot order these. Run ids are monotonic and are the only usable key.
 * Never rely on the order the API handed back.
 */
export function byRunId(runs) {
  return [...runs].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * Which workflow owns a context, inferred from the suites that did emit it.
 *
 * Inferred rather than configured: mapping context → workflow by hand is a
 * second source of truth that rots the first time a job is renamed, and the
 * SHA already carries the answer. Returns `null` when nothing emitted the
 * context, which is `NEVER_RAN`, not a latch.
 */
export function owningWorkflowId({ context, runs, checkRuns }) {
  const suites = new Set(
    checkRuns.filter((c) => c.name === context).map((c) => c.check_suite_id),
  );
  if (suites.size === 0) return null;
  const owner = runs.find((r) => suites.has(r.check_suite_id));
  return owner ? owner.workflow_id : null;
}

/**
 * Classify one required context on one head SHA.
 *
 * The order of the guards is load-bearing. `FAILING` and `PENDING` are decided
 * from the newest suite's own check-run and returned BEFORE the latch test, so
 * a genuine red or an in-flight run can never be reported as a latch — the
 * remedy for a latch is "push a new head SHA", and handing that to someone
 * sitting on a real regression would launder the failure into a green.
 */
export function analyzeContext({ context, runs, checkRuns }) {
  const emitted = checkRuns.filter((c) => c.name === context);
  const workflowId = owningWorkflowId({ context, runs, checkRuns });

  if (workflowId === null) {
    return { context, verdict: NEVER_RAN, newestRun: null, reportingRun: null, greenSuites: [] };
  }

  const owned = byRunId(runs.filter((r) => r.workflow_id === workflowId));
  const newest = owned[owned.length - 1];
  const fromNewest = emitted.find((c) => c.check_suite_id === newest.check_suite_id) ?? null;
  const greenSuites = emitted
    .filter((c) => c.conclusion === 'success')
    .map((c) => c.check_suite_id);

  const base = {
    context,
    newestRun: newest,
    reportingRun: fromNewest,
    greenSuites,
    runsOnSha: owned.length,
  };

  if (fromNewest) {
    if (fromNewest.status !== 'completed') return { ...base, verdict: PENDING };
    if (fromNewest.conclusion === 'success') return { ...base, verdict: OK };
    return { ...base, verdict: FAILING };
  }

  // The newest run of the owning workflow produced no check-run for this
  // context. That is the latch — but only call it that when something green
  // exists to contradict the `expected`, otherwise it is just "not run yet".
  if (greenSuites.length > 0) return { ...base, verdict: LATCHED };
  return { ...base, verdict: NEVER_RAN };
}

/**
 * The one step that clears a latch, ready to paste.
 *
 * An empty commit and nothing else. `gh run rerun` is deliberately not offered:
 * it re-runs an existing suite, and the suite the ruleset is reading has no run
 * in it to re-run. #1417 proved that the long way round.
 */
export function clearingStep(context) {
  return [
    `git commit --allow-empty -m "chore: new head SHA to clear the latched ${context} check"`,
    'git push',
  ];
}

/** Human report for one analysed context. Returns an array of lines. */
export function reportLines(result) {
  const { context, verdict, newestRun, greenSuites } = result;
  const lines = [];
  switch (verdict) {
    case OK:
      lines.push(`✓ ${context} — newest run reported success. Not latched.`);
      break;
    case PENDING:
      lines.push(`… ${context} — newest run is still reporting. Wait; push nothing.`);
      break;
    case FAILING:
      lines.push(
        `✗ ${context} — newest run reported ${result.reportingRun.conclusion}. This is a REAL red,`,
        '  not a latch. Fix the failure; an empty commit would only hide it.',
      );
      break;
    case NEVER_RAN:
      lines.push(`· ${context} — no check-run on this SHA. Nothing to diagnose here.`);
      break;
    case LATCHED:
      lines.push(
        `⚠ ${context} — LATCHED (brikdesigns#1421).`,
        `  Newest run of the owning workflow: ${newestRun.id} (suite ${newestRun.check_suite_id})`,
        `  conclusion=${newestRun.conclusion} — it emitted NO ${context} check-run.`,
        `  ${greenSuites.length} successful ${context} check-run(s) sit on this SHA in older`,
        '  suite(s), and the ruleset does not accept them. Clear it with a new head SHA:',
        '',
        ...clearingStep(context).map((c) => `    ${c}`),
      );
      break;
    default:
      throw new Error(`unhandled verdict: ${verdict}`);
  }
  return lines;
}

/** Exit code when at least one required context is latched. */
export const EXIT_LATCHED = 4;

/**
 * The contexts to diagnose — `staging`'s six required checks.
 *
 * Duplicated from `scripts/apply-staging-ruleset.sh`'s `REQUIRED_CONTEXTS`
 * rather than read from the ruleset at runtime: the ruleset endpoint needs an
 * admin scope a normal session does not carry, and a diagnostic that 403s when
 * you are blocked is no diagnostic. The self-test asserts the two lists stay
 * identical, so the copy cannot drift into covering five of six gates.
 */
export const REQUIRED_CONTEXTS = [
  'gitleaks',
  'closing-keyword-guard',
  'verify',
  'axe',
  'regression',
  'mockup',
];

// ── CLI ──────────────────────────────────────────────────────────────────────

async function main(argv) {
  const { execFileSync } = await import('node:child_process');
  const prArg = argv[argv.indexOf('--pr') + 1];
  if (!argv.includes('--pr') || !prArg) {
    console.error('usage: node scripts/lib/latched-context.mjs --pr <number> [--repo owner/name]');
    return 2;
  }
  const repo = argv.includes('--repo') ? argv[argv.indexOf('--repo') + 1] : 'brikdesigns/brikdesigns';
  const gh = (path) =>
    JSON.parse(execFileSync('gh', ['api', path, '--paginate'], { encoding: 'utf8', maxBuffer: 64e6 }));

  const pr = gh(`repos/${repo}/pulls/${prArg}`);
  const sha = pr.head.sha;
  const runs = gh(`repos/${repo}/actions/runs?head_sha=${sha}&per_page=100`).workflow_runs.map(
    (r) => ({
      id: r.id,
      check_suite_id: r.check_suite_id,
      workflow_id: r.workflow_id,
      name: r.name,
      status: r.status,
      conclusion: r.conclusion,
    }),
  );
  const checkRuns = gh(`repos/${repo}/commits/${sha}/check-runs?per_page=100`).check_runs.map(
    (c) => ({
      id: c.id,
      name: c.name,
      check_suite_id: c.check_suite.id,
      status: c.status,
      conclusion: c.conclusion,
    }),
  );

  console.log(`Head SHA ${sha} — ${runs.length} workflow run(s), ${checkRuns.length} check-run(s)\n`);
  let latched = 0;
  for (const context of REQUIRED_CONTEXTS) {
    const result = analyzeContext({ context, runs, checkRuns });
    if (result.verdict === LATCHED) latched += 1;
    for (const line of reportLines(result)) console.log(line);
  }
  return latched > 0 ? EXIT_LATCHED : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = await main(process.argv.slice(2));
}
