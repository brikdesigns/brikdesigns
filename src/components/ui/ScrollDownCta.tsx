'use client';

import { useRef } from 'react';
import { Icon } from '@iconify/react';

interface Props {
  label?: string;
}

export function ScrollDownCta({ label = 'Scroll' }: Props) {
  const ref = useRef<HTMLButtonElement>(null);

  const handleClick = () => {
    const section = ref.current?.closest('section');
    const next = section?.nextElementSibling as HTMLElement | null;
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
