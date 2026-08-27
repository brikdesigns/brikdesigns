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
// Three R2 capabilities have no backing service and are a tracked content gap
// (needs copy + a 3D illustration before they can render):
//   • Marketing   → Review generation, Lead nurture
//   • Back Office → Reporting and dashboards
// Once those exist each tab fills to the Figma count (Marketing 6, Back Office
// 5); until then Marketing and Back Office render 4 cards each. This is a
// curated visibility array in the spirit of `meganav-columns.ts` — a rename of
// any listed `services.slug` silently drops its card, caught by the render.

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
