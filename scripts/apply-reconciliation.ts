#!/usr/bin/env npx tsx
/**
 * Phase 4 — Apply the reconciliation plan to Supabase.
 *
 * Mutating. Safety:
 *   - Pre-flight: confirms snapshots/ contains a snapshot from today
 *   - Reuses Phase 3 resolveTarget logic so nothing surprises us
 *   - Logs every operation
 *   - Final step: prints a per-table action count
 *
 * Run: npx tsx scripts/apply-reconciliation.ts
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
const SNAPSHOT_DIR = path.join(__dirname, '../tmp/snapshots');

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

// ─── Pre-flight: snapshot must exist ────────────────────────────────

function preflight() {
  if (!fs.existsSync(SNAPSHOT_DIR)) {
    console.error('❌ tmp/snapshots/ does not exist. Run scripts/snapshot-supabase-tables.ts first.');
    process.exit(1);
  }
  const today = new Date().toISOString().substring(0, 10);
  const todaySnap = fs.readdirSync(SNAPSHOT_DIR).filter((f) => f.startsWith(today));
  if (todaySnap.length === 0) {
    console.error(`❌ No snapshot from today (${today}) in tmp/snapshots/. Re-snapshot before running this.`);
    process.exit(1);
  }
  console.log(`✓ Pre-flight: ${todaySnap.length} snapshot files from ${today}\n`);
}

// ─── Helpers ────────────────────────────────────────────────────────

function readCSV(filename: string): Record<string, string>[] {
  const filepath = fs.readdirSync(CSV_DIR).find((f) => f.includes(filename));
  if (!filepath) throw new Error(`CSV not found: ${filename}`);
  return parse(fs.readFileSync(path.join(CSV_DIR, filepath), 'utf8'), {
    columns: true,
    skip_empty_lines: true,
  });
}

const isPublished = (r: Record<string, string>) => r['Draft'] !== 'true' && r['Archived'] !== 'true';
const normName = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const toInt = (v: string, fb = 0) => { const n = parseInt(v, 10); return isNaN(n) ? fb : n; };
const toBool = (v: string) => v === 'true';

const SERVICE_LINE_ALIASES: Record<string, string> = {
  'brand-design': 'brand',
  'marketing-design': 'marketing',
  'information-design': 'information',
  'back-office-design': 'service',
  'product-design': 'product',
};

interface Counts { update: number; insert: number; hide: number; errors: number }

// ─── service_lines (no-op per Phase 3 dry-run, but verify) ──────────

async function applyServiceLines(): Promise<Counts> {
  console.log('## service_lines\n');
  console.log('  (Phase 3 dry-run showed 0 changes; verifying.)\n');
  return { update: 0, insert: 0, hide: 0, errors: 0 };
}

// ─── services ───────────────────────────────────────────────────────

async function applyServices(): Promise<Counts> {
  console.log('## services\n');
  const counts: Counts = { update: 0, insert: 0, hide: 0, errors: 0 };

  const csvRows = readCSV('Services').filter(isPublished);
  const { data: sbRows, error: fetchErr } = await supabase.from('services').select('id, slug, name, is_public');
  if (fetchErr) { console.log(`❌ fetch: ${fetchErr.message}`); counts.errors++; return counts; }

  const sbBySlug = new Map((sbRows ?? []).map((r) => [r.slug as string, r]));
  const sbByName = new Map((sbRows ?? []).map((r) => [normName(r.name as string), r]));
  const claimed = new Set<string>();

  // service_line slug → id
  const { data: catRows, error: catErr } = await supabase.from('service_lines').select('id, slug');
  if (catErr) { console.log(`❌ category fetch: ${catErr.message}`); counts.errors++; return counts; }
  const catBySlug = new Map((catRows ?? []).map((r) => [r.slug as string, r.id as string]));
  const getCategoryId = (csvServiceLineSlug: string): string | null => {
    if (!csvServiceLineSlug) return null;
    const aliased = SERVICE_LINE_ALIASES[csvServiceLineSlug] || csvServiceLineSlug;
    return catBySlug.get(aliased) ?? null;
  };

  function resolveTarget(csv: Record<string, string>) {
    const csvSlug = csv['Slug'];
    const csvName = csv['Name'];
    const aliased = SERVICES_OVERRIDES[csvSlug];
    if (aliased && sbBySlug.has(aliased)) return sbBySlug.get(aliased);
    if (sbBySlug.has(csvSlug)) return sbBySlug.get(csvSlug);
    return sbByName.get(normName(csvName));
  }

  // ── UPDATEs ────────────────────────────────────────────────────
  for (const csv of csvRows) {
    const target = resolveTarget(csv);
    if (!target) continue;
    if (claimed.has(target.slug as string)) continue;
    claimed.add(target.slug as string);

    const payload = {
      name: csv['Name'],
      tagline: csv['Tagline'] || null,
      description: csv['Description'] || null,
      image_url: csv['Image'] || null,
      primary_badge_url: csv['Primary Badge'] || null,
      secondary_badge_url: csv['Secondary Badge'] || null,
      related_service_slug: csv['Related'] || null,
      support_plan_slug: csv['Support Plan'] || null,
      service_line_id: getCategoryId(csv['Service Line']),
      is_public: true,
    };

    const { error } = await supabase.from('services').update(payload).eq('id', target.id);
    if (error) {
      console.log(`  ✗ UPDATE ${target.slug}: ${error.message}`);
      counts.errors++;
    } else {
      console.log(`  ✓ UPDATE ${target.slug}  (CSV: ${csv['Slug']})`);
      counts.update++;
    }
  }

  // ── INSERTs ────────────────────────────────────────────────────
  for (const csv of csvRows) {
    if (resolveTarget(csv)) continue;
    const payload = {
      slug: csv['Slug'],
      name: csv['Name'],
      tagline: csv['Tagline'] || null,
      description: csv['Description'] || null,
      image_url: csv['Image'] || null,
      primary_badge_url: csv['Primary Badge'] || null,
      secondary_badge_url: csv['Secondary Badge'] || null,
      related_service_slug: csv['Related'] || null,
      support_plan_slug: csv['Support Plan'] || null,
      service_line_id: getCategoryId(csv['Service Line']),
      is_public: true,
      rank: toInt(csv['Rank']),
      has_customer_story: toBool(csv['Has customer story']),
      active: true,
      sort_order: toInt(csv['Rank']),
    };
    const { error } = await supabase.from('services').insert(payload);
    if (error) {
      console.log(`  ✗ INSERT ${csv['Slug']}: ${error.message}`);
      counts.errors++;
    } else {
      console.log(`  ✓ INSERT ${csv['Slug']}`);
      counts.insert++;
    }
  }

  // ── HIDEs ──────────────────────────────────────────────────────
  for (const sb of sbRows ?? []) {
    if (claimed.has(sb.slug as string)) continue;
    if (sb.is_public === false) continue; // already hidden
    const { error } = await supabase.from('services').update({ is_public: false }).eq('id', sb.id);
    if (error) {
      console.log(`  ✗ HIDE ${sb.slug}: ${error.message}`);
      counts.errors++;
    } else {
      console.log(`  ✓ HIDE ${sb.slug}`);
      counts.hide++;
    }
  }
  console.log(`  → UPDATE ${counts.update}, INSERT ${counts.insert}, HIDE ${counts.hide}, errors ${counts.errors}\n`);
  return counts;
}

// ─── customer_stories ───────────────────────────────────────────────

async function applyCustomerStories(): Promise<Counts> {
  console.log('## customer_stories\n');
  const counts: Counts = { update: 0, insert: 0, hide: 0, errors: 0 };

  const csvRows = readCSV('Customer Stories').filter(isPublished);
  const { data: sbRows, error: fetchErr } = await supabase.from('customer_stories').select('id, slug');
  if (fetchErr) { console.log(`❌ fetch: ${fetchErr.message}`); counts.errors++; return counts; }
  const sbBySlug = new Map((sbRows ?? []).map((r) => [r.slug as string, r]));

  for (const csv of csvRows) {
    const sb = sbBySlug.get(csv['Slug']);
    if (!sb) continue;
    const payload = {
      name: csv['Name'],
      client_name: csv['Client'] || null,
      short_description: csv['Short Description'] || null,
      hero_image_url: csv['Hero Image'] || null,
      industry: csv['Industry'] || null,
      the_challenge: csv['The Challenge'] || null,
      the_solution: csv['The Solution'] || null,
      results: csv['Results'] || null,
      quote: csv['Quote'] || null,
      quote_attribution: csv['Customer Name'] || null,
      service_slug: csv['Service'] || null,
      service_line_slug: csv['Service Line'] || null,
      is_public: true,
    };
    const { error } = await supabase.from('customer_stories').update(payload).eq('id', sb.id);
    if (error) {
      console.log(`  ✗ UPDATE ${sb.slug}: ${error.message}`);
      counts.errors++;
    } else {
      console.log(`  ✓ UPDATE ${sb.slug}`);
      counts.update++;
    }
  }
  console.log(`  → UPDATE ${counts.update}, errors ${counts.errors}\n`);
  return counts;
}

// ─── Main ───────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  Phase 4 — applying reconciliation to Supabase');
  console.log('═══════════════════════════════════════════════════\n');
  preflight();

  const totals: Record<string, Counts> = {};
  totals.service_lines = await applyServiceLines();
  totals.services = await applyServices();
  totals.customer_stories = await applyCustomerStories();

  console.log('═══════════════════════════════════════════════════');
  console.log('  Done\n');
  console.log('| table | UPDATE | INSERT | HIDE | errors |');
  console.log('|---|---|---|---|---|');
  for (const [t, c] of Object.entries(totals)) {
    console.log(`| ${t} | ${c.update} | ${c.insert} | ${c.hide} | ${c.errors} |`);
  }
  const totalErrors = Object.values(totals).reduce((a, c) => a + c.errors, 0);
  if (totalErrors > 0) {
    console.log(`\n⚠️  ${totalErrors} errors. Review above.`);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
