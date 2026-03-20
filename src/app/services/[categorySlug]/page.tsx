import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCategoryBySlug, getServicesByCategory, mapCategorySlug } from '@/lib/supabase/queries';
import { ServiceCard } from '@/components/marketing/ServiceCard';
import { ServiceBadgeLabel } from '@/components/marketing/ServiceBadgeLabel';

type Props = { params: Promise<{ categorySlug: string }> };

export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { categorySlug } = await params;
  try {
    const cat = await getCategoryBySlug(categorySlug);
    return { title: cat.name, description: cat.tagline || cat.description || undefined };
  } catch {
    return { title: 'Services' };
  }
}

export default async function ServiceCategoryPage({ params }: Props) {
  const { categorySlug } = await params;

  let category;
  try {
    category = await getCategoryBySlug(categorySlug);
  } catch {
    notFound();
  }

  const services = await getServicesByCategory(category.id);

  return (
    <>
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: 'var(--padding-xl) var(--padding-lg)' }}>
        <p style={{ fontFamily: 'var(--font-family-label)', fontSize: 'var(--label-sm)', color: 'var(--text-secondary)', margin: 0 }}>
          <Link href="/services" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Services</Link>
          {' / '}
        </p>
        <div style={{ marginTop: 'var(--gap-md)' }}>
          <ServiceBadgeLabel category={mapCategorySlug(category.slug)} />
        </div>
        <h1 style={{ fontFamily: 'var(--font-family-heading)', fontSize: 'var(--heading-xl)', color: 'var(--text-primary)', marginTop: 'var(--gap-sm)' }}>
          {category.name}
        </h1>
        {category.tagline && (
          <p style={{ fontFamily: 'var(--font-family-body)', fontSize: 'var(--body-xl)', color: 'var(--text-brand-primary)', marginTop: 'var(--gap-sm)' }}>
            {category.tagline}
          </p>
        )}
        {category.description && (
          <p style={{ fontFamily: 'var(--font-family-body)', fontSize: 'var(--body-lg)', color: 'var(--text-secondary)', marginTop: 'var(--gap-md)', maxWidth: 700, lineHeight: 1.7 }}>
            {category.description}
          </p>
        )}
      </section>

      <section style={{ padding: 'var(--padding-xl) var(--padding-lg)' }}>
        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 'var(--gap-md)',
          }}
        >
          {services.map((svc) => (
            <ServiceCard
              key={svc.slug}
              name={svc.name}
              slug={svc.slug}
              categorySlug={categorySlug}
              category={mapCategorySlug(category.slug)}
              tagline={svc.tagline}
            />
          ))}
        </div>
      </section>
    </>
  );
}
