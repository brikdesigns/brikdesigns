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
  // Block model (portal migration 00207). The public client is untyped, so
  // these arrive as raw jsonb — normalize with parseBlocks() / parseAlertBanner()
  // from '@/lib/blocks' before rendering. An empty `blocks` array means
  // "render from the legacy columns" (the 00207 fallback contract, #423).
  blocks: unknown;
  layout: string | null;
  // Page-level surface treatment for the block render (#423). Optional — the
  // column lands with the portal migration; reads default to 'none' until then.
  surface_treatment?: SurfaceTreatment | null;
  alert_banner: unknown;
  created_at: string;
  updated_at: string;
}

/**
 * How the block-render section paints its accent: a full `solid` brand/service
 * surface (white-on-color), a `tint` (the `-light` surface + the service-surface
 * dark-pin), or `none` (neutral). The hue comes from `accent_color_token`;
 * the treatment chooses the surface family + text pairing.
 */
export type SurfaceTreatment = 'solid' | 'tint' | 'none';

export interface LandingSurface {
  /** Inline background CSS value, or undefined for the neutral surface. */
  background?: string;
  /** Text-pairing class that re-points `--text-*` for the section subtree. */
  className: string;
}

/**
 * Resolve the page-level surface for a block-rendered landing page from its
 * `accent_color_token` hue + `surface_treatment`. Each pairing is a canonical
 * BDS (surface, text) combination — validated by the color-pairing foundation
 * (brik-bds#868) and the axe gate; blocks never re-point a token per-element.
 */
export function landingSurface(
  token: string | null | undefined,
  treatment: SurfaceTreatment | null | undefined,
): LandingSurface {
  const t = treatment ?? 'none';
  if (t === 'none') return { className: '' };

  const slug = (token || 'brand')
    .replace(/^--background-service-/, '')
    .replace(/^--surface-service-/, '');

  if (t === 'tint') {
    // Fixed-light tint + the globals.css dark-pin (keeps text dark in dark mode).
    return { background: eventAccent(slug).surfaceLight, className: 'service-surface' };
  }

  // solid: full color surface, white text via the lp-surface-solid pin.
  // 'brand' uses the primary brand surface; the service hues use their solid
  // service surface.
  const background = slug === 'brand' ? 'var(--surface-brand-primary)' : eventAccent(slug).surface;
  return { background, className: 'lp-surface-solid' };
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
