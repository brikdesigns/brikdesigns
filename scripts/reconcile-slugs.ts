#!/usr/bin/env npx tsx
/**
 * Phase 1 — Build a CSV-slug → Supabase-slug reconciliation map.
 *
 * READ-ONLY. Proposes how to align Webflow CSV rows with the existing
 * Supabase rows when slugs have drifted manually.
 *
 * Strategy:
 *   1. Slug match wins always.
 *   2. Otherwise normalize names ("Letterhead Stationary" ↔ "Business Stationery"
 *      compare by lowercase + non-alpha stripped) and propose by name similarity.
 *   3. Anything left over: report as "needs human decision".
 *
 * Output:
 *   tmp/slug-reconciliation.json — review + edit before Phase 4.
 */

import { createClient } from '@supabase/supabase-js';
import { parse } from 'csv-parse/sync';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const CSV_DIR = path.join(__dirname, '../content/csv');
const OUT_FILE = path.join(__dirname, '../tmp/slug-reconciliation.json');

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

function isPublished(row: Record<string, string>): boolean {
  return row['Draft'] !== 'true' && row['Archived'] !== 'true';
}

/** "Letterhead Stationary" → "letterheadstationary" */
function normName(name: string): string {
  return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

interface Mapping {
  csv_slug: string;
  csv_name: string;
  sb_slug: string;
  sb_name: string;
  match_type: 'exact-slug' | 'exact-name' | 'fuzzy-name' | 'csv-only' | 'sb-only';
  confidence: 'high' | 'medium' | 'low' | 'none';
  /** Set this to false in the JSON to skip the row when seeding */
  apply: boolean;
  notes?: string;
}

interface CollectionResult {
  table: string;
  csv_count: number;
  sb_count: number;
  mappings: Mapping[];
}

// Service lines have a known canonical short→long mapping baked into the
// app's SERVICE_LINE_MAP. Encode it here so we don't rely on name fuzzing.
const SERVICE_LINE_SLUG_ALIASES: Record<string, string> = {
  'brand-design': 'brand',
  'marketing-design': 'marketing',
  'information-design': 'information',
  'back-office-design': 'service',
  'product-design': 'product',
};

async function reconcileServiceLines(): Promise<CollectionResult> {
  const csvRows = readCSV('Service Lines').filter(isPublished);
  const { data: sbRows, error } = await supabase.from('service_lines').select('id, slug, name');
  if (error) throw error;

  const sbBySlug = new Map((sbRows ?? []).map((r) => [r.slug, r]));
  const mappings: Mapping[] = [];

  for (const csv of csvRows) {
    const csvSlug = csv['Slug'];
    const csvName = csv['Name'];
    const aliasedSbSlug = SERVICE_LINE_SLUG_ALIASES[csvSlug] || csvSlug;
    const sb = sbBySlug.get(aliasedSbSlug);
    if (sb) {
      mappings.push({
        csv_slug: csvSlug,
        csv_name: csvName,
        sb_slug: sb.slug,
        sb_name: sb.name,
        match_type: csvSlug === sb.slug ? 'exact-slug' : 'fuzzy-name',
        confidence: 'high',
        apply: true,
        notes: csvSlug === sb.slug ? undefined : `aliased via SERVICE_LINE_SLUG_ALIASES`,
      });
      sbBySlug.delete(sb.slug);
    } else {
      mappings.push({
        csv_slug: csvSlug,
        csv_name: csvName,
        sb_slug: '',
        sb_name: '',
        match_type: 'csv-only',
        confidence: 'none',
        apply: false,
        notes: 'No Supabase row found — would INSERT (decide manually)',
      });
    }
  }
  // Remaining sbBySlug entries are orphans
  for (const [, sb] of sbBySlug) {
    mappings.push({
      csv_slug: '',
      csv_name: '',
      sb_slug: sb.slug,
      sb_name: sb.name,
      match_type: 'sb-only',
      confidence: 'none',
      apply: false,
      notes: 'Supabase orphan — would HIDE (is_public=false)',
    });
  }
  return { table: 'service_lines', csv_count: csvRows.length, sb_count: sbRows?.length ?? 0, mappings };
}

async function reconcileNamed(opts: {
  table: string;
  csvFile: string;
}): Promise<CollectionResult> {
  const csvRows = readCSV(opts.csvFile).filter(isPublished);
  const { data: sbRows, error } = await supabase.from(opts.table).select('id, slug, name');
  if (error) throw error;

  // Build lookups by both slug and normalized name
  const sbBySlug = new Map((sbRows ?? []).map((r) => [r.slug, r]));
  const sbByNorm = new Map((sbRows ?? []).map((r) => [normName(r.name), r]));
  const usedSb = new Set<string>();

  const mappings: Mapping[] = [];

  for (const csv of csvRows) {
    const csvSlug = csv['Slug'];
    const csvName = csv['Name'];

    // Pass 1: exact slug
    const slugMatch = sbBySlug.get(csvSlug);
    if (slugMatch && !usedSb.has(slugMatch.slug)) {
      mappings.push({
        csv_slug: csvSlug, csv_name: csvName,
        sb_slug: slugMatch.slug, sb_name: slugMatch.name,
        match_type: 'exact-slug', confidence: 'high', apply: true,
      });
      usedSb.add(slugMatch.slug);
      continue;
    }

    // Pass 2: exact normalized name
    const csvNorm = normName(csvName);
    const nameMatch = sbByNorm.get(csvNorm);
    if (nameMatch && !usedSb.has(nameMatch.slug)) {
      mappings.push({
        csv_slug: csvSlug, csv_name: csvName,
        sb_slug: nameMatch.slug, sb_name: nameMatch.name,
        match_type: 'exact-name', confidence: 'high', apply: true,
        notes: 'slug differs but normalized name matches — UPDATE Supabase row',
      });
      usedSb.add(nameMatch.slug);
      continue;
    }

    // Pass 3: fuzzy — substring containment (csv ⊆ sb or sb ⊆ csv)
    let fuzzy: { slug: string; name: string } | undefined;
    for (const [norm, row] of sbByNorm) {
      if (usedSb.has(row.slug)) continue;
      if (norm.includes(csvNorm) || csvNorm.includes(norm)) {
        fuzzy = row;
        break;
      }
    }
    if (fuzzy) {
      mappings.push({
        csv_slug: csvSlug, csv_name: csvName,
        sb_slug: fuzzy.slug, sb_name: fuzzy.name,
        match_type: 'fuzzy-name', confidence: 'medium', apply: false,
        notes: 'fuzzy substring match — REVIEW before approving',
      });
      usedSb.add(fuzzy.slug);
      continue;
    }

    // No match — would INSERT
    mappings.push({
      csv_slug: csvSlug, csv_name: csvName,
      sb_slug: '', sb_name: '',
      match_type: 'csv-only', confidence: 'none', apply: false,
      notes: 'no Supabase match — would INSERT new row using CSV slug',
    });
  }

  // Remaining Supabase rows = orphans
  for (const sb of sbRows ?? []) {
    if (usedSb.has(sb.slug)) continue;
    mappings.push({
      csv_slug: '', csv_name: '',
      sb_slug: sb.slug, sb_name: sb.name,
      match_type: 'sb-only', confidence: 'none', apply: false,
      notes: 'Supabase orphan — would HIDE (is_public=false)',
    });
  }

  return { table: opts.table, csv_count: csvRows.length, sb_count: sbRows?.length ?? 0, mappings };
}

async function main() {
  const results: CollectionResult[] = [];
  results.push(await reconcileServiceLines());
  results.push(await reconcileNamed({ table: 'services', csvFile: 'Services' }));
  results.push(await reconcileNamed({ table: 'offerings', csvFile: 'Offerings' }));
  results.push(await reconcileNamed({ table: 'customer_stories', csvFile: 'Customer Stories' }));

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify({ generated_at: new Date().toISOString(), results }, null, 2));

  // Print summary
  console.log('# Slug reconciliation summary\n');
  for (const r of results) {
    const counts = r.mappings.reduce<Record<string, number>>((acc, m) => {
      acc[m.match_type] = (acc[m.match_type] ?? 0) + 1;
      return acc;
    }, {});
    console.log(`## ${r.table} (CSV: ${r.csv_count}, SB: ${r.sb_count})\n`);
    console.log(`| match_type | count |\n|---|---|`);
    for (const [k, v] of Object.entries(counts)) console.log(`| ${k} | ${v} |`);
    console.log();
  }
  console.log(`\nFull mapping JSON: ${OUT_FILE}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
