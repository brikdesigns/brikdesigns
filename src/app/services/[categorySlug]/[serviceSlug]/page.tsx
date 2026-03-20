import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getServiceBySlug, mapCategorySlug } from '@/lib/supabase/queries';
import { ServiceBadgeLabel } from '@/components/marketing/ServiceBadgeLabel';
import '../../../shared-sections.css';

type Props = { params: Promise<{ categorySlug: string; serviceSlug: string }> };

export const revalidate = 86400;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { serviceSlug } = await params;
  try {
    const service = await getServiceBySlug(serviceSlug);
    return {
      title: service.name,
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

  const category = service.service_categories;
  const offerings = service.offerings?.filter((o: { is_public: boolean }) => o.is_public) || [];

  return (
    <>
      {/* Hero */}
      <section className="page-hero">
        <div className="page-hero__container">
          <p className="page-hero__breadcrumb">
            <Link href="/services">Services</Link>
            {' / '}
            <Link href={`/services/${categorySlug}`}>{category?.name || categorySlug}</Link>
          </p>
          <ServiceBadgeLabel
            category={mapCategorySlug(category?.slug || categorySlug)}
            serviceName={service.name}
          />
          <h1 className="page-hero__title" style={{ marginTop: 'var(--gap-sm)' }}>
            {service.name}
          </h1>
          {service.tagline && (
            <p className="page-hero__tagline">{service.tagline}</p>
          )}
          {service.marketing_description && (
            <p className="page-hero__description">{service.marketing_description}</p>
          )}
        </div>
      </section>

      {/* Offerings / Pricing */}
      {offerings.length > 0 && (
        <section className="content-section--secondary" style={{ padding: 'var(--padding-huge) 0' }}>
          <div className="content-section__container" style={{ maxWidth: 800 }}>
            <h2 className="content-section__heading" style={{ textAlign: 'left' }}>Pricing</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-md)', marginTop: 'var(--gap-lg)' }}>
              {offerings
                .sort((a: { tier_rank: number }, b: { tier_rank: number }) => (a.tier_rank || 0) - (b.tier_rank || 0))
                .map((off: { slug: string; name: string; price_display: string; description: string; what_you_get: string }) => (
                  <div key={off.slug} className="card-bordered" style={{ border: '2px solid var(--border-secondary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 'var(--gap-sm)' }}>
                      <h3 style={{ fontFamily: 'var(--font-family-heading)', fontSize: 'var(--heading-sm)', color: 'var(--text-primary)', margin: 0 }}>
                        {off.name}
                      </h3>
                      {off.price_display && (
                        <span style={{ fontFamily: 'var(--font-family-heading)', fontSize: 'var(--heading-sm)', color: 'var(--text-brand-primary)' }}>
                          {off.price_display}
                        </span>
                      )}
                    </div>
                    {off.description && (
                      <p style={{ fontFamily: 'var(--font-family-body)', fontSize: 'var(--body-sm)', color: 'var(--text-secondary)', marginTop: 'var(--gap-sm)' }}>
                        {off.description}
                      </p>
                    )}
                    {off.what_you_get && (
                      <p style={{ fontFamily: 'var(--font-family-label)', fontSize: 'var(--label-sm)', color: 'var(--text-muted)', marginTop: 'var(--gap-xs)' }}>
                        What you get: {off.what_you_get}
                      </p>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="content-section" style={{ padding: 'var(--padding-huge) 0', textAlign: 'center' }}>
        <div className="content-section__container">
          <h2 className="content-section__heading">Interested in {service.name}?</h2>
          <p className="content-section__subtext">Let&apos;s talk about what you need.</p>
          <div style={{ display: 'flex', gap: 'var(--gap-md)', justifyContent: 'center', marginTop: 'var(--gap-xl)' }}>
            <Link href="/get-started" className="btn-primary">Get Started</Link>
            <Link href="/contact" className="btn-outline">Let&apos;s Talk</Link>
          </div>
        </div>
      </section>
    </>
  );
}
