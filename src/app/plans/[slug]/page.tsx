import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import {
  getSupportPlanBySlug,
  getOtherSupportPlans,
  mapCategorySlug,
} from '@/lib/supabase/queries';
import {
  Card,
  CardGrid,
  Frame,
  Grid,
  HeroSplitImageCardOverlay,
  LinkButton,
} from '@brikdesigns/bds';
import type { BlueprintSection } from '@brikdesigns/bds';
import { defaultClientFacts, defaultMarketingTheme } from '@/lib/blueprint-helpers';
import { color, serviceColor } from '@/lib/tokens';
import { heading, text, label } from '@/lib/styles';
import { hasIconFor, SERVICE_LINE_ICON } from '@/lib/service-icons';
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

interface PlanItemRow {
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

  const sl = plan.service_lines as { slug: string; name: string } | null;
  const audience = mapCategorySlug(sl?.slug ?? '');
  const audienceTokens = serviceColor(audience);

  const items = (plan.plan_items ?? []) as PlanItemRow[];
  const includedServices: IncludedService[] = items
    .filter((i): i is PlanItemRow & { service: NonNullable<PlanItemRow['service']> } =>
      i.service !== null,
    )
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((i) => {
      const lineSlug = i.service.service_lines?.slug ?? '';
      const category = mapCategorySlug(lineSlug);
      return {
        ...i.service,
        category,
        hasIcon: hasIconFor(category, i.service.name),
      };
    });

  const otherPlans = await getOtherSupportPlans(slug);

  // Hero mirrors services/[slug] — split column with priceCard overlay
  // driven by the same image source as the meganav + related-plans card.
  // The hero's own CTA lives inside the priceCard, so cta is null at the
  // section level (no duplicate "Get Started" buttons stacked).
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
    iconAlt: `${sl?.name || audience} icon`,
    priceCard: plan.image_url
      ? {
          imageUrl: plan.image_url,
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
       * Webflow layout: eyebrow "Get" + plan name h2 + plan's own description
       * + price + single Get Started button. Full-width tinted section, not a
       * card. Tint is the service-line surface so the CTA stays visually tied
       * to the audience cascade established at the page root.
       */}
      <section
        className="content-section"
        style={{ backgroundColor: audienceTokens.surface }}
      >
        <div className="container-lg container-lg--comfortable">
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
              <LinkButton
                href={`/get-started?plan=${plan.slug}`}
                variant="primary"
                size="lg"
              >
                Get Started
              </LinkButton>
            </div>
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
            {otherPlans.map((other) => (
              <Card
                key={other.slug}
                preset="display"
                image={
                  other.image_url ? (
                    <Frame customRatio="3 / 2" fit="cover">
                      <Image
                        src={other.image_url}
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
                  <LinkButton
                    href={`/plans/${other.slug}`}
                    variant="primary"
                    size="sm"
                  >
                    Learn More
                  </LinkButton>
                }
              />
            ))}
          </Grid>
        </CardGrid>
      )}
    </div>
  );
}
