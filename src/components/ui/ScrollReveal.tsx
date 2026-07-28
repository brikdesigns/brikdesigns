'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import './scroll-reveal.css';

/**
 * Site-wide scroll-driven section reveal — BDS "subtle" motion tier
 * (IntersectionObserver + opacity/translate only, no GSAP).
 *
 * Renders nothing. After hydration it tags the outermost <section> elements
 * inside <main> with `.scroll-reveal` and lifts them in (`.scroll-reveal--in`)
 * as they enter the viewport. Because classes are only ever applied from JS,
 * nothing is hidden without JS (SEO / no-JS safe), and because sections
 * already in the viewport at init are skipped, above-the-fold content never
 * flashes — only content the visitor scrolls to animates.
 *
 * Re-runs on every App Router navigation via usePathname.
 */
export function ScrollReveal() {
  const pathname = usePathname();

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let observer: IntersectionObserver | undefined;
    let tagged: HTMLElement[] = [];
    let frame = 0;

    // Defer tagging past the hydration commit. ScrollReveal mounts with the
    // layout shell, but the <section>s it tags live in a sibling subtree
    // (<main>{children}</main>) that hydrates in a separate lane. A plain
    // useEffect only guarantees post-hydration for *this* component's tree, so
    // `classList.add('scroll-reveal')` can land while React is still hydrating
    // those sections — React then sees `…scroll-reveal` in the DOM vs the
    // server HTML and logs a className mismatch (#760). A double rAF lands the
    // mutation after hydration has committed and painted. The reveal is
    // scroll-driven and above-the-fold sections are skipped, so the defer is
    // visually inert.
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        const sections = Array.from(
          document.querySelectorAll<HTMLElement>('main section')
        )
          // Outermost sections only — nested <section>s ride along with their parent.
          .filter((el) => !el.parentElement?.closest('section'))
          // Skip tinted-surface bands (service tint / secondary / accent). Fading the
          // whole coloured band in reads as hacky against the page ground, since the
          // band's surface differs from the page (BACKLOG-940 / #728). These sections
          // now appear statically; inner cards/content carry their own motion where
          // wanted.
          .filter(
            (el) =>
              !el.matches(
                '.service-surface, .page-section--secondary, .page-section--accent'
              )
          )
          // Skip anything already (or nearly) on screen at init so the first paint
          // is untouched; the 0.85 factor matches the observer's -15% bottom margin.
          .filter(
            (el) => el.getBoundingClientRect().top > window.innerHeight * 0.85
          );

        if (sections.length === 0) return;

        observer = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (entry.isIntersecting) {
                entry.target.classList.add('scroll-reveal--in');
                observer?.unobserve(entry.target);
              }
            }
          },
          // Bottom: fire once the section's top clears the bottom 15% of the
          // viewport. Top: the huge margin extends the root far above the
          // viewport so a section the visitor jumps PAST (End key, anchor link,
          // fast scroll) still counts as intersecting and reveals — without it,
          // skipped sections never fire and stay at opacity 0.
          { rootMargin: '9999px 0px -15% 0px' }
        );

        tagged = sections;
        for (const el of sections) {
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
