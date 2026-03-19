import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { FeaturedTestimonial } from '@/components/marketing/FeaturedTestimonial';

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 86400; // ISR: 24 hours

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: story } = await supabase
    .from('customer_stories')
    .select('name, short_description, client_name')
    .eq('slug', slug)
    .eq('is_public', true)
    .single();

  if (!story) return { title: 'Story Not Found' };

  return {
    title: `${story.client_name} — ${story.name}`,
    description: story.short_description || undefined,
  };
}

export default async function CustomerStoryDetailPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: story } = await supabase
    .from('customer_stories')
    .select('*')
    .eq('slug', slug)
    .eq('is_public', true)
    .single();

  if (!story) notFound();

  return (
    <article style={{ maxWidth: 800, margin: '0 auto', padding: 'var(--padding-xl) var(--padding-lg)' }}>
      {/* Header */}
      <header>
        {story.industry && (
          <p style={{ fontFamily: 'var(--font-family-label)', fontSize: 'var(--label-sm)', color: 'var(--text-brand-primary)', margin: 0 }}>
            {story.industry}
          </p>
        )}
        <h1 style={{ fontFamily: 'var(--font-family-heading)', fontSize: 'var(--heading-xl)', color: 'var(--text-primary)', marginTop: 'var(--gap-xs)' }}>
          {story.name}
        </h1>
        <p style={{ fontFamily: 'var(--font-family-label)', fontSize: 'var(--label-lg)', color: 'var(--text-secondary)', marginTop: 'var(--gap-sm)' }}>
          {story.client_name}
        </p>
        {story.short_description && (
          <p style={{ fontFamily: 'var(--font-family-body)', fontSize: 'var(--body-lg)', color: 'var(--text-secondary)', marginTop: 'var(--gap-md)' }}>
            {story.short_description}
          </p>
        )}
      </header>

      {/* The Challenge */}
      {story.the_challenge && (
        <section style={{ marginTop: 'var(--gap-xl)' }}>
          <h2 style={{ fontFamily: 'var(--font-family-heading)', fontSize: 'var(--heading-md)', color: 'var(--text-primary)' }}>
            The Challenge
          </h2>
          <div
            style={{ fontFamily: 'var(--font-family-body)', fontSize: 'var(--body-md)', color: 'var(--text-secondary)', marginTop: 'var(--gap-sm)', lineHeight: 1.7 }}
            dangerouslySetInnerHTML={{ __html: story.the_challenge }}
          />
        </section>
      )}

      {/* The Solution */}
      {story.the_solution && (
        <section style={{ marginTop: 'var(--gap-xl)' }}>
          <h2 style={{ fontFamily: 'var(--font-family-heading)', fontSize: 'var(--heading-md)', color: 'var(--text-primary)' }}>
            The Solution
          </h2>
          <div
            style={{ fontFamily: 'var(--font-family-body)', fontSize: 'var(--body-md)', color: 'var(--text-secondary)', marginTop: 'var(--gap-sm)', lineHeight: 1.7 }}
            dangerouslySetInnerHTML={{ __html: story.the_solution }}
          />
        </section>
      )}

      {/* Results */}
      {story.results && (
        <section style={{ marginTop: 'var(--gap-xl)' }}>
          <h2 style={{ fontFamily: 'var(--font-family-heading)', fontSize: 'var(--heading-md)', color: 'var(--text-primary)' }}>
            Results
          </h2>
          <div
            style={{ fontFamily: 'var(--font-family-body)', fontSize: 'var(--body-md)', color: 'var(--text-secondary)', marginTop: 'var(--gap-sm)', lineHeight: 1.7 }}
            dangerouslySetInnerHTML={{ __html: story.results }}
          />
        </section>
      )}

      {/* Testimonial */}
      {story.quote && (
        <section style={{ marginTop: 'var(--gap-xl)' }}>
          <FeaturedTestimonial
            quote={story.quote}
            authorName={story.quote_attribution || story.client_name}
            rating={5}
          />
        </section>
      )}
    </article>
  );
}
