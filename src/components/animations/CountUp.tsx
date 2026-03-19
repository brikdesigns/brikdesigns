'use client';

import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface CountUpProps {
  target: number;
  suffix?: string;
  duration?: number;
  style?: React.CSSProperties;
}

export function CountUp({ target, suffix = '', duration = 2, style }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useGSAP(() => {
    if (!ref.current) return;
    const obj = { val: 0 };

    gsap.to(obj, {
      val: target,
      duration,
      ease: 'power1.out',
      snap: { val: 1 },
      scrollTrigger: {
        trigger: ref.current,
        start: 'top 80%',
        once: true,
      },
      onUpdate: () => {
        if (ref.current) {
          ref.current.textContent = Math.round(obj.val).toLocaleString() + suffix;
        }
      },
    });
  }, { scope: ref });

  return <span ref={ref} style={style}>0{suffix}</span>;
}
