#!/usr/bin/env npx tsx
/**
 * Audit drift between Supabase rows and Webflow CSV exports.
 *
 * READ-ONLY — no mutations. Run during the Webflow → Next.js rebuild to identify:
 *   1. Orphans — rows in Supabase that aren't in the CSV (manual edits / stale data)
 *   2. Missing — rows in the CSV that aren't in Supabase (need import)
 *   3. Drift   — rows in both where field values differ
 *
 * CSVs live in `content/csv/` (gitignored — they're Webflow exports refreshed
 * out-of-band; commit the audit output, not the source data).
 *
 * Run:
 *   set -a; source ~/.secrets/supabase-staging.env; set +a
 *   npm run audit:cms-drift
 *   npm run audit:cms-drift > tmp/drift-report.md
 */

import { createClient } from '@supabase/supabase-js';
import { parse } from 'csv-parse/sync';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const CSV_DIR = path.join(__dirname, '../content/csv');

// Read-only audit — uses the anon (publishable) key + public RLS, not
// service-role. Staging migrated to the new key system in 2026-05; the
// legacy JWT service-role key is rejected by the API. Anon is sufficient
// because every CMS table audited here has `is_public = true` rows that
// satisfy the standard public-read policy.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.\n' +
    'Run: set -a; source ~/.secrets/supabase-staging.env; set +a',
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ─── Helpers ────────────────────────────────────────────────────────────────

function readCSV(filename: string): Record<string, string>[] {
  const filepath = fs.readdirSync(CSV_DIR).find((f) => f.includes(filename));
  if (!filepath) throw new Error(`CSV not found: ${filename}`);
  const content = fs.readFileSync(path.join(CSV_DIR, filepath), 'utf8');
  return parse(content, { columns: true, skip_empty_lines: true });
}

function isPublished(row: Record<string, string>): boolean {
  return row['Draft'] !== 'true' && row['Archived'] !== 'true';
}

function snippet(s: unknown, n = 70): string {
  if (s === null || s === undefined || s === '') return '∅ (empty)';
  const str = String(s);
  return str.length > n ? `"${str.substring(0, n)}…"` : `"${str}"`;
}

function eq(a: unknown, b: unknown): boolean {
  const aEmpty = a === null || a === undefined || a === '';
  const bEmpty = b === null || b === undefined || b === '';
  if (aEmpty && bEmpty) return true;
  if (aEmpty !== bEmpty) return false;
  return String(a).trim() === String(b).trim();
}

interface FieldMap {
  csv: string;
  sb: string;
}

interface AuditOpts {
  title: string;
  csvFile: string;
  table: string;
  fields: FieldMap[];
  /** Limit drift detail output per row to this many fields (rest summarized) */
  maxDiffsPerRow?: number;
  /** Optional CSV-slug → SB-slug aliases (e.g., service_lines short-form, services overrides) */
  csvToSbAliasMap?: Record<string, string>;
}

const totals = {
  orphans: 0,
  missing: 0,
  driftRows: 0,
  emptyFields: 0,
};

async function auditCollection(opts: AuditOpts) {
  const { title, csvFile, table, fields, maxDiffsPerRow = 12 } = opts;
  console.log(`\n---\n\n## ${title}\n`);

  // CSV side
  let csvRows: Record<string, string>[];
  try {
    csvRows = readCSV(csvFile).filter(isPublished);
  } catch (e) {
    console.log(`❌ CSV read failed: ${(e as Error).message}\n`);
    return;
  }

  // Supabase side
  const { data: sbRows, error } = await supabase.from(table).select('*');
  if (error) {
    console.log(`❌ Supabase fetch failed (\`${table}\`): ${error.message}\n`);
    return;
  }

  // Apply alias map: when CSV slug aliases to a SB slug, treat as the same row.
  const aliasMap = opts.csvToSbAliasMap ?? {};
  const csvBySlug = new Map(csvRows.map((r) => {
    const aliased = aliasMap[r['Slug']];
    return [aliased ?? r['Slug'], r];
  }));
  const sbBySlug = new Map((sbRows ?? []).map((r) => [r.slug, r]));

  console.log(`| Side | Rows |\n|---|---|`);
  console.log(`| CSV (published) | ${csvRows.length} |`);
  console.log(`| Supabase | ${sbRows?.length ?? 0} |\n`);

  // Orphans
  const orphans = [...sbBySlug.keys()].filter((s) => !csvBySlug.has(s));
  console.log(`### Orphans (in Supabase, not in CSV) — ${orphans.length}\n`);
  if (orphans.length === 0) {
    console.log(`_None._\n`);
  } else {
    for (const slug of orphans) {
      const row = sbBySlug.get(slug);
      console.log(`- \`${slug}\` — name: ${snippet(row?.name)}`);
    }
    console.log();
    totals.orphans += orphans.length;
  }

  // Missing
  const missing = [...csvBySlug.keys()].filter((s) => !sbBySlug.has(s));
  console.log(`### Missing in Supabase (in CSV) — ${missing.length}\n`);
  if (missing.length === 0) {
    console.log(`_None._\n`);
  } else {
    for (const slug of missing) {
      const row = csvBySlug.get(slug);
      console.log(`- \`${slug}\` — name: ${snippet(row?.['Name'])}`);
    }
    console.log();
    totals.missing += missing.length;
  }

  // Field-level drift
  const inBoth = [...csvBySlug.keys()].filter((s) => sbBySlug.has(s));
  console.log(`### Drift in matched rows (${inBoth.length} matched)\n`);
  let driftRowCount = 0;
  let totalEmptyInSb = 0;

  for (const slug of inBoth) {
    const csv = csvBySlug.get(slug)!;
    const sb = sbBySlug.get(slug)!;
    const diffs: string[] = [];
    for (const f of fields) {
      const csvVal = csv[f.csv] ?? '';
      const sbVal = sb[f.sb] ?? '';
      if (!eq(csvVal, sbVal)) {
        const sbEmpty = sbVal === null || sbVal === undefined || sbVal === '';
        const csvEmpty = csvVal === '';
        if (sbEmpty && !csvEmpty) totalEmptyInSb++;
        diffs.push(
          `  - **\`${f.sb}\`**: SB=${snippet(sbVal)} ⟶ CSV=${snippet(csvVal)}`
        );
      }
    }
    if (diffs.length > 0) {
      driftRowCount++;
      console.log(`<details>\n<summary><code>${slug}</code> — ${diffs.length} field${diffs.length > 1 ? 's' : ''} drift</summary>\n`);
      const shown = diffs.slice(0, maxDiffsPerRow);
      console.log(shown.join('\n'));
      if (diffs.length > maxDiffsPerRow) {
        console.log(`  - _… ${diffs.length - maxDiffsPerRow} more_`);
      }
      console.log(`\n</details>\n`);
    }
  }
  if (driftRowCount === 0) {
    console.log(`_All matched rows have field parity._\n`);
  } else {
    console.log(`**${driftRowCount} of ${inBoth.length} matched rows have drift.** Empty-in-Supabase cells: ${totalEmptyInSb}.\n`);
    totals.driftRows += driftRowCount;
    totals.emptyFields += totalEmptyInSb;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log('# Supabase ↔ Webflow CSV drift audit\n');
  console.log(`- Generated: ${new Date().toISOString()}`);
  console.log(`- Supabase URL: ${supabaseUrl}`);
  console.log(`- CSV dir: \`content/csv/\``);
  console.log(`- Mode: **read-only** (no mutations)\n`);

  const SERVICE_LINE_ALIASES: Record<string, string> = {
    'brand-design': 'brand',
    'marketing-design': 'marketing',
    'information-design': 'information',
    'back-office-design': 'service',
    'product-design': 'product',
  };
  const SERVICES_ALIASES: Record<string, string> = {
    stationary: 'business-stationery',
  };

  await auditCollection({
    title: 'Service Lines (`service_lines`)',
    csvFile: 'Service Lines',
    table: 'service_lines',
    csvToSbAliasMap: SERVICE_LINE_ALIASES,
    fields: [
      { csv: 'Name', sb: 'name' },
      { csv: 'Tagline', sb: 'tagline' },
      { csv: 'Description', sb: 'description' },
      { csv: 'Hero', sb: 'hero_image_url' },
      { csv: 'Main Image', sb: 'card_image_url' },
      { csv: 'Support Plan', sb: 'support_plan_slug' },
      { csv: 'Support Plan Img', sb: 'support_plan_image_url' },
      { csv: 'Light', sb: 'brand_color_light' },
      { csv: 'Base', sb: 'brand_color_base' },
      { csv: 'Dark', sb: 'brand_color_dark' },
    ],
  });

  await auditCollection({
    title: 'Services (`services`)',
    csvFile: 'Services',
    table: 'services',
    csvToSbAliasMap: SERVICES_ALIASES,
    fields: [
      { csv: 'Name', sb: 'name' },
      { csv: 'Tagline', sb: 'tagline' },
      { csv: 'Description', sb: 'description' },
      { csv: 'Image', sb: 'image_url' },
      { csv: 'Related', sb: 'related_service_slug' },
      { csv: 'Support Plan', sb: 'support_plan_slug' },
    ],
  });

  await auditCollection({
    title: 'Offerings (`offerings`)',
    csvFile: 'Offerings',
    table: 'offerings',
    fields: [
      { csv: 'Name', sb: 'name' },
      { csv: 'Description', sb: 'description' },
      { csv: 'Price', sb: 'price_display' },
      { csv: 'What You Get', sb: 'what_you_get' },
      { csv: 'Icon', sb: 'icon_url' },
    ],
  });

  await auditCollection({
    title: 'Customer Stories (`customer_stories`)',
    csvFile: 'Customer Stories',
    table: 'customer_stories',
    fields: [
      { csv: 'Name', sb: 'name' },
      { csv: 'Client', sb: 'client_name' },
      { csv: 'Short Description', sb: 'short_description' },
      { csv: 'Hero Image', sb: 'hero_image_url' },
      { csv: 'Industry', sb: 'industry' },
      { csv: 'Service', sb: 'service_slug' },
      { csv: 'Service Line', sb: 'service_line_slug' },
    ],
  });

  // industry_pages: badge URL columns (primary_badge_url / secondary_badge_url)
  // were dropped from staging in 2026-05 — ServiceTag now drives badge
  // rendering off category + service name. The Webflow CSV still carries
  // "Primary Badge" / "Secondary Badge" columns from the old structure, but
  // they have no Supabase destination and are intentionally omitted here.
  await auditCollection({
    title: 'Industry Pages (`industry_pages` ← Customers CSV)',
    csvFile: 'Customers',
    table: 'industry_pages',
    fields: [
      { csv: 'Name', sb: 'name' },
      { csv: 'Tagline', sb: 'tagline' },
      { csv: 'Intro Title', sb: 'intro_title' },
      { csv: 'Intro Description', sb: 'intro_description' },
      { csv: 'Image', sb: 'image_url' },
    ],
  });

  console.log(`\n---\n\n## Totals\n`);
  console.log(`| Metric | Count |`);
  console.log(`|---|---|`);
  console.log(`| Orphan rows (Supabase not in CSV) | ${totals.orphans} |`);
  console.log(`| Missing rows (CSV not in Supabase) | ${totals.missing} |`);
  console.log(`| Rows with field drift | ${totals.driftRows} |`);
  console.log(`| Empty-in-Supabase cells (CSV has data) | ${totals.emptyFields} |`);
}

main().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
