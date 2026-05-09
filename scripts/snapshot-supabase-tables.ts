#!/usr/bin/env npx tsx
/**
 * Phase 2 — Snapshot the tables we're about to modify.
 *
 * Read-only on Supabase. Writes one JSON per table under tmp/snapshots/.
 * If Phase 4 produces a result we don't like, restore from these files.
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const SNAPSHOT_DIR = path.join(__dirname, '../tmp/snapshots');

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

const TABLES = ['service_lines', 'services', 'customer_stories', 'offerings', 'industry_pages', 'support_plans'];

async function main() {
  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');

  console.log(`Snapshot timestamp: ${stamp}\n`);

  for (const table of TABLES) {
    const { data, error } = await supabase.from(table).select('*');
    if (error) {
      console.log(`  ✗ ${table}: ${error.message}`);
      continue;
    }
    const file = path.join(SNAPSHOT_DIR, `${stamp}__${table}.json`);
    fs.writeFileSync(file, JSON.stringify({ table, snapshot_at: stamp, count: data?.length ?? 0, rows: data }, null, 2));
    console.log(`  ✓ ${table}: ${data?.length ?? 0} rows → tmp/snapshots/${path.basename(file)}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
