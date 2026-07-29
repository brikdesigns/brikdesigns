/**
 * Portal admin URL helper.
 *
 * brikdesigns is read-only on `services` (and eventually `service_lines`,
 * `offerings`, `plans` once portal admin covers them — see #178). When the
 * admin needs to surface "edit this in the portal" links, use this helper
 * so the URL tracks the deploy environment.
 *
 * Default: prod portal. Override via `NEXT_PUBLIC_PORTAL_URL` per Netlify
 * context (set to `https://staging--brik-client-portal.netlify.app` for the
 * brikdesigns staging + deploy-preview contexts). The portal has no
 * `staging.portal.brikdesigns.com` host — wildcards can't be issued on that
 * zone, so branch deploys stay on the Netlify branch URL.
 */
export const PORTAL_BASE_URL =
  process.env.NEXT_PUBLIC_PORTAL_URL ?? 'https://portal.brikdesigns.com';

export function portalAdminUrl(path: string = '/admin'): string {
  return `${PORTAL_BASE_URL}${path}`;
}

/** Portal settings: services list. */
export const PORTAL_SERVICES_ADMIN_URL = `${PORTAL_BASE_URL}/settings/services`;

/** Portal settings: service lines list. */
export const PORTAL_SERVICE_LINES_ADMIN_URL = `${PORTAL_BASE_URL}/settings/service-lines`;

/** Portal settings: offerings list. */
export const PORTAL_OFFERINGS_ADMIN_URL = `${PORTAL_BASE_URL}/settings/offerings`;

/** Portal settings URL for a specific service. Edit is a sheet off the list page. */
export function portalServiceEditUrl(_slug: string): string {
  return PORTAL_SERVICES_ADMIN_URL;
}
