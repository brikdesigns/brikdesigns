#!/usr/bin/env tsx
/**
 * audit-feedback-health.ts
 *
 * Guards the staging QA feedback widget (src/app/api/feedback/route.ts) against
 * the two failure classes that have broken it before — both of which surface to
 * the reviewer as the same generic "Feedback failed — see console for details."
 * alert, with no hint which one it is:
 *
 *   1. ENV BINDING GAP — NOTION_TOKEN missing from the brikdesigns Netlify
 *      deploy. The route returns 500 "Feedback service not configured" before it
 *      ever reaches Notion. Root cause of the 2026-06-11 outage: the token was
 *      never run through scripts/set-netlify-env.sh, so it existed for renew-pms
 *      but not here.
 *
 *   2. NOTION SCHEMA DRIFT — the shared Backlog DB gets restructured and the
 *      route's select-by-name payload 400s: the PM-system expansion (brik-llm#794)
 *      and the OPE-29 refactor that retyped Type/Severity to relations and renamed
 *      Triage → "Triage Status". Fixed reactively twice; this catches the next one.
 *
 * The route no longer gates on a Supabase super_admin session — this is the
 * marketing site, which has no login, so that gate rejected everyone and broke
 * all feedback (brik-llm#352). The whole brikdesigns deploy is now
 * password-protected at the Netlify edge (site-wide — Netlify password
 * protection can't scope to a context), which is the spam boundary.
 *
 * Three independent checks:
 *   A. Authenticate through the Netlify password, then POST an empty body to the
 *      staging route. Healthy = 400 "Description is required" — the route cleared
 *      the NOTION_TOKEN check and reached body validation WITHOUT writing to
 *      Notion. Fails on 500 (token missing/misbound) or 404 (route not deployed).
 *      Probing through the gate (not a public context) tests the real staging
 *      binding. Skipped (not failed) when STAGING_SITE_PASSWORD is absent — the
 *      gate-up check (C) still runs token-lessly.
 *   B. Fetch the live Backlog schema with NOTION_TOKEN and assert every property
 *      the route writes still exists with the expected type — and that the select
 *      options it sends by name are still present. Skipped (not failed) when
 *      NOTION_TOKEN is absent.
 *   C. Confirm the edge gate is up — GET the staging root unauthenticated and
 *      expect a Netlify password challenge (401). A 200 means the password
 *      protection was turned off and the public staging URL can spam the
 *      Backlog DB again.
 *
 * Usage:
 *   NOTION_TOKEN=… STAGING_SITE_PASSWORD=… \
 *     npx tsx scripts/audit-feedback-health.ts [staging-base-url]
 *   # default staging-base-url: https://staging--brikdesigns.netlify.app
 *
 * Exit 0 = healthy, 1 = a check failed. Wired into
 * .github/workflows/feedback-health.yml (scheduled daily + manual dispatch).
 */

const DEFAULT_BASE = 'https://staging--brikdesigns.netlify.app';

// Mirror of src/app/api/feedback/route.ts. Keep in sync when the route's POST
// payload changes — a divergence here is the gate failing to guard the contract.
const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';
const BACKLOG_DATABASE_ID = '32097d34-ed28-8051-8225-eb6800c2e05a';

/**
 * Every property route.ts writes, with the Notion type it sends and (for
 * select/multi_select) the option names it sends by name. A name the route
 * sends that no longer exists is the drift that 400s the live POST.
 */
const CONTRACT: Array<{ name: string; type: string; options?: string[] }> = [
  { name: 'Name', type: 'title' },
  { name: 'Description', type: 'rich_text' },
  { name: 'Submitter', type: 'rich_text' },
  // TYPE_MAP values + the 'Bug' fallback.
  { name: 'Type [legacy]', type: 'select', options: ['Bug', 'Enhancement', 'Suggestion', 'Question'] },
  { name: 'Role', type: 'multi_select', options: ['Brik Admin'] },
  { name: 'Product', type: 'select', options: ['Website'] },
  { name: 'Triage Status', type: 'select', options: ['Not Triaged'] },
  { name: 'URL', type: 'url' },
];

const problems: string[] = [];

/**
 * Submit the Netlify visitor-access password and return the access cookie that
 * unlocks the gated deploy, or null if auth failed. Netlify answers the password
 * POST with a 302 + a Set-Cookie named after the site ID (not "nf_jwt"), so we
 * forward whatever cookie(s) the 302 sets rather than matching a fixed name.
 */
async function authenticate(baseUrl: string, password: string): Promise<string | null> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `password=${encodeURIComponent(password)}`,
      redirect: 'manual', // the 302 carries the cookie; following it 401s again
    });
  } catch {
    return null;
  }
  if (res.status !== 302) return null;
  // getSetCookie() (undici, Node 18+) preserves multiple cookies; fall back to
  // the combined header for older runtimes. Keep only the name=value pair.
  const cookies = res.headers.getSetCookie?.() ?? [res.headers.get('set-cookie') ?? ''];
  const pairs = cookies.map((c) => c.split(';')[0].trim()).filter(Boolean);
  return pairs.length ? pairs.join('; ') : null;
}

/**
 * Check A — the route must clear the NOTION_TOKEN check and reach body
 * validation. Authenticate through the edge password first, then POST an empty
 * body: it stops at the description check (400) BEFORE the Notion write, so the
 * probe never creates a Backlog row.
 */
async function checkDeployedEndpoint(baseUrl: string, password: string): Promise<void> {
  const cookie = await authenticate(baseUrl, password);
  if (!cookie) {
    problems.push(`[A] could not authenticate through the Netlify password at ${baseUrl} (no nf_jwt).`);
    return;
  }

  const url = `${baseUrl}/api/feedback`;
  let status: number;
  let body = '';
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: '{}', // no description → 400 before any Notion write
    });
    status = res.status;
    body = await res.text();
  } catch (err) {
    problems.push(`[A] could not reach ${url}: ${(err as Error).message}`);
    return;
  }

  if (status === 400) {
    console.log(`[A] ✓ ${url} → 400 (authed; token check cleared, reached validation; no write)`);
    return;
  }
  if (status === 401) {
    problems.push(`[A] ${url} → 401 — edge password auth did not stick (nf_jwt rejected).`);
    return;
  }
  if (status === 500) {
    problems.push(
      `[A] ${url} → 500 ${body.trim()} — NOTION_TOKEN is missing/misbound on the ` +
        `Netlify deploy. Set it with: printf '%s' "$TOKEN" | ./scripts/set-netlify-env.sh NOTION_TOKEN`,
    );
    return;
  }
  if (status === 404) {
    problems.push(`[A] ${url} → 404 — the feedback route is not deployed on this context.`);
    return;
  }
  problems.push(`[A] ${url} → unexpected ${status} ${body.trim()} (expected 400).`);
}

/**
 * Check C — the staging edge gate must be up. GET the staging root; a Netlify
 * password-protected deploy answers 401 with a password page. A 200 means the
 * gate is off and the public staging URL can spam the Backlog DB again.
 */
async function checkEdgeGate(stagingUrl: string): Promise<void> {
  let status: number;
  try {
    const res = await fetch(stagingUrl, { method: 'GET', redirect: 'manual' });
    status = res.status;
  } catch (err) {
    problems.push(`[C] could not reach ${stagingUrl}: ${(err as Error).message}`);
    return;
  }
  if (status === 401) {
    console.log(`[C] ✓ ${stagingUrl} → 401 (Netlify password gate is up)`);
    return;
  }
  problems.push(
    `[C] ${stagingUrl} → ${status} (expected 401) — the staging password gate is ` +
      `OFF. Re-enable visitor-access password protection on non-production contexts.`,
  );
}

/** Check B — the live Backlog schema must still accept the route's payload. */
async function checkNotionSchema(token: string): Promise<void> {
  let props: Record<string, { type: string; [k: string]: unknown }>;
  try {
    const res = await fetch(`${NOTION_API}/databases/${BACKLOG_DATABASE_ID}`, {
      headers: { Authorization: `Bearer ${token}`, 'Notion-Version': NOTION_VERSION },
    });
    if (!res.ok) {
      problems.push(`[B] Notion schema fetch failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
      return;
    }
    props = (await res.json()).properties;
  } catch (err) {
    problems.push(`[B] could not reach Notion: ${(err as Error).message}`);
    return;
  }

  for (const field of CONTRACT) {
    const prop = props[field.name];
    if (!prop) {
      problems.push(`[B] property "${field.name}" is gone from the Backlog DB (route writes it).`);
      continue;
    }
    if (prop.type !== field.type) {
      problems.push(
        `[B] property "${field.name}" is now type "${prop.type}", route sends "${field.type}" ` +
          `(this is exactly the OPE-29-style retype that 400s the POST).`,
      );
      continue;
    }
    if (field.options) {
      const live = new Set(((prop[field.type] as { options: Array<{ name: string }> }).options).map((o) => o.name));
      const missing = field.options.filter((o) => !live.has(o));
      if (missing.length) {
        problems.push(`[B] property "${field.name}" is missing option(s) the route sends: ${missing.join(', ')}`);
      }
    }
  }
  if (!problems.some((p) => p.startsWith('[B]'))) {
    console.log(`[B] ✓ Backlog schema matches the route payload (${CONTRACT.length} properties).`);
  }
}

async function main(): Promise<void> {
  const stagingUrl = (process.argv[2] ?? DEFAULT_BASE).replace(/\/$/, '');
  const token = process.env.NOTION_TOKEN;
  const password = process.env.STAGING_SITE_PASSWORD;

  console.log(`Auditing feedback widget health against ${stagingUrl}\n`);

  if (password) {
    await checkDeployedEndpoint(stagingUrl, password);
  } else {
    console.log('[A] ⊘ skipped — STAGING_SITE_PASSWORD not set (gate-up check still runs).');
  }
  if (token) {
    await checkNotionSchema(token);
  } else {
    console.log('[B] ⊘ skipped — NOTION_TOKEN not set.');
  }
  await checkEdgeGate(stagingUrl);

  if (problems.length) {
    console.error(`\n✗ Feedback widget health check failed:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    process.exit(1);
  }
  console.log('\n✓ Feedback widget healthy.');
}

main();
