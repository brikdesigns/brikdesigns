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
import { ServiceBadge } from '@/components/marketing/ServiceBadgeClient';
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
      description: service.description || undefined,
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
  const bdsCat = mapCategorySlug(category?.slug || categorySlug);
  const offerings = service.offerings?.filter((o: { active: boolean }) => o.active) || [];
  const sortedOfferings = [...offerings].sort(
    (a: { sort_order: number }, b: { sort_order: number }) => (a.sort_order || 0) - (b.sort_order || 0)
  );
  const startingPrice = sortedOfferings.length > 0
    ? `$${(sortedOfferings[0]?.base_price_cents / 100).toLocaleString()}`
    : null;

  const siblingServices = category?.id
    ? (await getServicesByCategory(category.id)).filter((s) => s.slug !== serviceSlug).slice(0, 3)
    : [];

  const relatedStories = service.has_customer_story
    ? await getStoriesByService(serviceSlug)
    : [];
  const relatedStory = relatedStories[0] || null;

  const relatedService = service.related_service_slug
    ? await getRelatedService(service.related_service_slug)
    : null;

  const relatedCatSlug = (() => {
    if (!relatedService?.service_lines) return categorySlug;
    const catData = relatedService.service_lines;
    if (Array.isArray(catData)) return catData[0]?.slug || categorySlug;
    return (catData as { slug: string }).slug || categorySlug;
  })();

  let supportPlan = null;
  if (service.support_plan_slug) {
    try {
      supportPlan = await getSupportPlanBySlug(service.support_plan_slug);
    } catch {
      supportPlan = null;
    }
  }

  const heroImageUrl = service.image_url || category?.hero_image_url || null;

  // Brand color triplet — drives all section theming
  const colorLight = category?.brand_color_light || '#f1f0ec';
  const colorBase = category?.brand_color_base || '#828282';
  const colorDark = category?.brand_color_dark || '#1b1b1b';

  // CSS custom properties for brand theming
  const brandVars = {
    '--svc-light': colorLight,
    '--svc-base': colorBase,
    '--svc-dark': colorDark,
  } as React.CSSProperties;

  return (
    <div style={brandVars}>
      {/* ═══ 1. Hero ═══ */}
      <section className="svc-hero" style={{ backgroundColor: colorLight }}>
        <div className="container-lg">
          {/* Breadcrumb */}
          <div className="svc-hero__breadcrumb">
            <Link href="/services" className="text-body-lg" style={{ color: colorDark }}>
              All Services
            </Link>
            <span className="text-body-lg" style={{ color: colorDark }}>/</span>
            <Link href={`/services/${categorySlug}`} className="text-body-lg" style={{ color: colorDark }}>
              {category?.name || categorySlug}
            </Link>
            <span className="text-body-lg" style={{ color: colorBase }}>/</span>
            <span className="text-body-lg" style={{ color: colorBase }}>{service.name}</span>
          </div>

          {/* Hero 2-col grid */}
          <div className="svc-hero__grid">
            {/* Left: content */}
            <div className="svc-hero__content">
              {/* Badge — large, secondary SVG */}
              <div className="svc-hero__badge">
                {service.secondary_badge_url ? (
                  <Image src={service.secondary_badge_url} alt="" width={64} height={64} />
                ) : (
                  <ServiceBadge category={bdsCat} serviceName={service.name} size="lg" />
                )}
              </div>

              <h1 className="text-display-sm" style={{ color: colorDark }}>{service.name}</h1>

              {service.description && (
                <p className="text-body-huge" style={{ color: colorDark }}>{service.description}</p>
              )}

              <div className="button-wrapper">
                {sortedOfferings.length > 0 && (
                  <LinkButton
                    href="#pricing"
                    variant="primary"
                    size="md"
                    style={{ backgroundColor: colorDark, color: colorLight }}
                  >
                    View Details
                  </LinkButton>
                )}
                <LinkButton
                  href="/contact"
                  variant="primary"
                  size="md"
                  style={{ backgroundColor: colorDark, color: colorLight }}
                >
                  Let&apos;s Talk
                </LinkButton>
              </div>
            </div>

            {/* Right: image + price card */}
            {heroImageUrl && (
              <div className="svc-hero__aside">
                <div className="svc-hero__image-frame">
                  <Image
                    src={heroImageUrl}
                    alt={service.name}
                    width={560}
                    height={560}
                    priority
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
                {startingPrice && (
                  <div className="svc-hero__price-card">
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

      {/* ═══ 2. Pricing / Offerings ═══ */}
      {sortedOfferings.length > 0 && (
        <section id="pricing" className="svc-section" style={{ backgroundColor: colorLight }}>
          <div className="container-lg">
            <h2 className="text-heading-lg text--center" style={{ color: colorDark }}>
              Pricing Options
            </h2>
            <div className="svc-offerings-grid">
              {sortedOfferings.map((off: { slug: string; name: string; price_display: string; description: string; what_you_get: string; price_model?: string; icon_url?: string; service_line_id?: string }) => (
                <div key={off.slug} className="svc-offering-card">
                  {/* Badge icon */}
                  <div className="svc-offering-card__header">
                    {service.primary_badge_url ? (
                      <Image src={service.primary_badge_url} alt="" width={40} height={40} className="svc-offering-card__icon" />
                    ) : (
                      <ServiceBadge category={bdsCat} serviceName={service.name} size="lg" />
                    )}
                  </div>

                  {/* Title + description */}
                  <div className="svc-offering-card__content">
                    <h3 className="text-heading-sm">{off.name}</h3>
                    {off.description && (
                      <p className="text-body-md text--secondary">{off.description}</p>
                    )}
                  </div>

                  {/* Metadata rows */}
                  <div className="svc-offering-card__meta">
                    <div className="svc-divider" />
                    {off.price_display && (
                      <div className="svc-meta-row">
                        <span className="text-label-md">Price</span>
                        <span className="text-body-sm text--secondary">{off.price_display}</span>
                      </div>
                    )}
                    {off.price_model && (
                      <div className="svc-meta-row">
                        <span className="text-label-md">Type</span>
                        <span className="text-body-sm text--secondary">{off.price_model}</span>
                      </div>
                    )}
                    {off.what_you_get && (
                      <div className="svc-meta-row">
                        <span className="text-label-md">What You Get</span>
                        <span className="text-body-sm text--secondary">{off.what_you_get}</span>
                      </div>
                    )}
                    <div className="svc-meta-row">
                      <span className="text-label-md">Service Line</span>
                      <span className="text-body-sm text--secondary">{category?.name || 'Design'}</span>
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="button-wrapper">
                    <LinkButton href="/contact" variant="primary" size="md">
                      Let&apos;s Talk
                    </LinkButton>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══ 3. Related Customer Story ═══ */}
      {relatedStory && (
        <section className="svc-section">
          <div className="container-lg text--center">
            <h2 className="text-heading-lg text--center">Related Customer Story</h2>
            <p className="text-body-md text--secondary text--center">
              We&apos;re more than a design studio&mdash;we&apos;re your strategic marketing partner.
            </p>

            <Link href={`/customer-stories/${relatedStory.slug}`} className="svc-story-card">
              {relatedStory.hero_image_url && (
                <div className="svc-story-card__image">
                  <Image
                    src={relatedStory.hero_image_url}
                    alt={relatedStory.name || relatedStory.client_name}
                    width={960}
                    height={540}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
              )}
              <div className="svc-story-card__content">
                <h3 className="text-heading-sm">{relatedStory.name || relatedStory.client_name}</h3>
                {relatedStory.short_description && (
                  <p className="text-body-md text--secondary">{relatedStory.short_description}</p>
                )}
                <span className="bds-button bds-button--primary bds-button--sm" style={{ alignSelf: 'flex-start' }}>
                  Read Story
                </span>
              </div>
            </Link>
          </div>
        </section>
      )}

      {/* ═══ 4. Recommended Add-On ═══ */}
      {relatedService && (
        <section id="add-on" className="svc-section" style={{ backgroundColor: colorLight }}>
          <div className="container-lg">
            <div className="svc-addon__header">
              <h2 className="text-heading-lg text--center" style={{ color: colorDark }}>
                Recommended Add-On Service
              </h2>
              {relatedService.description && (
                <p className="text-body-md text--center" style={{ color: colorDark }}>
                  {relatedService.description}
                </p>
              )}
            </div>

            <div className="svc-addon-card">
              {relatedService.image_url && (
                <div className="svc-addon-card__image">
                  <Image
                    src={relatedService.image_url}
                    alt={relatedService.name}
                    width={600}
                    height={400}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
              )}
              <div className="svc-addon-card__body">
                <ServiceBadge category={mapCategorySlug(relatedCatSlug)} serviceName={relatedService.name} size="sm" />
                <h3 className="text-heading-md">{relatedService.name}</h3>
                {relatedService.description && (
                  <p className="text-body-md text--secondary">{relatedService.description}</p>
                )}
                <LinkButton
                  href={`/services/${relatedCatSlug}/${relatedService.slug}`}
                  variant="primary"
                  size="md"
                  style={{ backgroundColor: colorDark, color: colorLight, alignSelf: 'flex-start' }}
                >
                  Learn More
                </LinkButton>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ═══ 5. Other Services ═══ */}
      {siblingServices.length > 0 && (
        <section className="svc-section" style={{ backgroundColor: colorLight }}>
          <div className="container-lg container-lg--comfortable">
            <div className="svc-section__heading-row">
              <h2 className="text-heading-lg">Other</h2>
              <h2 className="text-heading-lg" style={{ color: colorDark }}>{category?.name || ''}</h2>
              <h2 className="text-heading-lg">Services</h2>
            </div>

            <div className="grid-3">
              {siblingServices.map((svc) => (
                <Link key={svc.slug} href={`/services/${categorySlug}/${svc.slug}`} className="svc-sibling-card">
                  {/* Service image */}
                  <div className="svc-sibling-card__image">
                    {svc.image_url && (
                      <Image
                        src={svc.image_url}
                        alt={svc.name}
                        width={400}
                        height={400}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    )}
                  </div>
                  {/* Badge icon */}
                  {svc.primary_badge_url && (
                    <Image src={svc.primary_badge_url} alt="" width={32} height={32} className="svc-sibling-card__badge" />
                  )}
                  {/* Content */}
                  <div className="svc-sibling-card__content">
                    <h4 className="text-heading-sm">{svc.name}</h4>
                    <p className="text-body-md text--secondary">{svc.tagline || svc.description}</p>
                  </div>
                  {/* CTA */}
                  <div className="button-wrapper">
                    <span
                      className="bds-button bds-button--primary bds-button--md"
                      style={{ backgroundColor: colorDark, color: colorLight }}
                    >
                      Learn More
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══ 6. Support CTA ═══ */}
      {supportPlan && (
        <section className="svc-section svc-support-section">
          <div className="container-lg container-lg--comfortable">
            <h2 className="text-heading-lg text--center text--on-color-dark">
              Want a partner to avoid the full-time hassle?
            </h2>
            <p className="text-body-md text--center text--on-color-dark" style={{ opacity: 0.8 }}>
              We&apos;re more than a design studio&mdash;we&apos;re your strategic marketing partner.
            </p>

            <div className="svc-support__layout">
              {/* Left: large illustration */}
              {category?.hero_image_url && (
                <div className="svc-support__illustration">
                  <Image
                    src={category.hero_image_url}
                    alt={category.name || ''}
                    width={500}
                    height={500}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                </div>
              )}

              {/* Right: support plan card */}
              <div className="svc-support-card" style={{ backgroundColor: colorDark }}>
                {supportPlan.image_url && (
                  <div className="svc-support-card__image">
                    <Image
                      src={supportPlan.image_url}
                      alt={supportPlan.name}
                      width={120}
                      height={120}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                )}
                <h3 className="text-heading-md text--on-color-dark">{supportPlan.name}</h3>
                <p className="text-body-md text--on-color-dark" style={{ opacity: 0.8 }}>
                  {supportPlan.description}
                </p>
                <LinkButton
                  href={`/plans#${supportPlan.slug}`}
                  variant="primary"
                  size="md"
                  style={{ alignSelf: 'flex-start' }}
                >
                  Learn More
                </LinkButton>
              </div>
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
    </div>
  );
}
