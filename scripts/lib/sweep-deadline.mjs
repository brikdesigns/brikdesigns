/**
 * Sweep deadline for the visual gate (#887 AC 2).
 *
 * The `regression` job carries `timeout-minutes: 25`. When that fires, Actions
 * **cancels** the job — and a cancelled job produces no verdict: no log tail
 * naming what was left, no failing check, nothing a reviewer can act on. The
 * filed symptom was that this "reads like still running"; the worse form,
 * observed on #1417 on 2026-09-11, is a merge refused with
 * `Required status check "regression" is expected` while a successful run sits
 * on the head SHA.
 *
 * The fix is to never reach the job cap. The sweep checks its own elapsed time
 * before each capture and, once past `SWEEP_DEADLINE_MS`, stops and **fails**
 * with the list of what it did not measure. A red check naming 11 unmeasured
 * routes is a verdict; a cancelled job is not.
 *
 * Split out here, rather than inlined in `visual-parity.mjs`, because the whole
 * value is in the edge cases — an off-by-one that fires on the last route, a
 * default that silently disables the guard, a report that says "9 remaining"
 * without naming them. `sweep-deadline.test.mjs` covers those offline.
 */

/** Exit code for "the sweep did not finish". Distinct from 1 (regression) and 2 (tooling). */
export const EXIT_DID_NOT_FINISH = 3;

/**
 * Resolve the deadline budget from the environment.
 *
 * Defaults to `0` — disabled. A local `npm run visual-regression` has no job
 * cap to protect and no business stopping halfway, so the guard is opt-in and
 * the workflow is the only caller that sets it. A malformed or negative value
 * disables it too rather than producing a deadline in the past, which would
 * abort every run on route 1.
 */
export function resolveDeadlineMs(raw) {
  const parsed = parseInt(raw ?? '0', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/**
 * Has the sweep run out of runway?
 *
 * `deadlineMs === 0` is always false — the guard is off, never "immediately
 * expired". The comparison is `>=` so a budget of exactly N ms does not admit
 * one more capture at N: the capture that follows is the one that would
 * overrun, which is the whole point of checking before it rather than after.
 */
export function isExpired({ deadlineMs, startedAt, now }) {
  if (deadlineMs <= 0) return false;
  return now - startedAt >= deadlineMs;
}

/**
 * The units this sweep intends to capture, in the order it will reach them.
 *
 * Taken as an explicit plan rather than derived inside the loop so the report
 * can name what was NOT reached. "9 routes remaining" is the report that sends
 * someone back to the log to work out which nine.
 */
export function planUnits(themes, viewports, routes) {
  const units = [];
  for (const theme of themes) {
    for (const viewport of viewports) {
      for (const route of routes) units.push(`${theme}/${viewport}: ${route}`);
    }
  }
  return units;
}

/**
 * The failure report printed when the deadline fires.
 *
 * States the budget, what was measured, and every unit that was not — then says
 * what to do, because a gate that stops without a remedy trains the re-run
 * reflex this repo has already paid for twice (#1350, #1359).
 */
export function deadlineReport({ deadlineMs, elapsedMs, measured, plan }) {
  const remaining = plan.slice(measured);
  const mins = (ms) => (ms / 60000).toFixed(1);
  const lines = [
    '',
    `✗ Sweep deadline reached after ${mins(elapsedMs)}m (budget ${mins(deadlineMs)}m) — stopping with a verdict rather than being cancelled by the job cap.`,
    `  reached ${measured} of ${plan.length} capture unit(s); ${remaining.length} not reached:`,
    ...remaining.map((u) => `    · ${u}`),
    '',
    '  This is NOT a flake and re-running unchanged will not help — the sweep needs more',
    '  runway or fewer units. Raise SWEEP_DEADLINE_MS and timeout-minutes together, or',
    '  shard the route set. A cancelled job would have reported none of the above.',
  ];
  return lines.join('\n');
}
