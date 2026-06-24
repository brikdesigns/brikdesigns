import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { hasIconFor } from '@/lib/service-icons';
import {
  getServiceBySlug,
  getServicesByServiceLine,
  getStoriesByService,
  getRelatedService,
  getSupportPlansByServiceId,
  getServiceCategories,
  getServices,
  resolveServiceTagCategory,
  mapServiceLineSlug,
} from '@/lib/supabase/queries';
import { GetStartedModalButton } from '@/components/marketing/GetStartedModalButton';
import { ServiceHeroModal } from './ServiceHeroModal';
import type { ServiceOption } from '@/components/marketing/ServiceMultiSelect';
import { routeSlugForServiceLine } from '@/lib/service-line-routes';
import {
  Card,
  CardDescription,
  CardFooter,
  CardGrid,
  CardTitle,
  Frame,
  Grid,
  Button,
  PricingCard,
  ServiceTag,
  Stack,
} from '@brikdesigns/bds';
import type { BlueprintSection } from '@brikdesigns/bds';
import { defaultClientFacts, defaultMarketingTheme } from '@/lib/blueprint-helpers';
import { text, heading } from '@/lib/styles';
import { color, serviceColor } from '@/lib/tokens';
import { ScrollDownCta } from '@/components/ui/ScrollDownCta';
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

  // Single-tier services have no pricing grid, so the hero "Let's Talk" CTA is
  // the only offering CTA — carry that one offering into the lead record,
  // formatted exactly like the multi-tier grid CTAs (#592/#595). Multi-tier and
  // no-offering services keep the hero CTA service-level (offering undefined).
  const heroOffering = (() => {
    if (sortedOfferings.length !== 1) return undefined;
    const off = sortedOfferings[0] as {
      name: string;
      base_price_cents: number | null;
      billing_frequency: string | null;
    };
    const priceDisplay = formatPrice(off.base_price_cents);
    const period = priceDisplay ? formatPeriod(off.billing_frequency) : undefined;
    // Price + frequency are carried separately so the lead-form summary card
    // can render them as `price • frequency`; they're rejoined into the lead
    // record on submit (#600).
    return {
      name: off.name,
      price: priceDisplay ?? undefined,
      frequency: period,
    };
  })();

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

  // The add-on card represents a *different* service line than this page (e.g.
  // business-card [brand] recommends layout-design [information]). Its CTA must
  // carry the add-on's own service-line color, not the page's — same per-card
  // pattern as the Other-Plans CTAs (#343/#570). Surface tint stays on the
  // page's band; only the button overrides `--background-brand-primary`. #569
  const relatedServiceTokens = serviceColor(mapServiceLineSlug(relatedServiceLineSlug));

  // Support plan — a service can belong to multiple plans (1:M plan→service via
  // service_plan_items); we render the highest-ranked one. Replaces the legacy
  // service.support_plan_slug denorm column (#206).
  const supportPlans = await getSupportPlansByServiceId(service.id).catch(() => []);
  const supportPlan = supportPlans[0] ?? null;

  // Resolve the support plan's *primary* service line for the bottom-CTA
  // illustration — distinct from this page's `serviceLine`. A plan can span
  // multiple lines (e.g. Marketing Support → Marketing + Information + Brand
  // services), so the CTA image must come from `service_plans.marketing_line_id`
  // (portal migration 00196), not the page's current line. PostgREST may
  // return the embed as object or array — defensive normalization mirrors
  // the relatedServiceLineSlug pattern above.
  const supportPlanMarketingLine = (() => {
    if (!supportPlan) return null;
    const raw = (supportPlan as { marketing_line?: unknown }).marketing_line;
    if (!raw) return null;
    if (Array.isArray(raw)) return (raw[0] as { slug: string | null; card_image_url: string | null; name: string | null } | undefined) ?? null;
    return raw as { slug: string | null; card_image_url: string | null; name: string | null };
  })();

  // The support-plan CTA carries the plan's *own* service-line color (its
  // marketing line), not this page's line — same per-card pattern as the add-on
  // and Other-Plans CTAs (#569/#343). #BRIK-WEB-47
  const supportPlanTokens = supportPlanMarketingLine?.slug
    ? serviceColor(mapServiceLineSlug(supportPlanMarketingLine.slug))
    : null;

  // Service-line tokens drive two scoped cascades:
  //   - Page-level: --text-brand-primary so eyebrows / breadcrumbs / accent
  //     copy across every section inherit the service-line text color.
  //   - Hero-only: --background-brand-primary so primary CTAs inside the
  //     hero render in the service-line inverse color (per brikdesigns#159).
  //     Scoping to the hero keeps Brik poppy on every CTA below.
  // BDS itself sets --bp-hero-img-card-* and --background-inverse on
  // `.bp-hero-img-card[data-audience]`, so those aren't repeated here
  // (brikdesigns#99 fix for the prior raw-hex bypass).
  //
  // `serviceLineKey` is the canonical BDS `ServiceLine` enum value
  // ('marketing' | 'brand' | 'information' | 'product' | 'back-office') —
  // distinct from `serviceLine` (the DB row above). It feeds `serviceColor()`
  // for `--{family}-service-{service-line}` token lookup and the BDS
  // `audience` prop / `data-audience` attribute (BDS-side naming; rename
  // to `service-line` tracked separately).
  const serviceLineKey = mapServiceLineSlug(serviceLine?.slug || serviceLineSlug);
  const serviceTokens = serviceColor(serviceLineKey);

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
    // Interior hero has no CTA — the "View Details"/#pricing scroll link was
    // removed (#384); pricing sits directly below the hero on the same page.
    cta: null,
    breadcrumb: [
      { label: 'Services', href: '/services' },
      { label: serviceLine?.name || serviceLineSlug, href: `/services/${serviceLineSlug}` },
      { label: service.name },
    ],
    audience: serviceLineKey,
    // Eyebrow icon — the BDS HeroSplitImageCardOverlay renders the canonical
    // `<ServiceTag variant="icon">` from the design system when `audience`
    // (BDS prop) is set and no `iconUrl` override is provided. That path
    // keeps the icon in sync with the rest of the site (ServiceTag uses the
    // same canonical art), so no per-record URL or static `/public/icons/`
    // lookup is needed. Per-service icon overrides remain a separate
    // discussion (would require a `services.service_tag_override` column).
    priceCard: service.image_url
      ? {
          imageUrl: service.image_url,
          imageAlt: service.name,
          ...(startingPrice && { priceLabel: 'Starting at', price: startingPrice }),
          cta: { label: "Let's Talk", url: '/contact', size: 'md' },
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

  // Service picker options for the Get Started modal, clustered by service
  // line (line rank → service rank), mirroring the /get-started page.
  const [allServiceLines, allServices] = await Promise.all([
    getServiceCategories(),
    getServices(),
  ]);
  const lineRank = new Map<string, number>(
    allServiceLines.map((l) => [l.id, l.rank ?? 0]),
  );
  const serviceOptions: ServiceOption[] = [...allServices]
    .sort(
      (a, b) =>
        (lineRank.get(a.service_line_id) ?? 99) -
          (lineRank.get(b.service_line_id) ?? 99) ||
        (a.rank ?? 0) - (b.rank ?? 0),
    )
    .map((s) => ({
      value: s.slug,
      label: s.name,
      category: resolveServiceTagCategory({
        slug: s.service_lines?.slug ?? s.slug,
      }),
    }));

  return (
    // Page-level cascade: service-line-colored accent text (eyebrows,
    // breadcrumbs, service tag copy). Stops short of --background-inverse on
    // purpose — canonical dark `--background-inverse` is reused by the
    // bottom support CTA band, and the hero's own CTA theming is scoped one
    // level deeper.
    //
    // `data-audience` activates BDS's `[data-audience='X'] .bds-breadcrumb`
    // cascade (brik-bds#781), tinting the current page label + slash
    // separators to match the service-line hue. (BDS-side rename of the
    // attribute name to `data-service-line` is tracked separately.)
    <div
      data-audience={serviceLineKey}
      style={
        {
          '--text-brand-primary': serviceTokens.text,
        } as React.CSSProperties
      }
    >
      {/* ═══ Hero ═══ */}
      <div
        className="page-hero-blueprint service-themed service-surface"
        data-scroll-hero
        style={
          {
            // Section-level service-line tint — use the `surface` family per
            // service-token-decision-tree.md (hero is a broad container, not
            // a small bounded component). The interior (service-detail) hero
            // uses the lighter `surfaceLight` ramp so it reads as one band with
            // the body sections below (#389 — interior hero matches body).
            backgroundColor: serviceTokens.surfaceLight,
            '--bp-hero-img-card-padding-y': 'var(--padding-huge)',
            // Service-line-colored primary CTAs inside the hero (View Details
            // + priceCard "Let's Talk"). BDS .bds-button--primary reads from
            // --background-brand-primary; scoping the override here keeps
            // sections below the hero on Brik poppy.
            '--background-brand-primary': serviceTokens.onLight,
          } as React.CSSProperties
        }
      >
        <ServiceHeroModal
          section={heroSection}
          clientFacts={defaultClientFacts}
          theme={defaultMarketingTheme}
          service={service.slug}
          serviceOptions={serviceOptions}
          offering={heroOffering}
          serviceLine={serviceLineKey}
          {...(service.image_url ? { imageUrl: service.image_url } : {})}
          {...(hasIconFor(serviceLineKey, service.name) ? { serviceName: service.name } : {})}
        />
        <ScrollDownCta />
      </div>

      {/* ═══ Pricing / Offerings ═══
       * Single-tier services already render the price inside the hero
       * priceCard — showing a one-card Pricing Options section below
       * duplicates the same number and diverges from the Webflow layout.
       * Multi-tier services still get the comparison grid.
       *
       * Tinted with the lighter `--surface-service-{line}-light` ramp so the
       * body reads as a paler band beneath the base-tint hero ("hero darker /
       * body lighter", MAY26 audit #389) — shared with Customer Story / Add-On
       * / Other Services below. BDS CardGrid spreads ...rest onto its <section>
       * root, so `style` lands on the actual section element.
       */}
      {sortedOfferings.length > 1 && (
        <CardGrid
          id="pricing"
          sectionKey="pricing"
          title="Pricing Options"
          className="service-themed service-surface"
          style={{ background: serviceTokens.surfaceLight, '--background-brand-primary': serviceTokens.onLight } as React.CSSProperties}
        >
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
              const period = priceDisplay ? formatPeriod(off.billing_frequency) : undefined;
              // No-price offerings show "Quote" in the price slot — single
              // word, fits PricingCard's heading-xl typography. The action
              // button carries the actual "contact for a custom quote" CTA.
              return (
                <PricingCard
                  key={off.slug}
                  title={off.name}
                  price={priceDisplay ?? 'Quote'}
                  period={period}
                  description={off.description ?? undefined}
                  features={parseFeatures(off.included_scope)}
                  highlighted={!!off.is_featured}
                  action={
                    <GetStartedModalButton
                      service={service.slug}
                      serviceOptions={serviceOptions}
                      // Carry the clicked tier into the lead record (#592).
                      // Price + frequency are split for the summary card's
                      // `price • frequency` rendering (#600); rejoined on submit.
                      offering={{
                        name: off.name,
                        price: priceDisplay ?? undefined,
                        frequency: period,
                      }}
                      serviceLine={serviceLineKey}
                      {...(service.image_url ? { imageUrl: service.image_url } : {})}
                      {...(hasIconFor(serviceLineKey, service.name) ? { serviceName: service.name } : {})}
                      label="Get Started"
                      size="md"
                    />
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
        <CardGrid
          sectionKey="story"
          title="Related Customer Story"
          className="service-themed service-surface"
          style={{ background: serviceTokens.surfaceLight, '--background-brand-primary': serviceTokens.onLight } as React.CSSProperties}
        >
          {/* elevated (not borderless): surface-primary fill + shadow keeps the
              row-card contained on the service tint — #427 (regression from #360). */}
          <Card variant="elevated" padding="lg">
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
       * Service-line tinted (same continuous band as Pricing + Customer
       * Story above, Other Services below). BDS CardGrid spreads ...rest
       * onto its <section> root — no extra wrapper needed.
       */}
      {relatedService && (
        <CardGrid
          sectionKey="addon"
          title="Recommended Add-On Service"
          className="service-themed service-surface"
          style={{ background: serviceTokens.surfaceLight, '--background-brand-primary': serviceTokens.onLight } as React.CSSProperties}
        >
          {/* elevated (not borderless): surface-primary fill + shadow keeps the
              row-card contained on the service tint — #427 (regression from #360). */}
          <Card variant="elevated" padding="lg">
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
                  size="sm"
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
                    href={`/services/${routeSlugForServiceLine(relatedServiceLineSlug)}/${relatedService.slug}`}
                    variant="primary"
                    size="md"
                    style={{ '--background-brand-primary': relatedServiceTokens.onLight } as React.CSSProperties}
                  >
                    Learn More
                  </Button>
                </CardFooter>
              </Stack>
            </Stack>
          </Card>
        </CardGrid>
      )}

      {/* ═══ Related Services ═══ */}
      {siblingServices.length > 0 && (
        <CardGrid
          sectionKey="other-services"
          title={`Other ${serviceLine?.name || ''} Services`.replace(/\s+/g, ' ').trim()}
          className="service-themed service-surface"
          style={{ background: serviceTokens.surfaceLight, '--background-brand-primary': serviceTokens.onLight } as React.CSSProperties}
        >
          <Grid columns={3} gap="lg">
            {siblingServices.map((svc) => {
              const cat = mapServiceLineSlug(serviceLine?.slug || serviceLineSlug);
              return (
                <Card
                  key={svc.slug}
                  preset="display"
                  variant="elevated"
                  className="service-sibling-card"
                  image={
                    svc.image_url ? (
                      <Frame customRatio="3 / 2" fit="contain" className="service-sibling-card__media">
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
       * Netlify-only duplicate and has been retired. Services with no row in
       * service_plan_items currently render no bottom CTA; backfill is a
       * portal /settings/plans data task.
       */}
      {supportPlan && (
        <section className="page-section">
          <div className="container-lg container-lg--comfortable">
            <div className="content-wrapper content-wrapper--center content-wrapper--narrow">
              <h2 style={{ ...heading.lg, textAlign: 'center' }}>Want a Partner to Avoid the Full-Time Hassle?</h2>
              <p style={{ ...text.body, color: color.text.secondary, textAlign: 'center' }}>
                We&apos;re more than a design studio—we&apos;re your strategic marketing partner.
              </p>
            </div>
            <div className="service-detail-support-grid">
              {supportPlan.image_url && (
                <div className="service-detail-support-grid__media">
                  <Image
                    src={supportPlan.image_url}
                    alt=""
                    fill
                    sizes="(max-width: 991px) 100vw, 45vw"
                    style={{ objectFit: 'contain' }}
                  />
                </div>
              )}
              <div className="service-detail-support-cta">
                {supportPlanMarketingLine?.card_image_url && (
                  <div className="service-detail-support-cta__media">
                    <Image
                      src={supportPlanMarketingLine.card_image_url}
                      alt={supportPlanMarketingLine.name ?? ''}
                      fill
                      sizes="180px"
                      style={{ objectFit: 'contain' }}
                    />
                  </div>
                )}
                <h3 style={{ ...heading.sm, textAlign: 'center' }}>{supportPlan.name}</h3>
                <p style={{ ...text.body, color: color.text.secondary, textAlign: 'center' }}>{supportPlan.description}</p>
                <Button
                  href={`/plans#${supportPlan.slug}`}
                  variant="primary"
                  size="md"
                  style={supportPlanTokens ? ({ '--background-brand-primary': supportPlanTokens.onLight } as React.CSSProperties) : undefined}
                >
                  Learn More
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
