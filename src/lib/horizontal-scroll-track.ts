/** Scrub geometry for the pinned horizontal card track (#1272).
 *
 * Pure functions, no DOM. `HorizontalScrollTrack.tsx` owns the GSAP wiring and
 * the element measurement; everything that decides *how far* the track moves
 * and *whether it moves at all* lives here so it can be tested without a
 * browser (`npm run test:hscroll`).
 *
 * The distinction matters because the failure mode is silent: a track that
 * over-translates leaves a blank gutter past the last card, and one that
 * under-translates strands the last card off-screen forever. Neither throws,
 * and neither is obvious at the viewport width the author happened to use.
 */

/** Measured inputs. All px, all read off live elements by the caller. */
export interface TrackMetrics {
  /** Full scroll width of the track — the sum of every card plus the gaps. */
  trackWidth: number;
  /** Width of the clipping window the track slides inside. */
  viewportWidth: number;
}

/**
 * How far the track must travel, as a positive px distance.
 *
 * The freedomgp reference (measured 2026-09-07) translates a 2028px track
 * inside a 1232px window and lands at −913px, i.e. slightly short of the raw
 * 796px overhang because its track carries trailing padding. We derive the
 * distance from the measurement rather than transcribing a constant, so a
 * card added in the CMS changes the travel with no code edit.
 *
 * Never negative: a track narrower than its window has nothing to reveal, and
 * a negative distance would drag the first card off the left edge.
 */
export function trackOverhang({ trackWidth, viewportWidth }: TrackMetrics): number {
  return Math.max(0, trackWidth - viewportWidth);
}

/**
 * Whether the pinned scrub should engage at all.
 *
 * Three independent reasons to fall back to a plain scrollable row, checked in
 * the order they should short-circuit:
 *
 *   1. `prefers-reduced-motion: reduce` — pinning hijacks the scroll, which is
 *      exactly what the preference asks us not to do. Non-negotiable.
 *   2. No overhang — every card already fits, so there is nothing to scrub and
 *      pinning would freeze the page for no visual payoff.
 *   3. Coarse pointer / narrow viewport — a touch device gets native momentum
 *      scrolling, which beats a scrubbed pin on every axis that matters.
 */
export function shouldScrub(opts: {
  prefersReducedMotion: boolean;
  overhang: number;
  isCoarsePointer: boolean;
}): boolean {
  if (opts.prefersReducedMotion) return false;
  if (opts.overhang <= 0) return false;
  if (opts.isCoarsePointer) return false;
  return true;
}

/**
 * Translate offset for a given scrub progress.
 *
 * `progress` is ScrollTrigger's 0→1 across the pinned range. Returns a
 * NEGATIVE px offset (0 at the top, −overhang at the end) so scrolling down
 * moves cards left and scrolling up moves them right — the operator's stated
 * direction, and the reversible default a `scrub` gives us for free.
 *
 * Progress is clamped because ScrollTrigger can report slightly outside 0–1
 * during rubber-band overscroll on macOS; unclamped, that shows as a flash of
 * blank gutter at the end of the track.
 */
export function trackOffset(progress: number, overhang: number): number {
  const clamped = Math.min(1, Math.max(0, progress));
  const offset = -(clamped * Math.max(0, overhang));
  // Normalise -0 → 0. `-(0 * n)` is negative zero, which is invisible in CSS
  // but compares unequal to 0 under Object.is, so it leaks into any strict
  // equality check a caller or test writes against a resting track.
  return offset === 0 ? 0 : offset;
}

/**
 * Extra scroll distance the pin consumes, in px.
 *
 * Held equal to the overhang so the track moves 1:1 with the scroll wheel —
 * a card travels exactly as far as the page would have. Multiplying this makes
 * the section feel sticky and is the usual cause of "the pin won't let go".
 */
export function pinDistance(overhang: number): number {
  return Math.max(0, overhang);
}
