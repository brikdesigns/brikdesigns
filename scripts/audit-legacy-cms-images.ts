#!/usr/bin/env npx tsx
/**
 * Audit CMS image references still pointing at the legacy Webflow CDN.
 *
 * READ-ONLY — no mutations. This is the verification tool for #1298 AC1
 * ("audit query returns 0 rows containing website-files.com"), and the
 * inventory generator the migration works from.
 *
 * brikdesigns is a pure read consumer of every table below
 * (`.claude/references/services-cms-ownership.md` rule 3) — so this script
 * audits and reports, and never writes. The repoint itself is portal-side.
 *
 * The `*_url` column set is derived from `src/types/supabase.ts` at runtime
 * rather than hardcoded, so a new image column added in portal enters the
 * audit on the next `npm run gen:types` instead of silently escaping it.
 *
 * Run:
 *   set -a; source ~/.secrets/supabase-staging.env; set +a
 *   npm run audit:legacy-images            # grouped report
 *   npm run audit:legacy-images -- --json  # machine-readable inventory
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// `quiet` matters here, not just for tidiness: dotenv v17 prints its "injected
// env" tip to STDOUT, which lands inside the `--json` payload and makes it
// unparseable by jq or any downstream consumer.
dotenv.config({ path: path.join(__dirname, '../.env.local'), quiet: true });
dotenv.config({ path: path.join(__dirname, '../.env'), quiet: true });

/** The legacy host every migrated ref must stop resolving to. */
const LEGACY_HOST = 'website-files.com';

/**
 * Tables audited, with the column that identifies a row in the report.
 * Scoped to the CMS tables brikdesigns renders — see the ownership matrix.
 */
const TABLES: { table: string; idColumn: string }[] = [
  { table: 'service_lines', idColumn: 'slug' },
  { table: 'services', idColumn: 'slug' },
  { table: 'offerings', idColumn: 'slug' },
  { table: 'service_plans', idColumn: 'slug' },
  { table: 'industry_pages', idColumn: 'slug' },
  { table: 'blog_posts', idColumn: 'slug' },
  { table: 'customer_stories', idColumn: 'slug' },
];

// Read-only audit — anon (publishable) key + public RLS, not service-role.
// Same rationale as scripts/audit-supabase-drift.ts: staging migrated to the
// new key system in 2026-05 and rejects the legacy service-role JWT.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    'Missing Supabase credentials.\n' +
      '  set -a; source ~/.secrets/supabase-staging.env; set +a'
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Extract every `*_url` column name for a table from the generated types.
 *
 * Parsing the type file rather than querying `information_schema` keeps the
 * audit runnable against the anon key, which cannot read the catalog.
 */
function urlColumnsFromTypes(table: string): string[] {
  const typesPath = path.join(__dirname, '../src/types/supabase.ts');
  const src = fs.readFileSync(typesPath, 'utf8');
  const block = src.match(
    new RegExp(`^ {6}${table}: \\{\\n {8}Row: \\{([\\s\\S]*?)\\n {8}\\}`, 'm')
  );
  if (!block) throw new Error(`${table}: no Row type in src/types/supabase.ts`);
  return [...block[1].matchAll(/^ {10}(\w+):/gm)]
    .map((m) => m[1])
    .filter((c) => c.endsWith('_url'));
}

interface LegacyRef {
  table: string;
  id: string;
  column: string;
  url: string;
  /** Trailing path segment — the Webflow asset filename. */
  filename: string;
}

async function main() {
  const asJson = process.argv.includes('--json');
  const findings: LegacyRef[] = [];
  const byTable = new Map<string, number>();
  const failures: string[] = [];

  for (const { table, idColumn } of TABLES) {
    const columns = urlColumnsFromTypes(table);
    const { data, error } = await supabase
      .from(table)
      .select([idColumn, ...columns].join(','));

    if (error) {
      failures.push(`${table}: ${error.message}`);
      continue;
    }

    for (const row of (data ?? []) as unknown as Record<string, string | null>[]) {
      for (const column of columns) {
        const url = row[column];
        if (!url || !url.includes(LEGACY_HOST)) continue;
        findings.push({
          table,
          id: row[idColumn] ?? '(no slug)',
          column,
          url,
          filename: decodeURIComponent(url.split('/').pop() ?? ''),
        });
        byTable.set(table, (byTable.get(table) ?? 0) + 1);
      }
    }
  }

  // A table that failed to read is not a table with zero legacy refs. Refusing
  // to print a total here is the point: AC1 asserts 0, and an unread table
  // would let a partial scan pass as a clean one.
  if (failures.length > 0) {
    console.error(`\nAudit INCOMPLETE — ${failures.length} table(s) unreadable:`);
    for (const f of failures) console.error(`  ${f}`);
    console.error('\nTotal suppressed: an unread table is not a clean table.');
    process.exit(2);
  }

  if (asJson) {
    console.log(JSON.stringify({ total: findings.length, findings }, null, 2));
  } else {
    console.log(`\nLegacy Webflow-CDN refs (${LEGACY_HOST}) — staging\n`);
    for (const { table } of TABLES) {
      const rows = findings.filter((f) => f.table === table);
      console.log(`${table} (${rows.length})`);
      for (const r of rows) console.log(`  ${r.id} · ${r.column} · ${r.filename}`);
      console.log('');
    }
    const counts = [...byTable.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([t, n]) => `${t} ${n}`)
      .join(', ');
    console.log(`TOTAL: ${findings.length}  (${counts})`);
  }

  // Exit 1 when legacy refs remain, so CI or a verification step can gate on
  // AC1 without parsing the report.
  process.exit(findings.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
