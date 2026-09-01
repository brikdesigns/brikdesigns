// R2 home "Tooling" section (brikdesigns#1055): "Tools we know."
// A monochrome logo ticker (BDS <Marquee>) of the platforms Brik works in.
// Copy + tool list are verbatim from the Homepage-R2 Notion doc ("Tools we
// know." section); the design (Figma node 25768:6728 title + 25833:3022 logos)
// is a single scrolling grey logo row, base.org "trusted by" style.
//
// SOURCING NOTE — the R2 list names 21 tools; these 8 ship. All 8 are
// simple-icons marks: CC0, already single-colour, and explicitly free to
// recolour, which is what makes them safe for the treatment below.
//
// The other 13 are BLOCKED, not pending (#1068, audited 2026-08-31). Read this
// before adding any of them:
//
//   • simple-icons has none of them — 0 of 13 across 3458 icons, searched by
//     title, slug and source.
//   • monday.com PROHIBITS monochrome outright: "Always use the colored version
//     of the logo. We don't use it in monochrome" (press kit) and "Don't use one
//     color" (brand-monday.com/logo).
//   • Weave PERMITS a monochrome mark, but only two exact colours — "white and
//     dark grey" — and lists "do not change the colors logo" as misuse. That is
//     still incompatible with this ticker: `.tooling-logo` (homepage.css:291)
//     takes a BLACK source glyph and applies `opacity: 0.55`, then `invert(1)`
//     on the dark band. Both are colour changes, so shipping Weave here breaks
//     the very permission that clears it. Adding it needs a per-logo carve-out
//     from that rule, not just the file.
//   • The remaining 10 (GoHighLevel, Trainual, Connecteam, Adit, Dental Intel,
//     RevenueWell, NexHealth, Rent Manager, ResNexus, Newbook) publish NO logo
//     guidance at all — seven standard brand/press paths probed per domain.
//     No published permission is not implied permission.
//   • "Flex" cannot be actioned: no dental or property tool resolves from the
//     bare name. It needs the vendor identified before it can even be audited.
//
// So the shortfall is a licensing constraint, not a sourcing backlog. Do not
// "finish the list" by pulling marks off a logo aggregator — that is the
// fabrication this note has always existed to prevent. Kept in Notion order.

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
