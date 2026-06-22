import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getEventBySlug, getPublicEventSlugs } from '@/lib/supabase/queries';
import { type EventRow, eventAccent, landingSurface, plainTextExcerpt } from '@/lib/events';
import { parseBlocks, parseAlertBanner } from '@/lib/blocks';
import { LandingBlocks, AlertBannerBlock } from '@/components/blocks';
import '../shared-sections.css';

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 3600;
// Only the CMS landing slugs are served at the marketing root; any other path
// falls through to a 404 rather than this route (no open root catch-all).
export const dynamicParams = false;

export async function generateStaticParams() {
  const rows = await getPublicEventSlugs('landing');
  return rows.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const event = (await getEventBySlug(slug)) as EventRow | null;
  if (!event || event.template !== 'landing') return { title: 'Not Found' };
  const description = plainTextExcerpt(event.description_html);
  return {
    // Bare title — the root layout's `title.template` ('%s | Brik Designs')
    // appends the site suffix. Appending it here too double-suffixes (#587).
    title: event.title,
    description,
    openGraph: {
      title: event.title,
      description,
      type: 'website',
      images: event.hero_image_url ? [event.hero_image_url] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: event.title,
      description,
    },
  };
}

export default async function LandingPage({ params }: Props) {
  const { slug } = await params;
  const event = (await getEventBySlug(slug)) as EventRow | null;
  // The marketing-root vanity URL serves `landing`-template rows only; events
  // live at /events/[slug], newsletters at /marketing/[slug]. Draft rows aren't
  // returned by RLS → also 404.
  if (!event || event.template !== 'landing') notFound();

  const accent = eventAccent(event.accent_color_token);
  const ended = event.status === 'ended';
  const blocks = parseBlocks(event.blocks);
  const alertBanner = parseAlertBanner(event.alert_banner);

  return (
    <>
      {alertBanner && <AlertBannerBlock {...alertBanner} />}
      <LandingBlocks
        blocks={blocks}
        context={{ rowId: event.id, accent, ended }}
        layout={event.layout}
        surface={landingSurface(event.accent_color_token, event.surface_treatment)}
      />
    </>
  );
}
