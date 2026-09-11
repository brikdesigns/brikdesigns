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
// Returns five disjoint findings. `blocking` and the two defect lists are what
// the caller exits on; `waived` and `underThreshold` are what it prints.
export function evaluateDeclaration({ declared = [], knownRoutes = [], results = [], threshold = 0 }) {
  const unknown = declared.filter((name) => !knownRoutes.includes(name));
  const declaredSet = new Set(declared);

  const over = results.filter((r) => r.diffPct !== null && r.diffPct > threshold);

  const waived = over.filter((r) => declaredSet.has(r.route));
  const blocking = over.filter((r) => !declaredSet.has(r.route));

  // A declared route that moved nowhere is a stale declaration. "Nowhere" means
  // NO measurable diff, not "under the threshold" (#880). The first version
  // derived this from the over-threshold set, so a real change too small to
  // clear 1% failed the gate for being honestly declared: PR #877 moved three
  // labels from uppercase to Title Case and measured 0.02–0.05% across all six
  // captures. That is a change; it is just not 1% of a page's pixels. Failing it
  // reintroduces the false-red #856 existed to remove, and leaves the author
  // choosing between a true declaration and a green check.
  //
  // Judge per route, not per capture: a redesign that only lands in dark/desktop
  // still moved the route, and demanding every viewport move would push authors
  // toward declaring less than they changed.
  const movedRoutes = new Set(
    results.filter((r) => r.diffPct !== null && r.diffPct > 0).map((r) => r.route),
  );
  const measuredRoutes = new Set(
    results.filter((r) => r.diffPct !== null).map((r) => r.route),
  );
  const unmoved = declared.filter(
    (name) =>
      knownRoutes.includes(name) &&
      measuredRoutes.has(name) &&
      !movedRoutes.has(name),
  );

  // Declared, genuinely moved, but never needed a waiver — the whole route sat
  // under the threshold. Reported rather than waived: nothing was let through,
  // so calling it a waiver would overstate what the declaration did.
  const waivedRoutes = new Set(waived.map((r) => r.route));
  const underThreshold = declared.filter(
    (name) =>
      knownRoutes.includes(name) &&
      movedRoutes.has(name) &&
      !waivedRoutes.has(name),
  );

  return { waived, blocking, unmoved, unknown, underThreshold };
}

// Split blocking routes by how their failure is spread across captures, so the
// gate can tell an intended/stale-base red apart from a capture flake (#1106).
//
// A real render change moves EVERY captured viewport of a route (all themes,
// all sizes); a route that blocks on some captures while its others measure
// 0.00% is a capture-side flake — the exact signature the issue documents
// (`home [light/desktop]` at 30% while its own tablet + mobile were identical).
//
//   broad          → every measured capture of the route is over threshold →
//                    the move is real: an intended change (label it) or a stale
//                    base (rebase). Never a flake.
//   viewportScoped → the route moved on a strict SUBSET of viewports, but on
//                    every theme within each moved viewport → a real change
//                    scoped to a breakpoint. Label or rebase; never a flake.
//   isolated       → some capture moved while its same-viewport sibling in the
//                    other theme read 0.00% → likely a capture flake; re-run
//                    before labeling.
//
// The theme axis is the discriminator, and counting alone misses it (#1311). A
// breakpoint-scoped change moves a strict subset of captures exactly like a
// flake does, so the pre-#1311 count test called it a flake: on PR #1293
// `plans` measured 13.92% light/desktop + 18.74% dark/desktop with all four
// smaller viewports at 0.00%, byte-identical across two independent runs — the
// definition of reproducible — and the gate said "re-run before you label".
// A capture flake does not politely take out both themes of one viewport and
// leave the rest untouched; a `@media (min-width: …)` rule does exactly that.
//
// A viewport only counts as coherently moved when it has at least TWO measured
// captures and all of them block. With a single measured capture the theme axis
// offers no corroboration, so such a route stays `isolated` — the error that
// costs a wasted re-run, never the one that waives a real regression by
// inviting a label.
//
// Keyed on the same `results` shape evaluateDeclaration consumes, so a route
// with no successfully measured capture cannot appear (it has no diffPct).
export function classifyBlockingSpread({ blocking = [], results = [] }) {
  const measuredFor = (name) =>
    results.filter((r) => r.route === name && r.diffPct !== null);
  const blockingFor = (name) => blocking.filter((r) => r.route === name);

  const broad = [];
  const viewportScoped = [];
  const isolated = [];

  for (const name of new Set(blocking.map((r) => r.route))) {
    const measured = measuredFor(name);
    const blocked = blockingFor(name);

    if (blocked.length === measured.length) {
      broad.push(name);
      continue;
    }

    // Every viewport this route blocks on must be corroborated across themes.
    const movedViewports = new Set(blocked.map((r) => r.viewport));
    const coherent = [...movedViewports].every((viewport) => {
      const atViewport = measured.filter((r) => r.viewport === viewport);
      return (
        atViewport.length > 1 &&
        atViewport.every((r) => blocked.some((b) => b.theme === r.theme && b.viewport === viewport))
      );
    });

    (coherent ? viewportScoped : isolated).push(name);
  }

  return { isolated, broad, viewportScoped };
}

// Build the exact `Visual-change:` line a failing run's author has to paste
// into the PR body (#1256).
//
// Without it the route names are only knowable from a source dive into
// ROUTES[].name, so every intended visual change pays a guaranteed first
// failure and then a lookup. The line names the DISTINCT routes that blocked,
// in the order they first appear in `blocking`, which is exactly the set the
// declaration has to cover for the re-run to go green.
//
// Returns null when nothing blocked — there is no line to paste, and emitting
// an empty one would read as a declaration of nothing.
export function buildDeclarationLine(blocking = []) {
  const routes = [...new Set(blocking.map((r) => r.route))];
  return routes.length ? `Visual-change: ${routes.join(', ')}` : null;
}

// Smallest share of the taller capture's height the shorter one may have before
// the pair is treated as a failed capture rather than a diff (#1314).
//
// Half is deliberately far below any real layout delta. The comparison pads the
// shorter image with white and diffs (visual-parity.mjs), which is CORRECT for a
// genuine height change — #830's #861 comment traced a 15.83% red to a 24px page
// shift exactly that way, and that measurement has to keep working. It is wrong
// when `fullPage` returns a viewport-sized image: on PR #1312, run 34396746728,
// `home [light/desktop]` captured at 1280x800 — the raw viewport — against a
// 1280x12722 reference, so 94% of the page was compared against white and
// reported as a 27.53% regression on a route the branch never touched. The same
// deploy captured the full 12722px page at dark/desktop, so nothing had moved.
export const MIN_CAPTURE_HEIGHT_RATIO = 0.5;

/**
 * True when two captures of the same route differ so much in height that one of
 * them cannot be a rendering of the same page.
 *
 * Height only — width is fixed by the viewport and always matches. A missing or
 * zero-height capture is handled upstream by the `wfOk`/`nlOk` existence check,
 * so a non-positive height here is not treated as truncation.
 */
export function isTruncatedCapture(
  heightA,
  heightB,
  minRatio = MIN_CAPTURE_HEIGHT_RATIO,
) {
  if (!(heightA > 0) || !(heightB > 0)) return false;
  return Math.min(heightA, heightB) / Math.max(heightA, heightB) < minRatio;
}

// How much shorter than the DOM a PNG may be before the capture is called
// partial (#1358). A `fullPage` screenshot is rounded to whole device pixels
// and a fractional layout height rounds either way, so an exact equality test
// would call every capture partial. 8px absorbs that without coming close to
// any real shortfall — the class this catches is "the browser rendered 8485px
// and the file is 1024px", not an off-by-two.
export const CAPTURE_HEIGHT_TOLERANCE_PX = 8;

// How close to the raw viewport height a faithful capture must be before it is
// read as a page that rendered one viewport tall (#1358). Next's error boundary
// centres its message in a `min-height: 100vh` box, so it measures the viewport
// height exactly; the margin covers a boundary that adds a few px of chrome.
export const VIEWPORT_RENDER_TOLERANCE_PX = 24;

/**
 * True when the PNG that was written is materially shorter than the DOM the
 * browser reported at screenshot time — a genuine partial capture (#1358).
 *
 * This is the ONLY honest test for truncation, and it needs both numbers from
 * the same capture. `isTruncatedCapture` compares the two SIDES of a
 * comparison, which cannot distinguish a short capture of a tall page from a
 * faithful capture of a short page — and on every occurrence recorded so far it
 * was the latter (see `isViewportHeightRender`).
 *
 * Machine-detectable, so the caller retries in-run rather than failing the job.
 */
export function isPartialCapture(
  pngHeight,
  domHeight,
  tolerancePx = CAPTURE_HEIGHT_TOLERANCE_PX,
) {
  if (!(pngHeight > 0) || !(domHeight > 0)) return false;
  return domHeight - pngHeight > tolerancePx;
}

/**
 * True when a capture is a faithful rendering of a page that came out roughly
 * one raw viewport tall, while the other side of the comparison is many times
 * taller (#1358).
 *
 * That is not a capture failure. It is the app's error boundary: the reference
 * capture from run 34486548222 is a complete 768x1024 render of the App Router
 * "This page couldn't load" screen. Every wait in `captureOnce` asks "has it
 * stopped changing?", and a page that never grew is maximally stable, so it
 * passes all of them instantly.
 *
 * All three occurrences on record land on EXACTLY the raw viewport height —
 * `home [light/desktop]` 800px, `industry-dental [dark/tablet]` 1024px,
 * `fma [dark/mobile]` 812px. A partial capture would land on an arbitrary
 * height; three-for-three on the viewport height is a page that rendered short.
 *
 * `otherHeight` guards against a legitimately short page: a route whose real
 * height is about one viewport in BOTH captures is not an error, so this only
 * fires when the pair already fails `isTruncatedCapture`.
 */
export function isViewportHeightRender(
  height,
  viewportHeight,
  otherHeight,
  tolerancePx = VIEWPORT_RENDER_TOLERANCE_PX,
) {
  if (!(height > 0) || !(viewportHeight > 0) || !(otherHeight > 0)) return false;
  if (Math.abs(height - viewportHeight) > tolerancePx) return false;
  return isTruncatedCapture(height, otherHeight);
}

/**
 * Which failure class a height pair represents, or null when it is a real diff.
 *
 * One function so the two classes cannot drift apart at the call sites, and so
 * adding a third is a decision someone has to make here (#1358).
 *
 *   'app-error'  the shorter side is a faithful capture of a page that rendered
 *                one viewport tall — the app errored. Fails the run and names
 *                the side; NEVER prescribes a re-run, because a CMS outage on
 *                the reference deployment must not pass by being retried.
 *   'truncated'  the heights disagree beyond the ratio, but the short side is
 *                not viewport-height — the pre-#1358 catch-all, kept so an
 *                unrecognised shape still fails loudly rather than diffing
 *                against white padding.
 */
export function classifyCaptureHeights(
  { referenceHeight, buildHeight, viewportHeight } = {},
) {
  if (!isTruncatedCapture(referenceHeight, buildHeight)) return null;
  const shortSide = referenceHeight <= buildHeight ? 'reference' : 'build';
  const shortHeight = Math.min(referenceHeight, buildHeight);
  const tallHeight = Math.max(referenceHeight, buildHeight);
  if (isViewportHeightRender(shortHeight, viewportHeight, tallHeight)) {
    return { kind: 'app-error', side: shortSide, shortHeight, tallHeight };
  }
  return { kind: 'truncated', side: shortSide, shortHeight, tallHeight };
}

/**
 * True when a capture produced a usable comparison, not merely a file (#1317).
 *
 * The distinction is the whole point. Before this, the summary counted captures
 * whose FILES exist — and since #1314 a truncated capture writes its file and
 * then fails the run, so it counted as "complete" while contributing no
 * comparison. Run 34402425891 attempt 1 printed
 *
 *     ✗ 1 capture(s) failed — a skipped route is not a pass:
 *       fma [dark/mobile] — truncated: 2741px vs 812px
 *     ✓ 84/84 captures complete
 *
 * two lines apart. `84/84` is the line a reader scans, and it overstated
 * coverage on a run that had a bad capture — the shape #822 hid behind.
 *
 * `wfOk` is waived under `updateBaselines` because that mode is AUTHORING the
 * reference side; there is nothing to compare against yet and its absence is
 * expected, not a failure.
 *
 * Every capture-failure class belongs here rather than at the call site, so
 * adding the next one is a decision this function forces someone to make — the
 * self-test asserts the rule directly.
 */
export function isUsableCapture(
  { nlOk = false, wfOk = false, truncated = false, appError = false } = {},
  { updateBaselines = false } = {},
) {
  if (!nlOk) return false;
  if (!(wfOk || updateBaselines)) return false;
  // Both height-failure classes contribute no comparison, so both are unusable
  // (#1358). They are separate flags rather than one because they need opposite
  // remedies — `truncated` is a capture bug, `appError` is the page — and
  // merging them here is how the summary line would go back to saying
  // "truncated" for an error-boundary render.
  return truncated !== true && appError !== true;
}

/** How many of `results` produced a usable comparison (#1317). */
export function countUsableCaptures(results = [], { updateBaselines = false } = {}) {
  return results.filter((r) => isUsableCapture(r, { updateBaselines })).length;
}

// Decide whether a visual-regression run must be SKIPPED because it is a
// stale-payload re-run (#1106). A `gh run rerun` replays the ORIGINAL
// `pull_request` payload, so the label state baked into VISUAL_CHANGE_LABEL is
// frozen at the original event. If the PR has since gained the `visual-change`
// label, the payload still reads undeclared and every route the label was meant
// to waive reds again on a non-bug — the exact false red item 1 could only warn
// against (PR #1258). Adding the label already fired a fresh `labeled`-event run
// with the correct payload (see the `labeled` trigger in visual-regression.yml),
// so the replay is redundant: skip it rather than fail.
//
// Only the label-GAINED direction is skipped. The reverse — the payload carries
// the label but it was removed since — is deliberately NOT skipped: it fails
// CLOSED (an undeclared route reds, which is the safe outcome), and the
// `unlabeled` trigger already re-runs it with a fresh payload. Skipping it would
// waive a real regression on a stale positive.
export function isStalePayloadRerun({ payloadLabel = false, liveLabel = false } = {}) {
  return liveLabel === true && payloadLabel === false;
}

// Aggregate captures into a per-route noise-floor summary (#1106). Used by the
// on-demand noise-floor run, which captures one deployment against itself so
// every measured diff is pure capture noise; the per-route worst is what the
// global DIFF_THRESHOLD has to clear to be free of flake.
//
// Rows are sorted worst-first. Captures with no measured diff (null) are
// excluded, matching evaluateDeclaration — an unmeasured capture is not 0.00%.
export function summarizeNoiseByRoute(results = []) {
  const byRoute = new Map();
  for (const r of results) {
    if (r.diffPct === null || r.diffPct === undefined) continue;
    const cur = byRoute.get(r.route) ?? { worst: 0, sum: 0, count: 0 };
    cur.worst = Math.max(cur.worst, r.diffPct);
    cur.sum += r.diffPct;
    cur.count += 1;
    byRoute.set(r.route, cur);
  }
  return [...byRoute.entries()]
    .map(([route, s]) => ({ route, worst: s.worst, avg: s.sum / s.count, count: s.count }))
    .sort((a, b) => b.worst - a.worst || a.route.localeCompare(b.route));
}
