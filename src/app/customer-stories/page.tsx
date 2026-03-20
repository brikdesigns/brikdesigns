import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { getCustomerStories } from '@/lib/supabase/queries';
import '../shared-sections.css';

export const metadata: Metadata = {
  title: 'Customer Stories | Brik Design Portfolio & Client Projects',
  description: 'Explore Brik\'s portfolio of brand, marketing, service, and product design. From startups to enterprise — see how we build impactful design for our customers, brik by brik.',
};

export const revalidate = 3600;

export default async function CustomerStoriesPage() {
  const stories = await getCustomerStories();

  return (
    <>
      {/* Hero */}
      <section className="page-hero">
        <div className="page-hero__container">
          <h1 className="page-hero__title">Customer Stories</h1>
          <p className="page-hero__description">
            Real results from real businesses. See how we help our clients build stronger brands and grow faster — brik by brik.
          </p>
        </div>
      </section>

      {/* Story cards */}
      <section className="content-section" style={{ padding: 'var(--padding-huge) 0' }}>
        <div className="content-section__container">
          <div className="grid-2">
            {stories?.map((story) => (
              <Link
                key={story.id}
                href={`/customer-stories/${story.slug}`}
                className="card-bordered"
                style={{ gap: 'var(--gap-md)' }}
              >
                {story.hero_image_url && (
                  <div className="img-frame--landscape" style={{ borderRadius: 'var(--border-radius-md)', overflow: 'hidden', aspectRatio: '16/9' }}>
                    <Image
                      src={story.hero_image_url}
                      alt={story.client_name || story.name}
                      width={600}
                      height={338}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                )}
                <div>
                  <h3 style={{ fontFamily: 'var(--font-family-heading)', fontSize: 'var(--heading-sm)', color: 'var(--text-primary)', margin: 0 }}>
                    {story.name || story.client_name}
                  </h3>
                  {story.industry && (
                    <p style={{ fontFamily: 'var(--font-family-label)', fontSize: 'var(--body-xs)', color: 'var(--text-brand-primary)', margin: 'var(--gap-xs) 0 0' }}>
                      {story.industry}
                    </p>
                  )}
                  {story.short_description && (
                    <p style={{ fontFamily: 'var(--font-family-body)', fontSize: 'var(--body-sm)', color: 'var(--text-secondary)', margin: 'var(--gap-sm) 0 0', lineHeight: 1.6 }}>
                      {story.short_description}
                    </p>
                  )}
                </div>
                <span className="btn-primary" style={{ alignSelf: 'flex-start' }}>Read Story</span>
              </Link>
            ))}
          </div>

          {(!stories || stories.length === 0) && (
            <p style={{ fontFamily: 'var(--font-family-body)', fontSize: 'var(--body-md)', color: 'var(--text-muted)', textAlign: 'center', padding: 'var(--padding-xl)' }}>
              Customer stories coming soon.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
