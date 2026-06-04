import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { notifyOnLead } from '@/lib/notifications';
import { checkHoneypot, verifyRecaptcha } from '@/lib/spam-protection';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Lead capture endpoint.
 * Called from the Get Started and Free Marketing Analysis forms.
 * Creates a company (type: 'lead') and contact in Supabase.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, company_name, phone, plan, service, message, source, event_id } = body;

    // Basic validation. company_name is optional for event registrations —
    // not every attendee has a practice; we derive one from the name below.
    if (!name || !email || (!company_name && !event_id)) {
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

    // company_name is optional for event signups; fall back to the person's
    // name so the companies row (slug + name, both NOT NULL) still has a value.
    const effectiveCompanyName =
      (company_name ? String(company_name).trim() : '') || String(name).trim();

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
        status: 'new',
        notes: [
          source && `Source: ${source}`,
          plan && `Interested in plan: ${plan}`,
          service && `Interested in service: ${service}`,
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
    const trimmed = String(name).trim();
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
    if (event_id) {
      const { data: eventRow, error: eventLookupError } = await supabase
        .from('events')
        .select('title')
        .eq('id', event_id)
        .maybeSingle();
      if (eventLookupError) {
        // Non-fatal: the registration insert below still records the signup;
        // we just lose the title in the notification. Log so it's observable.
        console.warn('[lead] event title lookup failed:', eventLookupError.message);
      }
      eventTitle = eventRow?.title ?? undefined;

      const { error: registrationError } = await supabase
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
        });

      if (registrationError) throw registrationError;
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
      message,
      source,
      eventTitle,
    });

    // TODO: Send confirmation email to the lead

    return NextResponse.json({
      success: true,
      message: "Thanks! We'll be in touch within 1 business day.",
    });
  } catch (error) {
    console.error('Lead capture error:', error);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
