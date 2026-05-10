import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  getServiceBySlug,
  getServicesByCategory,
  getStoriesByService,
  getRelatedService,
  getSupportPlanBySlug,
  mapCategorySlug,
} from '@/lib/supabase/queries';
import { ServiceBadgeLabel } from '@/components/marketing/ServiceBadgeLabel';
import { ServiceCard } from '@/components/marketing/ServiceCard';
import { LinkButton, HeroSplitImageCardOverlay } from '@brikdesigns/bds';
import type { BlueprintSection } from '@brikdesigns/bds';
import { composeButtonClasses } from '@/lib/bds-button-classes';
import { defaultClientFacts, defaultMarketingTheme } from '@/lib/blueprint-helpers';
import { text, heading, label } from '@/lib/styles';
import { color } from '@/lib/tokens';
import '../../../shared-sections.css';
import '../../services.css';

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
  const sortedOfferings = [...offerings].sort(
    (a: { tier_rank: number }, b: { tier_rank: number }) => (a.tier_rank || 0) - (b.tier_rank || 0)
  );
  const startingPrice = sortedOfferings.length > 0 ? sortedOfferings[0]?.price_display : null;

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
    // breadcrumb and h1, sourced from the parent service-line's
    // primary_badge_url column. BDS 0.64.0 added the iconUrl slot.
    iconUrl: category?.primary_badge_url ?? undefined,
    iconAlt: category?.name ? `${category.name} badge` : undefined,
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
              '--text-on-color-light': '#fff',
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
              {sortedOfferings.map((off: { slug: string; name: string; price_display: string; description: string; what_you_get: string; price_model?: string; icon_url?: string }) => (
                <div key={off.slug} className="svc-detail-offering-card">
                  <div className="svc-detail-offering-top">
                    {off.icon_url ? (
                      <Image src={off.icon_url} alt="" width={40} height={40} className="svc-detail-offering-icon" />
                    ) : (
                      <ServiceBadgeLabel
                        category={mapCategorySlug(category?.slug || categorySlug)}
                        serviceName={off.name}
                      />
                    )}
                    <h3 style={heading.sm}>{off.name}</h3>
                  </div>
                  {off.description && (
                    <p style={{ ...text.bodySm, color: color.text.secondary }}>{off.description}</p>
                  )}
                  <div className="svc-detail-offering-meta">
                    <div className="svc-detail-offering-price-row">
                      <span style={{ ...label.smBold, color: color.text.secondary }}>Price</span>
                      {off.price_display && (
                        <span style={{ ...heading.sm, color: color.text.brand }}>{off.price_display}</span>
                      )}
                    </div>
                    {off.price_model && (
                      <div className="svc-detail-offering-price-row">
                        <span style={{ ...label.smBold, color: color.text.secondary }}>Type</span>
                        <span style={label.smBold}>{off.price_model}</span>
                      </div>
                    )}
                  </div>
                  {off.what_you_get && (
                    <div className="svc-detail-offering-includes">
                      <span style={label.smBold}>What you get:</span>
                      <p style={{ ...text.bodySm, color: color.text.secondary }}>{off.what_you_get}</p>
                    </div>
                  )}
                  <LinkButton href="/contact" variant="primary" size="sm">
                    Let&apos;s Talk
                  </LinkButton>
                </div>
              ))}
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
                <ServiceBadgeLabel
                  category={mapCategorySlug(relatedCatSlug)}
                  serviceName={relatedService.name}
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
              {siblingServices.map((svc) => (
                <ServiceCard
                  key={svc.slug}
                  name={svc.name}
                  slug={svc.slug}
                  categorySlug={categorySlug}
                  category={mapCategorySlug(category?.slug || categorySlug)}
                  tagline={svc.tagline}
                  description={svc.description}
                  imageUrl={svc.image_url}
                  showCta
                />
              ))}
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
