import type { Metadata } from 'next';
import Image from 'next/image';
import { Card, Cluster, ContentBlock, Stack } from '@brikdesigns/bds';
import { getSupportPlans, mapServiceLineSlug } from '@/lib/supabase/queries';
import { PLAN_IMAGE_OVERRIDES } from '@/lib/plan-image-overrides';
import { PlanCardGrid } from './PlanCardGrid';
import { GetStartedModalButton } from '@/components/marketing/GetStartedModalButton';
import { ScrollDownCta } from '@/components/ui/ScrollDownCta';
import { color, font, serviceColor, serviceCtaVars } from '@/lib/tokens';
import { heading, text } from '@/lib/styles';
import '../shared-sections.css';
import './plans.css';

export const metadata: Metadata = {
  title: 'Support Plans | Monthly Marketing & Design Subscriptions',
  description: 'Monthly subscription plans for ongoing marketing, design, and back-office support — without the cost of full-time hires.',
};

export const revalidate = 3600;

export default async function PlansPage() {
  const rawPlans = await getSupportPlans();

  const plans = rawPlans.map((plan) => {
    const sl = plan.service_lines as { slug: string } | null;
    // Prefer the plan's marketing-line illustration (card_image_url) over its
    // own marketing image (#454). PostgREST returns the embed as object or
    // array — normalize both. Falls back to plan.image_url when unset.
    const rawLine = (plan as { display_line?: unknown }).display_line;
    const displayLine = Array.isArray(rawLine)
      ? (rawLine[0] as { slug: string | null; card_image_url: string | null } | undefined) ?? null
      : (rawLine as { slug: string | null; card_image_url: string | null } | null);
    // The plan's driving service line is its display_line (portal 00196, renamed by 00339) —
    // `getSupportPlans` embeds only that, not the plan's own service_line_id, so
    // `service_lines` is null here. Source the card tint + CTA color from the
    // marketing line, matching the plan detail page (audienceTokens). #BRIK-WEB-47
    const lineSlug = displayLine?.slug ?? sl?.slug ?? null;
    return {
      name: plan.name,
      slug: plan.slug,
      monthlyPrice: plan.monthly_price_display || 'Contact',
      annualPrice: plan.annual_price_display || null,
      discountLabel: plan.discount_label || null,
      description: plan.description || '',
      // Per-plan override wins over the line illustration (single source, #467).
      imageUrl: PLAN_IMAGE_OVERRIDES[plan.slug] ?? displayLine?.card_image_url ?? plan.image_url ?? null,
      features: [] as string[],
      serviceLineSlug: lineSlug ? mapServiceLineSlug(lineSlug) : null,
    };
  });

  // Product Support is pulled out of the pricing grid and given its own
  // service-themed feature section below (mirrors the plan-detail CTA panel).
  const gridPlans = plans.filter((p) => p.slug !== 'product-support');
  const productPlan = plans.find((p) => p.slug === 'product-support') ?? null;
  const productTokens = serviceColor('product');

  return (
    <>
      {/* Hero */}
      <section className="page-hero">
        <div className="page-hero__container">
          <h1 className="page-hero__title">Support Plans</h1>
          <p className="page-hero__description">
            Get an experienced, done-for-you team to manage your marketing, back-office
            systems, or product design — without the cost of full-time hires.
          </p>
        </div>
        <ScrollDownCta />
      </section>

      {/* Plan cards */}
      <section className="page-section">
        <div className="container-lg container-lg--comfortable">
          <PlanCardGrid plans={gridPlans} />
        </div>
      </section>

      {/* ═══ Product Design Support ═══
       * Product retainer promoted out of the grid into its own section — the
       * same two-column service-CTA panel used on the plan detail page
       * (plan-cta-panel), themed with the product line's purple tokens. The
       * `service-themed plan-detail-ctas` wrapper carries the service-CTA
       * cascade (globals.css / plans.css) so the Get Started button clears AA
       * in both themes. */}
      {productPlan && (
        <section
          data-section="product-support"
          className="page-section service-themed plan-detail-ctas"
          style={
            {
              // Canonical service-CTA cascade (brikdesigns#1001) — deep `onLight`
              // fill + white label; the `Get Started` hero primary reads it. The
              // `--background-inverse` keeps any inverse-variant CTA on the pale
              // `bg` fill (retained `.plan-detail-ctas .bds-button--inverse` rule).
              ...serviceCtaVars('product'),
              '--background-inverse': productTokens.bg,
            } as React.CSSProperties
          }
        >
          <div className="container-lg container-lg--comfortable">
            <div
              className="plan-cta-panel"
              style={{ backgroundColor: productTokens.surfaceLight }}
            >
              {productPlan.imageUrl && (
                <div className="plan-cta-panel__media">
                  <Image
                    src={productPlan.imageUrl}
                    alt=""
                    fill
                    sizes="(max-width: 991px) 100vw, 45vw"
                    style={{ objectFit: 'contain' }}
                  />
                </div>
              )}
              <Card
                variant="elevated"
                padding="lg"
                className="plan-cta-panel__card"
                style={{ backgroundColor: productTokens.inverse, '--service-cta-fill-dark': productTokens.onDark, '--service-cta-ink-dark': productTokens.text } as React.CSSProperties}
              >
                <Stack align="center" style={{ textAlign: 'center' }}>
                  <ContentBlock
                    size="md"
                    titleAs="h2"
                    title={<>Get {productPlan.name}</>}
                    {...(productPlan.description ? { description: productPlan.description } : {})}
                  />
                  {productPlan.monthlyPrice && (
                    <div
                      className="plan-cta-panel__price service-surface"
                      style={{ backgroundColor: productTokens.surfaceLight }}
                    >
                      <p style={{ ...heading.md, fontSize: font.size.display.md, color: productTokens.text, textAlign: 'center', margin: 0 }}>
                        {productPlan.monthlyPrice}
                      </p>
                      <p style={{ ...text.bodySm, color: color.text.secondary, textAlign: 'center', margin: 0 }}>
                        per month
                      </p>
                    </div>
                  )}
                  <Cluster gap="md" justify="center">
                    <GetStartedModalButton
                      plan={productPlan.slug}
                      planName={productPlan.name}
                      serviceLine="product"
                      {...(productPlan.description ? { description: productPlan.description } : {})}
                    />
                  </Cluster>
                </Stack>
              </Card>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
