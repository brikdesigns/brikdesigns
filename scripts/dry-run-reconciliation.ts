#!/usr/bin/env npx tsx
/**
 * Phase 3 — Generate a dry-run reconciliation plan (read-only).
 *
 * Reads:
 *   - tmp/slug-reconciliation.json  (Phase 1 output)
 *   - content/csv/*                 (Webflow exports)
 *   - Live Supabase rows            (for before-state)
 *   - scripts/lib/reconciliation-overrides.ts  (manual slug aliases)
 *
 * Writes:
 *   - tmp/reconciliation-plan.md    — human-readable plan for review
 *
 * No mutations.
 */

import { createClient } from '@supabase/supabase-js';
import { parse } from 'csv-parse/sync';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { SERVICES_OVERRIDES } from './lib/reconciliation-overrides';

dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const CSV_DIR = path.join(__dirname, '../content/csv');
const PLAN_FILE = path.join(__dirname, '../tmp/reconciliation-plan.md');

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

function readCSV(filename: string): Record<string, string>[] {
  const filepath = fs.readdirSync(CSV_DIR).find((f) => f.includes(filename));
  if (!filepath) throw new Error(`CSV not found: ${filename}`);
  const content = fs.readFileSync(path.join(CSV_DIR, filepath), 'utf8');
  return parse(content, { columns: true, skip_empty_lines: true });
}

const isPublished = (r: Record<string, string>) => r['Draft'] !== 'true' && r['Archived'] !== 'true';

function snippet(s: unknown, n = 70): string {
  if (s === null || s === undefined || s === '') return '∅';
  const str = String(s);
  return str.length > n ? `${str.substring(0, n)}…` : str;
}

const out: string[] = [];
const log = (s = '') => out.push(s);

// ─── Field mappings (CSV → Supabase column) ─────────────────────────────

const SERVICE_LINES_FIELDS: Array<[string, string]> = [
  ['Name', 'name'],
  ['Tagline', 'tagline'],
  ['Description', 'description'],
  ['Hero', 'hero_image_url'],
  ['Main Image', 'card_image_url'],
  ['Primary Badge - light', 'primary_badge_url'],
  ['Secondary Badge', 'secondary_badge_url'],
  ['Support Plan', 'support_plan_slug'],
  ['Support Plan Img', 'support_plan_image_url'],
  ['Light', 'brand_color_light'],
  ['Base', 'brand_color_base'],
  ['Dark', 'brand_color_dark'],
];

const SERVICES_FIELDS: Array<[string, string]> = [
  ['Name', 'name'],
  ['Tagline', 'tagline'],
  ['Description', 'marketing_description'],
  ['Description', 'description'], // dual-write to both, mirrors seed script
  ['Image', 'image_url'],
  ['Primary Badge', 'primary_badge_url'],
  ['Secondary Badge', 'secondary_badge_url'],
  ['Related', 'related_service_slug'],
  ['Support Plan', 'support_plan_slug'],
];

const CUSTOMER_STORIES_FIELDS: Array<[string, string]> = [
  ['Name', 'name'],
  ['Client', 'client_name'],
  ['Short Description', 'short_description'],
  ['Hero Image', 'hero_image_url'],
  ['Industry', 'industry'],
  ['The Challenge', 'the_challenge'],
  ['The Solution', 'the_solution'],
  ['Results', 'results'],
  ['Quote', 'quote'],
  ['Customer Name', 'quote_attribution'],
  ['Service', 'service_slug'],
  ['Service Line', 'service_line_slug'],
];

interface DryRunCounts { update: number; insert: number; hide: number; fields_changed: number }

function eq(a: unknown, b: unknown): boolean {
  const aE = a === null || a === undefined || a === '';
  const bE = b === null || b === undefined || b === '';
  if (aE && bE) return true;
  if (aE !== bE) return false;
  return String(a).trim() === String(b).trim();
}

function computeFieldDiffs(csv: Record<string, string>, sb: Record<string, unknown>, fields: Array<[string, string]>): string[] {
  const diffs: string[] = [];
  const seen = new Set<string>();
  for (const [csvCol, sbCol] of fields) {
    if (seen.has(sbCol)) continue;
    seen.add(sbCol);
    const csvVal = csv[csvCol] ?? '';
    const sbVal = sb[sbCol] ?? '';
    if (!eq(csvVal, sbVal)) {
      diffs.push(`  - \`${sbCol}\`: ${JSON.stringify(snippet(sbVal))} → ${JSON.stringify(snippet(csvVal))}`);
    }
  }
  return diffs;
}

// ─── Plan one collection ───────────────────────────────────────────────

interface PlanOpts {
  title: string;
  table: string;
  csvFile: string;
  fields: Array<[string, string]>;
  sbToCsvAliasMap?: Record<string, string>; // SB slug → CSV slug (reverse of overrides)
  csvToSbAliasMap?: Record<string, string>; // CSV slug → SB slug (overrides + service-line)
}

async function planCollection(opts: PlanOpts): Promise<DryRunCounts> {
  const counts: DryRunCounts = { update: 0, insert: 0, hide: 0, fields_changed: 0 };
  log(`\n---\n\n## ${opts.title}\n`);

  const csvRows = readCSV(opts.csvFile).filter(isPublished);
  const { data: sbRows, error } = await supabase.from(opts.table).select('*');
  if (error) {
    log(`❌ ${error.message}`);
    return counts;
  }
  const sbByName = new Map((sbRows ?? []).map((r) => [(r.name as string).toLowerCase().replace(/[^a-z0-9]/g, ''), r]));
  const sbBySlug = new Map((sbRows ?? []).map((r) => [r.slug as string, r]));
  const claimed = new Set<string>(); // sb slugs we've matched

  // Resolve each CSV row to a Supabase target slug.
  function resolveTarget(csvSlug: string, csvName: string): { sb: Record<string, unknown> | undefined; via: string } {
    // 1. Manual override
    const aliased = opts.csvToSbAliasMap?.[csvSlug];
    if (aliased && sbBySlug.has(aliased)) return { sb: sbBySlug.get(aliased), via: `override → ${aliased}` };
    // 2. Exact slug
    if (sbBySlug.has(csvSlug)) return { sb: sbBySlug.get(csvSlug), via: 'exact-slug' };
    // 3. Exact name
    const norm = csvName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const byName = sbByName.get(norm);
    if (byName) return { sb: byName, via: 'name-match' };
    return { sb: undefined, via: 'no-match' };
  }

  // ─── UPDATEs (matched) ──────────────────────────────────────────
  log(`### UPDATEs — marketing fields only\n`);
  let updateRows = 0;
  for (const csv of csvRows) {
    const csvSlug = csv['Slug'];
    const csvName = csv['Name'];
    const { sb, via } = resolveTarget(csvSlug, csvName);
    if (!sb) continue;
    if (claimed.has(sb.slug as string)) continue;
    claimed.add(sb.slug as string);

    const diffs = computeFieldDiffs(csv, sb, opts.fields);
    if (diffs.length === 0) {
      // No-op, still count as matched
      continue;
    }
    updateRows++;
    counts.fields_changed += diffs.length;
    log(`<details>\n<summary><code>${sb.slug}</code> (${via}, ${diffs.length} field${diffs.length > 1 ? 's' : ''}) — CSV row \`${csvSlug}\` "${snippet(csvName, 50)}"</summary>\n`);
    log(diffs.join('\n'));
    log(`\n</details>\n`);
  }
  if (updateRows === 0) log(`_No updates needed — all matched rows have field parity._\n`);
  else log(`**${updateRows} rows will UPDATE** (${counts.fields_changed} field changes).\n`);
  counts.update = updateRows;

  // ─── INSERTs (CSV slug not in Supabase, no alias, no name match) ───
  log(`### INSERTs — new Supabase rows\n`);
  const inserts: Array<{ slug: string; name: string }> = [];
  for (const csv of csvRows) {
    const { sb } = resolveTarget(csv['Slug'], csv['Name']);
    if (!sb) inserts.push({ slug: csv['Slug'], name: csv['Name'] });
  }
  if (inserts.length === 0) log(`_None._\n`);
  else {
    log(`| New SB slug | Name |\n|---|---|`);
    for (const i of inserts) log(`| \`${i.slug}\` | ${i.name} |`);
    log();
    log(`**${inserts.length} rows will INSERT.**\n`);
  }
  counts.insert = inserts.length;

  // ─── HIDEs (Supabase row not claimed by any CSV row) ────────────
  log(`### HIDEs — set is_public = false\n`);
  const hides: Array<{ slug: string; name: string }> = [];
  for (const sb of sbRows ?? []) {
    if (claimed.has(sb.slug as string)) continue;
    hides.push({ slug: sb.slug as string, name: sb.name as string });
  }
  if (hides.length === 0) log(`_None._\n`);
  else {
    log(`| SB slug | Name |\n|---|---|`);
    for (const h of hides) log(`| \`${h.slug}\` | ${h.name} |`);
    log();
    log(`**${hides.length} rows will be hidden** (rows preserved for portal FK references; just stop rendering on marketing site).\n`);
  }
  counts.hide = hides.length;

  return counts;
}

// ─── Main ───────────────────────────────────────────────────────────

async function main() {
  log(`# Phase 3 — Reconciliation dry-run plan\n`);
  log(`- Generated: ${new Date().toISOString()}`);
  log(`- Mode: **read-only** — nothing has been written to Supabase\n`);

  // service_lines: alias by hand-coded short→long map
  const SERVICE_LINE_ALIASES: Record<string, string> = {
    'brand-design': 'brand',
    'marketing-design': 'marketing',
    'information-design': 'information',
    'back-office-design': 'service',
    'product-design': 'product',
  };

  const totals: Record<string, DryRunCounts> = {};

  totals.service_lines = await planCollection({
    title: 'Service Lines (`service_lines`)',
    table: 'service_lines',
    csvFile: 'Service Lines',
    fields: SERVICE_LINES_FIELDS,
    csvToSbAliasMap: SERVICE_LINE_ALIASES,
  });

  totals.services = await planCollection({
    title: 'Services (`services`)',
    table: 'services',
    csvFile: 'Services',
    fields: SERVICES_FIELDS,
    csvToSbAliasMap: SERVICES_OVERRIDES,
  });

  totals.customer_stories = await planCollection({
    title: 'Customer Stories (`customer_stories`)',
    table: 'customer_stories',
    csvFile: 'Customer Stories',
    fields: CUSTOMER_STORIES_FIELDS,
  });

  log(`\n---\n\n## Totals\n`);
  log(`| Table | UPDATE | INSERT | HIDE | Field changes |`);
  log(`|---|---|---|---|---|`);
  for (const [t, c] of Object.entries(totals)) {
    log(`| \`${t}\` | ${c.update} | ${c.insert} | ${c.hide} | ${c.fields_changed} |`);
  }
  log(`\n_Offerings table is intentionally excluded from this plan and tracked as a separate ticket._`);

  fs.writeFileSync(PLAN_FILE, out.join('\n'));
  console.log(`Plan written: ${PLAN_FILE}`);
  console.log(`Lines: ${out.length}`);
  console.log(`\nSummary:`);
  for (const [t, c] of Object.entries(totals)) {
    console.log(`  ${t}: UPDATE ${c.update}, INSERT ${c.insert}, HIDE ${c.hide}, fields ${c.fields_changed}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
