import { PORTAL_BASE_URL } from '@/lib/portal-url';

/**
 * Get a Stripe Checkout URL for a paid event registration (#899).
 *
 * Public half of brikdesigns/brik-client-portal#1513. The portal owns the
 * Stripe SDK, the Checkout Session, the webhook reconciliation and the
 * paid-state columns; this repo owns the form and must not grow a `stripe`
 * dependency to do its half.
 *
 * Called server-side from `/api/leads` once the `event_registrations` row
 * exists, which is what the portal's route documents as its caller. The
 * `(registrationId, email)` pair is the credential — no shared secret, on the
 * portal's reasoning that the row it reads was itself created by this repo's
 * public, unauthenticated endpoint.
 *
 * Env vars (Netlify + .env.local):
 *   NEXT_PUBLIC_PORTAL_URL — per-context portal origin (see portal-url.ts)
 */

/**
 * Upper bound on the call.
 *
 * Unlike `triggerCampaignDispatch`, the registrant IS waiting on this one — it
 * decides where their browser goes next, so it cannot be deferred to
 * `after()`. Ten seconds is the ceiling before the caller gives up and hands
 * back a usable error instead of a hung form.
 */
const CHECKOUT_TIMEOUT_MS = 10_000;

/**
 * Ask the portal for a payment link. Never throws — returns null on any
 * failure.
 *
 * Null is not "this event is free"; it is "we could not reach checkout". The
 * caller distinguishes the two, because the registration row already exists
 * either way and the registrant must be told which happened. Silently
 * returning them to a success card would tell someone who owes money that
 * they are registered and done.
 */
export async function fetchEventCheckoutUrl(
  registrationId: string,
  email: string,
): Promise<string | null> {
  try {
    const response = await fetch(`${PORTAL_BASE_URL}/api/events/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registrationId, email }),
      signal: AbortSignal.timeout(CHECKOUT_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.warn(
        `[event-checkout] portal returned ${response.status} for registration ${registrationId}`,
      );
      return null;
    }

    const data = (await response.json()) as { url?: unknown };
    if (typeof data.url !== 'string' || !data.url) {
      console.warn(`[event-checkout] portal response carried no url for ${registrationId}`);
      return null;
    }

    return data.url;
  } catch (error) {
    console.error(`[event-checkout] call failed for registration ${registrationId}:`, error);
    return null;
  }
}
