import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { hasIconFor, SERVICE_LINE_ICON } from '@/lib/service-icons';
import {
  getServiceBySlug,
  getServicesByCategory,
  getStoriesByService,
  getRelatedService,
  getSupportPlanBySlug,
  mapCategorySlug,
} from '@/lib/supabase/queries';
import { ServiceCard } from '@/components/marketing/ServiceCard';
import { LinkButton, HeroSplitImageCardOverlay, PricingCard, ServiceTag } from '@brikdesigns/bds';
import type { BlueprintSection } from '@brikdesigns/bds';
import { composeButtonClasses } from '@/lib/bds-button-classes';
import { defaultClientFacts, defaultMarketingTheme } from '@/lib/blueprint-helpers';
import { text, heading, label } from '@/lib/styles';
import { color } from '@/lib/tokens';
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

type Props = { params: Promise<{ categorySlug: string; serviceSlug: string }> };

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
  const { categorySlug, serviceSlug } = await params;

  let service;
  try {
    service = await getServiceBySlug(serviceSlug);
  } catch {
    notFound();
  }

  const category = service.service_lines;
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

  // Related services in same category (exclude current)
  const siblingServices = category?.id
    ? (await getServicesByCategory(category.id)).filter((s) => s.slug !== serviceSlug).slice(0, 3)
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

  // Resolve related service's category slug for URLs
  const relatedCatSlug = (() => {
    if (!relatedService?.service_lines) return categorySlug;
    const catData = relatedService.service_lines;
    if (Array.isArray(catData)) return catData[0]?.slug || categorySlug;
    return (catData as { slug: string }).slug || categorySlug;
  })();

  // Support plan — scoped to this service's plan
  let supportPlan = null;
  if (service.support_plan_slug) {
    try {
      supportPlan = await getSupportPlanBySlug(service.support_plan_slug);
    } catch {
      supportPlan = null;
    }
  }

  // Brand colors drive the audience cascade for the hero blueprint.
  // Supabase columns are the source of truth; inline CSS custom
  // properties override BDS tokens within the hero subtree without
  // hardcoding a `[data-audience='X']` rule set.
  //
  // - `--page-brand-primary` ← brand_color_light: the soft hero bg.
  // - `--text-brand-primary` ← brand_color_dark: the breadcrumb +
  //   accent text. The dark variant ensures WCAG AA contrast against
  //   the light audience bg (poppy on yellow fails 2.58:1; brand-dark
  //   on brand-light is the canonical legible pairing).
  const brandColorLight = category?.brand_color_light || null;
  const brandColorDark = category?.brand_color_dark || null;

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
      { label: category?.name || categorySlug, href: `/services/${categorySlug}` },
      { label: service.name },
    ],
    audience: mapCategorySlug(category?.slug || categorySlug),
    // Audience badge icon — Webflow shows a small SVG icon between the
    // breadcrumb and h1. Resolved from the static service-line icon set in
    // /public/icons/{category}/, so no per-record URL upload is needed and
    // the icon set comes from the canonical BDS-shipped art (theme handling
    // happens at the surrounding hero level).
    iconUrl: SERVICE_LINE_ICON[mapCategorySlug(category?.slug || categorySlug)],
    iconAlt: `${category?.name || categorySlug} icon`,
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
    <>
      {/* ═══ Hero ═══ */}
      <div
        style={
          {
            // Per-page audience-color cascade. brikdesigns globals don't
            // define audience-specific tokens; Supabase columns drive
            // them inline.
            //
            // Webflow truth on /service/{slug}:
            //   - hero bg: audience-LIGHT
            //   - h1 text: audience-DARK
            //   - "View Details" CTA: audience-DARK fill, white text
            //   - breadcrumb: brand-DARK (passes AA on audience-light)
            //   - price-card "Let's Talk": brand-primary poppy (universal)
            ...(brandColorLight && { '--page-brand-primary': brandColorLight }),
            ...(brandColorDark && { '--text-brand-primary': brandColorDark }),
            ...(brandColorDark && {
              // h1 + LinkButton variant="inverse" both pick up brand-dark
              '--bp-hero-img-card-headline-color': brandColorDark,
              '--background-inverse': brandColorDark,
              '--text-on-color-light': 'var(--color-grayscale-white)',
            }),
            // Match Webflow's hero rhythm
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

      {/* ═══ Pricing / Offerings ═══ */}
      {sortedOfferings.length > 0 && (
        <section id="pricing" className="content-section content-section--secondary">
          <div className="container-lg">
            <h2 style={{ ...heading.lg, textAlign: 'center', marginBottom: 'var(--gap-lg)' }}>
              Pricing Options
            </h2>
            <div className={`svc-detail-offerings ${sortedOfferings.length >= 3 ? 'svc-detail-offerings--grid' : ''}`}>
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
                // No-price offerings show "Quote" in the price slot (single
                // word, fits the heading-xl typography PricingCard renders).
                // The action button below carries the actual "contact for a
                // custom quote" CTA — the slot just needs to render *something*
                // typographically appropriate so the card doesn't look broken.
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
                      <LinkButton href="/contact" variant="primary" size="sm">
                        Let&apos;s Talk
                      </LinkButton>
                    }
                  />
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ═══ Related Customer Story ═══ */}
      {relatedStory && (
        <section className="content-section">
          <div className="container-lg">
            <h2 style={{ ...heading.md, textAlign: 'center', marginBottom: 'var(--gap-lg)' }}>
              Related Customer Story
            </h2>
            <Link
              href={`/customer-stories/${relatedStory.slug}`}
              className={`svc-detail-story-card${relatedStory.hero_image_url ? ' svc-detail-story-card--with-image' : ''}`}
            >
              {relatedStory.hero_image_url && (
                <div className="svc-detail-story-card__image">
                  <Image
                    src={relatedStory.hero_image_url}
                    alt={relatedStory.name || relatedStory.client_name}
                    width={400}
                    height={267}
                  />
                </div>
              )}
              <div className="svc-detail-story-content">
                <p style={{ ...label.smBold, color: color.text.brand }}>
                  We&apos;re more than a design studio&mdash;we&apos;re your strategic marketing partner.
                </p>
                <h3 style={heading.sm}>{relatedStory.name || relatedStory.client_name}</h3>
                {relatedStory.short_description && (
                  <p style={{ ...text.bodySm, color: color.text.secondary }}>{relatedStory.short_description}</p>
                )}
                <span className={composeButtonClasses({ variant: 'primary', size: 'sm' })} style={{ alignSelf: 'flex-start' }}>
                  Read Story
                </span>
              </div>
            </Link>
          </div>
        </section>
      )}

      {/* ═══ Recommended Add-On ═══ */}
      {relatedService && (
        <section className="content-section content-section--accent">
          <div className="container-lg">
            <h2 style={{ ...heading.md, textAlign: 'center', marginBottom: 'var(--gap-lg)' }}>
              Recommended Add-On Service
            </h2>
            <div className="svc-detail-addon-card">
              {relatedService.image_url && (
                <div className="svc-detail-addon-card__image">
                  <Image
                    src={relatedService.image_url}
                    alt={relatedService.name}
                    width={400}
                    height={400}
                  />
                </div>
              )}
              <div className="svc-detail-addon-card__content">
                <ServiceTag
                  category={mapCategorySlug(relatedCatSlug)}
                  {...(hasIconFor(mapCategorySlug(relatedCatSlug), relatedService.name)
                    ? { serviceName: relatedService.name }
                    : {})}
                  variant="icon-text"
                  label={relatedService.name}
                  size="md"
                />
                <h3 style={heading.sm}>{relatedService.name}</h3>
                {(relatedService.description || relatedService.tagline) && (
                  <p style={{ ...text.bodySm, color: color.text.secondary }}>
                    {relatedService.description || relatedService.tagline}
                  </p>
                )}
                <LinkButton
                  href={`/services/${relatedCatSlug}/${relatedService.slug}`}
                  variant="primary"
                  size="sm"
                >
                  Learn More
                </LinkButton>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ═══ Related Services ═══ */}
      {siblingServices.length > 0 && (
        <section className="content-section content-section--secondary">
          <div className="container-lg container-lg--comfortable">
            <h2 style={{ ...heading.md, textAlign: 'center', marginBottom: 'var(--gap-lg)' }}>
              Other {category?.name || ''} Services
            </h2>
            <div className="grid-3">
              {siblingServices.map((svc) => {
                const cat = mapCategorySlug(category?.slug || categorySlug);
                return (
                  <ServiceCard
                    key={svc.slug}
                    name={svc.name}
                    slug={svc.slug}
                    categorySlug={categorySlug}
                    category={cat}
                    tagline={svc.tagline}
                    description={svc.description}
                    imageUrl={svc.image_url}
                    iconServiceName={hasIconFor(cat, svc.name) ? svc.name : undefined}
                    showCta
                  />
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ═══ Monthly Support CTA ═══ */}
      {supportPlan && (
        <section className="content-section">
          <div className="container-lg">
            <div className="svc-detail-support-cta">
              <p style={{ ...label.smBold, color: color.text.brand }}>Want a partner to avoid the full-time hassle?</p>
              <h2 style={heading.md}>{supportPlan.name}</h2>
              <p style={{ ...text.bodySm, color: color.text.secondary }}>{supportPlan.description}</p>
              <LinkButton href={`/plans#${supportPlan.slug}`} variant="primary" size="sm">Learn More</LinkButton>
            </div>
          </div>
        </section>
      )}

      {/* ═══ Final CTA ═══ */}
      <section className="content-section content-section--secondary">
        <div className="container-lg">
          <div className="content-wrapper content-wrapper--center">
            <h2 style={{ ...heading.lg, textAlign: 'center' }}>Interested in {service.name}?</h2>
            <p style={{ ...text.body, color: color.text.secondary, textAlign: 'center' }}>Let&apos;s talk about what you need.</p>
            <div className="button-wrapper button-wrapper--center">
              <LinkButton href="/get-started" variant="primary" size="lg">Get Started</LinkButton>
              <LinkButton href="/contact" variant="outline" size="lg">Let&apos;s Talk</LinkButton>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
