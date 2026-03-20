import type { Metadata } from 'next';
import { getServiceCategories, getServices, mapCategorySlug } from '@/lib/supabase/queries';
import { HomeServiceCard } from '@/components/homepage/HomeServiceCard';
import '../shared-sections.css';

export const metadata: Metadata = {
  title: 'Design Services | Branding, Marketing, Web & Back-Office',
  description: 'Brik Designs offers branding, marketing, information, product, and back-office design services for small businesses — one-time or subscription-based.',
};

export const revalidate = 3600;

export default async function ServicesPage() {
  const [categories, services] = await Promise.all([
    getServiceCategories(),
    getServices(),
  ]);

  const servicesByCategory = categories.map((cat) => ({
    ...cat,
    category: mapCategorySlug(cat.slug),
    services: services
      .filter((s: { category_id: string }) => s.category_id === cat.id)
      .map((s: { name: string; slug: string; tagline: string }) => ({
        name: s.name,
        slug: s.slug,
        tagline: s.tagline,
      })),
  }));

  return (
    <>
      {/* Hero */}
      <section className="page-hero">
        <div className="page-hero__container">
          <h1 className="page-hero__title">Our Services</h1>
          <p className="page-hero__description">
            We offer design services at every stage of your business growth — from establishment to maturity.
          </p>
        </div>
      </section>

      {/* Service line cards */}
      <section className="content-section--secondary">
        <div className="content-section__container" style={{ padding: 'var(--padding-huge) var(--padding-lg)' }}>
          <div className="grid-3">
            {servicesByCategory.map((cat) => (
              <HomeServiceCard
                key={cat.slug}
                name={cat.name}
                slug={cat.slug}
                category={cat.category}
                tagline={cat.tagline || cat.description || ''}
                imageUrl={cat.card_image_url}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Per-category service lists */}
      {servicesByCategory.map((cat, i) => (
        <section
          key={cat.slug}
          id={cat.slug}
          className={i % 2 === 0 ? 'content-section' : 'content-section--secondary'}
          style={{ padding: 'var(--padding-huge) 0' }}
        >
          <div className="content-section__container">
            <h2 className="content-section__heading" style={{ textAlign: 'left' }}>{cat.name}</h2>
            <p className="content-section__subtext" style={{ textAlign: 'left', margin: 'var(--gap-sm) 0 var(--gap-xl)' }}>
              {cat.description || cat.tagline || ''}
            </p>
            <div className="grid-3">
              {cat.services.map((svc: { slug: string; name: string; tagline: string }) => (
                <HomeServiceCard
                  key={svc.slug}
                  name={svc.name}
                  slug={`${cat.slug}/${svc.slug}`}
                  category={cat.category}
                  tagline={svc.tagline || ''}
                />
              ))}
            </div>
          </div>
        </section>
      ))}
    </>
  );
}
