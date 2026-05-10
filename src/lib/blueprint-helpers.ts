/**
 * Shared defaults for BlueprintProps on brikdesigns marketing pages.
 *
 * Every BDS blueprint accepts the same `BlueprintProps` shape — `section`,
 * `clientFacts`, `theme`. brikdesigns is a single-tenant marketing site,
 * so `clientFacts` and `theme` are constant across all pages and don't
 * vary per-page like they would in a templated multi-tenant scaffold.
 *
 * Per-page renderers import these defaults instead of redeclaring the
 * full prop shape inline.
 */
import type { BlueprintProps } from '@brikdesigns/bds';

export const defaultClientFacts: BlueprintProps['clientFacts'] = {
  brandName: 'Brik Designs',
  tagline: null,
  valueProposition: null,
  services: [],
  phone: null,
  email: null,
  address: null,
  hours: [],
  heroImageUrl: null,
  logoUrl: null,
  logoVariants: {},
};

export const defaultMarketingTheme: BlueprintProps['theme'] = {
  themeMode: 'light',
  atmosphere: 'none',
  navigationArchetype: 'utility-first',
  footerArchetype: 'four_col_directory',
};
