/**
 * Local mirror of BDS `composeButtonClasses`.
 *
 * `@brikdesigns/bds` DOES export `composeButtonClasses` from its barrel as of
 * v0.180.0 (brik-bds#465, CLOSED) — but it is a **client** export: it lives in
 * `Button2.mjs`, which carries `'use client'`, so the whole barrel binding is
 * client-only. A **server** component that calls it (e.g.
 * `src/app/(marketing)/results/[slug]/page.tsx`) 500s with "composeButtonClasses
 * is on the client — can't invoke from the server." This 1:1 mirror is a plain
 * server-safe module, which is why it stays. (Verified 2026-09-06 —
 * brikdesigns#1246, closed as premise-wrong.)
 *
 * **Do NOT delete this to import from the barrel.** Removing it needs BDS to
 * export `composeButtonClasses` from a server-safe (non-`'use client'`) entry
 * — until then the mirror is the only server-callable path.
 *
 * Stays a 1:1 mirror — output class strings are part of the BDS CSS contract
 * (`bds-button`, `bds-button--{variant}`, `bds-button--{size}`,
 * `bds-button--full-width`, `bds-button--loading`). If BDS renames any class,
 * this file goes stale silently — guard via a Storybook visual check on any
 * page using composed-button styling after a BDS bump.
 */

import type { ButtonVariant, ButtonSize } from '@brikdesigns/bds';

export interface ComposeButtonClassesOpts {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  className?: string;
}

export function composeButtonClasses({
  variant = 'primary',
  size = 'md',
  fullWidth,
  loading,
  className,
}: ComposeButtonClassesOpts = {}): string {
  const classes = ['bds-button', `bds-button--${variant}`, `bds-button--${size}`];
  if (fullWidth) classes.push('bds-button--full-width');
  if (loading) classes.push('bds-button--loading');
  if (className) classes.push(className);
  return classes.join(' ');
}
