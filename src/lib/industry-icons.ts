// Industry → Phosphor (`ph:*`) glyph mapping — the single source for the
// industry icon vocabulary shared by the customer-story index cards
// (CustomerStoryCard), the story detail page, and the Footer customer links.
// Glyphs render through the site's offline `<Icon>` (@/lib/icon), which bundles
// the referenced `ph:*` set with no CDN round-trip (#626).
//
// Kept local (not promoted to BDS): brikdesigns deliberately does not consume
// BDS's icon component for performance (#626), and this is the only surface
// using industry glyphs today. Promote to a BDS-owned mapping when a second
// surface needs it — see brikdesigns#139.
export const INDUSTRY_ICONS: Record<string, string> = {
  'Small Business': 'ph:storefront',
  'Dental': 'ph:tooth',
  'Real Estate': 'ph:house',
};

/** Glyph for an industry not present in INDUSTRY_ICONS. */
export const INDUSTRY_ICON_FALLBACK = 'ph:buildings';
