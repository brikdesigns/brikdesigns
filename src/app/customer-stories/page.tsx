import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { LinkButton } from '@brikdesigns/bds';
import { composeButtonClasses } from '@/lib/bds-button-classes';
import { getCustomerStories } from '@/lib/supabase/queries';
import { text, heading, label } from '@/lib/styles';
import { color } from '@/lib/tokens';
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
            <div className="story-list">
              {stories.map((story) => (
                <Link key={story.id} href={`/customer-stories/${story.slug}`} className="story-list-card">
                  {story.hero_image_url && (
                    <div className="story-list-card__image">
                      <Image src={story.hero_image_url} alt={story.client_name || story.name} width={600} height={338} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  )}
                  <div className="story-list-card__content">
                    <h3 style={heading.sm}>{story.name || story.client_name}</h3>
                    {story.industry && <p style={{ ...label.smBold, color: color.text.brand }}>{story.industry}</p>}
                    {story.short_description && <p style={{ ...text.bodySm, color: color.text.secondary }}>{story.short_description}</p>}
                  </div>
                  <span className={`${composeButtonClasses({ variant: 'primary', size: 'sm' })} story-list-card__cta`}>Read Story</span>
                </Link>
              ))}
            </div>
          ) : (
            <p style={{ ...text.body, color: color.text.secondary, textAlign: 'center' }}>Customer stories coming soon.</p>
          )}
        </div>
      </section>

      {/* Bottom Get In Touch CTA — Webflow shows this on the customer-stories index */}
      <section className="stories-cta-section">
        <div className="stories-cta-card">
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
