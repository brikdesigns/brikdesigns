'use client';

import { useState } from 'react';
import Image from 'next/image';
import { PricingCard } from '@bds/components/ui/PricingCard/PricingCard';
import { LinkButton } from '@bds/components/ui/Button/LinkButton';

interface Plan {
  name: string;
  slug: string;
  monthlyPrice: string;
  annualPrice: string | null;
  description: string;
  imageUrl: string | null;
  features: string[];
}

export function PlanCardGrid({ plans }: { plans: Plan[] }) {
  const [billing, setBilling] = useState<'monthly' | 'annually'>('monthly');

  return (
    <>
      {/* Billing toggle */}
      <div className="plans-toggle">
        <button
          className={`plans-toggle__btn ${billing === 'monthly' ? 'plans-toggle__btn--active' : ''}`}
          onClick={() => setBilling('monthly')}
        >
          Monthly
        </button>
        <button
          className={`plans-toggle__btn ${billing === 'annually' ? 'plans-toggle__btn--active' : ''}`}
          onClick={() => setBilling('annually')}
        >
          Annually
        </button>
      </div>

      <div className="grid-3">
        {plans.map((plan) => {
          const price = billing === 'annually' && plan.annualPrice
            ? plan.annualPrice
            : plan.monthlyPrice;
          const period = billing === 'annually' && plan.annualPrice
            ? '/year'
            : '/month';

          return (
            <div key={plan.slug} className="plans-card-wrapper">
              {plan.imageUrl && (
                <div className="plans-card-image">
                  <Image src={plan.imageUrl} alt={plan.name} width={400} height={400} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              )}
              <PricingCard
                title={plan.name}
                price={price}
                period={period}
                description={plan.description}
                features={plan.features.length > 0 ? plan.features : undefined}
                action={
                  <LinkButton href={`/get-started?plan=${plan.slug}`} variant="primary" size="md" style={{ width: '100%' }}>
                    Learn More
                  </LinkButton>
                }
              />
            </div>
          );
        })}
      </div>
    </>
  );
}
