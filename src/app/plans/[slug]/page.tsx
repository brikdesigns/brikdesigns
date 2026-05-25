import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import {
  getSupportPlanBySlug,
  getOtherSupportPlans,
  mapServiceLineSlug,
} from '@/lib/supabase/queries';
import {
  Card,
  CardGrid,
  Frame,
  Grid,
  HeroSplitImageCardOverlay,
  Button,
} from '@brikdesigns/bds';
import type { BlueprintSection } from '@brikdesigns/bds';
import { defaultClientFacts, defaultMarketingTheme } from '@/lib/blueprint-helpers';
import { color, serviceColor } from '@/lib/tokens';
import { heading, text, label } from '@/lib/styles';
import { hasIconFor, SERVICE_LINE_ICON } from '@/lib/service-icons';
import { planImage } from '@/lib/plan-images';
import { PlanIncludedServices, type IncludedService } from './PlanIncludedServices';
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

  // Derive service-line audience from included services — service_plans has no
  // service_line_id (plans span lines by design). Most common line wins to avoid
  // a single out-of-order item driving the wrong service-line color.
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
  const audience = mapServiceLineSlug(dominantLineSlug);
  const audienceTokens = serviceColor(audience);
  const firstLineName = dominantLineName;

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
          cta: { label: 'Get Started', url: `/get-started?plan=${plan.slug}` },
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
        style={
          {
            '--bp-hero-img-card-padding-y': 'clamp(5rem, 8vw, 8rem)',
          } as React.CSSProperties
        }
      >
        <HeroSplitImageCardOverlay
          section={heroSection}
          clientFacts={defaultClientFacts}
          theme={defaultMarketingTheme}
        />
      </div>

      {/* ═══ What You Get ═══ */}
      {includedServices.length > 0 && (
        <PlanIncludedServices services={includedServices} />
      )}

      {/* ═══ CTA ═══
       * Tinted section (surfaceLight) with a Card inset — lighter background
       * keeps the service-line palette tied to the audience while the Card
       * provides a clear focal surface for the pricing call-to-action.
       */}
      <section
        className="content-section"
        style={{ backgroundColor: audienceTokens.surfaceLight }}
      >
        <div className="container-lg container-lg--comfortable">
          <Card variant="outlined" padding="lg" style={{ maxWidth: '640px', margin: '0 auto' }}>
            <div className="content-wrapper content-wrapper--center">
              <p style={{ ...label.smBold, color: audienceTokens.text }}>Get</p>
              <h2 style={{ ...heading.lg, textAlign: 'center' }}>{plan.name}</h2>
              {plan.description && (
                <p
                  style={{
                    ...text.bodyLg,
                    color: color.text.secondary,
                    textAlign: 'center',
                    maxWidth: '560px',
                  }}
                >
                  {plan.description}
                </p>
              )}
              {plan.monthly_price_display && (
                <p
                  style={{
                    ...heading.md,
                    color: audienceTokens.text,
                    textAlign: 'center',
                  }}
                >
                  {plan.monthly_price_display}
                  <span style={{ ...text.bodyLg, color: color.text.secondary }}>
                    {' '}
                    /month
                  </span>
                </p>
              )}
              <div className="button-wrapper button-wrapper--center">
                <Button
                  href={`/get-started?plan=${plan.slug}`}
                  variant="primary"
                  size="lg"
                >
                  Get Started
                </Button>
              </div>
            </div>
          </Card>
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
                  <Button
                    href={`/plans/${other.slug}`}
                    variant="primary"
                    size="sm"
                  >
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
