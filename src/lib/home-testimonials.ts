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
// ⚠ NEVER pair a real client logomark with a bracketed placeholder quote. Every
// row briefly carried the Birdwell Mutlak logo beside `[Client name]`, which
// rendered as three testimonials Birdwell never gave; the logos were pulled in
// #1125. A `logoSrc` may only return to a row whose `quote` / `authorName` /
// `businessType` are real and sourced from that same client — and each row must
// carry its OWN client's logo, never a shared stand-in.

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
