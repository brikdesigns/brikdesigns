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

/**
 * Conclusions the ruleset accepts as satisfying a required context.
 *
 * Not just `success`. GitHub: "Required status checks must have a `successful`,
 * `skipped`, or `neutral` status before collaborators can make changes to a
 * protected branch" ([about-protected-branches], fetched 2026-09-11). Confirmed
 * live in this repo the same day: #1438 merged with `mockup=skipped` and
 * `regression=skipped`, #1429 with those plus `verify=skipped`.
 *
 * This set is the fix for the defect the detector shipped with: it treated any
 * non-`success` conclusion as a real red, so `axe=skipped` on #1434 was reported
 * as "This is a REAL red — fix the failure" on a PR whose only actual blocker was
 * a latched `verify`. `skipped` is the NORMAL state for a path-filtered required
 * gate in this repo (CLAUDE.md § "When adding a CI gate"), so the wrong verdict
 * fires on routine PRs, and it sends the reader hunting a failure that does not
 * exist while the real block sits two lines below.
 *
 * [about-protected-branches]: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
 */
export const ACCEPTED_CONCLUSIONS = new Set(['success', 'skipped', 'neutral']);

/** The context is reported by the newest suite and the ruleset accepts it. */
export const OK = 'ok';
/** The newest suite is still reporting. Wait, do not push anything. */
export const PENDING = 'pending';
/** The newest suite reported a real red. Fix it — an empty commit hides nothing here. */
export const FAILING = 'failing';
/**
 * Nothing the ruleset accepts for this context on the SHA. Not the #1421 shape.
 *
 * Two different states share this verdict, and the report distinguishes them:
 * the context emitted nothing at all (ordinary "still queued"), or it emitted
 * only check-runs the ruleset rejects — `cancelled`, in practice, which the
 * label burst produces by the dozen (#1443). The second is why the verdict is
 * not named "no check-run": saying that while the API returns two is the
 * misreport #1444 was filed on.
 */
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
    return {
      context,
      verdict: NEVER_RAN,
      newestRun: null,
      reportingRun: null,
      acceptedSuites: [],
      emitted: [],
    };
  }

  const owned = byRunId(runs.filter((r) => r.workflow_id === workflowId));
  const newest = owned[owned.length - 1];
  const fromNewest = emitted.find((c) => c.check_suite_id === newest.check_suite_id) ?? null;
  // Same set as the guard below, deliberately: an older suite that reported
  // `skipped` is as much a contradiction of `expected` as one that reported
  // `success`, so hardcoding `success` here would classify a real latch on a
  // path-filtered gate as NEVER_RAN and say nothing.
  const acceptedSuites = emitted
    .filter((c) => ACCEPTED_CONCLUSIONS.has(c.conclusion))
    .map((c) => c.check_suite_id);

  const base = {
    context,
    newestRun: newest,
    reportingRun: fromNewest,
    acceptedSuites,
    // Every check-run the context emitted on this SHA, accepted or not. Carried
    // so the NEVER_RAN report can say what is actually there instead of "no
    // check-run on this SHA" over a pile of cancelled ones (#1444).
    emitted,
    runsOnSha: owned.length,
  };

  if (fromNewest) {
    if (fromNewest.status !== 'completed') return { ...base, verdict: PENDING };
    if (ACCEPTED_CONCLUSIONS.has(fromNewest.conclusion)) return { ...base, verdict: OK };
    return { ...base, verdict: FAILING };
  }

  // The newest run of the owning workflow produced no check-run for this
  // context. That is the latch — but only call it that when something green
  // exists to contradict the `expected`, otherwise it is just "not run yet".
  if (acceptedSuites.length > 0) return { ...base, verdict: LATCHED };
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

/**
 * Tally check-run conclusions as `cancelled×2, failure×1`, newest-count first.
 *
 * Used only by the NEVER_RAN report, where the count is the whole point: the
 * reader has been told a context is not satisfied and needs to know whether
 * that is silence or rejected noise.
 */
function tallyConclusions(checkRuns) {
  const counts = new Map();
  for (const c of checkRuns) {
    const key = c.status === 'completed' ? (c.conclusion ?? 'null') : c.status;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .map(([k, n]) => `${k}×${n}`)
    .join(', ');
}

/** Human report for one analysed context. Returns an array of lines. */
export function reportLines(result) {
  const { context, verdict, newestRun, acceptedSuites } = result;
  const lines = [];
  switch (verdict) {
    case OK: {
      // Name the conclusion rather than saying "success" for all three. A
      // reader seeing `skipped` needs to know the ruleset accepts it, or they
      // go looking for a gate that never ran.
      const c = result.reportingRun.conclusion;
      lines.push(
        c === 'success'
          ? `✓ ${context} — newest run reported success. Not latched.`
          : `✓ ${context} — newest run reported ${c}, which the ruleset accepts. Not latched.`,
      );
      break;
    }
    case PENDING:
      lines.push(`… ${context} — newest run is still reporting. Wait; push nothing.`);
      break;
    case FAILING:
      lines.push(
        `✗ ${context} — newest run reported ${result.reportingRun.conclusion}. This is a REAL red,`,
        '  not a latch. Fix the failure; an empty commit would only hide it.',
      );
      break;
    case NEVER_RAN: {
      // Never claim "no check-run" without checking. #1444 was filed because
      // this line printed on a SHA carrying two `regression` check-runs, and a
      // reader who then runs `gh api …/check-runs` stops trusting the whole
      // tool — which is what happened, in a hand-off, the same afternoon.
      const emitted = result.emitted ?? [];
      if (emitted.length === 0) {
        lines.push(`· ${context} — no check-run on this SHA. Nothing to diagnose here.`);
      } else {
        lines.push(
          `· ${context} — ${emitted.length} check-run(s) on this SHA (${tallyConclusions(emitted)}),`,
          '  none of which the ruleset accepts, and the newest suite reported nothing.',
          '  Not a latch: an empty commit has no green to un-block. Wait for the gate',
          '  to report, or fix what cancelled it.',
        );
      }
      break;
    }
    case LATCHED:
      lines.push(
        `⚠ ${context} — LATCHED (brikdesigns#1421).`,
        `  Newest run of the owning workflow: ${newestRun.id} (suite ${newestRun.check_suite_id})`,
        `  conclusion=${newestRun.conclusion} — it emitted NO ${context} check-run.`,
        // "N accepted check-runs … the ruleset does not accept them" read as a
        // contradiction after #1439 renamed the count from `green`. The ruleset
        // does accept the CONCLUSION; it just is not reading those SUITES.
        `  ${acceptedSuites.length} ${context} check-run(s) with an accepted conclusion sit on`,
        '  this SHA in older suite(s), but the ruleset reads only the newest suite,',
        '  so they do not count. Clear it with a new head SHA:',
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
