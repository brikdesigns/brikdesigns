import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { notifyOnLead } from '@/lib/notifications';

/**
 * Lead capture endpoint.
 * Called from the Get Started and Free Marketing Analysis forms.
 * Creates a company (type: 'lead') and contact in Supabase.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, company_name, phone, plan, service, message, source } = body;

    // Basic validation
    if (!name || !email || !company_name) {
      return NextResponse.json(
        { error: 'Name, email, and company name are required.' },
        { status: 400 }
      );
    }

    // TODO: Verify reCAPTCHA token
    // const recaptchaValid = await verifyRecaptcha(body.recaptcha_token);
    // if (!recaptchaValid) return NextResponse.json({ error: 'Invalid captcha' }, { status: 400 });

    const supabase = createServiceClient();

    // companies.slug is NOT NULL; derive from company_name + a 6-char suffix
    // for uniqueness when two leads share a company name.
    const baseSlug = String(company_name)
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
        name: company_name,
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

    // Fan out notifications to email + Slack. Best-effort; failures here
    // never block the success response — we already saved the lead.
    await notifyOnLead({ name, email, company_name, phone, plan, service, message, source });

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
