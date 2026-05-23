#!/usr/bin/env npx tsx
/**
 * Audit drift between Supabase rows and Webflow CSV exports.
 *
 * READ-ONLY — no mutations.
 *
 * ## Framing (post-#178)
 *
 * **Supabase is canon for every table audited here.** The Webflow CSVs in
 * `content/csv/` are a one-time migration source from the legacy Webflow
 * site (being decommissioned); they are not an ongoing source of truth.
 *
 * Per `.claude/references/services-cms-ownership.md`:
 *   - `services` — portal owns writes (brikdesigns admin read-only post-#179)
 *   - `service_lines` — portal owns writes (brikdesigns admin read-only post-#188)
 *   - `offerings` — portal owns writes (brikdesigns admin read-only post-#189)
 *   - `customer_stories`, `industry_pages` — brikdesigns owns writes
 *
 * What drift findings mean now:
 *   1. Orphans (in Supabase, not in CSV) — expected. Rows added since the
 *      original Webflow import. NOT actionable.
 *   2. Missing (in CSV, not in Supabase) — almost always legacy Webflow rows
 *      intentionally not imported. Cross-check before "fixing"; usually NOT
 *      actionable.
 *   3. Field drift — Supabase wins. If values diverge, the CSV is stale.
 *      Only investigate if you expect the CSV to be authoritative for that
 *      field (rare — see `data-canonical-fields.md`).
 *
 * Real value of this audit now: catching ACCIDENTAL Supabase deletions of
 * rows the Webflow CSV still has (regression detection), and confirming the
 * legacy Webflow CSV has been fully absorbed. After the Webflow → Next.js
 * public cutover lands, this audit can retire entirely.
 *
 * CSVs are gitignored — Webflow exports refreshed out-of-band; commit the
 * audit output, not the source data.
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
  /**
   * When true, the audit skips field-level drift comparison for this field.
   * Use for fields where Supabase holds a BDS-canonical value (e.g., a token
   * string) that the legacy CSV cannot match by construction. See
   * `.claude/references/data-canonical-fields.md` for the policy.
   */
  canonicalSupabase?: boolean;
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
  /**
   * When true, this collection's findings are shown for historical reference
   * but are NOT counted in the grand totals. Use for tables where portal
   * Supabase is now the write authority and the Webflow CSV is a legacy
   * snapshot that will naturally fall further behind over time. See
   * `.claude/references/services-cms-ownership.md` (#178).
   */
  historical?: boolean;
}

const totals = {
  orphans: 0,
  missing: 0,
  driftRows: 0,
  emptyFields: 0,
};

async function auditCollection(opts: AuditOpts) {
  const { title, csvFile, table, fields, maxDiffsPerRow = 12 } = opts;
  const historical = opts.historical ?? false;
  const historicalNote = historical
    ? ' ⚠️ historical — portal Supabase is canon; findings below are legacy artifacts, not backlog (#178)'
    : '';
  console.log(`\n---\n\n## ${title}${historicalNote}\n`);

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
    if (!historical) totals.orphans += orphans.length;
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
    if (!historical) totals.missing += missing.length;
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
      if (f.canonicalSupabase) continue;
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
    if (!historical) {
      totals.driftRows += driftRowCount;
      totals.emptyFields += totalEmptyInSb;
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log('# Supabase ↔ Webflow CSV drift audit\n');
  console.log(`- Generated: ${new Date().toISOString()}`);
  console.log(`- Supabase URL: ${supabaseUrl}`);
  console.log(`- CSV dir: \`content/csv/\``);
  console.log(`- Mode: **read-only** (no mutations)\n`);
  console.log(
    '> **Supabase is canon.** Webflow CSVs are a one-time migration source ' +
      '(Webflow is being decommissioned). Drift findings on `services` / ' +
      '`service_lines` / `offerings` are legacy artifacts, not backlog — see ' +
      '`.claude/references/services-cms-ownership.md` for ownership boundaries ' +
      'and `audit-supabase-drift.ts` header comment for what each finding type ' +
      'means now.\n',
  );

  const SERVICE_LINE_ALIASES: Record<string, string> = {
    'brand-design': 'brand',
    'marketing-design': 'marketing',
    'information-design': 'information',
    'back-office-design': 'service',
    'product-design': 'product',
  };
  // Webflow CSV slug → Brik-canonical Supabase slug. Same framing as
  // SERVICE_LINE_ALIASES: Supabase wins, the CSV is a legacy export of a
  // soon-decommissioned Webflow site (see
  // `.claude/references/data-canonical-fields.md`). Each pair below was
  // verified by name match between the two sides. Without these, the audit
  // reports 6 orphans + 6 missing for what are actually the same rows under
  // different slugs (brikdesigns#149 reconciliation).
  const SERVICES_ALIASES: Record<string, string> = {
    stationary: 'business-stationery',
    'journey-map': 'customer-journey-mapping',
    infographic: 'infographics',
    'landing-page': 'landing-pages',
    'mobile-app': 'mobile-app-design',
    'business-listings': 'online-business-listings',
    'training-setup-organization': 'training-setup',
  };

  // service_lines: portal owns writes (brikdesigns admin flipped read-only via
  // #188; portal `/settings/service-lines` is canonical). CSV ↔ Supabase drift
  // is legacy migration artifact only — Supabase is canon.
  await auditCollection({
    title: 'Service Lines (`service_lines`) — _portal-owned, brikdesigns read-only_',
    csvFile: 'Service Lines',
    table: 'service_lines',
    historical: true,
    csvToSbAliasMap: SERVICE_LINE_ALIASES,
    fields: [
      { csv: 'Name', sb: 'name' },
      { csv: 'Tagline', sb: 'tagline' },
      { csv: 'Description', sb: 'description' },
      { csv: 'Hero', sb: 'hero_image_url' },
      { csv: 'Main Image', sb: 'card_image_url' },
      { csv: 'Support Plan', sb: 'support_plan_slug' },
      { csv: 'Support Plan Img', sb: 'support_plan_image_url' },
      // BDS-canonical: brand_color_* holds BDS design token strings. CSV holds
      // legacy raw hex from the original Webflow build and will never be back-
      // ported (Webflow is being decommissioned). See
      // `.claude/references/data-canonical-fields.md`.
      { csv: 'Light', sb: 'brand_color_light', canonicalSupabase: true },
      { csv: 'Base', sb: 'brand_color_base', canonicalSupabase: true },
      { csv: 'Dark', sb: 'brand_color_dark', canonicalSupabase: true },
    ],
  });

  // services: portal owns writes (brikdesigns admin is read-only post-#179).
  // CSV ↔ Supabase drift is legacy migration artifact only — Supabase is canon.
  await auditCollection({
    title: 'Services (`services`) — _portal-owned, brikdesigns read-only_',
    csvFile: 'Services',
    table: 'services',
    historical: true,
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

  // offerings: portal owns writes (brikdesigns admin flipped read-only via
  // #189; portal `/settings/offerings` is canonical). CSV ↔ Supabase drift
  // is legacy migration artifact only — Supabase is canon.
  await auditCollection({
    title: 'Offerings (`offerings`) — _portal-owned, brikdesigns read-only_',
    csvFile: 'Offerings',
    table: 'offerings',
    historical: true,
    fields: [
      { csv: 'Name', sb: 'name' },
      { csv: 'Description', sb: 'description' },
      { csv: 'Price', sb: 'price_display' },
      { csv: 'What You Get', sb: 'what_you_get' },
      { csv: 'Icon', sb: 'icon_url' },
    ],
  });

  // customer_stories: brikdesigns owns this table (no portal admin UI exists).
  // Drift findings here ARE actionable — Supabase is still canon, but the CSV
  // is the historical Webflow export and brikdesigns admin writes ongoing.
  await auditCollection({
    title: 'Customer Stories (`customer_stories`) — _brikdesigns-owned_',
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
