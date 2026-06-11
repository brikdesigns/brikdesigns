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
 * all feedback (brik-llm#352). Staging is now publicly reachable + noindexed
 * (the Webflow-staging model); the spam boundary is a capability token
 * (FEEDBACK_INTAKE_TOKEN) the route requires as the `k` query param — see
 * src/app/api/feedback/route.ts (brikdesigns#444, replaced the #442/#443
 * site-wide Netlify edge password).
 *
 * Three independent checks:
 *   A. POST an empty body to the staging route WITH the token (`?k=…`). Healthy
 *      = 400 "Description is required" — the route cleared the token gate and
 *      the NOTION_TOKEN check, and reached body validation WITHOUT writing to
 *      Notion. Fails on 401 (token rejected), 500 (NOTION_TOKEN missing/misbound)
 *      or 404 (route not deployed / no token provisioned). Skipped (not failed)
 *      when FEEDBACK_INTAKE_TOKEN is absent — the gate-up check (C) still runs.
 *   B. Fetch the live Backlog schema with NOTION_TOKEN and assert every property
 *      the route writes still exists with the expected type — and that the select
 *      options it sends by name are still present. Skipped (not failed) when
 *      NOTION_TOKEN is absent.
 *   C. Confirm the token gate is up — POST to the route WITHOUT a token and
 *      expect 401. A 400 (reached body validation) or 200 means the gate is OFF
 *      and the public staging URL can spam the Backlog DB again.
 *
 * Usage:
 *   NOTION_TOKEN=… FEEDBACK_INTAKE_TOKEN=… \
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
 * Check A — the route must clear the token gate + the NOTION_TOKEN check and
 * reach body validation. POST an empty body WITH the token (`?k=…`): it stops
 * at the description check (400) BEFORE the Notion write, so the probe never
 * creates a Backlog row.
 */
async function checkDeployedEndpoint(baseUrl: string, intakeToken: string): Promise<void> {
  const url = `${baseUrl}/api/feedback?k=${encodeURIComponent(intakeToken)}`;
  const display = `${baseUrl}/api/feedback`;
  let status: number;
  let body = '';
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}', // no description → 400 before any Notion write
    });
    status = res.status;
    body = await res.text();
  } catch (err) {
    problems.push(`[A] could not reach ${display}: ${(err as Error).message}`);
    return;
  }

  if (status === 400) {
    console.log(`[A] ✓ ${display} → 400 (token + NOTION_TOKEN cleared, reached validation; no write)`);
    return;
  }
  if (status === 401) {
    problems.push(`[A] ${display} → 401 — token rejected. FEEDBACK_INTAKE_TOKEN here ≠ the value on the deploy.`);
    return;
  }
  if (status === 500) {
    problems.push(
      `[A] ${display} → 500 ${body.trim()} — NOTION_TOKEN is missing/misbound on the ` +
        `Netlify deploy. Set it with: printf '%s' "$TOKEN" | ./scripts/set-netlify-env.sh NOTION_TOKEN`,
    );
    return;
  }
  if (status === 404) {
    problems.push(
      `[A] ${display} → 404 — route not deployed, or NEXT_PUBLIC_FEEDBACK_INTAKE_TOKEN ` +
        `is not provisioned on this context.`,
    );
    return;
  }
  problems.push(`[A] ${display} → unexpected ${status} ${body.trim()} (expected 400).`);
}

/**
 * Check C — the token gate must be up. POST to the route WITHOUT a token; the
 * gate answers 401 before any Notion write. A 400 (reached body validation) or
 * 200 means the gate is OFF and the public staging URL can spam the Backlog DB.
 */
async function checkTokenGate(stagingUrl: string): Promise<void> {
  const url = `${stagingUrl}/api/feedback`;
  let status: number;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    status = res.status;
  } catch (err) {
    problems.push(`[C] could not reach ${url}: ${(err as Error).message}`);
    return;
  }
  if (status === 401 || status === 404) {
    console.log(`[C] ✓ ${url} → ${status} (token gate is up — no token, no write)`);
    return;
  }
  problems.push(
    `[C] ${url} → ${status} (expected 401) — the feedback token gate is OFF. The ` +
      `public staging URL can write to the Backlog DB without a token.`,
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
  const intakeToken = process.env.FEEDBACK_INTAKE_TOKEN;

  console.log(`Auditing feedback widget health against ${stagingUrl}\n`);

  if (intakeToken) {
    await checkDeployedEndpoint(stagingUrl, intakeToken);
  } else {
    console.log('[A] ⊘ skipped — FEEDBACK_INTAKE_TOKEN not set (gate-up check still runs).');
  }
  if (token) {
    await checkNotionSchema(token);
  } else {
    console.log('[B] ⊘ skipped — NOTION_TOKEN not set.');
  }
  await checkTokenGate(stagingUrl);

  if (problems.length) {
    console.error(`\n✗ Feedback widget health check failed:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    process.exit(1);
  }
  console.log('\n✓ Feedback widget healthy.');
}

main();
