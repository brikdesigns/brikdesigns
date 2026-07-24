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

    const sections = Array.from(
      document.querySelectorAll<HTMLElement>('main section')
    )
      // Outermost sections only — nested <section>s ride along with their parent.
      .filter((el) => !el.parentElement?.closest('section'))
      // Skip anything already (or nearly) on screen at init so the first paint
      // is untouched; the 0.85 factor matches the observer's -15% bottom margin.
      .filter((el) => el.getBoundingClientRect().top > window.innerHeight * 0.85);

    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('scroll-reveal--in');
            observer.unobserve(entry.target);
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

    for (const el of sections) {
      el.classList.add('scroll-reveal');
      observer.observe(el);
    }

    return () => {
      observer.disconnect();
      for (const el of sections) {
        el.classList.remove('scroll-reveal', 'scroll-reveal--in');
      }
    };
  }, [pathname]);

  return null;
}
