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
 */

export interface LeadNotification {
  name: string;
  email: string;
  company_name: string;
  phone?: string;
  plan?: string;
  service?: string;
  message?: string;
  source: string;
}

const FROM_EMAIL = 'Brik Designs <hello@brikdesigns.com>';

function field(label: string, value: string | undefined): string | null {
  if (!value) return null;
  return `${label}: ${value}`;
}

function plainTextBody(lead: LeadNotification): string {
  return [
    `New lead from brikdesigns.com`,
    ``,
    field('Name', lead.name),
    field('Email', lead.email),
    field('Company', lead.company_name),
    field('Phone', lead.phone),
    field('Source', lead.source),
    field('Plan', lead.plan),
    field('Service', lead.service),
    lead.message ? `\nMessage:\n${lead.message}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

function htmlBody(lead: LeadNotification): string {
  const rows = [
    ['Name', lead.name],
    ['Email', `<a href="mailto:${lead.email}">${lead.email}</a>`],
    ['Company', lead.company_name],
    ['Phone', lead.phone],
    ['Source', lead.source],
    ['Plan', lead.plan],
    ['Service', lead.service],
  ]
    .filter(([, v]) => Boolean(v))
    .map(([k, v]) => `<tr><td><strong>${k}</strong></td><td>${v}</td></tr>`)
    .join('');

  const message = lead.message
    ? `<h3>Message</h3><p style="white-space:pre-wrap">${escapeHtml(lead.message)}</p>`
    : '';

  return `<div style="font-family:system-ui,sans-serif;max-width:560px">
    <h2>New lead from brikdesigns.com</h2>
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
      subject: `New lead — ${lead.name} (${lead.company_name})`,
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
  const url = process.env.SLACK_LEADS_WEBHOOK_URL;
  if (!url) {
    console.warn('[lead-notify] SLACK_LEADS_WEBHOOK_URL missing — skipping slack');
    return;
  }

  const summary = `🎯 New lead: ${lead.name} (${lead.email}) at ${lead.company_name} — source: ${lead.source}`;
  const detailLines = [
    field('Phone', lead.phone),
    field('Plan', lead.plan),
    field('Service', lead.service),
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
