#!/usr/bin/env tsx
/**
 * audit-plan-data.ts
 *
 * Read-only audit of the `plans` table on staging Supabase. Prints each
 * support plan's slug, name, service_line_id, joined service_lines.slug,
 * and what mapServiceLineSlug() would resolve to. Surfaces NULL/wrong
 * service-line affinity so the audience cascade (--surface-service-*,
 * --background-inverse, etc.) doesn't silently fall back to 'brand'.
 *
 * Run with staging env sourced:
 *   set -a; source ~/.secrets/supabase-staging.env; set +a
 *   npx tsx scripts/audit-plan-data.ts
 *
 * Uses only anon-key reads — RLS on `plans` permits `is_public=true` rows.
 * Exit code 1 if any plan has missing or non-canonical service_line.
 */

const CANONICAL = new Set(['brand', 'marketing', 'information', 'product', 'service']);

interface PlanRow {
  slug: string;
  name: string;
  service_line_id: string | null;
  service_lines: { slug: string; name: string } | null;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.');
    console.error('Run: set -a; source ~/.secrets/supabase-staging.env; set +a');
    process.exit(2);
  }

  const endpoint = `${url}/rest/v1/plans?select=slug,name,service_line_id,service_lines(slug,name)&plan_type=eq.support&is_public=eq.true&order=rank.asc`;
  const resp = await fetch(endpoint, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!resp.ok) {
    console.error(`Supabase request failed: ${resp.status} ${resp.statusText}`);
    console.error(await resp.text());
    process.exit(2);
  }
  const rows = (await resp.json()) as PlanRow[];

  console.log(`${rows.length} support plans (is_public = true):\n`);

  const broken: PlanRow[] = [];
  for (const row of rows) {
    const lineSlug = row.service_lines?.slug ?? null;
    const resolved = lineSlug && CANONICAL.has(lineSlug) ? lineSlug : 'brand (FALLBACK)';
    const ok = lineSlug && CANONICAL.has(lineSlug);
    const flag = ok ? '✓' : '✗';
    console.log(`  ${flag} ${row.slug.padEnd(28)}  service_line_id=${row.service_line_id ?? 'NULL'}`);
    console.log(`    joined service_lines.slug: ${lineSlug ?? 'NULL'}`);
    console.log(`    audience cascade would resolve to: ${resolved}`);
    console.log();
    if (!ok) broken.push(row);
  }

  if (broken.length === 0) {
    console.log('All plans have canonical service-line affinity. ✓');
    return;
  }

  console.log('═══ Plans falling back to brand ═══');
  for (const row of broken) {
    console.log(`  ${row.slug} — fix: UPDATE plans SET service_line_id = (SELECT id FROM service_lines WHERE slug = '<correct>') WHERE slug = '${row.slug}';`);
  }
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
