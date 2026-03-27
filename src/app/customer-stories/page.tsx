import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getCustomerStories } from '@/lib/supabase/queries';
import '../shared-sections.css';
import './customer-stories.css';

export const metadata: Metadata = {
  title: 'Customer Stories | Brik Design Portfolio & Client Projects',
  description: 'Explore Brik\'s portfolio of brand, marketing, service, and product design. See how we build impactful design for our customers, brik by brik.',
};

export const revalidate = 3600;

export default async function CustomerStoriesPage() {
  const stories = await getCustomerStories();

  return (
    <>
      <section className="page-hero">
        <div className="page-hero__container">
          <h1 className="page-hero__title">Customer Stories</h1>
          <p className="page-hero__description">
            Real results from real businesses. See how we help our clients build stronger brands and grow faster — brik by brik.
          </p>
        </div>
      </section>

      <section className="content-section stories-section">
        <div className="container-lg">
          {stories && stories.length > 0 ? (
            <div className="grid-2">
              {stories.map((story) => (
                <Link key={story.id} href={`/customer-stories/${story.slug}`} className="story-list-card">
                  {story.hero_image_url && (
                    <div className="story-list-card__image">
                      <Image src={story.hero_image_url} alt={story.client_name || story.name} width={600} height={338} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  )}
                  <div className="story-list-card__content">
                    <h3 className="text-heading-sm">{story.name || story.client_name}</h3>
                    {story.industry && <p className="text-label-sm text--brand">{story.industry}</p>}
                    {story.short_description && <p className="text-body-sm text--secondary">{story.short_description}</p>}
                  </div>
                  <span className="bds-button bds-button--primary bds-button--sm story-list-card__cta">Read Story</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-body-md text--secondary text--center">Customer stories coming soon.</p>
          )}
        </div>
      </section>
    </>
  );
}
