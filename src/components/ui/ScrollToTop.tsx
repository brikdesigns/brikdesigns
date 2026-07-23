'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Scroll reset for param-only navigations — BACKLOG-859.
 *
 * The App Router resets scroll when the route *segment* changes, but skips it
 * when only a dynamic param changes (story → story, service → service):
 * verified on the local prod build 2026-07-23 — cross-route nav lands at
 * scrollY 0, same-segment nav stays at the old offset with no scrollTo /
 * scrollIntoView call from Next at all. This component covers that gap.
 *
 * Renders nothing. On every pathname change it snaps to the top — except
 * back/forward traversals (popstate), where the browser/Next restore the
 * previous scroll position and a forced top would break that. Hash-only
 * changes never fire it (usePathname excludes the fragment), so in-page
 * anchor gliding (SmoothScrollButton, ScrollDownCta) is untouched.
 */
export function ScrollToTop() {
  const pathname = usePathname();
  const isTraversal = useRef(false);

  useEffect(() => {
    const onPopState = () => {
      isTraversal.current = true;
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useLayoutEffect(() => {
    if (isTraversal.current) {
      isTraversal.current = false;
      return;
    }
    // 'instant' bypasses the html scroll-behavior:smooth so the reset can't
    // be animated-and-interrupted (the same failure data-scroll-behavior
    // guards against for Next's own resets).
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);

  return null;
}
