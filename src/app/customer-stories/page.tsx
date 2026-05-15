import type { Metadata } from 'next';
import { LinkButton } from '@brikdesigns/bds';
import type { ServiceCategory } from '@brikdesigns/bds';
import { getCustomerStories, getServiceCategories, mapCategorySlug } from '@/lib/supabase/queries';
import { hasIconFor } from '@/lib/service-icons';
import { CustomerStoryCard } from '@/components/marketing/CustomerStoryCard';
import { ServiceLineCard } from '@/app/services/ServiceLineCard';
import { text, heading } from '@/lib/styles';
import { color } from '@/lib/tokens';
import '../shared-sections.css';
import '../services/services.css';
import './customer-stories.css';

export const metadata: Metadata = {
  title: 'Customer Stories | Brik Design Portfolio & Client Projects',
  description: 'Explore Brik\'s portfolio of brand, marketing, service, and product design. See how we build impactful design for our customers, brik by brik.',
};

export const revalidate = 3600;

export default async function CustomerStoriesPage() {
  const [stories, serviceLines] = await Promise.all([
    getCustomerStories(),
    getServiceCategories(),
  ]);

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

      <section className="content-section">
        <div className="container-lg">
          {stories && stories.length > 0 ? (
            <div className="story-list">
              {stories.map((story) => {
                const serviceLineCategory = story.service_line_slug
                  ? (mapCategorySlug(story.service_line_slug) as ServiceCategory)
                  : null;
                const serviceLineName = (story as { service_lines?: { name: string } | null }).service_lines?.name ?? null;
                const serviceName = (story as { offerings?: { name: string } | null }).offerings?.name ?? null;
                const iconServiceName = serviceLineCategory && serviceName && hasIconFor(serviceLineCategory, serviceName)
                  ? serviceName
                  : undefined;

                return (
                  <CustomerStoryCard
                    key={story.id}
                    slug={story.slug}
                    name={story.name}
                    clientName={story.client_name}
                    industry={story.industry ?? null}
                    launchDate={story.launch_date ?? null}
                    serviceLineName={serviceLineName}
                    serviceLineCategory={serviceLineCategory}
                    serviceName={serviceName}
                    shortDescription={story.short_description ?? null}
                    imageUrl={story.thumbnail_url ?? story.hero_image_url ?? null}
                    iconServiceName={iconServiceName}
                  />
                );
              })}
            </div>
          ) : (
            <p style={{ ...text.body, color: color.text.secondary, textAlign: 'center' }}>Customer stories coming soon.</p>
          )}
        </div>
      </section>

      {serviceLines && serviceLines.length > 0 && (
        <section className="content-section">
          <div className="container-lg container-lg--comfortable">
            <div className="content-wrapper content-wrapper--center content-wrapper--narrow">
              <h2 style={{ ...heading.lg, textAlign: 'center' }}>Our Services</h2>
              <p style={{ ...text.body, color: color.text.secondary, textAlign: 'center' }}>
                We offer design services at every stage of your business growth — from brand to back office.
              </p>
            </div>
            <div className="grid-3">
              {serviceLines.map((cat) => (
                <ServiceLineCard
                  key={cat.slug}
                  name={cat.name}
                  slug={cat.slug}
                  category={mapCategorySlug(cat.slug)}
                  tagline={cat.tagline || cat.description || ''}
                  imageUrl={cat.card_image_url}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="cta-section-brand">
        <div className="cta-card-brand">
          <h2 style={{ ...heading.lg, color: color.text.onColorDark, textAlign: 'center', margin: 0 }}>Get in Touch</h2>
          <p style={{ ...text.body, color: color.text.onColorDark, textAlign: 'center', margin: 0, opacity: 0.9 }}>
            Starting a new project or want to collaborate with us?
          </p>
          <LinkButton href="/contact" variant="inverse" size="lg">
            Let&apos;s Talk
          </LinkButton>
        </div>
      </section>
    </>
  );
}
