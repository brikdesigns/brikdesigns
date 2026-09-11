// R2 home "Industries" section (brikdesigns#1054): "Where we do our best work."
// A MediaTabs peer selector — one tab per industry, each revealing its blurb and
// a synced illustration panel (Figma node 25768:6527, ratified as tabs).
//
// The blurbs are the curated R2 marketing copy, verbatim from the Homepage-R2
// Notion doc ("Where we do our best work" section) — NOT the industry_pages
// tagline/intro (those are the /industries landing copy). The illustration for
// each tab is a curated static asset in `public/images/industries/` — NOT the
// shared `industry_pages.image_url`, which is an icon reused at 240×240 in
// /industries + the MegaNav; the home/hww section wants a wide 664×498
// illustration, so its art is decoupled here. R2 names exactly these three
// (SaaS is excluded from home).

export interface HomeIndustry {
  /** Stable tab id (was the `industry_pages.slug` join key). */
  slug: string;
  /** Tab label. */
  label: string;
  /** R2 blurb, verbatim from Notion. */
  description: string;
  /** Curated illustration under `public/` (root-relative). */
  illustration: string;
}

export const HOME_INDUSTRIES: HomeIndustry[] = [
  {
    slug: 'dental',
    label: 'Dental',
    description:
      'Marketing and back office for practices at every stage — from new ownership to exit planning.',
    illustration: '/images/industries/industry_dental_2x.webp',
  },
  {
    slug: 'real-estate',
    label: 'Real Estate',
    description:
      'For property owners, management companies, and brokers building the infrastructure to match the portfolio.',
    illustration: '/images/industries/industry_real-estate_2x.webp',
  },
  {
    slug: 'small-business',
    label: 'Small Business',
    description:
      "Service-based businesses at every stage. We've helped owners get out from under the business side — and keep it that way.",
    illustration: '/images/industries/industry_small_business_2x.webp',
  },
];
