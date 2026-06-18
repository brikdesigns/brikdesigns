/**
 * BDS Token Reference for brikdesigns.com
 *
 * Maps Figma style names → CSS custom property strings.
 * Source of truth: brik-bds/tokens/figma-tokens.css + brik-bds/tokens/gap-fills.css.
 *
 * WHY THIS EXISTS:
 * Figma shows "body/md · 16/150" but code needs "var(--body-md)".
 * This file makes that conversion instant — import and use, no guessing.
 *
 * USAGE:
 *   import { font, color, space, gap, border } from '@/lib/tokens';
 *   style={{ fontSize: font.size.body.md, color: color.text.primary }}
 *
 * DO NOT hardcode px values or hex colors. If a token is missing, add it here
 * and reference brik-bds/tokens/figma-tokens.css for the correct variable name.
 *
 * Mirrors brik-client-portal/src/lib/tokens.ts so the typed surface is shared
 * across product + marketing repos. Differences from the portal version are
 * marked with `// brikdesigns:` comments.
 */

// ─── Typography ──────────────────────────────────────────────────────

export const font = {
  family: {
    body: 'var(--font-family-body)',
    heading: 'var(--font-family-heading)',
    label: 'var(--font-family-label)',
    display: 'var(--font-family-display)',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },

  /**
   * Font sizes — maps to Figma typography styles
   *
   * Figma style        → Token                    → Resolved (Base)
   * ─────────────────────────────────────────────────────────────────
   * body/tiny           → --body-tiny              → 10.26px
   * body/xs             → --body-xs                → 11.54px
   * body/sm (14/150)    → --body-sm                → 14px
   * body/md (16/150)    → --body-md                → 16px
   * body/lg (18/150)    → --body-lg                → 18px
   * body/xl (20/150)    → --body-xl                → 20px
   * body/huge           → --body-huge              → 25.3px
   * label/sm            → --label-sm               → 14px
   * label/md            → --label-md               → 16px
   * label/lg            → --label-lg               → 18px
   * label/xl            → --label-xl               → 20px
   * heading/tiny        → --heading-tiny           → 18px
   * heading/small       → --heading-sm             → 20px
   * heading/medium      → --heading-md             → 25.3px
   * heading/large       → --heading-lg             → 32px
   */
  size: {
    body: {
      tiny: 'var(--body-tiny)',
      xs: 'var(--body-xs)',
      sm: 'var(--body-sm)',
      md: 'var(--body-md)',
      lg: 'var(--body-lg)',
      xl: 'var(--body-xl)',
      huge: 'var(--body-huge)',
    },
    label: {
      tiny: 'var(--label-tiny)',
      sm: 'var(--label-sm)',
      md: 'var(--label-md)',
      lg: 'var(--label-lg)',
      xl: 'var(--label-xl)',
    },
    heading: {
      tiny: 'var(--heading-tiny)',
      small: 'var(--heading-sm)',
      medium: 'var(--heading-md)',
      large: 'var(--heading-lg)',
      xLarge: 'var(--heading-xl)',
      xxLarge: 'var(--heading-xxl)',
      xxxLarge: 'var(--heading-huge)',
    },
    icon: {
      sm: 'var(--icon-sm)',
      md: 'var(--icon-md)',
      lg: 'var(--icon-lg)',
    },
    display: {
      sm: 'var(--display-sm)',
      md: 'var(--display-md)',
      lg: 'var(--display-lg)',
      xl: 'var(--display-xl)',
    },
  },

  lineHeight: {
    none: 'var(--font-line-height-none)',
    tight: 'var(--font-line-height-tight)',
    snug: 'var(--font-line-height-snug)',
    normal: 'var(--font-line-height-normal)',
    relaxed: 'var(--font-line-height-relaxed)',
    loose: 'var(--font-line-height-loose)',
  },

  weight: {
    light: 300 as const,
    regular: 400 as const,
    medium: 500 as const,
    semibold: 600 as const,
    bold: 700 as const,
  },
} as const;

// ─── Colors ──────────────────────────────────────────────────────────

export const color = {
  text: {
    primary: 'var(--text-primary)',
    secondary: 'var(--text-secondary)',
    muted: 'var(--text-muted)',
    brand: 'var(--text-brand-primary)',
    inverse: 'var(--text-inverse)',
    onColorDark: 'var(--text-on-color-dark)',
    onColorLight: 'var(--text-on-color-light)',
    negative: 'var(--text-negative)',
    warning: 'var(--text-warning)',
    success: 'var(--text-positive)',
  },
  surface: {
    primary: 'var(--surface-primary)',
    secondary: 'var(--surface-secondary)',
    negative: 'var(--surface-negative)',
    warning: 'var(--surface-warning)',
    success: 'var(--surface-positive)',
    overlay: 'var(--surface-overlay)',
    brandPrimary: 'var(--surface-brand-primary)',
    brandSecondary: 'var(--surface-brand-secondary)',
  },
  background: {
    primary: 'var(--background-primary)',
    secondary: 'var(--background-secondary)',
    brandPrimary: 'var(--background-brand-primary)',
    inverse: 'var(--background-inverse)',
    input: 'var(--background-input)',
    onColorDark: 'var(--background-on-color-dark)',
  },
  border: {
    primary: 'var(--border-primary)',
    secondary: 'var(--border-secondary)',
    muted: 'var(--border-muted)',
    brand: 'var(--border-brand-primary)',
    negative: 'var(--border-negative)',
    success: 'var(--border-positive)',
    input: 'var(--border-input)',
    inverse: 'var(--border-inverse)',
  },
  page: {
    primary: 'var(--page-primary)',
    secondary: 'var(--page-secondary)',
    accent: 'var(--page-accent)',
  },
  system: {
    link: 'var(--text-link)',
    red: 'var(--color-system-red)',
    redLight: 'var(--color-system-red-light)',
    green: 'var(--color-system-green)',
    greenLight: 'var(--color-system-green-light)',
    yellow: 'var(--color-system-yellow)',
    yellowLight: 'var(--color-system-yellow-light)',
    blue: 'var(--color-system-blue)',
    blueLight: 'var(--color-system-blue-light)',
    orange: 'var(--color-system-orange)',
    orangeLight: 'var(--color-system-orange-light)',
    purple: 'var(--color-system-purple)',
    purpleLight: 'var(--color-system-purple-light)',
    neutral: 'var(--color-system-neutral)',
    neutralLight: 'var(--color-system-neutral-light)',
  },
  // brikdesigns: Brik's marketing site IS the surface that introduces the
  // five service categories to the public, so service tokens belong here.
  // (`service` is the token *namespace*, not the back-office line.) The
  // back-office line's sub-key is `back-office` to match BDS 0.81.0's
  // canonical ServiceLine member; the legacy `service` line slug falls
  // through to it in serviceColor(). Token suffix is `back-office` (#797).
  service: {
    // CTA pairing note: service buttons use the base `bg` fill + the neutral
    // `--text-on-color-light` foreground (the canonical BDS service-button
    // pattern, ≥AA on all five lines). The former `ctaBg`/`ctaText` consumer
    // pairing (#346) is retired — contrast now lives in the BDS color-pairing
    // foundation (brik-bds#868). See ServiceLineCard. (#429)
    //
    // `onLight` is the component fill to use when the element sits on a known
    // *light* backdrop (the `surfaceLight` service band). It's the `background`
    // context token per `token-anatomy` canon — a service line adapts via
    // `-on-light`/`-on-dark`, not a per-line inverse. It replaces the former
    // `inverse` key, which aliased the `surface`-tone `-dark` token into
    // `background`-tier consumer properties (surface→background, alias→alias).
    // Value-identical to `surface-service-{slug}-dark` in both modes (#525), so
    // this is a zero-visual-change semantic correction. (#526 / BACKLOG-318)
    brand: {
      bg: 'var(--background-service-brand)',
      text: 'var(--text-service-brand-on-light)',
      surface: 'var(--surface-service-brand)',
      surfaceLight: 'var(--surface-service-brand-light)',
      surfaceDark: 'var(--surface-service-brand-dark)',
      onLight: 'var(--background-service-brand-on-light)',
    },
    marketing: {
      bg: 'var(--background-service-marketing)',
      text: 'var(--text-service-marketing-on-light)',
      surface: 'var(--surface-service-marketing)',
      surfaceLight: 'var(--surface-service-marketing-light)',
      surfaceDark: 'var(--surface-service-marketing-dark)',
      onLight: 'var(--background-service-marketing-on-light)',
    },
    information: {
      bg: 'var(--background-service-information)',
      text: 'var(--text-service-information-on-light)',
      surface: 'var(--surface-service-information)',
      surfaceLight: 'var(--surface-service-information-light)',
      surfaceDark: 'var(--surface-service-information-dark)',
      onLight: 'var(--background-service-information-on-light)',
    },
    product: {
      bg: 'var(--background-service-product)',
      text: 'var(--text-service-product-on-light)',
      surface: 'var(--surface-service-product)',
      surfaceLight: 'var(--surface-service-product-light)',
      surfaceDark: 'var(--surface-service-product-dark)',
      onLight: 'var(--background-service-product-on-light)',
    },
    'back-office': {
      bg: 'var(--background-service-back-office)',
      text: 'var(--text-service-back-office-on-light)',
      surface: 'var(--surface-service-back-office)',
      surfaceLight: 'var(--surface-service-back-office-light)',
      surfaceDark: 'var(--surface-service-back-office-dark)',
      onLight: 'var(--background-service-back-office-on-light)',
    },
  },
} as const;

/** Look up service color tokens by category slug. Unknown / legacy `service`
 *  inputs fall through to the back-office (orange) entry. */
export function serviceColor(category: string) {
  const key = category as keyof typeof color.service;
  return color.service[key] ?? color.service['back-office'];
}

// ─── Spacing (Padding) ──────────────────────────────────────────────

export const space = {
  none: 'var(--padding-none)',
  tiny: 'var(--padding-tiny)',
  xs: 'var(--padding-xs)',
  sm: 'var(--padding-sm)',
  md: 'var(--padding-md)',
  lg: 'var(--padding-lg)',
  xl: 'var(--padding-xl)',
  xxl: 'var(--padding-xl)',
  huge: 'var(--padding-huge)',
  button: 'var(--padding-tiny)',
  input: 'var(--padding-tiny)',
} as const;

// ─── Layout widths ──────────────────────────────────────────────────
// Content column max-widths from BDS dist/tokens.css. Use these for
// `max-width` on container elements — prose columns, body sections,
// feature bands. Pair with `margin-inline: auto` (or `.container-lg`)
// for centering. NOT screen breakpoints; constrain content within a
// viewport. For @media values, use the `breakpoints` constant from
// `@bds-tokens` — CSS custom properties can't go inside @media rules.

export const width = {
  /** 640px — prose, reading columns, focused forms (e.g. blog body) */
  narrow: 'var(--content-width-narrow)',
  /** 800px — standard body sections */
  default: 'var(--content-width-default)',
  /** 1024px — feature sections, grids */
  wide: 'var(--content-width-wide)',
  /** 1280px — hero bands, wide layouts. Canonical site-wide container max
   *  (replaces the retired project-local --site-container-max). */
  xl: 'var(--content-width-xl)',
  /** 100% — full-bleed (use sparingly; prefer explicit widths) */
  full: 'var(--content-width-full)',
} as const;

// ─── Gap (between elements) ─────────────────────────────────────────

export const gap = {
  none: 'var(--gap-none)',
  tiny: 'var(--gap-tiny)',
  xs: 'var(--gap-xs)',
  sm: 'var(--gap-sm)',
  md: 'var(--gap-md)',
  lg: 'var(--gap-lg)',
  xl: 'var(--gap-xl)',
  huge: 'var(--gap-huge)',
} as const;

// ─── Border ──────────────────────────────────────────────────────────

export const border = {
  width: {
    none: 'var(--border-width-none)',
    sm: 'var(--border-width-sm)',
    md: 'var(--border-width-md)',
    lg: 'var(--border-width-lg)',
    xl: 'var(--border-width-xl)',
    huge: 'var(--border-width-huge)',
  },
  radius: {
    none: 'var(--border-radius-none)',
    xs: 'var(--border-radius-100)',
    sm: 'var(--border-radius-sm)',
    md: 'var(--border-radius-md)',
    lg: 'var(--border-radius-lg)',
    button: 'var(--border-radius-50)',
    input: 'var(--border-radius-50)',
    pill: '9999px',
    circle: '50%',
  },
} as const;

// ─── Shadows ─────────────────────────────────────────────────────────

export const shadow = {
  none: 'var(--box-shadow-none)',
  sm: 'var(--box-shadow-sm)',
  md: 'var(--box-shadow-md)',
  lg: 'var(--box-shadow-lg)',
} as const;
