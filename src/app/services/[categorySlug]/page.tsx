import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCategoryBySlug, getServicesByCategory, mapCategorySlug } from '@/lib/supabase/queries';
import { ServiceCard } from '@/components/marketing/ServiceCard';
import { ServiceBadgeLabel } from '@/components/marketing/ServiceBadgeLabel';
import '../../shared-sections.css';

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
      {/* Hero */}
      <section className="page-hero">
        <div className="page-hero__container">
          <p className="page-hero__breadcrumb">
            <Link href="/services">Services</Link> /
          </p>
          <ServiceBadgeLabel category={mapCategorySlug(category.slug)} />
          <h1 className="page-hero__title" style={{ marginTop: 'var(--gap-sm)' }}>
            {category.name}
          </h1>
          {category.tagline && (
            <p className="page-hero__tagline">{category.tagline}</p>
          )}
          {category.description && (
            <p className="page-hero__description">{category.description}</p>
          )}
        </div>
      </section>

      {/* Service cards */}
      <section className="content-section--secondary" style={{ padding: 'var(--padding-huge) 0' }}>
        <div className="content-section__container">
          <div className="grid-3">
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
        </div>
      </section>
    </>
  );
}
