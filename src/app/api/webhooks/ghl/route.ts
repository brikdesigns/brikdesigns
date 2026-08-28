import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { notifyOnLead, type LeadNotification } from '@/lib/notifications';

/**
 * Inbound GoHighLevel webhook — makes a Grind After Graduation RSVP observable
 * in Slack (#events) without any location-scoped GHL read. The Webflow twin's
 * GHL widget (#864) posts straight to leadconnectorhq.com and never hits our
 * Next.js API, so the native lead path (src/app/api/leads/route.ts) cannot see
 * an RSVP. This route is the observability path #886 needs. One-way IN only —
 * brikdesigns never writes to GHL.
 *
 * PAYLOAD-TRUST design: GHL "custom webhooks" (a workflow action) send the
 * submission's fields in the POST body, and we map those directly. We do NOT
 * re-pull via the contacts/forms API — Brik's Private Integration Token is
 * agency-level and sub-account scopes 401 ("not authorized for this scope",
 * secrets.yaml:1125, brik-client-portal#1683). The shared secret is the trust
 * boundary; when a sub-account token is provisioned later it can augment this
 * with an authoritative re-pull and no route signature change.
 *
 * Auth: GHL custom webhooks aren't signed like Stripe, so we authenticate a
 * shared secret in the `x-ghl-webhook-secret` header (constant-time compare vs
 * GHL_WEBHOOK_SECRET). Fail-secure: an unset secret rejects every call (503).
 *
 * Configure in GHL (Automation → Workflow → add "Custom Webhook" action) —
 * OPERATOR/COLLEAGUE step, #886 is parked pending sub-account access:
 *   URL:     https://www.brikdesigns.com/api/webhooks/ghl
 *   Method:  POST
 *   Header:  x-ghl-webhook-secret: <GHL_WEBHOOK_SECRET>   (provision via brik-secrets, set as a Netlify env var on the brikdesigns site)
 *   Body (map the RSVP fields; name + email required):
 *     {
 *       "name": "{{contact.name}}",
 *       "email": "{{contact.email}}",
 *       "phone": "{{contact.phone}}",
 *       "company_name": "{{contact.company_name}}",
 *       "grad_year": "{{contact.<dental_school_grad_year_field>}}",
 *       "staying_in_tn": "{{contact.<staying_in_tennessee_field>}}"
 *     }
 *   Trigger: Form Submitted (form 66TSwG7WrK0fSiTYg6DC).
 *
 * A payload missing name+email is acked 200 (skipped) so GHL stops retrying a
 * shape we can't use.
 */

const RSVP_EVENT_TITLE = 'Grind After Graduation';

function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on length mismatch — guard first. The length check
  // is not itself constant-time, but a shared secret's length is not sensitive.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function str(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Map a GHL custom-webhook body to a LeadNotification. Pure + exported so the
 * mapping is unit-testable without a network (scripts/test-ghl-webhook.ts).
 * Returns null when the payload lacks the name+email a notification needs.
 */
export function buildRsvpNotification(
  body: Record<string, unknown>,
): LeadNotification | null {
  const name = str(body.name) ?? str(body.full_name) ?? str(body.first_name);
  const email = str(body.email);
  if (!name || !email) return null;

  // The GHL form collects two fields the native EventRegistrationForm has no
  // schema for (#864); surface them in the message so the RSVP is fully
  // observable in Slack without a location-scoped read.
  const extras = [
    str(body.grad_year) && `Graduation year: ${str(body.grad_year)}`,
    str(body.staying_in_tn) && `Staying in Tennessee: ${str(body.staying_in_tn)}`,
  ].filter(Boolean);

  return {
    name,
    email,
    // No company on an RSVP; company_name is required on LeadNotification.
    company_name: str(body.company_name) ?? 'N/A (event RSVP)',
    phone: str(body.phone),
    message: extras.length > 0 ? extras.join('\n') : undefined,
    source: 'ghl-webhook',
    // Routes the Slack notification to #events (notifications.ts:141).
    eventTitle: RSVP_EVENT_TITLE,
  };
}

export async function POST(request: Request) {
  // ── Shared-secret verification (fail-secure) ──
  const expected = process.env.GHL_WEBHOOK_SECRET;
  if (!expected) {
    console.error('[ghl-webhook] GHL_WEBHOOK_SECRET not set — rejecting');
    return NextResponse.json({ error: 'Webhook verification not configured' }, { status: 503 });
  }
  const provided = request.headers.get('x-ghl-webhook-secret');
  if (!provided || !secretsMatch(provided, expected)) {
    console.error('[ghl-webhook] invalid or missing secret header');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // ── Parse the payload ──
  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const lead = buildRsvpNotification(body);
  if (!lead) {
    // Ack (200) a shape we can't use so GHL stops retrying.
    return NextResponse.json({ ok: true, skipped: 'missing name or email' });
  }

  // Best-effort fan-out (email + Slack), same as the native lead path.
  await notifyOnLead(lead);

  return NextResponse.json({ ok: true, notified: true });
}
