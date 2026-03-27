import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getIndustryPageBySlug } from '@/lib/supabase/queries';
import { LinkButton } from '@bds/components/ui/Button/LinkButton';
import '../../shared-sections.css';
import '../industries.css';

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 86400;

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

  return (
    <>
      {/* Hero */}
      <section className="page-hero page-hero--brand">
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
                <h2 className="text-heading-md">{page.intro_title}</h2>
              )}
              {page.intro_description && (
                <p className="text-body-lg text--secondary" style={{ marginTop: 'var(--gap-md)', lineHeight: 1.7 }}>
                  {page.intro_description}
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Topic sections */}
      {topics.length > 0 && (
        <section className="content-section content-section--secondary">
          <div className="container-lg">
            {topics.map((topic: { topic_number: number; title: string; description: string }) => (
              <div key={topic.topic_number} className="industry-topic">
                <div className="industry-topic__container">
                  <span className="text-label-sm text--brand">
                    {String(topic.topic_number).padStart(2, '0')}
                  </span>
                  <h3 className="text-heading-sm">{topic.title}</h3>
                  {topic.description && (
                    <p className="text-body-md text--secondary">{topic.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="content-section">
        <div className="container-lg">
          <div className="content-wrapper content-wrapper--center">
            <h2 className="text-heading-lg text--center">Ready to get started?</h2>
            <p className="text-body-md text--secondary text--center">
              Let&apos;s talk about how we can help your {page.name.toLowerCase()} business.
            </p>
            <div className="button-wrapper button-wrapper--center">
              <LinkButton href="/contact" variant="primary" size="lg">Let&apos;s Talk</LinkButton>
              <LinkButton href="/get-started" variant="outline" size="lg">Get Started</LinkButton>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
