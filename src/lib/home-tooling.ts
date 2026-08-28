// R2 home "Tooling" section (brikdesigns#1055): "Tools we know."
// A monochrome logo ticker (BDS <Marquee>) of the platforms Brik works in.
// Copy + tool list are verbatim from the Homepage-R2 Notion doc ("Tools we
// know." section); the design (Figma node 25768:6728 title + 25833:3022 logos)
// is a single scrolling grey logo row, base.org "trusted by" style.
//
// SOURCING NOTE — the R2 list names 21 tools, but only these 8 have a
// license-clean pre-monochromed brand SVG (simple-icons, CC0). The other 13
// niche dental/property tools (GoHighLevel, Monday.com, Trainual, Connecteam,
// Adit, Dental Intel, RevenueWell, Weave, Flex, Nexhealth, RentManager,
// ResNexus, Newbook) have no available monochrome logo and are DEFERRED to a
// follow-up rather than fabricated. Kept in the Notion list order.

export interface ToolingLogo {
  /** Brand name — used verbatim as the image `alt`. */
  name: string;
  /** Pre-monochromed single-color SVG under /public/logos/tooling. */
  src: string;
}

export const TOOLING_LOGOS: ToolingLogo[] = [
  { name: 'HubSpot', src: '/logos/tooling/hubspot.svg' },
  { name: 'Google Workspace', src: '/logos/tooling/google.svg' },
  { name: 'Microsoft 365', src: '/logos/tooling/microsoft.svg' },
  { name: 'Slack', src: '/logos/tooling/slack.svg' },
  { name: 'Gusto', src: '/logos/tooling/gusto.svg' },
  { name: 'Stripe', src: '/logos/tooling/stripe.svg' },
  { name: 'Notion', src: '/logos/tooling/notion.svg' },
  { name: 'Calendly', src: '/logos/tooling/calendly.svg' },
];
