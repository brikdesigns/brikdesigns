import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { getEventBySlug, getPublicEventSlugs } from '@/lib/supabase/queries';
import {
  type EventRow,
  eventAccent,
  landingSurface,
  fieldLabel,
  feeLabel,
  formatEventDate,
  plainTextExcerpt,
} from '@/lib/events';
import { sanitizeHtml } from '@/lib/sanitize';
import { parseBlocks, parseAlertBanner } from '@/lib/blocks';
import { LandingBlocks, AlertBannerBlock } from '@/components/blocks';
import { EventRegistrationForm } from '@/components/marketing/EventRegistrationForm';
import { EventEndedBanner } from '@/components/marketing/EventStatusBanner';
import { heading, text, label } from '@/lib/styles';
import { color, gap } from '@/lib/tokens';
import { Icon } from '@/lib/icon';
import '../../shared-sections.css';
import '../events.css';

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 3600;

export async function generateStaticParams() {
  const events = await getPublicEventSlugs('event');
  return events.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const event = (await getEventBySlug(slug)) as EventRow | null;
  if (!event || event.template !== 'event') return { title: 'Event Not Found' };
  const description = plainTextExcerpt(event.description_html);
  return {
    title: `${event.title} | Events`,
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

export default async function EventPage({ params }: Props) {
  const { slug } = await params;
  const event = (await getEventBySlug(slug)) as EventRow | null;
  // /events/[slug] serves event-template rows only — newsletters live at
  // /marketing/[slug]. Draft events aren't returned by RLS → also 404.
  if (!event || event.template !== 'event') notFound();

  const accent = eventAccent(event.accent_color_token);
  const ended = event.status === 'ended';
  const sponsors = Array.isArray(event.sponsor_logos) ? event.sponsor_logos : [];
  const blocks = parseBlocks(event.blocks);
  const alertBanner = parseAlertBanner(event.alert_banner);

  return (
    <>
      {alertBanner && <AlertBannerBlock {...alertBanner} />}
      {blocks.length > 0 ? (
        <LandingBlocks
          blocks={blocks}
          context={{ rowId: event.id, accent, ended }}
          layout={event.layout}
          surface={landingSurface(event.accent_color_token, event.surface_treatment)}
        />
      ) : (
    <section className="event-page service-surface" style={{ backgroundColor: accent.surfaceLight }}>
      <div className="event-page__grid">
        <div className="event-page__content">
          {event.hero_image_url && (
            <div className="event-page__hero">
              <Image
                src={event.hero_image_url}
                alt={event.title}
                fill
                sizes="(max-width: 991px) 100vw, 60vw"
                style={{ objectFit: 'cover' }}
                priority
              />
            </div>
          )}

          <h1 className="page-hero__title">{event.title}</h1>

          <div className="event-page__meta">
            {event.event_date && (
              <span className="event-page__meta-item" style={{ ...label.sm, color: color.text.secondary }}>
                <Icon icon="ph:calendar-blank" width={16} height={16} aria-hidden />
                {formatEventDate(event.event_date)}
              </span>
            )}
            {event.event_time && (
              <span className="event-page__meta-item" style={{ ...label.sm, color: color.text.secondary }}>
                <Icon icon="ph:clock" width={16} height={16} aria-hidden />
                {event.event_time}
              </span>
            )}
            <span className="event-page__meta-item" style={{ ...label.sm, color: color.text.secondary }}>
              <Icon icon="ph:ticket" width={16} height={16} aria-hidden />
              {feeLabel(event.fee)}
            </span>
          </div>

          {event.description_html && (
            <div
              className="event-page__description"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(event.description_html) }}
            />
          )}

          {(event.speaker_name || event.speaker_bio) && (
            <div className="event-page__speaker">
              {event.speaker_name && (
                <h2 style={{ ...heading.sm, marginBottom: gap.xs }}>{event.speaker_name}</h2>
              )}
              {event.speaker_bio && (
                <p style={{ ...text.body, color: color.text.secondary, margin: 0 }}>
                  {event.speaker_bio}
                </p>
              )}
            </div>
          )}

          {sponsors.length > 0 && (
            <div className="event-page__sponsors">
              {sponsors.map((s, i) => {
                const img = (
                  <Image
                    src={s.url}
                    alt={s.alt || ''}
                    width={120}
                    height={48}
                    style={{ objectFit: 'contain' }}
                  />
                );
                return s.href ? (
                  <a key={s.url || i} href={s.href} target="_blank" rel="noopener noreferrer">
                    {img}
                  </a>
                ) : (
                  <span key={s.url || i}>{img}</span>
                );
              })}
            </div>
          )}
        </div>

        <aside className="event-page__form-col">
          {/* Accent is applied to decorative surfaces only (section tint +
              card top border) — NOT the submit button fill. White button text
              on a light palette accent (e.g. brand gold) fails WCAG contrast
              (caught by the a11y gate); the BDS primary button keeps its
              designed, accessible colors. */}
          <div className="event-page__form-card" style={{ borderTopColor: accent.bg }}>
            {ended ? (
              <EventEndedBanner />
            ) : (
              <>
                <h2 style={{ ...heading.sm, marginBottom: gap.md }}>Register</h2>
                <EventRegistrationForm
                  eventId={event.id}
                  variant="event"
                  source="event_signup"
                  companyLabel={fieldLabel(
                    event.form_config,
                    'practice_name',
                    'Practice / Company (optional)',
                  )}
                />
              </>
            )}
          </div>
        </aside>
      </div>
    </section>
      )}
    </>
  );
}
