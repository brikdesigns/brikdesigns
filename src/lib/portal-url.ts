/**
 * Portal admin URL helper.
 *
 * brikdesigns is read-only on `services` (and eventually `service_lines`,
 * `offerings`, `plans` once portal admin covers them — see #178). When the
 * admin needs to surface "edit this in the portal" links, use this helper
 * so the URL tracks the deploy environment.
 *
 * Default: prod portal. Override via `NEXT_PUBLIC_PORTAL_URL` per Netlify
 * context (set to `https://staging.portal.brikdesigns.com` for the
 * brikdesigns staging + deploy-preview contexts).
 */
export const PORTAL_BASE_URL =
  process.env.NEXT_PUBLIC_PORTAL_URL ?? 'https://portal.brikdesigns.com';

export function portalAdminUrl(path: string = '/admin'): string {
  return `${PORTAL_BASE_URL}${path}`;
}

/** Portal admin services list (catalog tab). */
export const PORTAL_SERVICES_ADMIN_URL = `${PORTAL_BASE_URL}/admin/services?tab=catalog`;

/** Portal admin URL for a specific service by slug. */
export function portalServiceEditUrl(slug: string): string {
  return `${PORTAL_BASE_URL}/admin/services/${slug}`;
}
