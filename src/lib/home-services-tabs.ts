// R2 home "Services" section (brikdesigns#1053): a Marketing / Back-Office
// SegmentedControl toggling two card grids (Figma node 25768:6723). The R2
// Notion doc ("Marketing AND back office. One team for both.") groups Brik's
// offer into two peer sets of capabilities; this file maps each capability to
// the closest existing `services` row, so every card carries real copy, a real
// illustration, and a working `/services/{line}/{slug}` route.
//
// PROPOSED mapping — ratify in review (#1053). Card title / description / image
// / ServiceTag all come from the mapped `services` row (real content, real
// route), NOT from the Notion capability phrasing — some of which (e.g. "Email
// & SMS marketing") overstates the current service (Email Marketing only), so
// asserting it as a card title would be an unsourced capability claim.
//
// 4 + 4 is the SETTLED count, not a shortfall (#1065, closed 2026-09-03).
//
// Three R2 capabilities in the Notion doc have no backing `services` row, and
// none of the three is coming:
//   • Marketing   → Review generation, Lead nurture — not offerings Brik sells.
//     OPERATOR SAID 2026-09-03 (chat, answering whether the earlier uncited
//     "drop them" note was right): "Correct — they're out".
//   • Back Office → Reporting and dashboards. A row exists
//     (`data-management-reporting`, `is_public=false`), but Stripe — the source
//     of truth — carries no product for it in any tier: a full paginated sweep
//     with no `active` filter returned 80 products, 0 inactive, and the three
//     `prod_Tp3*` ids its offerings mirror all 404 `resource_missing`. They are
//     the only 3 dead mirrors out of 71. OPERATOR SAID 2026-09-03 (chat, asked
//     whether Brik still sells it): "No — retire it".
//
// So the Figma counts of 6 and 5 (node 25768:6723) describe a capability list
// that was pruned after the design. Do not treat 4 + 4 as pending work, and do
// not re-derive the gap from Figma — the delta is content that was withdrawn,
// not content that is late.
//
// This is a curated visibility array in the spirit of `meganav-columns.ts` — a
// rename of any listed `services.slug` silently drops its card, caught by the
// render.

export interface HomeServicesTab {
  /** Stable id — SegmentedControl value + panel ARIA wiring. */
  id: string;
  /** Segment label shown in the toggle. */
  label: string;
  /** Ordered `services.slug` values sourced into this tab's card grid. */
  serviceSlugs: string[];
}

export const HOME_SERVICES_TABS: HomeServicesTab[] = [
  {
    id: 'marketing',
    label: 'Marketing',
    serviceSlugs: [
      'brand-guidelines',
      'email-marketing',
      'web-design',
      'online-business-listings',
    ],
  },
  {
    id: 'back-office',
    label: 'Back Office',
    serviceSlugs: [
      'sop-creation',
      'crm-setup-and-data-cleanup',
      'welcome-onboarding-kit',
      'software-subscription-audit',
    ],
  },
];
