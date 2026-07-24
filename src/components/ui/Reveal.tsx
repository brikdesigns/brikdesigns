'use client';

import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Element to render as the reveal root. Defaults to a <div>. */
  as?: ElementType;
  className?: string;
  /** Reveal once and stop observing (default), or re-hide when scrolled out. */
  once?: boolean;
  /** Fraction of the element that must be visible before revealing. */
  threshold?: number;
}

/**
 * Scroll-reveal wrapper. Adds `.is-visible` to its root when it enters the
 * viewport; descendants marked `.rise` (see value.css / shared reveal CSS)
 * transition in. Motion is entirely CSS — this component only toggles the flag.
 *
 * Follows the site's CSS-only motion convention (cf. `ScrollDownCta`): no
 * animation library. Falls back to visible-immediately when
 * `IntersectionObserver` is unavailable, and the CSS honours
 * `prefers-reduced-motion`, so content is never trapped hidden.
 */
export function Reveal({
  children,
  as: Tag = 'div',
  className = '',
  once = true,
  threshold = 0.15,
}: Props) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      // No IO (very old/degraded runtime): reveal on the next frame so content
      // is never trapped hidden. Deferred out of the effect body intentionally.
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          if (once) io.disconnect();
        } else if (!once) {
          setVisible(false);
        }
      },
      { threshold, rootMargin: '0px 0px -10% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [once, threshold]);

  return (
    <Tag ref={ref} className={`reveal${visible ? ' is-visible' : ''}${className ? ` ${className}` : ''}`}>
      {children}
    </Tag>
  );
}
