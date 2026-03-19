'use client';

import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface StaggeredGridProps {
  children: React.ReactNode;
  stagger?: number;
  style?: React.CSSProperties;
  className?: string;
}

/**
 * Wraps a grid of children and staggers their fade-in on scroll.
 * Apply to the grid container — children animate in sequence.
 */
export function StaggeredGrid({
  children,
  stagger = 0.1,
  style,
  className,
}: StaggeredGridProps) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!ref.current) return;
    const items = ref.current.children;

    gsap.fromTo(
      items,
      { opacity: 0, y: 30 },
      {
        opacity: 1,
        y: 0,
        duration: 0.6,
        stagger,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: ref.current,
          start: 'top 85%',
          once: true,
        },
      }
    );
  }, { scope: ref });

  return (
    <div ref={ref} style={style} className={className}>
      {children}
    </div>
  );
}
