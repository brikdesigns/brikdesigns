import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { notifyOnLead, type LeadNotification } from '@/lib/notifications';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * Inbound GoHighLevel webhook — makes a Grind After Graduation RSVP observable
 * in Slack (#events) AND records it in event_registrations so it reaches the
 * portal's campaign funnel (#886 + #1024). The Webflow twin's GHL widget (#864)
 * posts straight to leadconnectorhq.com and never hits our Next.js API, so the
 * native lead path (src/app/api/leads/route.ts) cannot see an RSVP — this
 * webhook is the only path a public RSVP has into the shared Supabase project.
 * One-way IN only — brikdesigns never writes to GHL.
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
 *   URL:     https://brikdesigns.netlify.app/api/webhooks/ghl
 *            (NOT www.brikdesigns.com — that CNAMEs to Webflow and returns 405;
 *             this route only answers on the Netlify site. Verified 2026-09-05.)
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

// The public RSVP page is the Webflow twin (#864); its GHL form posts to GHL,
// never /api/leads — so this webhook is the ONLY path by which a public RSVP
// reaches event_registrations, the table the portal's campaign funnel reads
// (#1024). Resolved by slug rather than a hard-coded UUID so a re-created event
// row keeps working.
const RSVP_EVENT_SLUG = 'grind-after-graduation';

/**
 * Map a GHL custom-webhook body to an `event_registrations` insert row. Pure +
 * exported so the mapping is unit-testable without a network. Returns null when
 * the payload lacks the name+email a registration needs (mirrors
 * buildRsvpNotification's guard). `company_id` is left unset — the column is
 * nullable and the funnel counts by `event_id`; unlike /api/leads, this path
 * does not mint a lead company/contact for an RSVP.
 */
export function buildRsvpRegistration(
  body: Record<string, unknown>,
  eventId: string,
) {
  const name = str(body.name) ?? str(body.full_name) ?? str(body.first_name);
  const email = str(body.email);
  if (!name || !email) return null;

  const firstSpace = name.indexOf(' ');
  const firstName = firstSpace === -1 ? name : name.slice(0, firstSpace);
  const lastName = firstSpace === -1 ? null : name.slice(firstSpace + 1).trim() || null;

  // Same two RSVP-only fields the notification surfaces; kept on the row so the
  // registration is self-describing without a location-scoped GHL read.
  const notes =
    [
      str(body.grad_year) && `Graduation year: ${str(body.grad_year)}`,
      str(body.staying_in_tn) && `Staying in Tennessee: ${str(body.staying_in_tn)}`,
    ]
      .filter(Boolean)
      .join('\n') || null;

  return {
    event_id: eventId,
    first_name: firstName,
    last_name: lastName,
    email,
    phone: str(body.phone) ?? null,
    practice_name: str(body.company_name) ?? null,
    source: 'ghl-webhook',
    status: 'registered',
    notes,
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

  // Record the RSVP in event_registrations so it appears in the portal's
  // campaign funnel (#1024). Best-effort: a lookup miss or insert error is
  // logged but still acked 200 (below), matching the Slack fan-out, so a
  // transient DB error does not trigger a GHL retry-storm that would re-notify.
  let registered = false;
  const supabase = createServiceClient();
  const { data: eventRow, error: eventLookupError } = await supabase
    .from('events')
    .select('id')
    .eq('slug', RSVP_EVENT_SLUG)
    .maybeSingle();
  if (eventLookupError || !eventRow) {
    console.error(
      `[ghl-webhook] events lookup for slug "${RSVP_EVENT_SLUG}" failed: ` +
        `${eventLookupError?.message ?? 'no matching row'} — registration skipped`,
    );
  } else {
    const registration = buildRsvpRegistration(body, eventRow.id);
    if (registration) {
      const { error: registrationError } = await supabase
        .from('event_registrations')
        .insert(registration);
      if (registrationError) {
        console.error('[ghl-webhook] event_registrations insert failed:', registrationError.message);
      } else {
        registered = true;
      }
    }
  }

  // Best-effort fan-out (email + Slack), same as the native lead path.
  await notifyOnLead(lead);

  return NextResponse.json({ ok: true, notified: true, registered });
}
