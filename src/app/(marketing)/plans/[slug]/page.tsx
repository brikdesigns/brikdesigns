import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import {
  getSupportPlanBySlug,
  getOtherSupportPlans,
  mapServiceLineSlug,
} from '@/lib/supabase/queries';
import {
  Button,
  Card,
  CardGrid,
  Frame,
  Grid,
  HeroSplitImageCardOverlay,
} from '@brikdesigns/bds';
import type { BlueprintSection } from '@brikdesigns/bds';
import { GetStartedModalButton } from '@/components/marketing/GetStartedModalButton';
import { defaultClientFacts, defaultMarketingTheme } from '@/lib/blueprint-helpers';
import { color, serviceColor } from '@/lib/tokens';
import { heading, text, label } from '@/lib/styles';
import { hasIconFor, SERVICE_LINE_ICON } from '@/lib/service-icons';
import { planImage } from '@/lib/plan-images';
import { PlanIncludedServices, type IncludedService } from './PlanIncludedServices';
import { ScrollDownCta } from '@/components/ui/ScrollDownCta';
import '../../shared-sections.css';
import '../plans.css';

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const plan = await getSupportPlanBySlug(slug);
    return {
      title: `${plan.name} | Support Plans`,
      description: plan.description ?? undefined,
    };
  } catch {
    return { title: 'Plan Not Found' };
  }
}

interface ServicePlanItemRow {
  sort_order: number | null;
  service: {
    slug: string;
    name: string;
    description: string | null;
    image_url: string | null;
    service_lines: { slug: string; name: string } | null;
  } | null;
}

export default async function PlanDetailPage({ params }: Props) {
  const { slug } = await params;

  let plan;
  try {
    plan = await getSupportPlanBySlug(slug);
  } catch {
    notFound();
  }

  const items = (plan.service_plan_items ?? []) as ServicePlanItemRow[];
  const sortedItems = items
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const seenServices = new Map<string, IncludedService>();
  for (const item of sortedItems) {
    const svc = item.service;
    if (!svc || seenServices.has(svc.slug)) continue;
    const lineSlug = svc.service_lines?.slug ?? '';
    const category = mapServiceLineSlug(lineSlug);
    seenServices.set(svc.slug, {
      ...svc,
      category,
      hasIcon: hasIconFor(category, svc.name),
    });
  }
  const includedServices: IncludedService[] = Array.from(seenServices.values());

  // Prefer the authoritative marketing_line_id FK for visual identity —
  // the same column getOtherSupportPlans uses on the /plans list page.
  // PostgREST may return embedded FK rows as object or array; normalize both.
  const rawMarketingLine = (plan as { marketing_line?: unknown }).marketing_line;
  const marketingLine = Array.isArray(rawMarketingLine)
    ? (rawMarketingLine[0] as { slug: string; name: string } | undefined) ?? null
    : (rawMarketingLine as { slug: string; name: string } | null);

  // Fall back to dominant-included-line heuristic when marketing_line_id is unset.
  const lineCounts = new Map<string, number>();
  for (const svc of includedServices) {
    const slug = svc.service_lines?.slug ?? '';
    lineCounts.set(slug, (lineCounts.get(slug) ?? 0) + 1);
  }
  let dominantLineSlug = includedServices[0]?.service_lines?.slug ?? '';
  let maxCount = 0;
  for (const [slug, count] of lineCounts) {
    if (count > maxCount) { maxCount = count; dominantLineSlug = slug; }
  }
  const dominantLineName =
    includedServices.find((s) => s.service_lines?.slug === dominantLineSlug)?.service_lines?.name ?? '';

  const audience = mapServiceLineSlug(marketingLine?.slug ?? dominantLineSlug);
  const audienceTokens = serviceColor(audience);
  const firstLineName = marketingLine?.name ?? dominantLineName;

  const otherPlans = await getOtherSupportPlans(slug);

  // Hero mirrors services/[slug] — split column with priceCard overlay
  // driven by the same image source as the meganav + related-plans card
  // (planImage lookup keyed by slug). The hero's own CTA lives inside the
  // priceCard, so cta is null at the section level (no duplicate "Get Started"
  // buttons stacked).
  const heroImage = planImage(plan.slug);
  const heroSection: BlueprintSection = {
    sectionKey: `hero-${plan.slug}`,
    sectionType: 'hero',
    heading: plan.name,
    subheading: null,
    body: plan.description ?? null,
    cta: null,
    breadcrumb: [
      { label: 'Support Plans', href: '/plans' },
      { label: plan.name },
    ],
    audience,
    iconUrl: SERVICE_LINE_ICON[audience],
    iconAlt: `${firstLineName || audience} icon`,
    priceCard: heroImage
      ? {
          imageUrl: heroImage,
          imageAlt: plan.name,
          ...(plan.monthly_price_display && {
            priceLabel: 'Per month',
            price: plan.monthly_price_display,
          }),
          // Hero CTA stays a nav link: the BDS hero blueprint's `priceCard.cta`
          // is url-only (no onClick), so it can't open the modal the cta-panel
          // button does (#401). Tracked in brik-bds#843 — swap to the modal once
          // the blueprint gains an action affordance. The standalone route is
          // the fallback target regardless.
          // `size: 'md'` opts into the priceCard.cta size hook added in
          // @brikdesigns/bds@0.95.0 (brik-bds#869); blueprint default is `sm`.
          cta: { label: 'Get Started', url: `/get-started?plan=${plan.slug}`, size: 'md' },
        }
      : undefined,
    visualNotes: {
      blueprintKey: 'hero_split_image_card_overlay',
      moodKeywords: [],
      layoutBlueprint: 'hero_split_image_card_overlay',
      imageOpportunity: null,
      animationSuggestion: null,
      illustrationOpportunity: null,
    },
    items: [],
  };

  return (
    <div
      style={
        {
          '--background-inverse': audienceTokens.inverse,
          '--text-brand-primary': audienceTokens.text,
        } as React.CSSProperties
      }
    >
      {/* ═══ Hero ═══ */}
      <div
        className="page-hero-blueprint"
        data-scroll-hero
        style={
          {
            '--bp-hero-img-card-padding-y': 'var(--padding-huge)',
            // Section-level service-line tint — `surface` family, pale `-light`
            // tone per service-token-decision-tree.md Q2 (the hero is a broad
            // container; pale surface pairs with darkest on-light text at AAA,
            // brik-bds#838). Mirrors the now-pale services/[slug] hero (#389)
            // so all interior heros read as one continuous surface band; the
            // BDS blueprint card defers to this via the
            // `.page-hero-blueprint .bp-hero-img-card` override in
            // shared-sections.css (no two-tone seam). (#408)
            backgroundColor: audienceTokens.surfaceLight,
          } as React.CSSProperties
        }
      >
        <HeroSplitImageCardOverlay
          section={heroSection}
          clientFacts={defaultClientFacts}
          theme={defaultMarketingTheme}
          showServiceTag={false}
        />
        <ScrollDownCta />
      </div>

      {/* ═══ What You Get ═══ */}
      {includedServices.length > 0 && (
        <PlanIncludedServices services={includedServices} />
      )}

      {/* ═══ CTA — two-column support-plan panel (Webflow parity) ═══
       * Surface-service-tinted panel carrying the plan's marketing
       * illustration on the left and a neutral price/CTA card on the right.
       * Panel tone is the dominant service-line pale `surfaceLight` tint
       * (matches the hero band above, #408); the inner elevated card stays
       * neutral so the price + button read as the focal element (mirrors the
       * live Webflow support-plan CTA).
       */}
      <section className="page-section">
        <div className="container-lg container-lg--comfortable">
          <div
            className="plan-cta-panel"
            style={{ backgroundColor: audienceTokens.surfaceLight }}
          >
            {heroImage && (
              <div className="plan-cta-panel__media">
                <Image
                  src={heroImage}
                  alt=""
                  fill
                  sizes="(max-width: 991px) 100vw, 45vw"
                  style={{ objectFit: 'contain' }}
                />
              </div>
            )}
            <Card variant="elevated" padding="lg" className="plan-cta-panel__card">
              <div className="content-wrapper content-wrapper--center">
                <p style={{ ...label.smBold, color: audienceTokens.text }}>Get</p>
                <h2 style={{ ...heading.lg, textAlign: 'center' }}>{plan.name}</h2>
                {plan.description && (
                  <p
                    style={{
                      ...text.body,
                      color: color.text.secondary,
                      textAlign: 'center',
                    }}
                  >
                    {plan.description}
                  </p>
                )}
                {plan.monthly_price_display && (
                  <div className="plan-cta-panel__price">
                    <p style={{ ...heading.md, color: audienceTokens.text, textAlign: 'center', margin: 0 }}>
                      {plan.monthly_price_display}
                    </p>
                    <p style={{ ...text.bodySm, color: color.text.secondary, textAlign: 'center', margin: 0 }}>
                      per month
                    </p>
                  </div>
                )}
                <div className="button-wrapper button-wrapper--center">
                  <GetStartedModalButton plan={plan.slug} planName={plan.name} />
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* ═══ Other Support Plans ═══
       * Simple image + title + description + Learn More — matches Webflow.
       * No price / no PricingCard chrome (those are reserved for the /plans
       * list page where prices are part of the selling proposition).
       */}
      {otherPlans.length > 0 && (
        <CardGrid sectionKey="other-plans" title="Other Support Plans">
          <Grid columns={3} gap="lg">
            {otherPlans.map((other) => {
              const otherImage = planImage(other.slug);
              // Plain surface-primary cards — the per-plan service tint (#397)
              // was removed per staging review (backlog #278 / #482); the cards
              // now use the default display-preset fill in both themes.
              return (
              <Card
                key={other.slug}
                preset="display"
                image={
                  otherImage ? (
                    <Frame customRatio="3 / 2" fit="contain" className="illustration-media-bg">
                      <Image
                        src={otherImage}
                        alt={other.name}
                        width={400}
                        height={267}
                      />
                    </Frame>
                  ) : undefined
                }
                title={other.name}
                description={other.description ?? undefined}
                action={
                  <Button href={`/plans/${other.slug}`} variant="primary" size="md">
                    Learn More
                  </Button>
                }
              />
              );
            })}
          </Grid>
        </CardGrid>
      )}
    </div>
  );
}
