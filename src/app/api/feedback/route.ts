import { NextResponse } from 'next/server';
import { getAuthUser, isBrikAdmin } from '@/lib/auth';

const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';
const BACKLOG_DATABASE_ID = '32097d34-ed28-8051-8225-eb6800c2e05a';
const PRODUCT_NAME = 'Brikdesigns';
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://staging--brikdesigns.netlify.app';

const SCOPE_MAP: Record<string, string> = {
  bug: 'Critical',
  ui: 'Normal',
  suggestion: 'Low',
  question: 'Low',
};

const FEEDBACK_TYPE_MAP: Record<string, string> = {
  bug: 'Bug',
  ui: 'UI Issue',
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
 *
 * Pre-requisites (one-time, manual in Notion):
 *   - Add "Brikdesigns" to the Product select on the Backlog database.
 *
 * Required env vars (Netlify staging context):
 *   - NOTION_TOKEN          — Notion integration token with write access to
 *                             the Backlog DB
 *   - NEXT_PUBLIC_SITE_URL  — base URL the page_url field is prefixed with
 *
 * Auth: only Brik super_admins can submit. Anonymous or client-role logins
 * are rejected to prevent Notion-DB spam from the staging URL leaking.
 */
export async function POST(request: Request) {
  const notionToken = process.env.NOTION_TOKEN;
  if (!notionToken) {
    console.error('[feedback] NOTION_TOKEN not configured in env');
    return NextResponse.json({ error: 'Feedback service not configured' }, { status: 500 });
  }

  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  if (!isBrikAdmin(authUser)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { page_url, feedback_type, description } = body as {
    page_url?: string;
    feedback_type?: string;
    description?: string;
  };

  if (!description?.trim()) {
    return NextResponse.json({ error: 'Description is required' }, { status: 400 });
  }

  const submitter = authUser.profile.full_name ?? 'Unknown';
  const email = authUser.profile.email ?? 'unknown';
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
        Submitter: { rich_text: [{ text: { content: `${submitter} (${email})` } }] },
        'Feedback Type': { select: { name: FEEDBACK_TYPE_MAP[type] ?? 'Bug' } },
        Role: { select: { name: 'admin' } },
        Product: { select: { name: PRODUCT_NAME } },
        Status: { status: { name: 'Not Started' } },
        Scope: { select: { name: SCOPE_MAP[type] ?? 'Normal' } },
        URL: { url: `${BASE_URL}${page_url ?? ''}` },
      },
    }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    console.error('[feedback] Notion API error:', res.status, JSON.stringify(errBody));
    return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 });
  }

  const page = await res.json();
  return NextResponse.json({ id: page.id, status: 'submitted' });
}
