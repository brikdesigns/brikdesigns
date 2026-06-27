'use client';

import { useRef } from 'react';
import { Icon } from '@/lib/icon';

interface Props {
  label?: string;
}

export function ScrollDownCta({ label = 'Scroll' }: Props) {
  const ref = useRef<HTMLButtonElement>(null);

  const handleClick = () => {
    const hero = ref.current?.closest('[data-scroll-hero]') ?? ref.current?.closest('section');
    const next = hero?.nextElementSibling as HTMLElement | null;
    next?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <button
      ref={ref}
      className="scroll-down-cta"
      onClick={handleClick}
      aria-label="Scroll to next section"
      type="button"
    >
      <span className="scroll-down-cta__label">{label}</span>
      <Icon
        icon="ph:arrow-down"
        className="scroll-down-cta__icon"
        aria-hidden
      />
    </button>
  );
}
