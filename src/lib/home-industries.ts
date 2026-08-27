// R2 home "Industries" section (brikdesigns#1054): "Where we do our best work."
// A MediaTabs peer selector — one tab per industry, each revealing its blurb and
// a synced illustration panel (Figma node 25768:6527, ratified as tabs).
//
// The blurbs are the curated R2 marketing copy, verbatim from the Homepage-R2
// Notion doc ("Where we do our best work" section) — NOT the industry_pages
// tagline/intro (those are the /industries landing copy). The illustration for
// each tab is sourced from `industry_pages.image_url` (DB is SoT for imagery),
// joined by `slug`. R2 names exactly these three (SaaS is excluded from home).

export interface HomeIndustry {
  /** `industry_pages.slug` — joins the DB row for the illustration. */
  slug: string;
  /** Tab label. */
  label: string;
  /** R2 blurb, verbatim from Notion. */
  description: string;
}

export const HOME_INDUSTRIES: HomeIndustry[] = [
  {
    slug: 'dental',
    label: 'Dental',
    description:
      'Marketing and back office for practices at every stage — from new ownership to exit planning.',
  },
  {
    slug: 'real-estate',
    label: 'Real Estate',
    description:
      'For property owners, management companies, and brokers building the infrastructure to match the portfolio.',
  },
  {
    slug: 'small-business',
    label: 'Small Business',
    description:
      "Service-based businesses at every stage. We've helped owners get out from under the business side — and keep it that way.",
  },
];
