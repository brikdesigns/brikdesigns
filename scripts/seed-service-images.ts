/**
 * Seed script: populate image_url, primary_badge_url, secondary_badge_url,
 * and tagline on the services table from the Webflow CSV export.
 *
 * Usage: npx tsx scripts/seed-service-images.ts
 *
 * Reads the CSV, matches rows by slug, and updates Supabase.
 * Only updates non-archived, non-draft rows.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const CSV_PATH = resolve(
  __dirname,
  '../content/csv/Brik Designs - Services - 67e481b75bdc3adb3c1e30f6.csv'
);

function parseCSV(raw: string) {
  const lines = raw.split('\n');
  const headers = lines[0].split(',').map((h) => h.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    // Simple CSV parse (handles quoted fields with commas)
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || '';
    });
    rows.push(row);
  }
  return rows;
}

async function main() {
  const raw = readFileSync(CSV_PATH, 'utf-8');
  const rows = parseCSV(raw);

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    if (row['Archived'] === 'true' || row['Draft'] === 'true') {
      skipped++;
      continue;
    }

    const slug = row['Slug'];
    if (!slug) continue;

    const updates: Record<string, string | null> = {};

    if (row['Image']) updates.image_url = row['Image'];
    if (row['Primary Badge']) updates.primary_badge_url = row['Primary Badge'];
    if (row['Secondary Badge']) updates.secondary_badge_url = row['Secondary Badge'];
    if (row['Tagline']) updates.tagline = row['Tagline'];

    if (Object.keys(updates).length === 0) {
      skipped++;
      continue;
    }

    const { error } = await supabase
      .from('services')
      .update(updates)
      .eq('slug', slug);

    if (error) {
      console.error(`  ✗ ${slug}: ${error.message}`);
    } else {
      console.log(`  ✓ ${slug}: ${Object.keys(updates).join(', ')}`);
      updated++;
    }
  }

  console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}`);
}

main().catch(console.error);
