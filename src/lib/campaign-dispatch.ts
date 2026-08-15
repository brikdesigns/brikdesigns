import { PORTAL_BASE_URL } from '@/lib/portal-url';

/**
 * Nudge the portal's campaign dispatcher after a registration lands (#3075).
 *
 * The dispatcher reconciles and sends on an hourly Netlify schedule, which is
 * the finest granularity Netlify supports for scheduled functions. An
 * `on_registration` step — the RSVP confirmation — therefore goes out up to an
 * hour late, which reads as broken to the person who just registered.
 *
 * Registrations are written here, in brikdesigns, so this is the only place
 * that knows one happened the moment it does. #3060 chose the schedule over a
 * cross-repo enqueue deliberately; this closes the gap without replacing it.
 * The hourly tick stays the backstop — the dispatcher claims each (step,
 * registration) row before sending, so an extra run overlapping the tick finds
 * nothing to claim rather than mailing twice.
 *
 * Env vars (Netlify + .env.local):
 *   CAMPAIGN_DISPATCH_SECRET — shared with the portal route; unset = no-op
 *   NEXT_PUBLIC_PORTAL_URL   — per-context portal origin (see portal-url.ts)
 */

/**
 * Upper bound on how long a registration will wait on the portal.
 *
 * "Fire and forget" cannot be a floating promise here: this runs in a
 * serverless function, whose execution is torn down once the response is
 * returned, so an un-awaited fetch is liable to be killed before it connects.
 * A bounded await is the honest version — the registrant waits at most this
 * long, and only when the portal is slow or down.
 */
const DISPATCH_TIMEOUT_MS = 2500;

/**
 * Ask the portal to run a dispatch cycle now. Never throws.
 *
 * Every failure mode — no secret, portal down, timeout, 403 — is a logged
 * no-op, because the hourly tick will still send the mail. Losing the fast
 * path must never cost someone their registration.
 */
export async function triggerCampaignDispatch(): Promise<void> {
  const secret = process.env.CAMPAIGN_DISPATCH_SECRET;
  if (!secret) {
    console.warn('[campaign-dispatch] CAMPAIGN_DISPATCH_SECRET not set — skipping trigger');
    return;
  }

  try {
    const response = await fetch(`${PORTAL_BASE_URL}/api/admin/campaigns/dispatch`, {
      method: 'POST',
      headers: { 'x-campaign-dispatch-secret': secret },
      signal: AbortSignal.timeout(DISPATCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.warn(`[campaign-dispatch] portal returned ${response.status} — hourly tick will retry`);
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.warn(`[campaign-dispatch] trigger failed: ${detail} — hourly tick will retry`);
  }
}
