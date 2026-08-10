// Route slug ↔ DB slug translation for service lines.
//
// The Back Office Design line keeps its FK-stable DB `service_lines.slug`
// value of `service` (shared across portal + renew-pms — see
// `.claude/references/service-url-slug-convention.md` and brik-client-portal
// migration 00042, which deliberately kept the slug to match BDS component
// CSS class names). Its public route, however, is `/services/back-office`.
// Every other line's route slug equals its DB slug.
//
// Translate at the route/link boundary so the DB value never leaks into a URL
// and `/services/back-office` resolves back to the `service` row. The BDS
// `ServiceLine` enum value stays `service` — `mapServiceLineSlug()` continues
// to own slug → enum mapping; this module only owns slug ↔ URL-segment.
//
// Pure + client-safe (no Supabase / next-server imports) so client link
// components and server route handlers can both import it. Wrapping is a
// no-op for non-back-office slugs and idempotent on an already-route slug.

import { color } from './tokens';

const DB_TO_ROUTE: Record<string, string> = { service: 'back-office' };
const ROUTE_TO_DB: Record<string, string> = { 'back-office': 'service' };

/** The five canonical service lines, as their public `/services/{segment}` route
 *  segments. For every line the BDS `ServiceLine` value, the route segment, and
 *  the `--*-service-{suffix}` token suffix are the *same string* — only the DB
 *  `service_lines.slug` diverges (back-office), which is what the two functions
 *  below translate. Keying off the token map therefore gives route segments
 *  directly, with no mapping.
 *
 *  Derived rather than hand-listed. A route-keyed consumer carrying its own
 *  allowlist drifts silently: the nav tint shipped for `marketing` alone behind
 *  a hardcoded `Set` and the other four lines stayed neutral for two weeks with
 *  CI green (#729 → #858/#860). Anything that keys behaviour off "which service
 *  lines exist" reads this; `npm run lint:nav-service-tint` asserts the CSS
 *  keeps up with it. */
export const SERVICE_LINE_SEGMENTS: readonly string[] = Object.keys(color.service);

/** DB `service_lines.slug` → public `/services/{slug}` route segment. */
export function routeSlugForServiceLine(dbSlug: string): string {
  return DB_TO_ROUTE[dbSlug] ?? dbSlug;
}

/** Public `/services/{slug}` route segment → DB `service_lines.slug` for lookups. */
export function dbSlugForServiceLineRoute(routeSlug: string): string {
  return ROUTE_TO_DB[routeSlug] ?? routeSlug;
}
