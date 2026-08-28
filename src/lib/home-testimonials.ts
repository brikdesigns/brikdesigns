// R2 "What clients say" Testimonials section (Homepage-R2 Notion doc + Figma
// node 25157:16902): three alternating rows, each a client logo tile beside a
// quote + attribution.
//
// PLACEHOLDER CONTENT — structure only. The R2 Notion doc reserves this
// section's real copy until 2–3 client engagements are complete ("no names
// required" until then). These entries are intentionally bracketed so they read
// as a template, never as a fabricated client quote (Brik provenance doctrine:
// never assert a checkable client fact without a source). Replace `quote` /
// `authorName` / `businessType` with real, sourced testimonials before launch.
//
// ⚠ PRODUCTION-PROMOTE BLOCKER: row 1 now carries a REAL client logomark
// (Birdwell Mutlak) beside a placeholder quote and a bracketed `[Client name]`.
// That pairing reads as a testimonial Birdwell never gave, so this section must
// not reach production until row 1's quote + attribution are real and sourced —
// or the logo comes back out. Staging preview only. Tracked on #1047.

export interface Testimonial {
  id: string;
  quote: string;
  authorName: string;
  businessType: string;
  /** Client logomark under /logos/clients/. Absent → the placeholder tile. */
  logoSrc?: string;
  /** Accessible name for the logomark. Required whenever `logoSrc` is set. */
  logoAlt?: string;
}

export const TESTIMONIALS: Testimonial[] = [
  {
    id: 'placeholder-1',
    quote:
      '[Client quote — a specific outcome: time saved, revenue found, or something they no longer have to do themselves.]',
    authorName: '[Client name]',
    businessType: '[Business type]',
    logoSrc: '/logos/clients/birdwell-mutlak.svg',
    logoAlt: 'Birdwell Mutlak',
  },
  {
    id: 'placeholder-2',
    quote:
      '[Client quote — what the BrikDown revealed, and what changed in real terms after.]',
    authorName: '[Client name]',
    businessType: '[Business type]',
  },
  {
    id: 'placeholder-3',
    quote:
      '[Client quote — the before, the a-ha, and the after, in the client’s own words.]',
    authorName: '[Client name]',
    businessType: '[Business type]',
  },
];
