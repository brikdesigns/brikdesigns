'use client';

import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface TypewriterTextProps {
  lines: string[];
  charDelay?: number;
  lineDelay?: number;
  style?: React.CSSProperties;
}

export function TypewriterText({
  lines,
  charDelay = 0.03,
  lineDelay = 0.4,
  style,
}: TypewriterTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!containerRef.current) return;
    const spans = containerRef.current.querySelectorAll('.tw-line');

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top 80%',
        once: true,
      },
    });

    spans.forEach((span) => {
      const text = span.textContent || '';
      span.textContent = '';
      const chars = text.split('');

      chars.forEach((char, i) => {
        tl.call(
          () => {
            span.textContent = (span.textContent || '') + char;
          },
          [],
          `+=${i === 0 ? lineDelay : charDelay}`
        );
      });
    });
  }, { scope: containerRef });

  return (
    <div ref={containerRef} style={style}>
      {lines.map((line, i) => (
        <span key={i} className="tw-line" style={{ display: 'block' }}>
          {line}
        </span>
      ))}
    </div>
  );
}
