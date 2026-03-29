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
import { LinkButton } from '@bds/components/ui/Button/LinkButton';
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
      description: service.tagline || service.marketing_description || undefined,
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

  // Brand colors for dynamic hero background
  const brandColorLight = category?.brand_color_light || null;
  const brandColorBase = category?.brand_color_base || null;
  const brandColorDark = category?.brand_color_dark || null;

  return (
    <>
      {/* ═══ Hero ═══ */}
      <section
        className="svc-detail-hero-section"
        style={brandColorLight ? { backgroundColor: brandColorLight } as React.CSSProperties : undefined}
      >
        <div className="page-hero__container">
          <p className="page-hero__breadcrumb">
            <Link href="/services">All Services</Link>
            {' / '}
            <Link href={`/services/${categorySlug}`}>{category?.name || categorySlug}</Link>
            {' / '}
            {service.name}
          </p>

          <div className="svc-detail-hero">
            <div className="svc-detail-hero__content">
              <ServiceBadgeLabel
                category={mapCategorySlug(category?.slug || categorySlug)}
                serviceName={service.name}
              />
              <h1 className="page-hero__title">{service.name}</h1>
              {service.tagline && (
                <p className="page-hero__description">{service.tagline}</p>
              )}
              <div className="button-wrapper">
                {sortedOfferings.length > 0 && (
                  <LinkButton href="#pricing" variant="primary" size="md">View Details</LinkButton>
                )}
                <LinkButton href="/contact" variant="outline" size="md">Let&apos;s Talk</LinkButton>
              </div>
            </div>

            {service.image_url && (
              <div className="svc-detail-hero__aside">
                <div
                  className="svc-detail-hero__image"
                  style={brandColorLight ? { backgroundColor: brandColorLight } as React.CSSProperties : undefined}
                >
                  <Image
                    src={service.image_url}
                    alt={service.name}
                    width={560}
                    height={560}
                    priority
                  />
                </div>
                {startingPrice && (
                  <div className="svc-detail-hero__price-card">
                    <span className="text-label-sm text--secondary">Starting at</span>
                    <span className="text-heading-lg text--brand">{startingPrice}</span>
                    <LinkButton href="/contact" variant="primary" size="sm">Let&apos;s Talk</LinkButton>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ═══ Pricing / Offerings ═══ */}
      {sortedOfferings.length > 0 && (
        <section id="pricing" className="content-section content-section--secondary">
          <div className="container-lg">
            <h2 className="text-heading-lg text--center" style={{ marginBottom: 'var(--gap-lg)' }}>
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
                    <h3 className="text-heading-sm">{off.name}</h3>
                  </div>
                  {off.description && (
                    <p className="text-body-sm text--secondary">{off.description}</p>
                  )}
                  <div className="svc-detail-offering-meta">
                    <div className="svc-detail-offering-price-row">
                      <span className="text-label-sm text--secondary">Price</span>
                      {off.price_display && (
                        <span className="text-heading-sm text--brand">{off.price_display}</span>
                      )}
                    </div>
                    {off.price_model && (
                      <div className="svc-detail-offering-price-row">
                        <span className="text-label-sm text--secondary">Type</span>
                        <span className="text-label-sm">{off.price_model}</span>
                      </div>
                    )}
                  </div>
                  {off.what_you_get && (
                    <div className="svc-detail-offering-includes">
                      <span className="text-label-sm">What you get:</span>
                      <p className="text-body-sm text--secondary">{off.what_you_get}</p>
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
            <h2 className="text-heading-md text--center" style={{ marginBottom: 'var(--gap-lg)' }}>
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
                <p className="text-label-sm text--brand">
                  We&apos;re more than a design studio&mdash;we&apos;re your strategic marketing partner.
                </p>
                <h3 className="text-heading-sm">{relatedStory.name || relatedStory.client_name}</h3>
                {relatedStory.short_description && (
                  <p className="text-body-sm text--secondary">{relatedStory.short_description}</p>
                )}
                <span className="bds-button bds-button--primary bds-button--sm" style={{ alignSelf: 'flex-start' }}>
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
            <h2 className="text-heading-md text--center" style={{ marginBottom: 'var(--gap-lg)' }}>
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
                <h3 className="text-heading-sm">{relatedService.name}</h3>
                {(relatedService.marketing_description || relatedService.tagline) && (
                  <p className="text-body-sm text--secondary">
                    {relatedService.marketing_description || relatedService.tagline}
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
            <h2 className="text-heading-md text--center" style={{ marginBottom: 'var(--gap-lg)' }}>
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
                  description={svc.marketing_description}
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
              <p className="text-label-sm text--brand">Want a partner to avoid the full-time hassle?</p>
              <h2 className="text-heading-md">{supportPlan.name}</h2>
              <p className="text-body-sm text--secondary">{supportPlan.description}</p>
              <LinkButton href={`/plans#${supportPlan.slug}`} variant="primary" size="sm">Learn More</LinkButton>
            </div>
          </div>
        </section>
      )}

      {/* ═══ Final CTA ═══ */}
      <section className="content-section content-section--secondary">
        <div className="container-lg">
          <div className="content-wrapper content-wrapper--center">
            <h2 className="text-heading-lg text--center">Interested in {service.name}?</h2>
            <p className="text-body-md text--secondary text--center">Let&apos;s talk about what you need.</p>
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
