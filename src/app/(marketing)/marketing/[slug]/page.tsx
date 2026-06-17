import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { getEventBySlug, getPublicEventSlugs } from '@/lib/supabase/queries';
import { type EventRow, eventAccent, plainTextExcerpt } from '@/lib/events';
import { sanitizeHtml } from '@/lib/sanitize';
import { parseBlocks, parseAlertBanner } from '@/lib/blocks';
import { BlockRenderer, AlertBannerBlock } from '@/components/blocks';
import { EventRegistrationForm } from '@/components/marketing/EventRegistrationForm';
import { EventEndedBanner } from '@/components/marketing/EventStatusBanner';
import { heading, text } from '@/lib/styles';
import { color, gap } from '@/lib/tokens';
import '../../shared-sections.css';
import '../marketing.css';

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 3600;

export async function generateStaticParams() {
  const events = await getPublicEventSlugs('newsletter');
  return events.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const event = (await getEventBySlug(slug)) as EventRow | null;
  if (!event || event.template !== 'newsletter') return { title: 'Not Found' };
  const description = plainTextExcerpt(event.description_html);
  return {
    title: `${event.title} | Brik Designs`,
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

export default async function MarketingPage({ params }: Props) {
  const { slug } = await params;
  const event = (await getEventBySlug(slug)) as EventRow | null;
  // /marketing/[slug] serves newsletter-template rows only — events live at
  // /events/[slug]. Draft rows aren't returned by RLS → also 404.
  if (!event || event.template !== 'newsletter') notFound();

  const accent = eventAccent(event.accent_color_token);
  const ended = event.status === 'ended';
  const blocks = parseBlocks(event.blocks);
  const alertBanner = parseAlertBanner(event.alert_banner);

  return (
    <>
      {alertBanner && <AlertBannerBlock {...alertBanner} />}
      {blocks.length > 0 ? (
        <section className="lp-blocks">
          <div className="lp-blocks__container">
            <BlockRenderer blocks={blocks} context={{ rowId: event.id, accent, ended }} />
          </div>
        </section>
      ) : (
    <section className="marketing-page" style={{ backgroundColor: accent.surfaceLight }}>
      <div className="marketing-page__container">
        {event.hero_image_url && (
          <div className="marketing-page__hero">
            <Image
              src={event.hero_image_url}
              alt={event.title}
              fill
              sizes="(max-width: 991px) 100vw, 640px"
              style={{ objectFit: 'cover' }}
              priority
            />
          </div>
        )}

        <h1 style={heading.lg}>{event.title}</h1>

        {event.description_html && (
          <div
            className="marketing-page__description"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(event.description_html) }}
          />
        )}

        <div className="marketing-page__form-card" style={{ borderTopColor: accent.bg }}>
          {ended ? (
            <EventEndedBanner />
          ) : (
            <>
              <h2 style={{ ...heading.sm, marginBottom: gap.xs }}>Sign Up</h2>
              <p style={{ ...text.bodySm, color: color.text.secondary, marginTop: 0, marginBottom: gap.md }}>
                Enter your email and we&apos;ll be in touch.
              </p>
              <EventRegistrationForm
                eventId={event.id}
                variant="newsletter"
                source="newsletter_signup"
                submitLabel="Subscribe"
              />
            </>
          )}
        </div>
      </div>
    </section>
      )}
    </>
  );
}
