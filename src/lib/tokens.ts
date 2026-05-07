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
    },
    label: {
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
    tertiary: 'var(--background-tertiary)',
    negative: 'var(--surface-negative)',
    warning: 'var(--surface-warning)',
    success: 'var(--surface-positive)',
    successSubtle: 'var(--background-status-success-subtle)',
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
  brand: {
    // brikdesigns: globals.css aliases --brand--primary (legacy double-dash)
    // to the canonical --brand-primary; both resolve to poppy red. Reference
    // the canonical name here.
    primary: 'var(--brand-primary)',
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
  // The `light` entries use BDS gap-fill names (`--services--*-light`,
  // double-dash) — the form actually defined in brik-bds/tokens/gap-fills.css.
  service: {
    brand: {
      bg: 'var(--background-service-brand)',
      text: 'var(--text-service-brand)',
      light: 'var(--services--yellow-light)',
    },
    marketing: {
      bg: 'var(--background-service-marketing)',
      text: 'var(--text-service-marketing)',
      light: 'var(--services--green-light)',
    },
    information: {
      bg: 'var(--background-service-information)',
      text: 'var(--text-service-information)',
      light: 'var(--services--blue-light)',
    },
    product: {
      bg: 'var(--background-service-product)',
      text: 'var(--text-service-product)',
      light: 'var(--services--purple-light)',
    },
    service: {
      bg: 'var(--background-service-service)',
      text: 'var(--text-service-service)',
      light: 'var(--services--orange-light)',
    },
  },
} as const;

/** Look up service color tokens by category slug */
export function serviceColor(category: string) {
  const key = category as keyof typeof color.service;
  return color.service[key] ?? color.service.service;
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
