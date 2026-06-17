'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Grid, PricingCard, SegmentedControl, Button } from '@brikdesigns/bds';
import { color, font, gap, serviceColor } from '@/lib/tokens';

interface Plan {
  name: string;
  slug: string;
  monthlyPrice: string;
  annualPrice: string | null;
  discountLabel: string | null;
  description: string;
  imageUrl: string | null;
  features: string[];
  serviceLineSlug: string | null;
}

export function PlanCardGrid({ plans }: { plans: Plan[] }) {
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: gap.xl }}>
        <SegmentedControl
          items={[
            { label: 'Monthly', value: 'monthly' },
            { label: 'Annually', value: 'annual' },
          ]}
          value={billing}
          onChange={(v) => setBilling(v as 'monthly' | 'annual')}
          size="lg"
        />
      </div>

      <Grid columns={3} gap="md">
        {plans.map((plan) => {
          const price =
            billing === 'annual' && plan.annualPrice ? plan.annualPrice : plan.monthlyPrice;
          const period =
            billing === 'annual' && plan.annualPrice ? '/year' : '/month';
          const svcTokens = plan.serviceLineSlug ? serviceColor(plan.serviceLineSlug) : null;

          return (
            <div key={plan.slug} className="plans-card-wrapper">
              {plan.imageUrl && (
                <div
                  className="plans-card-image"
                  style={svcTokens ? { backgroundColor: svcTokens.surface } : undefined}
                >
                  <Image
                    src={plan.imageUrl}
                    alt={plan.name}
                    width={400}
                    height={400}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
              )}
              <PricingCard
                title={plan.name}
                price={price}
                period={period}
                description={plan.description}
                features={plan.features.length > 0 ? plan.features : undefined}
                badge={
                  plan.discountLabel ? (
                    <span
                      style={{
                        color: color.system.green,
                        fontSize: font.size.label.sm,
                        fontWeight: font.weight.semibold,
                      }}
                    >
                      {plan.discountLabel}
                    </span>
                  ) : undefined
                }
                action={
                  <Button
                    href={`/plans/${plan.slug}`}
                    variant="primary"
                    size="md"
                    style={{ width: '100%' }}
                  >
                    Learn More
                  </Button>
                }
              />
            </div>
          );
        })}
      </Grid>
    </>
  );
}
