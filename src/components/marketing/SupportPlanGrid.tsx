'use client';

import Link from 'next/link';
import { PricingCard } from '@brikdesigns/bds';
import { Button } from '@brikdesigns/bds';

interface SupportPlan {
  name: string;
  slug: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  highlighted?: boolean;
}

export function SupportPlanGrid({ items }: { items: SupportPlan[] }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: 'var(--gap-lg)',
      }}
    >
      {items.map((plan) => (
        <PricingCard
          key={plan.slug}
          title={plan.name}
          price={plan.price}
          period={plan.period}
          description={plan.description}
          features={plan.features}
          highlighted={plan.highlighted}
          action={
            <Link href={`/get-started?plan=${plan.slug}`}>
              <Button
                variant={plan.highlighted ? 'primary' : 'outline'}
                fullWidth
              >
                Get Started
              </Button>
            </Link>
          }
        />
      ))}
    </div>
  );
}
