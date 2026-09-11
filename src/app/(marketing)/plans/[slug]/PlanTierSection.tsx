'use client';

import { useState } from 'react';
import { Button, Card, SectionHeader, SegmentedControl, type ServiceLine } from '@brikdesigns/bds';
import { GetStartedModalButton } from '@/components/marketing/GetStartedModalButton';
import { serviceCtaVars } from '@/lib/tokens';

/** A `section-type` card, pre-resolved on the server from `service_plan_tiers`. */
export interface PlanTier {
  name: string;
  slug: string;
  monthlyPrice: string;
  annualPrice: string | null;
  description: string;
  /** `who_executes` — the line under the price ("Your team executes."). */
  whoExecutes: string | null;
  ctaLabel: string;
  /**
   * Service-line accent. The two engagement modes are asymmetric BY DESIGN —
   * Advisory takes `brand`, Managed takes `back-office` (Figma `26144:9107` /
   * `26144:9108`). Same two-family split #1304 landed on the /plans index, and
   * the same `accent` vocabulary its `ENGAGEMENT_MODES` uses.
   */
  accent: 'brand' | 'back-office';
}

/**
 * `section-type` (Figma `26144:9099`) plus the monthly/annual control that
 * precedes it.
 *
 * The control and the cards are ONE component because they share billing
 * state, but they render as two siblings: #1371's delta row 4 moves the toggle
 * out of the card grid to sit after `section-details`, so the page order is
 * … → details → toggle → type → …. Keeping them in one client component is
 * what lets the toggle live outside the tinted band while still driving it.
 */
export function PlanTierSection({
  tiers,
  bandSurface,
  headerTitle,
  headerDescription,
  brikdownHref,
  planSlug,
  planName,
  serviceLine,
}: {
  tiers: PlanTier[];
  /** Section band fill — the pale back-office tint Figma binds on this frame. */
  bandSurface: string;
  headerTitle: string;
  headerDescription: string;
  brikdownHref: string;
  /** Plan slug carried into the lead record when a tier CTA opens the modal. */
  planSlug: string;
  /** Plan display name for the lead callout / hidden field. */
  planName: string;
  /**
   * The plan's service line — drives the lead modal's showcase-panel tint and
   * fallback glyph, matching the service pricing-grid modal. No `serviceOptions`
   * is passed, so the modal omits the "Services you're interested in" picker
   * (support plans preselect the plan, not a service).
   */
  serviceLine: ServiceLine;
}) {
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');
  const hasAnnual = tiers.some((t) => t.annualPrice);

  return (
    <>
      {/* Delta row 4 — the toggle keeps its /plans behaviour but moves here,
          between section-details and section-type. Hidden outright when no tier
          authored an annual figure, so single-price plans show no dead control. */}
      {hasAnnual && (
        <div className="plan-billing-toggle">
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
      )}

      {/* `.service-surface` carries the tinted-band card chrome (shadow, no
          border) and the dark on-band text pin; the fill is set inline from the
          token bundle. Figma draws a 3px border on these cards, but chrome is
          derived from the BAND, never the mockup — card-treatment.md, and the
          /plans index already ships this same Figma frame (26103:10983) on the
          same rule. */}
      <section
        className="page-section service-surface plan-tier-section"
        data-section="engagement-modes"
        style={{ backgroundColor: bandSurface }}
      >
        <div className="container-lg container-lg--comfortable">
          <div className="pricing-header pricing-header--top">
            <SectionHeader align="start" title={headerTitle} description={headerDescription} />
            <Button href={brikdownHref} variant="primary" size="lg">
              Get your free BrikDown
            </Button>
          </div>

          <div className="plan-tier-grid">
            {tiers.map((tier) => {
              const price =
                billing === 'annual' && tier.annualPrice ? tier.annualPrice : tier.monthlyPrice;
              const period = billing === 'annual' && tier.annualPrice ? '/year' : '/month';

              return (
                <Card
                  key={tier.slug}
                  padding="lg"
                  className="plan-tier-card"
                  data-accent={tier.accent}
                >
                  <div className="plan-tier-card__content">
                    <p className="plan-tier-card__title">{tier.name}</p>
                    {/* Price and period are SIBLINGS, not nested. axe resolves a
                        nested inline's backdrop to its parent's text colour, so a
                        <span> inside the coloured price figure is measured against
                        that colour rather than the card surface — it reported 1.36:1
                        when the period carried its own ink and 1:1 when it inherited.
                        Flattening the pair makes each measure against the card. */}
                    <p className="plan-tier-card__amount">
                      <span className="plan-tier-card__price">{price}</span>
                      <span className="plan-tier-card__period">{period}</span>
                    </p>
                    {tier.whoExecutes && (
                      <p className="plan-tier-card__who">{tier.whoExecutes}</p>
                    )}
                  </div>
                  {tier.description && (
                    <p className="plan-tier-card__description">{tier.description}</p>
                  )}
                  {/* Per-tier CTA in that tier's own accent, not the page's —
                      the canonical service-CTA bundle (brikdesigns#1001). The
                      wrapper carries `service-themed` for the hover/focus and
                      dark-mode cascade the bundle's pairing contract requires. */}
                  <div className="service-themed" style={serviceCtaVars(tier.accent)}>
                    {/* Opens the shared lead-capture modal (the service
                        pricing-grid pattern), preselecting this plan + the
                        clicked tier as the offering. No `serviceOptions`, so the
                        "Services you're interested in" picker is omitted — the
                        plan is the selection here, not a service. */}
                    <GetStartedModalButton
                      plan={planSlug}
                      planName={planName}
                      offering={{ name: tier.name, price, frequency: period }}
                      serviceLine={serviceLine}
                      label={tier.ctaLabel}
                      size="md"
                    />
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
