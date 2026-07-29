/**
 * Server-side icon helper for the marketing site.
 *
 * This module used to mirror BDS's `getServiceIconPath(category, serviceName)`
 * so Server Components could PRE-CHECK whether a predicted icon file existed on
 * disk — without that check, a miss rendered an `<img>` to a 404 and leaked the
 * native broken-image glyph through SSR before React hydrated.
 *
 * BDS 0.137.0 removed that failure mode. `getServiceIconPath` /
 * `getServiceLineIconPath` are gone (brik-bds#1518) and `<ServiceTag>` resolves
 * through `resolveServiceIcon`, which returns a key into a bundled inline SVG
 * set and falls back to the service-line default glyph — so it can never 404.
 *
 * `hasIconFor` and the hand-maintained override map it depended on are
 * therefore gone (brikdesigns#776); every call site now passes `serviceName`
 * unconditionally and lets BDS resolve it.
 *
 * What remains is only the URL-shaped line default below, which is still needed
 * where a blueprint takes an `iconUrl` string rather than rendering ServiceTag.
 */

import type { ServiceLine } from '@brikdesigns/bds';

/** Service-line default icon (5 entries) — for places where BDS's per-service
 *  resolver can't run (e.g., a Server Component passing iconUrl to a blueprint).
 */
export const SERVICE_LINE_ICON: Record<ServiceLine, string> = {
  brand: '/icons/brand/brand-design.svg',
  marketing: '/icons/marketing/marketing-design.svg',
  information: '/icons/information/information-design.svg',
  product: '/icons/product/product-design.svg',
  'back-office': '/icons/back-office/back-office-design.svg',
  // @deprecated alias of 'back-office'. Kept only for the retired `service`
  // ServiceLine value; resolves to the same back-office icon.
  service: '/icons/back-office/back-office-design.svg',
};
