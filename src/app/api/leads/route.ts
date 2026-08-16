import { NextResponse, after } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { notifyOnLead, notifyOnEventRegistration } from '@/lib/notifications';
import { checkHoneypot, verifyRecaptcha } from '@/lib/spam-protection';
import { triggerCampaignDispatch } from '@/lib/campaign-dispatch';
import { fetchEventCheckoutUrl } from '@/lib/event-checkout';
import {
  parseCustomFields,
  isCustomFieldVisible,
  BOOLEAN_ANSWER_YES,
  BOOLEAN_ANSWER_NO,
} from '@/lib/events';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Derive a display name from an email local part for name-optional newsletter
 * signups (brikdesigns#336): "jane.doe@x.com" → "Jane Doe". Keeps
 * contacts.first_name + companies.name populated when no name is given.
 */
function emailToName(email: string): string {
  const local = String(email).split('@')[0] ?? '';
  const cleaned = local
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
  return cleaned || 'Subscriber';
}

/**
 * Keep only answers to questions this event actually declares, coerced to the
 * declared type (#2558).
 *
 * `/api/leads` is public and unauthenticated, so the submitted map is
 * untrusted input: without this filter a caller could write arbitrary keys —
 * or arbitrarily large values — into `event_registrations.custom_answers`.
 * An unknown key is dropped silently; the registration itself still succeeds,
 * because losing a stray answer must never cost someone their RSVP.
 */
function sanitizeCustomAnswers(
  formConfig: unknown,
  submitted: unknown,
): Record<string, string | number | boolean> {
  if (!submitted || typeof submitted !== 'object' || Array.isArray(submitted)) return {};
  const fields = parseCustomFields(formConfig);
  if (fields.length === 0) return {};

  const raw = submitted as Record<string, unknown>;

  // Pass 1 — normalize every declared answer to the string form the
  // conditionals compare against, dropping anything not answerable.
  const asText: Record<string, string> = {};
  for (const field of fields) {
    const value = raw[field.key];
    if (value === undefined || value === null || value === '') continue;
    if (typeof value === 'boolean') {
      asText[field.key] = value ? BOOLEAN_ANSWER_YES : BOOLEAN_ANSWER_NO;
      continue;
    }
    if (typeof value !== 'string' && typeof value !== 'number') continue;
    asText[field.key] = String(value).slice(0, MAX_ANSWER_LENGTH);
  }

  // Pass 2 — keep only questions the registrant could actually see, then
  // coerce to the declared type. The browser already filters by visibility
  // (`toCustomAnswers`), but this endpoint is public: a hand-crafted post
  // would otherwise store both sides of a branch, so a registration could
  // claim "opening in TN: yes" and still carry an "if no, where?" answer.
  const out: Record<string, string | number | boolean> = {};
  for (const field of fields) {
    const text = asText[field.key];
    if (text === undefined) continue;
    if (!isCustomFieldVisible(field, asText, fields)) continue;

    if (field.type === 'boolean') {
      if (text === BOOLEAN_ANSWER_YES) out[field.key] = true;
      else if (text === BOOLEAN_ANSWER_NO) out[field.key] = false;
      continue;
    }

    if (field.type === 'number') {
      const n = Number(text);
      if (Number.isFinite(n)) out[field.key] = n;
      continue;
    }

    // A choice question only accepts one of its own options — anything else
    // is a hand-crafted post, not something the rendered form can produce.
    if (field.type === 'select' && !(field.options ?? []).includes(text)) continue;

    out[field.key] = text;
  }

  return out;
}

/** Upper bound on a single free-text answer — the form has no length cap of its own. */
const MAX_ANSWER_LENGTH = 2000;

/**
 * Lead capture endpoint.
 * Called from the Get Started and Free Marketing Analysis forms.
 * Creates a company (type: 'lead') and contact in Supabase.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, company_name, phone, plan, service, services, offering, offering_price, message, source, event_id, custom_answers } = body;

    // Basic validation. With an event_id, name + company_name are both
    // optional — event attendees may have no practice, and newsletter signups
    // (brikdesigns#336) capture email only; both are derived below. Without an
    // event_id (the Get Started / analysis forms) all three stay required.
    if (!email || (!name && !event_id) || (!company_name && !event_id)) {
      return NextResponse.json(
        { error: 'Name, email, and company name are required.' },
        { status: 400 }
      );
    }

    // Reject a malformed event_id at the boundary — otherwise it slips past the
    // company + contact inserts and only fails at the event_registrations FK,
    // leaving those rows committed (no transaction wraps the three writes).
    if (event_id && (typeof event_id !== 'string' || !UUID_RE.test(event_id))) {
      return NextResponse.json({ error: 'Invalid event.' }, { status: 400 });
    }

    // Layer 1 — honeypot. If filled, bot. Silent 200 so the bot doesn't learn.
    const honeypot = checkHoneypot(body);
    if (honeypot.silentDrop) {
      console.warn('[lead] honeypot triggered:', honeypot.detail);
      return NextResponse.json({
        success: true,
        message: "Thanks! We'll be in touch within 1 business day.",
      });
    }

    // Layer 2 — reCAPTCHA v3 verification, only when keys are configured.
    const recaptcha = await verifyRecaptcha(body);
    if (recaptcha.recaptchaFailed) {
      console.warn('[lead] recaptcha failed:', recaptcha.detail);
      return NextResponse.json(
        { error: 'Verification failed. Please try again.' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Resolve multi-select service slugs (#578) to display names for the notes
    // + notification, falling back to the slug if a name isn't found. Read-only
    // lookup against the public `services` table. Backward compatible: the
    // legacy single `service` field still flows through untouched.
    const serviceSlugs: string[] = Array.isArray(services)
      ? services.filter((s: unknown): s is string => typeof s === 'string' && s.length > 0)
      : [];
    let serviceNames: string[] = [];
    if (serviceSlugs.length > 0) {
      const { data: svcRows } = await supabase
        .from('services')
        .select('slug, name')
        .in('slug', serviceSlugs);
      const nameBySlug = new Map<string, string>(
        (svcRows ?? []).map((r: { slug: string; name: string }) => [r.slug, r.name]),
      );
      serviceNames = serviceSlugs.map((s) => nameBySlug.get(s) ?? s);
    }

    // Name may be absent for newsletter signups — derive one from the email so
    // contacts.first_name + companies.name stay populated (brikdesigns#336).
    const displayName = String(name || '').trim() || emailToName(email);

    // company_name is optional for event/newsletter signups; fall back to the
    // person's (derived) name so the companies row (slug + name, both NOT NULL)
    // still has a value.
    const effectiveCompanyName =
      (company_name ? String(company_name).trim() : '') || displayName;

    // companies.slug is NOT NULL; derive from the company name + a 6-char
    // suffix for uniqueness when two leads share a company name.
    const baseSlug = effectiveCompanyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'lead';
    const slugSuffix = Math.random().toString(36).slice(2, 8);
    const companySlug = `${baseSlug}-${slugSuffix}`;

    // Create company as lead
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .insert({
        name: effectiveCompanyName,
        slug: companySlug,
        type: 'lead',
        // Portal migration 00277 (#2123) dropped 'new' from
        // companies_status_check, so every insert here 500'd with 23514 —
        // the whole public lead + RSVP path was down. 'not_started' is the
        // canonical entry state for an unworked lead.
        status: 'not_started',
        notes: [
          source && `Source: ${source}`,
          plan && `Interested in plan: ${plan}`,
          service && `Interested in service: ${service}`,
          serviceNames.length > 0 && `Interested in services: ${serviceNames.join(', ')}`,
          offering && `Interested in offering: ${offering}${offering_price ? ` (${offering_price})` : ''}`,
          message && `Message: ${message}`,
        ]
          .filter(Boolean)
          .join('\n'),
      })
      .select()
      .single();

    if (companyError) throw companyError;

    // Create primary contact. `full_name` is a generated column on this
    // table — split into first/last instead of writing to it directly.
    const trimmed = displayName;
    const firstSpace = trimmed.indexOf(' ');
    const firstName = firstSpace === -1 ? trimmed : trimmed.slice(0, firstSpace);
    const lastName = firstSpace === -1 ? '' : trimmed.slice(firstSpace + 1).trim();

    const { error: contactError } = await supabase.from('contacts').insert({
      company_id: company.id,
      first_name: firstName,
      last_name: lastName || null,
      email,
      phone: phone || null,
      role: 'owner',
      is_primary: true,
    });

    if (contactError) throw contactError;

    // Event registration: when the submission came from an event/newsletter
    // landing page, record it against the event (FK = the company just made)
    // and look up the title so the notification can name the event.
    let eventTitle: string | undefined;
    // Stripe Checkout URL for a fee-bearing event (#899). Returned to the form,
    // which redirects the browser; absent for a free event.
    let checkoutUrl: string | null = null;
    let checkoutFailed = false;
    if (event_id) {
      const { data: eventRow, error: eventLookupError } = await supabase
        .from('events')
        .select('title, template, event_date, event_time, description_html, form_config, fee')
        .eq('id', event_id)
        .maybeSingle();
      if (eventLookupError) {
        // Non-fatal: the registration insert below still records the signup;
        // we just lose the title in the notification. Log so it's observable.
        console.warn('[lead] event title lookup failed:', eventLookupError.message);
      }
      eventTitle = eventRow?.title ?? undefined;

      const { data: registrationRow, error: registrationError } = await supabase
        .from('event_registrations')
        .insert({
          event_id,
          first_name: firstName,
          last_name: lastName || null,
          email,
          phone: phone || null,
          practice_name: company_name ? String(company_name).trim() : null,
          company_id: company.id,
          source: 'event_signup',
          status: 'registered',
          // Answers are filtered against the event's own question set rather
          // than trusted from the post body: this endpoint is public, so an
          // arbitrary client could otherwise write any key into the jsonb.
          custom_answers: sanitizeCustomAnswers(eventRow?.form_config, custom_answers),
        })
        .select('id')
        .single();

      if (registrationError) throw registrationError;

      // Paid event → hand back a Stripe Checkout URL for the form to redirect
      // to (#899). Awaited, not deferred with `after()` like the dispatch nudge
      // below: this decides where the registrant's browser goes next, so it is
      // the one cross-repo call they legitimately wait on.
      //
      // A failure here is NOT fatal to the request. The row is already written,
      // so the registrant is registered-and-unpaid — which is the same state an
      // abandoned Stripe session leaves, and one the portal already renders as
      // Unpaid. Reporting it as a 500 would tell them the whole registration
      // failed and invite a duplicate submission.
      if (eventRow?.fee != null && registrationRow?.id) {
        checkoutUrl = await fetchEventCheckoutUrl(registrationRow.id, email);
        checkoutFailed = checkoutUrl === null;
      }

      // Run the portal's campaign dispatcher now rather than waiting on its
      // hourly tick, so an `on_registration` step reaches the registrant in
      // seconds (#3075). Deferred with `after()` so it runs once the success
      // response is already on its way — the registrant never waits on the
      // portal, and Netlify keeps the request alive via waitUntil rather than
      // killing the fetch mid-flight. Best-effort besides: the tick is still
      // the backstop, and the helper swallows every failure.
      after(triggerCampaignDispatch);

      // Confirmation email to the registrant — event template only
      // (newsletter welcome is a separate Phase 2 flow). Best-effort: the
      // helper swallows its own errors so it never blocks the success
      // response (brikdesigns#337).
      if (eventRow?.template === 'event') {
        await notifyOnEventRegistration({
          email,
          firstName,
          event: {
            title: eventRow.title,
            event_date: eventRow.event_date ?? null,
            event_time: eventRow.event_time ?? null,
            description_html: eventRow.description_html ?? null,
          },
        });
      }
    }

    // Fan out notifications to email + Slack. Best-effort; failures here
    // never block the success response — we already saved the lead. Slack
    // routes to #events when eventTitle is set (see notifications.ts).
    await notifyOnLead({
      name,
      email,
      company_name: effectiveCompanyName,
      phone,
      plan,
      service,
      services: serviceNames,
      offering,
      offeringPrice: offering_price,
      message,
      source,
      eventTitle,
    });

    // TODO: Send confirmation email to the lead

    return NextResponse.json({
      success: true,
      message: "Thanks! We'll be in touch within 1 business day.",
      // Present only for a fee-bearing event registration (#899). The form
      // redirects to it; `checkout_unavailable` is how it tells the difference
      // between a free event and a paid one whose checkout call failed.
      ...(checkoutUrl ? { checkout_url: checkoutUrl } : {}),
      ...(checkoutFailed ? { checkout_unavailable: true } : {}),
    });
  } catch (error) {
    console.error('Lead capture error:', error);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
