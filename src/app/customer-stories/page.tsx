import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { CustomerStoryCard } from '@/components/marketing/CustomerStoryCard';

export const metadata: Metadata = {
  title: 'Customer Stories',
  description: 'See how Brik Designs has helped small businesses build stronger brands and grow faster.',
};

export const revalidate = 3600; // ISR: revalidate every hour

export default async function CustomerStoriesPage() {
  const supabase = await createClient();
  const { data: stories } = await supabase
    .from('customer_stories')
    .select('*')
    .eq('is_public', true)
    .order('rank', { ascending: true });

  return (
    <>
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: 'var(--padding-xl) var(--padding-lg)' }}>
        <h1 style={{ fontFamily: 'var(--font-family-heading)', fontSize: 'var(--heading-xl)', color: 'var(--text-primary)', margin: 0 }}>
          Customer Stories
        </h1>
        <p style={{ fontFamily: 'var(--font-family-body)', fontSize: 'var(--body-lg)', color: 'var(--text-secondary)', marginTop: 'var(--gap-md)' }}>
          Real results from real businesses.
        </p>
      </section>

      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '0 var(--padding-lg) var(--padding-xl)' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: 'var(--gap-lg)',
          }}
        >
          {stories?.map((story) => (
            <CustomerStoryCard
              key={story.id}
              name={story.name}
              slug={story.slug}
              clientName={story.client_name}
              shortDescription={story.short_description || ''}
              industry={story.industry || undefined}
            />
          ))}
        </div>

        {(!stories || stories.length === 0) && (
          <p style={{ fontFamily: 'var(--font-family-body)', fontSize: 'var(--body-md)', color: 'var(--text-muted)', textAlign: 'center', padding: 'var(--padding-xl)' }}>
            Customer stories coming soon.
          </p>
        )}
      </section>
    </>
  );
}
