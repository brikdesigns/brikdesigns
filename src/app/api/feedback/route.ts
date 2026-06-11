import { NextResponse } from 'next/server';

const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';
const BACKLOG_DATABASE_ID = '32097d34-ed28-8051-8225-eb6800c2e05a';
const PRODUCT_NAME = 'Website';
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://staging--brikdesigns.netlify.app';

/** Map widget types to Backlog Type select values */
const TYPE_MAP: Record<string, string> = {
  bug: 'Bug',
  ui: 'Enhancement',
  suggestion: 'Suggestion',
  question: 'Question',
};

const EMOJI_MAP: Record<string, string> = {
  bug: '🐛',
  ui: '🎨',
  suggestion: '💡',
  question: '❓',
};

/**
 * POST /api/feedback — staging-only QA feedback → renew-pms Backlog Notion DB.
 *
 * Phase 3 of brikdesigns/brik-llm#352 (issue brikdesigns/brikdesigns#54).
 * Mirrors product/renew-pms/src/app/api/feedback/route.ts; the same Notion DB
 * (32097d34-...) tracks feedback across Brik products via the Product select.
 * Filed under the existing "Website" Product option (brik-llm#794).
 *
 * Required env vars (Netlify staging context):
 *   - NOTION_TOKEN                      — Notion integration token with write
 *                                         access to the Backlog DB
 *   - NEXT_PUBLIC_SITE_URL              — base URL the page_url field prefixes
 *   - NEXT_PUBLIC_FEEDBACK_INTAKE_TOKEN — capability token gating this route
 *
 * Auth: this site has no login (it's the marketing rebuild, not an app), so a
 * super_admin session can never exist here — the old session gate rejected
 * everyone and blocked all feedback (brik-llm#352). Instead the route requires
 * a capability token (NEXT_PUBLIC_FEEDBACK_INTAKE_TOKEN), carried as the `k`
 * query param on the widget's POST URL and provisioned only on the staging
 * Netlify context: a request without the matching token gets 401, and a deploy
 * with no token provisioned (e.g. production) gets 404. This lets staging be
 * publicly reachable + noindexed (the Webflow-staging model) without leaving
 * the public URL free to spam writes into the shared Backlog DB. The token is
 * a bot/scanner boundary, not a secret — it ships in the staging client bundle.
 * (brikdesigns#444; replaced the site-wide Netlify edge password of #442/#443.)
 */
export async function POST(request: Request) {
  // Capability-token gate (brikdesigns#444). Staging-only: no token provisioned
  // → route is not available here (production). Token present but mismatched/
  // absent on the request → unauthorized. Checked before NOTION_TOKEN so blind
  // scanners get 401 regardless of the Notion binding state.
  const intakeToken = process.env.NEXT_PUBLIC_FEEDBACK_INTAKE_TOKEN;
  if (!intakeToken) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (new URL(request.url).searchParams.get('k') !== intakeToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const notionToken = process.env.NOTION_TOKEN;
  if (!notionToken) {
    console.error('[feedback] NOTION_TOKEN not configured in env');
    return NextResponse.json({ error: 'Feedback service not configured' }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const { page_url, feedback_type, description, submitter: rawSubmitter } = body as {
    page_url?: string;
    feedback_type?: string;
    description?: string;
    submitter?: string;
  };

  if (!description?.trim()) {
    return NextResponse.json({ error: 'Description is required' }, { status: 400 });
  }

  // No session to attribute to. Use the reviewer name if the widget sends one
  // (form mode currently doesn't), else a generic staging label.
  const submitter = rawSubmitter?.trim() || 'Staging reviewer';
  const type = feedback_type ?? 'bug';
  const emoji = EMOJI_MAP[type] ?? '📝';
  const title = `${emoji} ${description.trim().slice(0, 80)}${description.length > 80 ? '...' : ''}`;

  const res = await fetch(`${NOTION_API}/pages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${notionToken}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      parent: { database_id: BACKLOG_DATABASE_ID },
      properties: {
        Name: { title: [{ text: { content: title } }] },
        Description: { rich_text: [{ text: { content: description.trim() } }] },
        Submitter: { rich_text: [{ text: { content: submitter } }] },
        // Post-OPE-29 Backlog schema: Type/Severity are now relations (not
        // writable by name), Triage was renamed to "Triage Status". Intake
        // writes the surviving select properties; triage assigns the relations.
        'Type [legacy]': { select: { name: TYPE_MAP[type] ?? 'Bug' } },
        Role: { multi_select: [{ name: 'Brik Admin' }] },
        Product: { select: { name: PRODUCT_NAME } },
        'Triage Status': { select: { name: 'Not Triaged' } },
        URL: { url: `${BASE_URL}${page_url ?? ''}` },
      },
    }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    console.error('[feedback] Notion API error:', res.status, JSON.stringify(errBody));
    // Surface the upstream Notion status + message so the widget shows an
    // actionable error instead of a generic string (see brik-llm#791).
    return NextResponse.json(
      { error: 'Failed to submit feedback', notion_status: res.status, details: errBody },
      { status: 502 },
    );
  }

  const page = await res.json();
  return NextResponse.json({ id: page.id, status: 'submitted' });
}
