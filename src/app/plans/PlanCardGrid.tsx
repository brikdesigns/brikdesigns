'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { SegmentedControl } from '@bds/components/ui/SegmentedControl/SegmentedControl';

interface Plan {
  name: string;
  slug: string;
  monthlyPrice: string;
  annualPrice: string | null;
  description: string;
  imageUrl: string | null;
  brandColorBase: string;
}

export function PlanCardGrid({ plans }: { plans: Plan[] }) {
  const [billing, setBilling] = useState('monthly');

  return (
    <>
      {/* BDS SegmentedControl for Monthly / Annually toggle */}
      <SegmentedControl
        items={[
          { label: 'Monthly', value: 'monthly' },
          { label: 'Annually', value: 'annually' },
        ]}
        value={billing}
        onChange={setBilling}
        size="lg"
      />

      {/* 3-col grid of plan cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--gap-lg)', width: '100%' }}>
        {plans.map((plan) => {
          const price = billing === 'annually' && plan.annualPrice
            ? plan.annualPrice
            : plan.monthlyPrice;
          const period = billing === 'annually' && plan.annualPrice
            ? 'Per year'
            : 'Per month';

          return (
            <div
              key={plan.slug}
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                background: 'var(--surface-primary)',
                borderRadius: 'var(--border-radius-lg)',
                padding: 'var(--padding-md)',
                gap: 'var(--gap-lg)',
                border: '1px solid var(--border-secondary)',
              }}
            >
              {/* Image frame (1:1) */}
              {plan.imageUrl && (
                <div style={{ aspectRatio: '1', borderRadius: 'var(--border-radius-md)', overflow: 'hidden', background: 'var(--surface-secondary)' }}>
                  <Image
                    src={plan.imageUrl}
                    alt={plan.name}
                    width={400}
                    height={400}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
              )}

              {/* Price + plan name + description */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--padding-sm)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-tiny)' }}>
                  <span className="text-heading-lg">{price}</span>
                  <span className="text-body-md text--secondary">{period}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span className="text-heading-sm">{plan.name}</span>
                  <span className="text-body-md">{plan.description}</span>
                </div>
              </div>

              {/* Button — brand BASE color per plan */}
              <div style={{ display: 'flex' }}>
                <Link
                  href={`/category/${plan.slug}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 'var(--padding-sm) var(--padding-lg)',
                    borderRadius: 'var(--border-radius-md)',
                    backgroundColor: plan.brandColorBase,
                    color: 'var(--text-on-color-dark)',
                    fontFamily: 'var(--font-family-label)',
                    fontSize: 'var(--label-md)',
                    fontWeight: 'var(--font-weight--semi-bold)',
                    textDecoration: 'none',
                  }}
                >
                  Learn More
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
