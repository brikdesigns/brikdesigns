'use client';

import Link from 'next/link';
import { Button } from '@bds/components/ui/Button/Button';

export function HeroButtons() {
  return (
    <div
      style={{
        marginTop: 'var(--gap-xl)',
        display: 'flex',
        gap: 'var(--gap-md)',
        justifyContent: 'center',
        flexWrap: 'wrap',
      }}
    >
      <Link href="/services">
        <Button variant="primary" size="lg">
          Explore Design Services
        </Button>
      </Link>
      <Link href="/contact">
        <Button variant="inverse" size="lg">
          Let&apos;s Talk
        </Button>
      </Link>
    </div>
  );
}
