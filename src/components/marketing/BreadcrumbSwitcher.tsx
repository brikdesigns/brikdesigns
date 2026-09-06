'use client';

/**
 * BreadcrumbSwitcher — thin marketing wrapper over the shared BDS
 * `BreadcrumbSwitcher` (brik-bds #1504, #1506; promoted from this local copy +
 * the portal twin, brik-client-portal#2145).
 *
 * BDS owns no router, so this `'use client'` wrapper injects the Next.js router
 * (`useRouter().push`) and `Link`. As of BDS 0.184.0 (brik-bds#2284) `Hero`
 * wraps its own `breadcrumb` slot in `.bds-hero__breadcrumb`, so this wrapper no
 * longer injects that hook; the `[data-audience] .bds-breadcrumb` service-line
 * tint cascade (brik-bds#781) still applies because it targets the inner
 * `.bds-breadcrumb` the BDS component renders.
 *
 * The caret glyph now comes from BDS's own offline `<Icon>` (bundled Phosphor
 * subset, no CDN fetch), so the site's `@/lib/icon` / `ph:caret-down` entry is
 * no longer needed for this component.
 */

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  BreadcrumbSwitcher as BdsBreadcrumbSwitcher,
  type BreadcrumbSwitcherProps as BdsBreadcrumbSwitcherProps,
  type BreadcrumbSwitcherOption,
  type BreadcrumbItem,
} from '@brikdesigns/bds';

/** Re-exported so existing imports of the local option/item types keep resolving. */
export type BreadcrumbSwitchOption = BreadcrumbSwitcherOption;
export type BreadcrumbSwitchItem = BreadcrumbItem;

interface BreadcrumbSwitcherProps
  extends Omit<BdsBreadcrumbSwitcherProps, 'items' | 'linkComponent' | 'onNavigate' | 'className'> {
  /** Full crumb trail (Services → service line → current service). */
  items: readonly BreadcrumbItem[];
}

export function BreadcrumbSwitcher({ items, ...props }: BreadcrumbSwitcherProps) {
  const router = useRouter();

  return (
    <BdsBreadcrumbSwitcher
      {...props}
      items={[...items]}
      linkComponent={Link}
      onNavigate={(href) => router.push(href)}
    />
  );
}
