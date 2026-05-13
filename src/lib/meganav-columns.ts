/**
 * Hand-curated meganav columns — keyed by `service_lines.slug` (short form:
 * brand / marketing / information / service). Slug values match the canonical
 * Brik service catalog as of the 2026-04 reorg, NOT Webflow's old slugs.
 *
 * Each entry's `slugs` is filtered against the live `services` table:
 * a service slug that doesn't exist in Supabase (or has `is_public = false`)
 * is silently dropped from the column.
 *
 * Coverage gaps surface via `npm run audit:meganav` (brikdesigns#112).
 *
 * Long-term: replace this hand-curated list with a `services.show_in_nav`
 * boolean + sort_order column so the admin CMS owns nav membership.
 */
export interface NavColumn {
  tagline: string;
  slugs: string[];
}

export const NAV_COLUMNS: Record<string, NavColumn> = {
  brand: {
    tagline: 'Shape your identity',
    slugs: [
      'logo-design',
      // `brand-identity` was stale (no public service with this slug) per
      // #112 audit. Left out pending decision on whether it was renamed or
      // archived — re-add if a matching DB slug is identified.
      'brand-guidelines',
      'business-stationery',
      'online-business-listings',
      'business-card',
      'email-signature',
    ],
  },
  marketing: {
    tagline: 'Connect and convert',
    slugs: [
      'website-experience-mapping',
      'patient-experience-mapping',
      'web-design',
      'email-marketing',
      'landing-pages',
      'social',
      'swag',
      'marketing-consulting',
    ],
  },
  information: {
    tagline: 'Simplify the complex',
    slugs: [
      'layout-design',
      'sales-resources',
      'welcome-onboarding-kit',
      'infographics',
      'presentation-design',
      'signage-design',
      'intake-forms',
    ],
  },
  // 'service' is the DB slug for the Back Office Design line.
  service: {
    tagline: 'Make work flow',
    slugs: [
      'software-automation-setup',
      'digital-file-organization',
      'sop-creation',
      'training-setup',
      'crm-setup-and-data-cleanup',
      'automated-workflow-and-ai-integration',
      'customer-journey-mapping',
      'software-subscription-audit',
    ],
  },
};
