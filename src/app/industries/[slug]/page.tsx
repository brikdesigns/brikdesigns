import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getIndustryPageBySlug, getIndustryPages, getCustomerStories } from '@/lib/supabase/queries';
import { LinkButton } from '@brikdesigns/bds';
import { text, heading, label } from '@/lib/styles';
import { color } from '@/lib/tokens';
import '../../shared-sections.css';
import '../industries.css';

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 86400;

// Hardcoded tinted backgrounds for topic sections, keyed by topic_number.
// Matches Webflow's per-topic colored sections (yellow / pink / green pastels).
// All values are high-luminance so text-primary maintains 4.5:1+ contrast.
const TOPIC_TINTS: Record<number, string> = {
  1: '#fff4ad',
  2: '#fcd7d3',
  3: '#c8e6c9',
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const page = await getIndustryPageBySlug(slug);
    return {
      title: `${page.name} | Brik Designs`,
      description: page.tagline || `Brik Designs for ${page.name}`,
    };
  } catch {
    return { title: 'Industry Not Found' };
  }
}

export default async function IndustryDetailPage({ params }: Props) {
  const { slug } = await params;

  let page;
  try {
    page = await getIndustryPageBySlug(slug);
  } catch {
    notFound();
  }

  const topics = page.industry_page_topics
    ?.sort((a: { topic_number: number }, b: { topic_number: number }) => a.topic_number - b.topic_number) || [];

  // Other industries (exclude current)
  const allIndustries = await getIndustryPages();
  const otherIndustries = allIndustries
    .filter((ind: { slug: string }) => ind.slug !== slug)
    .slice(0, 3);

  // Latest customer story for inline panel
  const stories = await getCustomerStories();
  const featuredStory = stories?.[0];

  return (
    <>
      {/* Hero */}
      <section className="page-hero">
        <div className="page-hero__container">
          <h1 className="page-hero__title">{page.name}</h1>
          {page.tagline && (
            <p className="page-hero__tagline">{page.tagline}</p>
          )}
        </div>
      </section>

      {/* Intro */}
      {(page.intro_title || page.intro_description) && (
        <section className="content-section">
          <div className="container-lg">
            <div className="industry-intro">
              {page.intro_title && (
                <h2 style={heading.md}>{page.intro_title}</h2>
              )}
              {page.intro_description && (
                <p style={{ ...text.bodyLg, color: color.text.secondary, marginTop: 'var(--gap-md)', lineHeight: 1.7 }}>
                  {page.intro_description}
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Topic sections — each in its own tinted section */}
      {topics.map((topic: { topic_number: number; title: string; description: string }) => (
        <section
          key={topic.topic_number}
          className="content-section"
          style={{ backgroundColor: TOPIC_TINTS[topic.topic_number] ?? 'var(--surface-secondary)' }}
        >
          <div className="container-lg">
            <div className="industry-topic">
              <div className="industry-topic__container">
                <span style={{ ...label.smBold, color: color.text.brand }}>
                  {String(topic.topic_number).padStart(2, '0')}
                </span>
                <h3 style={heading.md}>{topic.title}</h3>
                {topic.description && (
                  <p style={{ ...text.body, color: color.text.primary }}>{topic.description}</p>
                )}
              </div>
            </div>
          </div>
        </section>
      ))}

      {/* Other Industries */}
      {otherIndustries.length > 0 && (
        <section className="content-section">
          <div className="container-lg">
            <div className="content-wrapper content-wrapper--center" style={{ marginBottom: 'var(--gap-xl)' }}>
              <h2 style={{ ...heading.lg, textAlign: 'center', margin: 0 }}>Other Industries</h2>
            </div>
            <div className="industry-others-grid">
              {otherIndustries.map((ind: { slug: string; name: string; tagline: string | null }) => (
                <Link key={ind.slug} href={`/industries/${ind.slug}`} className="industry-other-card">
                  <h3 style={heading.sm}>{ind.name}</h3>
                  {ind.tagline && (
                    <p style={{ ...text.bodySm, color: color.text.secondary }}>{ind.tagline}</p>
                  )}
                  <span style={{ ...label.smBold, color: color.text.brand, marginTop: 'auto' }}>Learn more →</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Latest Customer Story */}
      {featuredStory && (
        <section className="content-section content-section--secondary">
          <div className="container-lg">
            <div className="content-wrapper content-wrapper--center" style={{ marginBottom: 'var(--gap-xl)' }}>
              <h2 style={{ ...heading.lg, textAlign: 'center', margin: 0 }}>Latest Customer Story</h2>
            </div>
            <Link href={`/customer-stories/${featuredStory.slug}`} className="industry-story-card">
              {featuredStory.hero_image_url && (
                <div className="industry-story-card__image">
                  <Image
                    src={featuredStory.hero_image_url}
                    alt={featuredStory.client_name || featuredStory.name || 'Customer story'}
                    width={600}
                    height={400}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
              )}
              <div className="industry-story-card__content">
                <h3 style={heading.sm}>{featuredStory.name || featuredStory.client_name}</h3>
                {featuredStory.short_description && (
                  <p style={{ ...text.bodySm, color: color.text.secondary }}>{featuredStory.short_description}</p>
                )}
                <span style={{ ...label.smBold, color: color.text.brand }}>Read story →</span>
              </div>
            </Link>
          </div>
        </section>
      )}

      {/* Get In Touch CTA — orange brand panel */}
      <section className="industry-cta-section">
        <div className="industry-cta-card">
          <h2 style={{ ...heading.lg, color: color.text.onColorDark, textAlign: 'center', margin: 0 }}>Get in Touch</h2>
          <p style={{ ...text.body, color: color.text.onColorDark, textAlign: 'center', margin: 0 }}>
            Let&apos;s talk about how we can help your {page.name.toLowerCase()} business.
          </p>
          <LinkButton href="/contact" variant="inverse" size="lg">
            Let&apos;s Talk
          </LinkButton>
        </div>
      </section>
    </>
  );
}
