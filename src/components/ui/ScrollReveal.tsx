'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import './scroll-reveal.css';

/**
 * Site-wide scroll-driven reveal — BDS "subtle" motion tier
 * (IntersectionObserver + opacity/translate only, no GSAP).
 *
 * Renders nothing. After hydration it tags elements with `.scroll-reveal` and
 * lifts them in (`.scroll-reveal--in`) as they enter the viewport. Because
 * classes are only ever applied from JS, nothing is hidden without JS (SEO /
 * no-JS safe), and because anything already in the viewport at init is skipped,
 * above-the-fold content never flashes — only content the visitor scrolls to
 * animates.
 *
 * ── WHAT gets tagged: the band rule (#1170) ───────────────────────────────
 *
 * A section painted in a colour other than the page ground is a BAND. Fading a
 * whole coloured band in reads as hacky — the band's edge sweeps across the
 * page ground, so the eye tracks the rectangle rather than the content. So:
 *
 *   • Section is ON the page ground → tag the SECTION. Its content and its
 *     (absent or matching) background rise together, which is invisible-by-
 *     design because there is no edge to see.
 *   • Section is a BAND → tag its CONTENT, never the section. The surface
 *     stays put; the header, cards, and media inside it animate in.
 *
 * This was already decided once, in #728 / BACKLOG-940. That fix shipped as a
 * hardcoded list of four class names — `.service-surface`,
 * `.page-section--secondary`, `.page-section--accent`, `.vband` — and so
 * covered only the bands that existed the day it was written. Twenty-odd
 * tinted band rules later, `/how-it-works` shipped three bands
 * (`.hiw-process`, `.hiw-practice`, `.hiw-industries`) that matched none of
 * them and animated as whole rectangles, and the operator reported the same
 * defect again on 2026-08-31 (#1168).
 *
 * The rule is therefore DERIVED, not enumerated: "is this a band?" is answered
 * by MEASURING the section's computed background against the page ground. A
 * newly authored band is covered the moment it paints, with no edit to this
 * file. Do not reintroduce a class list here — that is the bug, not the fix.
 *
 * Measuring also makes the rule theme-correct for free. `--surface-primary`
 * and the page ground move together (white/white in light, black/black in
 * dark), so a `.page-section` is never a band in either theme; the accent
 * tints are fixed-light in BOTH themes, so they are always a band. A
 * class list cannot express that; a measurement doesn't have to.
 *
 * Gated by tests/a11y/band-animation.spec.ts and documented in
 * .claude/references/band-animation.md.
 *
 * Re-runs on every App Router navigation via usePathname.
 */

/** Tagging targets stop descending after this many single-child wrappers. */
const MAX_UNWRAP_DEPTH = 4;

/** A background that paints nothing — the element shows the ground behind it. */
function isTransparent(color: string): boolean {
  if (!color || color === 'transparent') return true;
  const parts = color.match(/rgba?\(([^)]+)\)/)?.[1].split(',');
  return parts?.length === 4 && parseFloat(parts[3]) === 0;
}

/**
 * The elements that carry a band's motion: the band's content, unwrapped.
 *
 * Marketing sections are near-universally `<section>` → one layout container →
 * N content blocks (header, grid, media). Tagging the container would re-create
 * the whole-rectangle problem one level down, so single-child wrappers are
 * descended through until real siblings appear, and those siblings are what
 * animates. Bounded by MAX_UNWRAP_DEPTH so a pathological nest can't spin.
 */
function contentTargets(section: HTMLElement): HTMLElement[] {
  let node: HTMLElement = section;
  for (let depth = 0; depth < MAX_UNWRAP_DEPTH; depth++) {
    const children = Array.from(node.children) as HTMLElement[];
    if (children.length !== 1) break;
    node = children[0];
  }
  return Array.from(node.children) as HTMLElement[];
}

export function ScrollReveal() {
  const pathname = usePathname();

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let observer: IntersectionObserver | undefined;
    let tagged: HTMLElement[] = [];
    let frame = 0;

    // Defer tagging past the hydration commit. ScrollReveal mounts with the
    // layout shell, but the <section>s it reads live in a sibling subtree
    // (<main>{children}</main>) that hydrates in a separate lane. A plain
    // useEffect only guarantees post-hydration for *this* component's tree, so
    // `classList.add('scroll-reveal')` can land while React is still hydrating
    // those sections — React then sees `…scroll-reveal` in the DOM vs the
    // server HTML and logs a className mismatch (#760). A double rAF lands the
    // mutation after hydration has committed and painted. The reveal is
    // scroll-driven and above-the-fold content is skipped, so the defer is
    // visually inert.
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        // The page ground, read off the live document rather than a token name,
        // so this follows a theme change or a client-theme override without
        // knowing either exists.
        const ground = getComputedStyle(document.body).backgroundColor;

        const sections = Array.from(
          document.querySelectorAll<HTMLElement>('main section')
          // Outermost sections only — nested <section>s ride along with their parent.
        ).filter((el) => !el.parentElement?.closest('section'));

        // Band → animate the content inside it. Ground → animate the section.
        const candidates: HTMLElement[] = [];
        for (const section of sections) {
          const bg = getComputedStyle(section).backgroundColor;
          const isBand = !isTransparent(bg) && bg !== ground;
          candidates.push(...(isBand ? contentTargets(section) : [section]));
        }

        const targets = candidates.filter(
          // Skip anything already (or nearly) on screen at init so the first paint
          // is untouched; the 0.85 factor matches the observer's -15% bottom margin.
          (el) => el.getBoundingClientRect().top > window.innerHeight * 0.85
        );

        if (targets.length === 0) return;

        observer = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (entry.isIntersecting) {
                entry.target.classList.add('scroll-reveal--in');
                observer?.unobserve(entry.target);
              }
            }
          },
          // Bottom: fire once the target's top clears the bottom 15% of the
          // viewport. Top: the huge margin extends the root far above the
          // viewport so an element the visitor jumps PAST (End key, anchor link,
          // fast scroll) still counts as intersecting and reveals — without it,
          // skipped elements never fire and stay at opacity 0.
          { rootMargin: '9999px 0px -15% 0px' }
        );

        tagged = targets;
        for (const el of targets) {
          el.classList.add('scroll-reveal');
          observer.observe(el);
        }
      });
    });

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      for (const el of tagged) {
        el.classList.remove('scroll-reveal', 'scroll-reveal--in');
      }
    };
  }, [pathname]);

  return null;
}
