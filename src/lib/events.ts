/**
 * Shared types + helpers for the public event/newsletter landing pages
 * (/events/[slug], /marketing/[slug]). The Supabase row shape mirrors the
 * portal migration 00200 (brik-client-portal/supabase/migrations) — the
 * public client is untyped, so this interface is the typed surface the
 * templates render against.
 */

import { serviceColor } from './tokens';

export interface SponsorLogo {
  url: string;
  alt: string;
  href: string;
}

export interface EventRow {
  id: string;
  slug: string;
  title: string;
  description_html: string | null;
  speaker_name: string | null;
  speaker_bio: string | null;
  event_date: string | null;
  event_time: string | null;
  fee: number | null;
  template: 'event' | 'newsletter';
  status: 'draft' | 'active' | 'ended';
  accent_color_token: string | null;
  hero_image_url: string | null;
  sponsor_logos: SponsorLogo[];
  form_config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/**
 * Map the stored service-line palette slug ('brand' | 'marketing' | … ) to its
 * BDS color tokens. Events store the slug (portal TokenPicker, brik-client-
 * portal#965); we tolerate a full `--background-service-*` var name too in
 * case the column is ever populated that way. Null / unknown → brand.
 */
export function eventAccent(token: string | null | undefined) {
  const slug = (token || 'brand')
    .replace(/^--background-service-/, '')
    .replace(/^--surface-service-/, '');
  return serviceColor(slug);
}

/** Resolve a form-field label, honouring per-event form_config overrides. */
export function fieldLabel(
  formConfig: Record<string, unknown> | null | undefined,
  key: string,
  fallback: string,
): string {
  const v = formConfig?.[key];
  return typeof v === 'string' && v.trim() ? v : fallback;
}

/** Human fee label — null fee means the event is free. */
export function feeLabel(fee: number | null): string {
  return fee == null ? 'Free' : `$${Number(fee).toFixed(2)}`;
}

/** Format a yyyy-mm-dd event_date for display. Returns '' for null. */
export function formatEventDate(date: string | null): string {
  if (!date) return '';
  // Parse as a plain date (no tz shift) — event_date is a DATE column.
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return date;
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Crude tag-strip for building a meta description from description_html. */
export function plainTextExcerpt(html: string | null, max = 200): string | undefined {
  if (!html) return undefined;
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    // Decode the common named/numeric entities so OG previews don't show
    // raw "&amp;" / "&#39;" in link cards.
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;|&rsquo;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return undefined;
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}
