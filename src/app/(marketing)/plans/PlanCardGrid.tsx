'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Grid, PricingCard, SegmentedControl, Button } from '@brikdesigns/bds';
import { font, gap, serviceColor } from '@/lib/tokens';

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
  /** is_featured — PricingCard's highlighted/recommended treatment. */
  highlighted?: boolean;
  /** CTA label; defaults to "Learn More" (the /plans list-page behaviour). */
  ctaLabel?: string;
  /** CTA href; defaults to the plan detail route `/plans/{slug}`. */
  ctaHref?: string;
}

export function PlanCardGrid({
  plans,
  columns = 3,
}: {
  plans: Plan[];
  /** Fixed grid column count. Defaults to 3 (the /plans list page); the plan
   *  detail page passes 2 for its narrower tier grid. */
  columns?: 2 | 3;
}) {
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

      <Grid columns={columns} gap="md">
        {plans.map((plan) => {
          const price =
            billing === 'annual' && plan.annualPrice ? plan.annualPrice : plan.monthlyPrice;
          const period =
            billing === 'annual' && plan.annualPrice ? '/year' : '/month';
          const svcTokens = plan.serviceLineSlug ? serviceColor(plan.serviceLineSlug) : null;

          return (
            <div key={plan.slug} className="plans-card-wrapper">
              {plan.imageUrl && (
                <div className="plans-card-wrapper__media">
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
                highlighted={plan.highlighted}
                badge={
                  plan.discountLabel ? (
                    <span
                      className="plans-discount-badge"
                      style={{
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
                    href={plan.ctaHref ?? `/plans/${plan.slug}`}
                    variant="primary"
                    size="md"
                    style={{
                      width: '100%',
                      ...(svcTokens ? { '--background-brand-primary': svcTokens.onLight } : {}),
                    } as React.CSSProperties}
                  >
                    {plan.ctaLabel ?? 'Learn More'}
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
