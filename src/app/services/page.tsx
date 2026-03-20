import type { Metadata } from 'next';
import { getServiceCategories, getServices, mapCategorySlug } from '@/lib/supabase/queries';
import { ServiceLineGrid } from '@/components/marketing/ServiceLineGrid';
import { ServiceCard } from '@/components/marketing/ServiceCard';

export const metadata: Metadata = {
  title: 'Services',
  description: 'Branding, marketing, web design, and back-office services for small businesses.',
};

export const revalidate = 3600;

export default async function ServicesPage() {
  const [categories, services] = await Promise.all([
    getServiceCategories(),
    getServices(),
  ]);

  const serviceLines = categories.map((cat) => ({
    name: cat.name,
    slug: cat.slug,
    category: mapCategorySlug(cat.slug),
    tagline: cat.tagline || cat.name,
  }));

  // Group services by category
  const servicesByCategory = categories.map((cat) => ({
    ...cat,
    services: services
      .filter((s: { category_id: string }) => s.category_id === cat.id)
      .map((s: { name: string; slug: string }) => ({ name: s.name, slug: s.slug })),
  }));

  return (
    <>
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: 'var(--padding-xl) var(--padding-lg)' }}>
        <h1 style={{ fontFamily: 'var(--font-family-heading)', fontSize: 'var(--heading-xl)', color: 'var(--text-primary)', margin: 0 }}>
          Our Services
        </h1>
        <p style={{ fontFamily: 'var(--font-family-body)', fontSize: 'var(--body-lg)', color: 'var(--text-secondary)', marginTop: 'var(--gap-md)', maxWidth: 700 }}>
          We offer design services at every stage of your business growth — from establishment to maturity.
        </p>
      </section>

      <section style={{ backgroundColor: 'var(--surface-secondary)', padding: 'var(--padding-xl) var(--padding-lg)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <ServiceLineGrid items={serviceLines} />
        </div>
      </section>

      {servicesByCategory.map((cat) => (
        <section key={cat.slug} id={cat.slug} style={{ padding: 'var(--padding-xl) var(--padding-lg)' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <h2 style={{ fontFamily: 'var(--font-family-heading)', fontSize: 'var(--heading-lg)', color: 'var(--text-primary)', margin: 0 }}>
              {cat.name}
            </h2>
            <p style={{ fontFamily: 'var(--font-family-body)', fontSize: 'var(--body-md)', color: 'var(--text-secondary)', marginTop: 'var(--gap-sm)', maxWidth: 600 }}>
              {cat.description || cat.tagline || ''}
            </p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: 'var(--gap-md)',
                marginTop: 'var(--gap-lg)',
              }}
            >
              {cat.services.map((svc: { slug: string; name: string }) => (
                <ServiceCard
                  key={svc.slug}
                  name={svc.name}
                  slug={svc.slug}
                  categorySlug={cat.slug}
                  category={mapCategorySlug(cat.slug)}
                />
              ))}
            </div>
          </div>
        </section>
      ))}
    </>
  );
}
