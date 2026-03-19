'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SegmentedControl } from '@bds/components/ui/SegmentedControl/SegmentedControl';
import { PricingCard } from '@bds/components/ui/PricingCard/PricingCard';
import { Button } from '@bds/components/ui/Button/Button';
import { Badge } from '@bds/components/ui/Badge/Badge';

interface Plan {
  name: string;
  slug: string;
  monthlyPrice: string;
  annualPrice: string;
  description: string;
  features: string[];
  discount?: string;
  highlighted?: boolean;
}

export function PlanTabs({ plans }: { plans: Plan[] }) {
  const [billing, setBilling] = useState('monthly');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--gap-xl)' }}>
        <SegmentedControl
          items={[
            { label: 'Monthly', value: 'monthly' },
            { label: 'Annually', value: 'annual' },
          ]}
          value={billing}
          onChange={setBilling}
          size="lg"
        />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 'var(--gap-lg)',
        }}
      >
        {plans.map((plan) => (
          <PricingCard
            key={plan.slug}
            title={plan.name}
            price={billing === 'monthly' ? plan.monthlyPrice : plan.annualPrice}
            period={billing === 'monthly' ? '/month' : '/year'}
            description={plan.description}
            features={plan.features}
            highlighted={plan.highlighted}
            badge={
              billing === 'annual' && plan.discount ? (
                <Badge status="positive" size="sm">{plan.discount}</Badge>
              ) : undefined
            }
            action={
              <Link href={`/get-started?plan=${plan.slug}&billing=${billing}`}>
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
    </div>
  );
}
