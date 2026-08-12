/**
 * Series-category registry — the code-owned visual identity for an event's
 * `series` slug (portal migration 00307). The composer authors only the slug
 * (brik-client-portal /settings/events); brikdesigns resolves it here to a
 * display label + Phosphor icon, mirroring how `accent_color_token` stores a
 * service-line slug that resolves to BDS tokens. No hex/icons live in the DB.
 *
 * The tag's ground colour is owned by CSS (`.lp-showcase__series-tag`,
 * blocks.css) — a fixed green-light primitive — not stored per-series here.
 * Adding a series with a different ground is a deliberate code change in both
 * places.
 */
export interface SeriesIdentity {
  /** Display label rendered in the tag. */
  label: string;
  /** Phosphor icon id (`ph:*`); bundled by `npm run gen:icons`. */
  icon: string;
}

export const SERIES_REGISTRY: Record<string, SeriesIdentity> = {
  'dine-and-develop': { label: 'Dine & Develop Series', icon: 'ph:wine' },
};

/** Resolve a series slug to its identity, or null for unknown / unset slugs. */
export function seriesIdentity(slug: string | null | undefined): SeriesIdentity | null {
  if (!slug) return null;
  return SERIES_REGISTRY[slug] ?? null;
}
