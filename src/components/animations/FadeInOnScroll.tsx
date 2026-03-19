'use client';

import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface FadeInOnScrollProps {
  children: React.ReactNode;
  direction?: 'up' | 'down' | 'left' | 'right';
  delay?: number;
  duration?: number;
  stagger?: number;
  style?: React.CSSProperties;
  className?: string;
}

export function FadeInOnScroll({
  children,
  direction = 'up',
  delay = 0,
  duration = 0.8,
  style,
  className,
}: FadeInOnScrollProps) {
  const ref = useRef<HTMLDivElement>(null);

  const offsets = {
    up: { y: 40, x: 0 },
    down: { y: -40, x: 0 },
    left: { y: 0, x: 40 },
    right: { y: 0, x: -40 },
  };

  useGSAP(() => {
    if (!ref.current) return;
    const offset = offsets[direction];

    gsap.fromTo(
      ref.current,
      { opacity: 0, y: offset.y, x: offset.x },
      {
        opacity: 1,
        y: 0,
        x: 0,
        duration,
        delay,
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
    <div ref={ref} style={{ opacity: 0, ...style }} className={className}>
      {children}
    </div>
  );
}
