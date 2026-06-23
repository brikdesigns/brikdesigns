import { Resend } from 'resend';

/**
 * Lead notification fan-out. Called from /api/leads after a successful insert.
 * Both channels are best-effort — failures are logged but never thrown to the
 * caller, so the form's success state is never blocked by a notification
 * outage.
 *
 * Env vars (Netlify + .env.local):
 *   RESEND_API_KEY           — Resend account key (shared with portal)
 *   LEADS_NOTIFICATION_EMAIL — destination address; defaults to hello@brikdesigns.com
 *   SLACK_LEADS_WEBHOOK_URL  — Slack incoming-webhook URL for #leads (or wherever)
 *   SLACK_EVENTS_WEBHOOK_URL — Slack incoming-webhook URL for #events; used when
 *                              the lead is an event registration. Falls back to
 *                              SLACK_LEADS_WEBHOOK_URL if unset (brikdesigns#334).
 */

export interface LeadNotification {
  name: string;
  email: string;
  company_name: string;
  phone?: string;
  plan?: string;
  service?: string;
  /** Multi-select service names from the Get Started form (#578). */
  services?: string[];
  /** Pricing tier the lead clicked through from (#592). */
  offering?: string;
  /** Formatted price of that tier (e.g. "$350 /month"). */
  offeringPrice?: string;
  message?: string;
  source: string;
  /** Set for event/newsletter registrations — routes Slack to #events. */
  eventTitle?: string;
}

const FROM_EMAIL = 'Brik Designs <hello@brikdesigns.com>';

function field(label: string, value: string | undefined): string | null {
  if (!value) return null;
  return `${label}: ${value}`;
}

/** Combine the offering name + its formatted price into one display value. */
function offeringValue(lead: LeadNotification): string | undefined {
  if (!lead.offering) return undefined;
  return lead.offeringPrice ? `${lead.offering} (${lead.offeringPrice})` : lead.offering;
}

function headline(lead: LeadNotification): string {
  return lead.eventTitle
    ? 'New event registration from brikdesigns.com'
    : 'New lead from brikdesigns.com';
}

function plainTextBody(lead: LeadNotification): string {
  return [
    headline(lead),
    ``,
    field('Name', lead.name),
    field('Email', lead.email),
    field('Event', lead.eventTitle),
    field('Company', lead.company_name),
    field('Phone', lead.phone),
    field('Source', lead.source),
    field('Plan', lead.plan),
    field('Service', lead.service),
    field('Services', lead.services?.length ? lead.services.join(', ') : undefined),
    field('Offering', offeringValue(lead)),
    lead.message ? `\nMessage:\n${lead.message}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

function htmlBody(lead: LeadNotification): string {
  const rows = [
    ['Name', lead.name],
    ['Email', `<a href="mailto:${lead.email}">${lead.email}</a>`],
    ['Event', lead.eventTitle ? escapeHtml(lead.eventTitle) : undefined],
    ['Company', lead.company_name],
    ['Phone', lead.phone],
    ['Source', lead.source],
    ['Plan', lead.plan],
    ['Service', lead.service],
    ['Services', lead.services?.length ? escapeHtml(lead.services.join(', ')) : undefined],
    ['Offering', offeringValue(lead) ? escapeHtml(offeringValue(lead)!) : undefined],
  ]
    .filter(([, v]) => Boolean(v))
    .map(([k, v]) => `<tr><td><strong>${k}</strong></td><td>${v}</td></tr>`)
    .join('');

  const message = lead.message
    ? `<h3>Message</h3><p style="white-space:pre-wrap">${escapeHtml(lead.message)}</p>`
    : '';

  return `<div style="font-family:system-ui,sans-serif;max-width:560px">
    <h2>${headline(lead)}</h2>
    <table style="border-collapse:collapse">${rows}</table>
    ${message}
  </div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function sendEmail(lead: LeadNotification): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.LEADS_NOTIFICATION_EMAIL ?? 'hello@brikdesigns.com';
  if (!apiKey) {
    console.warn('[lead-notify] RESEND_API_KEY missing — skipping email');
    return;
  }
  const resend = new Resend(apiKey);
  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      replyTo: lead.email,
      subject: lead.eventTitle
        ? `New event registration — ${lead.name} (${lead.eventTitle})`
        : `New lead — ${lead.name} (${lead.company_name})`,
      text: plainTextBody(lead),
      html: htmlBody(lead),
    });
    if (error) {
      console.error('[lead-notify] Resend error:', error);
    }
  } catch (err) {
    console.error('[lead-notify] Resend threw:', err);
  }
}

async function sendSlack(lead: LeadNotification): Promise<void> {
  // Event registrations route to #events; fall back to #leads if the events
  // webhook isn't configured yet (brikdesigns#334).
  const url = lead.eventTitle
    ? process.env.SLACK_EVENTS_WEBHOOK_URL ?? process.env.SLACK_LEADS_WEBHOOK_URL
    : process.env.SLACK_LEADS_WEBHOOK_URL;
  if (!url) {
    console.warn('[lead-notify] no Slack webhook configured — skipping slack');
    return;
  }

  const summary = lead.eventTitle
    ? `📅 New event registration: ${lead.name} (${lead.email}) for *${lead.eventTitle}* — source: ${lead.source}`
    : `🎯 New lead: ${lead.name} (${lead.email}) at ${lead.company_name} — source: ${lead.source}`;
  const detailLines = [
    field('Phone', lead.phone),
    field('Plan', lead.plan),
    field('Service', lead.service),
    field('Services', lead.services?.length ? lead.services.join(', ') : undefined),
    field('Offering', offeringValue(lead)),
    lead.message ? `*Message:* ${lead.message}` : null,
  ].filter(Boolean);

  const text = detailLines.length ? `${summary}\n${detailLines.join('\n')}` : summary;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      console.error('[lead-notify] Slack webhook returned', res.status, await res.text());
    }
  } catch (err) {
    console.error('[lead-notify] Slack threw:', err);
  }
}

export async function notifyOnLead(lead: LeadNotification): Promise<void> {
  // Fan out in parallel; both are best-effort.
  await Promise.allSettled([sendEmail(lead), sendSlack(lead)]);
}

// ── Event registration confirmation email (brikdesigns#337) ──────────────
// Sent to the registrant after a successful event_registrations insert.
// Best-effort, same as notifyOnLead — never blocks the API response. Only
// fired for template='event' signups (the route guards this); newsletter
// welcome emails are a separate Phase 2 flow.

export interface EventConfirmation {
  /** Registrant email — the recipient. */
  email: string;
  /** Registrant first name for the greeting; '' falls back to "there". */
  firstName: string;
  event: {
    title: string;
    event_date: string | null;
    event_time: string | null;
    description_html: string | null;
  };
}

/** Format a yyyy-mm-dd DATE for the email; '' for null. Plain-date parse,
 *  no timezone shift. */
function formatConfirmationDate(date: string | null): string {
  if (!date) return '';
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return date;
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function confirmationWhen(event: EventConfirmation['event']): string {
  return [formatConfirmationDate(event.event_date), event.event_time ?? '']
    .filter(Boolean)
    .join(' · ');
}

function confirmationText(c: EventConfirmation): string {
  const when = confirmationWhen(c.event);
  const details = c.event.description_html ? stripTags(c.event.description_html) : '';
  return [
    `Hi ${c.firstName || 'there'},`,
    ``,
    `You're registered for ${c.event.title}.`,
    when ? `\nWhen: ${when}` : null,
    details ? `\n${details}` : null,
    ``,
    `See you there,`,
    `Brik Designs`,
  ]
    .filter((l) => l !== null)
    .join('\n');
}

function confirmationHtml(c: EventConfirmation): string {
  const when = confirmationWhen(c.event);
  // description_html is admin-authored and sanitized on write by the portal
  // CMS uploader; embedded as-is for the "what to expect" section (mail
  // clients sandbox HTML). Title/name/when are escaped.
  return `<div style="font-family:system-ui,sans-serif;max-width:560px">
    <h2>You're registered!</h2>
    <p>Hi ${escapeHtml(c.firstName || 'there')},</p>
    <p>Thanks for registering for <strong>${escapeHtml(c.event.title)}</strong>.</p>
    ${when ? `<p><strong>When:</strong> ${escapeHtml(when)}</p>` : ''}
    ${c.event.description_html ? `<div>${c.event.description_html}</div>` : ''}
    <p>See you there,<br />Brik Designs</p>
  </div>`;
}

export async function notifyOnEventRegistration(c: EventConfirmation): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[event-confirm] RESEND_API_KEY missing — skipping confirmation email');
    return;
  }
  const resend = new Resend(apiKey);
  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: c.email,
      replyTo: 'hello@brikdesigns.com',
      subject: `You're registered — ${c.event.title}`,
      text: confirmationText(c),
      html: confirmationHtml(c),
    });
    if (error) {
      console.error('[event-confirm] Resend error:', error);
    }
  } catch (err) {
    console.error('[event-confirm] Resend threw:', err);
  }
}
