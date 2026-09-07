'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import {
  trackOverhang,
  shouldScrub,
  trackOffset,
  pinDistance,
} from '@/lib/horizontal-scroll-track';
import './horizontal-scroll-track.css';

/**
 * Pinned horizontal card track — BDS "GSAP" motion tier (#1272).
 *
 * Pins its section and scrubs a row of cards sideways as the visitor scrolls
 * vertically: down moves cards left, up moves them right. Reversible, because
 * that is what a `scrub` gives us — no separate up/down code path.
 *
 * ── Why GSAP, and why this isn't a new bet ───────────────────────────────────
 *
 * The BDS motion tiers already sanction exactly this. From brik-rag
 * (Document: Tiers § Tier comparison):
 *
 *   | GSAP | … | Design calls for scroll pinning, scrubbing, HORIZONTAL SCROLL
 *              PANELS, text splitting. | ~120 KB JS |
 *
 * The tier vocabulary lives in brik-bds
 * `content-system/vocabularies/animation-tier.ts`. What the toolkit does NOT
 * have is a React primitive — it targets the Phase 03 vanilla-HTML mockup
 * pipeline and loads GSAP from a CDN. Here GSAP is a real pinned dependency
 * and is imported dynamically, so it stays out of the main bundle and off
 * every page that doesn't scrub.
 *
 * The canonical recipe in brik-rag (Document: GSAP § Horizontal scroll) uses
 * `xPercent: -100 * (panels.length - 1)` with `snap`. That is a full-viewport
 * panel deck, one panel at a time. This is a continuous card track, so the
 * travel is the MEASURED overhang and there is no snap — see
 * `src/lib/horizontal-scroll-track.ts`, which owns that geometry and is tested
 * headlessly (`npm run test:hscroll`).
 *
 * ── What it refuses to do ────────────────────────────────────────────────────
 *
 * The base stylesheet renders a plain scrollable row. This component only
 * upgrades that, and `shouldScrub()` declines under `prefers-reduced-motion`,
 * on a coarse pointer, or when every card already fits. So:
 *
 *   - no JS            → scrollable row, all cards reachable
 *   - reduced motion   → scrollable row, nothing pinned, nothing transformed
 *   - touch / narrow   → native momentum scrolling
 *
 * ── Why the section opts out of ScrollReveal ─────────────────────────────────
 *
 * A tinted section is a BAND, so ScrollReveal tags its CONTENT for reveal
 * (band-animation.md) — and `.scroll-reveal` animates `transform`. GSAP also
 * owns `transform` on the track. Two owners of one property is the #1271 class
 * of defect, so the root carries `data-no-reveal` and ScrollReveal skips
 * anything inside it. That is a scoped declaration of ownership, NOT a band
 * allowlist — the band derivation itself stays measured.
 */

interface HorizontalScrollTrackProps {
  children: ReactNode;
  /** Extra classes on the root, for section-specific layout. */
  className?: string;
  /**
   * Accessible name for the scrollable region. Required: in its fallback state
   * the viewport is a keyboard-focusable scroll container, and an unnamed one
   * is announced only as "scrollable region".
   */
  label: string;
}

export function HorizontalScrollTrack({
  children,
  className,
  label,
}: HorizontalScrollTrackProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!root || !viewport || !track) return;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pointerQuery = window.matchMedia('(pointer: coarse)');

    let cancelled = false;
    let teardown: (() => void) | undefined;

    async function engage() {
      if (!root || !viewport || !track) return;

      const overhang = trackOverhang({
        trackWidth: track.scrollWidth,
        viewportWidth: viewport.clientWidth,
      });

      if (
        !shouldScrub({
          prefersReducedMotion: motionQuery.matches,
          overhang,
          isCoarsePointer: pointerQuery.matches,
        })
      ) {
        return;
      }

      // Dynamic import keeps GSAP out of the main bundle — it loads only on a
      // page that actually scrubs, and only after the fallback has rendered.
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger'),
      ]);
      if (cancelled) return;

      gsap.registerPlugin(ScrollTrigger);

      // Pin the whole section so the header holds with the cards, matching the
      // freedomgp reference (measured 2026-09-07: the section holds top:0
      // across the scrub). Falls back to the root when used outside a section.
      const pinTarget = root.closest('section') ?? root;

      root.dataset.scrub = 'on';

      const tween = gsap.to(track, {
        // Driven off the measured overhang, recomputed on every refresh below,
        // so a card added in the CMS changes the travel with no code edit.
        x: () =>
          trackOffset(
            1,
            trackOverhang({
              trackWidth: track.scrollWidth,
              viewportWidth: viewport.clientWidth,
            })
          ),
        ease: 'none',
        scrollTrigger: {
          trigger: pinTarget,
          start: 'top top',
          // 1:1 with the wheel — a card travels exactly as far as the page
          // would have. Multiplying this is what makes a pin feel stuck.
          end: () =>
            '+=' +
            pinDistance(
              trackOverhang({
                trackWidth: track.scrollWidth,
                viewportWidth: viewport.clientWidth,
              })
            ),
          pin: pinTarget,
          scrub: 1,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      });

      const trigger = tween.scrollTrigger;

      // Keyboard reachability. With the scrub engaged the viewport no longer
      // scrolls natively, so a card tabbed to off-screen would otherwise stay
      // off-screen — the browser's own scrollIntoView has nothing to scroll.
      // Map the focused card's position along the track onto the page scroll
      // that reveals it.
      function handleFocusIn(event: FocusEvent) {
        if (!trigger || !track || !viewport) return;
        const focused = event.target as HTMLElement | null;
        if (!focused || !track.contains(focused)) return;

        const currentOverhang = trackOverhang({
          trackWidth: track.scrollWidth,
          viewportWidth: viewport.clientWidth,
        });
        if (currentOverhang <= 0) return;

        // Where the focused element sits along the track, independent of the
        // transform GSAP has already applied.
        const trackBox = track.getBoundingClientRect();
        const focusedBox = focused.getBoundingClientRect();
        const offsetInTrack = focusedBox.left - trackBox.left;

        // Reveal its leading edge, minus a little context.
        const desired = Math.min(
          currentOverhang,
          Math.max(0, offsetInTrack - viewport.clientWidth * 0.1)
        );
        const progress = desired / currentOverhang;

        window.scrollTo({
          top: trigger.start + progress * (trigger.end - trigger.start),
          behavior: 'auto',
        });
      }

      track.addEventListener('focusin', handleFocusIn);

      // Re-measure once webfonts land — Poppins swapping in changes card
      // heights and can change the track width, and a stale measurement
      // strands the last card.
      document.fonts?.ready.then(() => {
        if (!cancelled) ScrollTrigger.refresh();
      });

      teardown = () => {
        track.removeEventListener('focusin', handleFocusIn);
        trigger?.kill();
        tween.kill();
        gsap.set(track, { clearProps: 'transform' });
        delete root.dataset.scrub;
      };
    }

    // Defer past the hydration commit, matching ScrollReveal's reasoning
    // (#760): mutating these nodes mid-hydration produces a className/attribute
    // mismatch. A double rAF lands after hydration has committed and painted.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        void engage();
      });
    });

    // A preference or pointer change mid-session rebuilds from scratch rather
    // than trying to mutate a live ScrollTrigger.
    function rebuild() {
      teardown?.();
      teardown = undefined;
      void engage();
    }
    motionQuery.addEventListener('change', rebuild);
    pointerQuery.addEventListener('change', rebuild);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      motionQuery.removeEventListener('change', rebuild);
      pointerQuery.removeEventListener('change', rebuild);
      teardown?.();
    };
  }, []);

  return (
    <div ref={rootRef} className={className ? `hscroll ${className}` : 'hscroll'} data-no-reveal>
      {/* tabIndex makes the fallback scroll container keyboard-operable — a
          scrollable region that cannot be reached by keyboard is a WCAG 2.1.1
          failure. Named via aria-label so it is not announced as an anonymous
          "scrollable region". */}
      <div
        ref={viewportRef}
        className="hscroll__viewport"
        tabIndex={0}
        role="group"
        aria-label={label}
      >
        <div ref={trackRef} className="hscroll__track">
          {children}
        </div>
      </div>
    </div>
  );
}
