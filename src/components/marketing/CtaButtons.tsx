'use client';

import Link from 'next/link';
import { Button } from '@brikdesigns/bds';
import { Badge } from '@brikdesigns/bds';

export function AnalysisCta() {
  return (
    <div style={{ textAlign: 'center' }}>
      <Badge status="info" size="lg">
        Free
      </Badge>
      <h2
        style={{
          fontFamily: 'var(--font-family-heading)',
          fontSize: 'var(--heading-lg)',
          color: 'var(--text-primary)',
          marginTop: 'var(--gap-md)',
        }}
      >
        Not sure what you need yet?
      </h2>
      <p
        style={{
          fontFamily: 'var(--font-family-body)',
          fontSize: 'var(--body-lg)',
          color: 'var(--text-secondary)',
          margin: 'var(--gap-md) auto 0',
          maxWidth: 560,
        }}
      >
        Start with a free marketing assessment. We&apos;ll review your brand,
        website, and online presence — then give you a clear plan.
      </p>
      <div style={{ marginTop: 'var(--gap-lg)' }}>
        <Link href="/free-marketing-analysis">
          <Button variant="primary" size="lg">
            Get Your Free Analysis
          </Button>
        </Link>
      </div>
    </div>
  );
}

export function BottomCta() {
  return (
    <div style={{ marginTop: 'var(--gap-lg)' }}>
      <Link href="/contact">
        <Button variant="inverse" size="lg">
          Let&apos;s Talk
        </Button>
      </Link>
    </div>
  );
}

export function ViewStoriesButton() {
  return (
    <div style={{ marginTop: 'var(--gap-lg)' }}>
      <Link href="/customer-stories">
        <Button variant="ghost">View All Stories</Button>
      </Link>
    </div>
  );
}
