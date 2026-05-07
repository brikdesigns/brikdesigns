/**
 * Local mirror of BDS `composeButtonClasses`.
 *
 * The function exists in `@brikdesigns/bds` (per BDS PR #36 routing all
 * button visuals through it) but isn't re-exported from the package barrel.
 * `Button/index.ts` only re-exports `Button`, `ButtonProps`, `ButtonVariant`,
 * `ButtonSize` — `composeButtonClasses` is missing from the public surface.
 *
 * Tracking: brik-bds#465.
 *
 * **Remove this file once BDS exposes composeButtonClasses on its barrel.**
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
