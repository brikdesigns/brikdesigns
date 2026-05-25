import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { hasIconFor, SERVICE_LINE_ICON } from '@/lib/service-icons';
import {
  getServiceBySlug,
  getServicesByServiceLine,
  getStoriesByService,
  getRelatedService,
  getSupportPlansByServiceId,
  mapServiceLineSlug,
} from '@/lib/supabase/queries';
import {
  Card,
  CardDescription,
  CardFooter,
  CardGrid,
  CardTitle,
  Frame,
  Grid,
  HeroSplitImageCardOverlay,
  Button,
  PricingCard,
  ServiceTag,
  Stack,
} from '@brikdesigns/bds';
import type { BlueprintSection } from '@brikdesigns/bds';
import { defaultClientFacts, defaultMarketingTheme } from '@/lib/blueprint-helpers';
import { text, heading } from '@/lib/styles';
import { color, serviceColor } from '@/lib/tokens';
import '../../../shared-sections.css';
import '../../services.css';

// Derive marketing-display strings from the portal's canonical operational
// columns. We render whatever the portal admin / Stripe sync wrote — no
// separate display strings stored on the marketing side, no drift.
function formatPrice(cents: number | null | undefined): string | null {
  if (cents == null) return null;
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

// Short period suffix for the PricingCard `period` slot. Designed to read
// next to the price (e.g., "$1,500 /month"). `one_time` returns null so the
// price stands alone — no awkward "/one-time" suffix.
const PERIOD_SUFFIXES: Record<string, string | null> = {
  one_time: null,
  monthly: '/month',
  quarterly: '/quarter',
  // Stripe sync may emit `yearly` as an alias for `annual`. Both map to the
  // same display — the admin form writes `annual` canonically.
  annual: '/year',
  yearly: '/year',
  hourly: '/hour',
};

function formatPeriod(
  billingFrequency: string | null | undefined,
): string | undefined {
  const key = (billingFrequency ?? '').toLowerCase();
  if (!key) return undefined;
  return PERIOD_SUFFIXES[key] ?? `/${key.replace(/_/g, ' ')}`;
}

// Split the operator-authored "What you get" block (one item per line) into
// individual feature strings for the PricingCard checklist. Empty lines and
// stray indentation are trimmed; bullet-prefix glyphs and numeric markers
// (•, -, –, —, *, >, ✓, ✗, ◦, "1.", "2)") are stripped so operators can paste
// lists from Google Docs / Notion / Word without leading glyphs leaking
// through. Unrecognised prefix characters render verbatim — fine for
// operator-authored copy, but new bullet styles may need to be added here.
function parseFeatures(includedScope: string | null | undefined): string[] | undefined {
  if (!includedScope) return undefined;
  const items = includedScope
    .split('\n')
    .map((line) =>
      line.replace(/^\s*(?:[•\-–—*>✓✗◦]|\d+[.)])\s*/, '').trim()
    )
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

type Props = { params: Promise<{ serviceLineSlug: string; serviceSlug: string }> };

export const revalidate = 86400;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { serviceSlug } = await params;
  try {
    const service = await getServiceBySlug(serviceSlug);
    return {
      title: `${service.name} | Design Services`,
      description: service.tagline || service.description || undefined,
    };
  } catch {
    return { title: 'Service Not Found' };
  }
}

export default async function ServiceDetailPage({ params }: Props) {
  const { serviceLineSlug, serviceSlug } = await params;

  let service;
  try {
    service = await getServiceBySlug(serviceSlug);
  } catch {
    notFound();
  }

  const serviceLine = service.service_lines;
  const offerings = service.offerings?.filter((o: { is_public: boolean }) => o.is_public) || [];
  // Cheapest first. base_price_cents is the canonical price column owned by
  // the portal admin (mirrors the Stripe price); marketing-display strings
  // are derived from it on the fly. Ties on price break by `rank` — the
  // column the brikdesigns admin form writes — so operator edits propagate
  // to the public order. (Don't use `sort_order`: it's a legacy column
  // seeded from the Webflow CSV's `tier_rank` and is not editable from this
  // admin.)
  const sortedOfferings = [...offerings].sort(
    (a: { base_price_cents: number | null; rank: number | null },
     b: { base_price_cents: number | null; rank: number | null }) => {
      const ap = a.base_price_cents ?? Number.POSITIVE_INFINITY;
      const bp = b.base_price_cents ?? Number.POSITIVE_INFINITY;
      if (ap !== bp) return ap - bp;
      return (a.rank ?? 0) - (b.rank ?? 0);
    }
  );
  const startingPrice = sortedOfferings.length > 0
    ? formatPrice(sortedOfferings[0]?.base_price_cents)
    : null;

  // Related services in same service line (exclude current)
  const siblingServices = serviceLine?.id
    ? (await getServicesByServiceLine(serviceLine.id)).filter((s) => s.slug !== serviceSlug).slice(0, 3)
    : [];

  // Customer story — scoped to this service
  const relatedStories = service.has_customer_story
    ? await getStoriesByService(serviceSlug)
    : [];
  const relatedStory = relatedStories[0] || null;

  // Recommended add-on — from related_service_slug
  const relatedService = service.related_service_slug
    ? await getRelatedService(service.related_service_slug)
    : null;

  // Resolve related service's service-line slug for URLs
  const relatedServiceLineSlug = (() => {
    if (!relatedService?.service_lines) return serviceLineSlug;
    const lineData = relatedService.service_lines;
    if (Array.isArray(lineData)) return lineData[0]?.slug || serviceLineSlug;
    return (lineData as { slug: string }).slug || serviceLineSlug;
  })();

  // Support plan — M:N via service_supported_plans; replaces service.support_plan_slug (#206)
  const supportPlans = await getSupportPlansByServiceId(service.id).catch(() => []);
  const supportPlan = supportPlans[0] ?? null;

  // Audience tokens drive two scoped cascades:
  //   - Page-level: --text-brand-primary so eyebrows / breadcrumbs / accent
  //     copy across every section inherit the service-line text color.
  //   - Hero-only: --background-brand-primary so primary CTAs inside the
  //     hero render in the audience inverse color (per brikdesigns#159).
  //     Scoping to the hero keeps Brik poppy on every CTA below.
  // BDS itself sets --bp-hero-img-card-* and --background-inverse on
  // `.bp-hero-img-card[data-audience]`, so those aren't repeated here
  // (brikdesigns#99 fix for the prior raw-hex bypass).
  const audience = mapServiceLineSlug(serviceLine?.slug || serviceLineSlug);
  const audienceTokens = serviceColor(audience);

  const heroSection: BlueprintSection = {
    sectionKey: `hero-${service.slug}`,
    sectionType: 'hero',
    heading: service.name,
    // Live Webflow service detail pages render an icon-only eyebrow
    // (no text label). Setting subheading null suppresses the wrong
    // "INFORMATION DESIGN" text the blueprint would otherwise emit.
    // Audience-keyed icon support is tracked in brik-bds#500.
    subheading: null,
    // `service.description` is the long body paragraph (sentences).
    // `service.tagline` is the mega-menu hover string (3-5 words);
    // not the right field for the hero body.
    body: service.description ?? null,
    cta:
      sortedOfferings.length > 0
        ? { label: 'View Details', url: '#pricing' }
        : null,
    breadcrumb: [
      { label: 'All Services', href: '/services' },
      { label: serviceLine?.name || serviceLineSlug, href: `/services/${serviceLineSlug}` },
      { label: service.name },
    ],
    audience,
    // Audience badge icon — Webflow shows a small SVG icon between the
    // breadcrumb and h1. Resolved from the static service-line icon set in
    // /public/icons/{category}/, so no per-record URL upload is needed and
    // the icon set comes from the canonical BDS-shipped art (theme handling
    // happens at the surrounding hero level).
    iconUrl: SERVICE_LINE_ICON[audience],
    iconAlt: `${serviceLine?.name || serviceLineSlug} icon`,
    priceCard: service.image_url
      ? {
          imageUrl: service.image_url,
          imageAlt: service.name,
          ...(startingPrice && { priceLabel: 'Starting at', price: startingPrice }),
          cta: { label: "Let's Talk", url: '/contact' },
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
    // Page-level cascade: audience-colored accent text (eyebrows, breadcrumbs,
    // service tag copy). Stops short of --background-inverse on purpose —
    // canonical dark `--background-inverse` is reused by the bottom support
    // CTA band, and the hero's own CTA theming is scoped one level deeper.
    <div
      style={
        {
          '--text-brand-primary': audienceTokens.text,
        } as React.CSSProperties
      }
    >
      {/* ═══ Hero ═══ */}
      <div
        style={
          {
            // Match Webflow's hero vertical rhythm — only override needed
            // beyond what [data-audience] already handles in BDS.
            '--bp-hero-img-card-padding-y': 'clamp(5rem, 8vw, 8rem)',
            // Audience-colored primary CTAs inside the hero (View Details
            // + priceCard "Let's Talk"). BDS .bds-button--primary reads from
            // --background-brand-primary; scoping the override here keeps
            // sections below the hero on Brik poppy.
            '--background-brand-primary': audienceTokens.inverse,
          } as React.CSSProperties
        }
      >
        <HeroSplitImageCardOverlay
          section={heroSection}
          clientFacts={defaultClientFacts}
          theme={defaultMarketingTheme}
        />
      </div>

      {/* ═══ Pricing / Offerings ═══
       * Single-tier services already render the price inside the hero
       * priceCard — showing a one-card Pricing Options section below
       * duplicates the same number and diverges from the Webflow layout.
       * Multi-tier services still get the comparison grid.
       */}
      {sortedOfferings.length > 1 && (
        <CardGrid id="pricing" sectionKey="pricing" title="Pricing Options">
          <Grid columns={3} gap="lg">
            {sortedOfferings.map((off: {
              slug: string;
              name: string;
              description: string | null;
              base_price_cents: number | null;
              billing_frequency: string | null;
              included_scope: string | null;
              is_featured: boolean | null;
            }) => {
              const priceDisplay = formatPrice(off.base_price_cents);
              // No-price offerings show "Quote" in the price slot — single
              // word, fits PricingCard's heading-xl typography. The action
              // button carries the actual "contact for a custom quote" CTA.
              return (
                <PricingCard
                  key={off.slug}
                  title={off.name}
                  price={priceDisplay ?? 'Quote'}
                  period={priceDisplay ? formatPeriod(off.billing_frequency) : undefined}
                  description={off.description ?? undefined}
                  features={parseFeatures(off.included_scope)}
                  highlighted={!!off.is_featured}
                  action={
                    <Button href="/contact" variant="primary" size="md">
                      Let&apos;s Talk
                    </Button>
                  }
                />
              );
            })}
          </Grid>
        </CardGrid>
      )}

      {/* ═══ Related Customer Story ═══
       * Pattern parity with the Recommended Add-On section below: the Card
       * itself is non-interactive (no `href`, no `interactive`); the only
       * click target is the explicit <Button> in the footer. Avoids the
       * "whole card is the link" anti-pattern that prior agents shipped via
       * #105/#107 (asymmetric with the sibling Add-On block in the same file).
       */}
      {relatedStory && (
        <CardGrid sectionKey="story" title="Related Customer Story">
          <Card padding="lg">
            <Stack direction="horizontal" gap="lg" align="center">
              {relatedStory.hero_image_url && (
                <div style={{ flex: '0 0 40%' }}>
                  <Frame customRatio="3 / 2" fit="cover">
                    <Image
                      src={relatedStory.hero_image_url}
                      alt={relatedStory.name || relatedStory.client_name}
                      width={400}
                      height={267}
                    />
                  </Frame>
                </div>
              )}
              <Stack direction="vertical" gap="sm" style={{ flex: 1 }}>
                <CardTitle>{relatedStory.name || relatedStory.client_name}</CardTitle>
                {relatedStory.short_description && (
                  <CardDescription>{relatedStory.short_description}</CardDescription>
                )}
                <CardFooter>
                  <Button
                    href={`/customer-stories/${relatedStory.slug}`}
                    variant="primary"
                    size="md"
                  >
                    Read Story
                  </Button>
                </CardFooter>
              </Stack>
            </Stack>
          </Card>
        </CardGrid>
      )}

      {/* ═══ Recommended Add-On ═══
       * Webflow wraps this section in a category-tinted band; reproduce that
       * via the canonical `--surface-service-{audience}` token. Surface (not
       * background) per the service-token decision tree — this is a section,
       * not a small component.
       */}
      {relatedService && (
        <section style={{ background: audienceTokens.surface }}>
        <CardGrid sectionKey="addon" title="Recommended Add-On Service">
          <Card padding="lg">
            <Stack direction="horizontal" gap="lg" align="center">
              {relatedService.image_url && (
                <div style={{ flex: '0 0 35%' }}>
                  <Frame ratio="square" fit="cover">
                    <Image
                      src={relatedService.image_url}
                      alt={relatedService.name}
                      width={400}
                      height={400}
                    />
                  </Frame>
                </div>
              )}
              <Stack direction="vertical" gap="sm" style={{ flex: 1 }}>
                <ServiceTag
                  category={mapServiceLineSlug(relatedServiceLineSlug)}
                  {...(hasIconFor(mapServiceLineSlug(relatedServiceLineSlug), relatedService.name)
                    ? { serviceName: relatedService.name }
                    : {})}
                  variant="icon-text"
                  label={relatedService.name}
                  size="md"
                  style={{ alignSelf: 'flex-start' }}
                />
                <CardTitle>{relatedService.name}</CardTitle>
                {(relatedService.description || relatedService.tagline) && (
                  <CardDescription>
                    {relatedService.description || relatedService.tagline}
                  </CardDescription>
                )}
                <CardFooter>
                  <Button
                    href={`/services/${relatedServiceLineSlug}/${relatedService.slug}`}
                    variant="primary"
                    size="md"
                  >
                    Learn More
                  </Button>
                </CardFooter>
              </Stack>
            </Stack>
          </Card>
        </CardGrid>
        </section>
      )}

      {/* ═══ Related Services ═══ */}
      {siblingServices.length > 0 && (
        <CardGrid
          sectionKey="other-services"
          title={`Other ${serviceLine?.name || ''} Services`.replace(/\s+/g, ' ').trim()}
        >
          <Grid columns={3} gap="lg">
            {siblingServices.map((svc) => {
              const cat = mapServiceLineSlug(serviceLine?.slug || serviceLineSlug);
              return (
                <Card
                  key={svc.slug}
                  preset="display"
                  image={
                    svc.image_url ? (
                      <Frame customRatio="3 / 2" fit="contain" className="svc-sibling-card__media">
                        <Image
                          src={svc.image_url}
                          alt={svc.name}
                          width={400}
                          height={267}
                        />
                      </Frame>
                    ) : undefined
                  }
                  tag={
                    <ServiceTag
                      category={cat}
                      {...(hasIconFor(cat, svc.name) ? { serviceName: svc.name } : {})}
                      variant="icon-text"
                      label={svc.name}
                      size="sm"
                    />
                  }
                  title={svc.name}
                  description={svc.description || svc.tagline || undefined}
                  action={
                    <Button
                      href={`/services/${serviceLineSlug}/${svc.slug}`}
                      variant="primary"
                      size="md"
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

      {/* ═══ Monthly Support CTA — bottom CTA pattern (parity #159) ═══
       * Webflow's bottom CTA is a single dark band carrying the support-plan
       * card. The previous "Interested in {service}?" final CTA was a
       * Netlify-only duplicate and has been retired. Services missing a
       * support_plan_slug currently render no bottom CTA; backfill tracked
       * in the brikdesigns CMS audit (#114 followup).
       */}
      {supportPlan && (
        <section className="content-section">
          <div className="container-lg container-lg--comfortable">
            <div className="content-wrapper content-wrapper--center content-wrapper--narrow">
              <h2 style={{ ...heading.md, textAlign: 'center' }}>Want a partner to avoid the full-time hassle?</h2>
              <p style={{ ...text.body, color: color.text.secondary, textAlign: 'center' }}>
                We&apos;re more than a design studio—we&apos;re your strategic marketing partner.
              </p>
            </div>
            <div className="svc-detail-support-grid">
              {supportPlan.image_url && (
                <div className="svc-detail-support-grid__media">
                  <Image
                    src={supportPlan.image_url}
                    alt=""
                    fill
                    sizes="(max-width: 991px) 100vw, 45vw"
                    style={{ objectFit: 'contain' }}
                  />
                </div>
              )}
              <div className="svc-detail-support-cta">
                {serviceLine?.card_image_url && (
                  <div className="svc-detail-support-cta__media">
                    <Image
                      src={serviceLine.card_image_url}
                      alt={serviceLine.name ?? ''}
                      fill
                      sizes="180px"
                      style={{ objectFit: 'contain' }}
                    />
                  </div>
                )}
                <h3 style={{ ...heading.sm, textAlign: 'center' }}>{supportPlan.name}</h3>
                <p style={{ ...text.bodySm, color: color.text.secondary, textAlign: 'center' }}>{supportPlan.description}</p>
                <Button href={`/plans#${supportPlan.slug}`} variant="primary" size="md">Learn More</Button>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
