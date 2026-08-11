// visual-change-declaration.mjs — the waiver logic behind the `visual-change`
// declaration on a PR (brikdesigns#856).
//
// The problem: `visual-regression` blocks on any diff over 1%, and its own
// header called the resulting red check "the point". So every deliberate design
// PR shipped with a failing gate, and the signal carried no information exactly
// when a design change was in flight. On #853 — a showcase-layout redesign —
// 6 of 84 captures failed and all 6 were the one redesigned route; the other
// 13 routes measured 0.00%. Nothing machine-readable said which was intended.
//
// The fix is a declaration, not a bypass. A PR states which routes it MEANT to
// move; those are reported and waived, every other route still gates. Crucially
// a declaration that does NOT move is itself a failure — otherwise the waiver
// decays into a permanent allowlist nobody prunes, which is the `--no-verify`
// shape this repo refuses.
//
// Two halves are required, mirroring `repro:none` / `issue:none` in the Brik
// issue canon: the `visual-change` LABEL makes the waiver visible on the board,
// the body line makes it specific and reviewable in the place review reads.
// Either half alone declares nothing.

// A single line in the PR body naming route entries from ROUTES[].name:
//
//   Visual-change: events-grind-after-graduation, home
//
// Case-insensitive on the key, tolerant of surrounding whitespace, and ignored
// inside a fenced code block — a PR that quotes this doc in an example must not
// thereby waive anything. Multiple lines accumulate.
const DECLARATION_RE = /^[ \t]*visual-change[ \t]*:[ \t]*(.+)$/i;

export function parseDeclaration(body) {
  if (!body) return [];
  const names = [];
  let inFence = false;
  for (const line of String(body).split(/\r?\n/)) {
    if (/^[ \t]*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = line.match(DECLARATION_RE);
    if (!m) continue;
    for (const raw of m[1].split(',')) {
      const name = raw.trim();
      if (name && !names.includes(name)) names.push(name);
    }
  }
  return names;
}

// Partition the run's per-capture results against a declaration.
//
//   declared    route names from parseDeclaration (already label-gated)
//   knownRoutes every ROUTES[].name, so a typo fails loudly instead of
//               silently waiving nothing
//   results     [{ route, theme, viewport, diffPct }] — diffPct null when the
//               capture produced no comparison
//   threshold   DIFF_THRESHOLD, in percent
//
// Returns four disjoint findings. `blocking` and the two defect lists are what
// the caller exits on; `waived` is what it prints.
export function evaluateDeclaration({ declared = [], knownRoutes = [], results = [], threshold = 0 }) {
  const unknown = declared.filter((name) => !knownRoutes.includes(name));
  const declaredSet = new Set(declared);

  const over = results.filter((r) => r.diffPct !== null && r.diffPct > threshold);

  const waived = over.filter((r) => declaredSet.has(r.route));
  const blocking = over.filter((r) => !declaredSet.has(r.route));

  // A declared route that moved nowhere is a stale declaration. Judge it per
  // route, not per capture: a redesign that only lands in dark/desktop still
  // moved the route, and demanding every viewport move would push authors
  // toward declaring less than they changed.
  const movedRoutes = new Set(waived.map((r) => r.route));
  const measuredRoutes = new Set(
    results.filter((r) => r.diffPct !== null).map((r) => r.route),
  );
  const unmoved = declared.filter(
    (name) =>
      knownRoutes.includes(name) &&
      measuredRoutes.has(name) &&
      !movedRoutes.has(name),
  );

  return { waived, blocking, unmoved, unknown };
}
