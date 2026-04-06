/**
 * Service Detail Page — CMS template
 *
 * Markup transcribed from Paper artboards (01-06) which were built
 * from extracted Webflow source HTML. Each section preserves the exact
 * container nesting, typography hierarchy, and color application from Webflow.
 */
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
import { ServiceJsonLd, BreadcrumbJsonLd } from '@/components/seo/JsonLd';
import '../../../shared-sections.css';
import '../../services.css';

type Props = { params: Promise<{ categorySlug: string; serviceSlug: string }> };

export const revalidate = 86400;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { serviceSlug } = await params;
  try {
    const service = await getServiceBySlug(serviceSlug);
    const { categorySlug } = await params;
    return {
      title: `${service.name} | Design Services`,
      description: service.description || undefined,
      alternates: { canonical: `/services/${categorySlug}/${serviceSlug}` },
      openGraph: {
        title: `${service.name} | Design Services`,
        description: service.description || undefined,
        images: service.image_url ? [{ url: service.image_url, alt: service.name }] : undefined,
      },
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
    try { supportPlan = await getSupportPlanBySlug(service.support_plan_slug); } catch { supportPlan = null; }
  }

  const heroImageUrl = service.image_url || category?.hero_image_url || null;
  const colorLight = category?.brand_color_light || '#f1f0ec';
  const colorBase = category?.brand_color_base || '#828282';
  const colorDark = category?.brand_color_dark || '#1b1b1b';

  // Support plan illustration from service_lines
  const supportIllustrationUrl = category?.support_plan_image_url || category?.hero_image_url || null;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://brikdesigns.com';
  const categoryName = category?.name || categorySlug;

  return (
    <>
      <ServiceJsonLd
        name={service.name}
        description={service.description || ''}
        url={`${siteUrl}/services/${categorySlug}/${serviceSlug}`}
        image={service.image_url || undefined}
        category={categoryName}
      />
      <BreadcrumbJsonLd items={[
        { name: 'Home', url: siteUrl },
        { name: 'Services', url: `${siteUrl}/services` },
        { name: categoryName, url: `${siteUrl}/services/${categorySlug}` },
        { name: service.name, url: `${siteUrl}/services/${categorySlug}/${serviceSlug}` },
      ]} />
      {/* ═══ 01 Hero ═══ */}
      <section className="svc-page__hero" style={{ backgroundColor: colorLight }}>
        <div className="container-lg">
          {/* Breadcrumb — centered */}
          <div className="svc-page__breadcrumb">
            <Link href="/services" style={{ color: colorDark, textDecoration: 'none' }}>
              <span className="text-body-lg">All Services</span>
            </Link>
            <span className="text-body-lg" style={{ color: colorDark }}>/</span>
            <Link href={`/services/${categorySlug}`} style={{ color: colorDark, textDecoration: 'none' }}>
              <span className="text-body-lg">{category?.name || categorySlug}</span>
            </Link>
            <span className="text-body-lg" style={{ color: colorBase }}>/</span>
            <span className="text-body-lg" style={{ color: colorBase }}>{service.name}</span>
          </div>

          {/* 2-col grid */}
          <div className="svc-page__hero-grid">
            {/* LEFT: badge + title + description + button */}
            <div className="svc-page__hero-left">
              {/* Badge — dark rounded square */}
              <div className="svc-page__badge" style={{ backgroundColor: colorDark }}>
                {service.secondary_badge_url ? (
                  <Image src={service.secondary_badge_url} alt="" width={36} height={36} style={{ objectFit: 'cover' }} />
                ) : (
                  <ServiceBadge category={bdsCat} serviceName={service.name} size="lg" />
                )}
              </div>

              <h1 className="text-display-sm" style={{ color: colorDark }}>{service.name}</h1>

              {(service.tagline || service.description) && (
                <p className="text-body-huge" style={{ color: colorDark }}>
                  {service.tagline || service.description}
                </p>
              )}

              <div className="svc-page__buttons">
                {sortedOfferings.length > 0 && (
                  <a href="#pricing" className="svc-page__btn-primary" style={{ backgroundColor: colorDark, color: colorLight }}>
                    View Details
                  </a>
                )}
              </div>
            </div>

            {/* RIGHT: white price card (image + price + button inside) */}
            {heroImageUrl && (
              <div className="svc-page__hero-right">
                <div className="svc-page__price-card">
                  <div className="svc-page__img-frame">
                    <Image src={heroImageUrl} alt={service.name} width={560} height={560} priority style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  {startingPrice && (
                    <div className="svc-page__price-text">
                      <span className="text-body-lg" style={{ color: '#828282' }}>Starting at</span>
                      <span className="text-heading-lg">{startingPrice}</span>
                    </div>
                  )}
                  <div className="svc-page__buttons">
                    <a href="/contact" className="svc-page__btn-primary" style={{ backgroundColor: '#E35335', color: '#fff' }}>
                      Let&apos;s Talk
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ═══ 02 Offerings ═══ */}
      {sortedOfferings.length > 0 && (
        <section id="pricing" className="svc-page__section" style={{ backgroundColor: colorLight }}>
          <div className="container-lg">
            <h2 className="text-heading-lg text--center" style={{ color: colorDark }}>Pricing Options</h2>

            <div className="svc-page__offerings-grid">
              {sortedOfferings.map((off: { slug: string; name: string; price_display: string; description: string; what_you_get: string; price_model?: string }) => (
                <div key={off.slug} className="svc-page__offering-card">
                  {/* Badge icon */}
                  <div className="svc-page__offering-header">
                    {service.primary_badge_url ? (
                      <Image src={service.primary_badge_url} alt="" width={40} height={40} style={{ objectFit: 'cover' }} />
                    ) : (
                      <ServiceBadge category={bdsCat} serviceName={service.name} size="lg" />
                    )}
                  </div>

                  {/* Title + description */}
                  <div className="svc-page__offering-content">
                    <div className="text-heading-sm">{off.name}</div>
                    {off.description && <div className="text-body-md">{off.description}</div>}
                  </div>

                  {/* Metadata rows */}
                  <div className="svc-page__offering-meta">
                    <div className="svc-page__divider" />
                    {off.price_display && (
                      <div className="svc-page__meta-item">
                        <div className="text-label-md">Price</div>
                        <div className="text-body-sm text--secondary">{off.price_display}</div>
                      </div>
                    )}
                    {off.price_model && (
                      <div className="svc-page__meta-item">
                        <div className="text-label-md">Type</div>
                        <div className="text-body-sm text--secondary">{off.price_model}</div>
                      </div>
                    )}
                    {off.what_you_get && (
                      <div className="svc-page__meta-item">
                        <div className="text-label-md">What You Get</div>
                        <div className="text-body-sm text--secondary">{off.what_you_get}</div>
                      </div>
                    )}
                    <div className="svc-page__meta-item">
                      <div className="text-label-md">Service Line</div>
                      <div className="text-body-sm text--secondary">{category?.name || 'Design'}</div>
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="svc-page__buttons">
                    <a href="/contact" className="svc-page__btn-primary">Let&apos;s Talk</a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══ 03 Customer Story ═══ */}
      {relatedStory && (
        <section className="svc-page__section" style={{ backgroundColor: '#fff' }}>
          <div className="container-lg">
            <div className="svc-page__section-header">
              <h2 className="text-heading-lg text--center">Related Customer Story</h2>
              <p className="text-body-md text--center">
                We&apos;re more than a design studio&mdash;we&apos;re your strategic marketing partner.
              </p>
            </div>

            <Link href={`/customer-stories/${relatedStory.slug}`} className="svc-page__story-card">
              {/* Image with floating badge */}
              <div className="svc-page__story-image-wrapper">
                {relatedStory.hero_image_url && (
                  <div className="svc-page__img-frame-landscape">
                    <Image
                      src={relatedStory.hero_image_url}
                      alt={relatedStory.name || relatedStory.client_name}
                      width={960} height={540}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                )}
                {/* Floating badge pill */}
                <div className="svc-page__badge-floating">
                  <div className="svc-page__badge-pill" style={{ backgroundColor: colorLight }}>
                    {service.primary_badge_url && (
                      <Image src={service.primary_badge_url} alt="" width={16} height={16} />
                    )}
                    <span style={{ fontSize: '10px', fontWeight: 600, color: colorDark }}>{service.name}</span>
                  </div>
                </div>
              </div>

              {/* Content below image */}
              <div className="svc-page__story-content">
                <h3 className="text-heading-md">{relatedStory.name || relatedStory.client_name}</h3>
                {relatedStory.short_description && (
                  <p className="text-body-md">{relatedStory.short_description}</p>
                )}
                <span className="svc-page__btn-primary" style={{ alignSelf: 'center' }}>Read Story</span>
              </div>
            </Link>
          </div>
        </section>
      )}

      {/* ═══ 04 Add-On ═══ */}
      {relatedService && (
        <section id="add-on" className="svc-page__section" style={{ backgroundColor: colorLight }}>
          <div className="container-lg">
            <div className="svc-page__addon-stack">
              {/* Heading */}
              <div className="svc-page__section-header">
                <div className="svc-page__heading-row">
                  <h2 className="text-heading-lg" style={{ color: colorDark }}>Recommended</h2>
                  <h2 className="text-heading-lg" style={{ color: colorDark }}>Add-On Service</h2>
                </div>
                {relatedService.description && (
                  <p className="text-body-md text--center" style={{ color: colorDark }}>
                    {relatedService.description}
                  </p>
                )}
              </div>

              {/* White card (image + badge pill + content + button) */}
              <div className="svc-page__addon-card">
                {relatedService.image_url && (
                  <div className="svc-page__addon-image">
                    <Image src={relatedService.image_url} alt={relatedService.name} width={600} height={600} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}
                <div className="svc-page__addon-body">
                  {/* Badge pill */}
                  <div className="svc-page__badge-pill" style={{ backgroundColor: colorLight, alignSelf: 'flex-start' }}>
                    <ServiceBadge category={mapCategorySlug(relatedCatSlug)} serviceName={relatedService.name} size="sm" />
                    <span style={{ fontSize: '10px', fontWeight: 600, color: colorDark }}>{category?.name || 'Design'}</span>
                  </div>
                  <div className="text-heading-md">{relatedService.name}</div>
                  {relatedService.description && <div className="text-body-md">{relatedService.description}</div>}
                  <div className="svc-page__buttons">
                    <Link href={`/services/${relatedCatSlug}/${relatedService.slug}`} className="svc-page__btn-primary" style={{ backgroundColor: colorDark, color: colorLight }}>
                      Learn more
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ═══ 05 Other Services ═══ */}
      {siblingServices.length > 0 && (
        <section className="svc-page__section" style={{ backgroundColor: colorLight }}>
          <div className="container-lg">
            <div className="svc-page__heading-row" style={{ marginBottom: '36px' }}>
              <h2 className="text-heading-lg">Other</h2>
              <h2 className="text-heading-lg" style={{ color: colorDark }}>{category?.name || ''}</h2>
              <h2 className="text-heading-lg">Services</h2>
            </div>

            <div className="svc-page__grid-3">
              {siblingServices.map((svc) => (
                <Link key={svc.slug} href={`/services/${categorySlug}/${svc.slug}`} className="svc-page__sibling-card">
                  {/* Image frame (white bg) */}
                  <div className="svc-page__img-frame">
                    {svc.image_url && (
                      <Image src={svc.image_url} alt={svc.name} width={400} height={400} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                  </div>
                  {/* Badge icon */}
                  {svc.primary_badge_url ? (
                    <Image src={svc.primary_badge_url} alt="" width={32} height={32} style={{ objectFit: 'cover' }} />
                  ) : (
                    <ServiceBadge category={bdsCat} serviceName={svc.name} size="md" />
                  )}
                  {/* Content */}
                  <div className="svc-page__sibling-content">
                    <h4 className="text-heading-sm">{svc.name}</h4>
                    <p className="text-body-md">{svc.tagline || svc.description}</p>
                  </div>
                  {/* Button */}
                  <div className="svc-page__buttons">
                    <span className="svc-page__btn-primary" style={{ backgroundColor: colorDark, color: colorLight }}>
                      Learn More
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══ 06 Support CTA ═══ */}
      {supportPlan && (
        <section className="svc-page__section svc-page__support-section">
          <div className="container-lg">
            <div className="svc-page__section-header">
              <h2 className="text-heading-lg text--center" style={{ color: '#fff' }}>
                Want a partner to avoid the full-time hassle?
              </h2>
              <p className="text-body-md text--center" style={{ color: 'rgba(255,255,255,0.7)' }}>
                We&apos;re more than a design studio&mdash;we&apos;re your strategic marketing partner.
              </p>
            </div>

            <div className="svc-page__support-row">
              {/* Left: illustration */}
              {supportIllustrationUrl && (
                <div className="svc-page__support-illustration">
                  <Image src={supportIllustrationUrl} alt={category?.name || ''} width={500} height={500} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px' }} />
                </div>
              )}
              {/* Right: dark green card */}
              <div className="svc-page__support-card" style={{ backgroundColor: colorDark }}>
                {category?.card_image_url && (
                  <div className="svc-page__support-card-img">
                    <Image src={category.card_image_url} alt={supportPlan.name} width={120} height={120} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}
                <h3 className="text-heading-md" style={{ color: '#fff' }}>{supportPlan.name}</h3>
                <p className="text-body-md text--center" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  {supportPlan.description}
                </p>
                <Link href={`/plans#${supportPlan.slug}`} className="svc-page__btn-primary" style={{ backgroundColor: colorLight, color: colorDark }}>
                  Learn More
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

    </>
  );
}
