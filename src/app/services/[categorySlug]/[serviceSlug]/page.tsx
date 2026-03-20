import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getServiceBySlug, mapCategorySlug } from '@/lib/supabase/queries';
import { HeroButtons } from '@/components/marketing/HeroButtons';
import { ServiceBadgeLabel } from '@/components/marketing/ServiceBadgeLabel';

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
      <section style={{ maxWidth: 800, margin: '0 auto', padding: 'var(--padding-xl) var(--padding-lg)' }}>
        <p style={{ fontFamily: 'var(--font-family-label)', fontSize: 'var(--label-sm)', color: 'var(--text-secondary)', margin: 0 }}>
          <Link href="/services" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Services</Link>
          {' / '}
          <Link href={`/services/${categorySlug}`} style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>
            {category?.name || categorySlug}
          </Link>
        </p>
        <div style={{ marginTop: 'var(--gap-md)' }}>
          <ServiceBadgeLabel
            category={mapCategorySlug(category?.slug || categorySlug)}
            serviceName={service.name}
          />
        </div>
        <h1 style={{ fontFamily: 'var(--font-family-heading)', fontSize: 'var(--heading-xl)', color: 'var(--text-primary)', marginTop: 'var(--gap-sm)' }}>
          {service.name}
        </h1>
        {service.tagline && (
          <p style={{ fontFamily: 'var(--font-family-body)', fontSize: 'var(--body-xl)', color: 'var(--text-brand-primary)', marginTop: 'var(--gap-sm)' }}>
            {service.tagline}
          </p>
        )}
        {service.marketing_description && (
          <p style={{ fontFamily: 'var(--font-family-body)', fontSize: 'var(--body-lg)', color: 'var(--text-secondary)', marginTop: 'var(--gap-md)', lineHeight: 1.7 }}>
            {service.marketing_description}
          </p>
        )}
      </section>

      {/* Offerings */}
      {offerings.length > 0 && (
        <section style={{ backgroundColor: 'var(--surface-secondary)', padding: 'var(--padding-xl) var(--padding-lg)' }}>
          <div style={{ maxWidth: 800, margin: '0 auto' }}>
            <h2 style={{ fontFamily: 'var(--font-family-heading)', fontSize: 'var(--heading-md)', color: 'var(--text-primary)', margin: 0 }}>
              Pricing
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-md)', marginTop: 'var(--gap-lg)' }}>
              {offerings
                .sort((a: { tier_rank: number }, b: { tier_rank: number }) => (a.tier_rank || 0) - (b.tier_rank || 0))
                .map((off: { slug: string; name: string; price_display: string; description: string; what_you_get: string }) => (
                  <div
                    key={off.slug}
                    style={{
                      padding: 'var(--padding-lg)',
                      backgroundColor: 'var(--surface-primary)',
                      border: '1px solid var(--border-secondary)',
                      borderRadius: 'var(--border-radius-md)',
                    }}
                  >
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
      <section style={{ maxWidth: 800, margin: '0 auto', padding: 'var(--padding-xl) var(--padding-lg)', textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'var(--font-family-heading)', fontSize: 'var(--heading-md)', color: 'var(--text-primary)', margin: 0 }}>
          Interested in {service.name}?
        </h2>
        <p style={{ fontFamily: 'var(--font-family-body)', fontSize: 'var(--body-md)', color: 'var(--text-secondary)', marginTop: 'var(--gap-sm)' }}>
          Let&apos;s talk about what you need.
        </p>
        <HeroButtons />
      </section>
    </>
  );
}
