#!/usr/bin/env npx tsx
/**
 * Audit CMS image assets against the aspect ratio of the slot that renders them,
 * and measure the transparent margin baked into each file.
 *
 * READ-ONLY — no mutations, no writes. It downloads each asset into memory,
 * measures it with `sharp`, and reports. #1298 AC4 ("aspect-ratio report lists
 * every off-standard image with its target ratio").
 *
 * ## Why the transparent margin matters
 *
 * Card media sits on a filled well (`--surface-secondary`, or the service-themed
 * `--surface-accent` on /services*) — see `.claude/references/card-media.md`.
 * The well is *behind* the image, so baked-in transparent border pixels let it
 * show through and read as oversized padding. A 640×640 file whose opaque
 * content is only 442×489 wastes ~15% on each side. `trimmed` below is what the
 * asset would measure after `sharp().trim()`, i.e. what the migration should
 * upload.
 *
 * ## Why the column → ratio map is explicit
 *
 * Each entry cites the render site and the CSS rule that sets the ratio, because
 * the ratio is a property of the *slot*, not the table. Columns with no consumer
 * in `src/` carry `slot: null` — they are audited but never flagged off-standard,
 * since there is no slot to be off-standard against.
 *
 * Run:
 *   set -a; source ~/.secrets/supabase-staging.env; set +a
 *   npm run audit:image-ratios              # all CMS assets
 *   npm run audit:image-ratios -- --legacy  # only legacy Webflow-CDN refs
 */

import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import * as path from 'path';
import * as dotenv from 'dotenv';

// quiet: dotenv v17 writes its "injected env" tip to stdout — see
// audit-legacy-cms-images.ts for the same guard.
dotenv.config({ path: path.join(__dirname, '../.env.local'), quiet: true });
dotenv.config({ path: path.join(__dirname, '../.env'), quiet: true });

const LEGACY_HOST = 'website-files.com';

/** Tolerance on the ratio match — a 1:1 slot accepts 0.97–1.03. */
const RATIO_TOLERANCE = 0.03;

/** Budget every migrated asset must land under (`image-optimization.md` rule 3). */
const MAX_KB = 300;

interface Slot {
  /** Target aspect ratio (width / height) of the rendering slot. */
  ratio: number;
  /** Human label for the report. */
  label: string;
  /** Where the ratio comes from — render site + the CSS rule that sets it. */
  source: string;
}

interface ColumnSpec {
  table: string;
  column: string;
  /** null = no consumer in src/, verified by grep; audited but never flagged. */
  slot: Slot | null;
}

const SQUARE = (source: string): Slot => ({ ratio: 1, label: '1:1', source });

/**
 * Every `*_url` column that holds a legacy ref today (per
 * `npm run audit:legacy-images`), with its slot.
 *
 * The five `slot: null` rows are not an oversight — each was grepped across
 * `src/` and `scripts/` and has no reader, so 48 of the 130 legacy refs render
 * nowhere on this site. They stay in the audit so the count reconciles against
 * AC1, which counts rows and not rendered images.
 */
const COLUMNS: ColumnSpec[] = [
  {
    table: 'services',
    column: 'image_url',
    slot: SQUARE(
      'services/[serviceLineSlug]/page.tsx:147 → services.css:165 aspect-ratio: 1'
    ),
  },
  {
    table: 'service_lines',
    column: 'card_image_url',
    slot: SQUARE('services/page.tsx:79 → services.css:24 aspect-ratio: 1'),
  },
  {
    table: 'service_lines',
    column: 'hero_image_url',
    slot: SQUARE(
      'services/[serviceLineSlug]/page.tsx:105 .service-detail-hero__media → services.css:104 aspect-ratio: 1'
    ),
  },
  {
    table: 'service_plans',
    column: 'image_url',
    slot: SQUARE(
      'services/[serviceLineSlug]/page.tsx:180 → plans.css:131 aspect-ratio: 1'
    ),
  },
  {
    table: 'industry_pages',
    column: 'image_url',
    slot: SQUARE('MegaNavServer.tsx:76 → industries.css aspect-ratio: 1'),
  },
  {
    table: 'blog_posts',
    column: 'featured_image_url',
    slot: { ratio: 16 / 9, label: '16:9', source: 'blog.css:95 aspect-ratio: 16/9' },
  },
  {
    table: 'customer_stories',
    column: 'thumbnail_url',
    slot: { ratio: 4 / 3, label: '4:3', source: 'results/page.tsx:82 → results.css:42 aspect-ratio: 4/3' },
  },
  {
    table: 'customer_stories',
    column: 'hero_image_url',
    slot: { ratio: 4 / 3, label: '4:3', source: 'results/[slug] StoryHero → results.css:42 aspect-ratio: 4/3' },
  },
  {
    table: 'customer_stories',
    column: 'after_photo_url',
    slot: { ratio: 16 / 9, label: '16:9', source: 'results/[slug]/page.tsx:304 StorySections midMedia → results.css:103 aspect-ratio: 16/9' },
  },
  {
    table: 'customer_stories',
    column: 'results_photo_url',
    slot: { ratio: 16 / 9, label: '16:9', source: 'results/[slug]/page.tsx:312 StorySections closingMedia → results.css:103 aspect-ratio: 16/9' },
  },

  // ── No consumer in src/ — audited, never flagged. Greps that came back empty:
  //   rg -n 'offering\.(hero_)?image_url' src/     → no matches
  //   rg -n 'support_plan_image_url'      src/     → no matches
  //   rg -n 'before_photo|client_logo'    src/ scripts/ → no matches
  { table: 'offerings', column: 'image_url', slot: null },
  { table: 'offerings', column: 'hero_image_url', slot: null },
  { table: 'service_lines', column: 'support_plan_image_url', slot: null },
  { table: 'customer_stories', column: 'before_photo_url', slot: null },
  { table: 'customer_stories', column: 'client_logo_url', slot: null },
];

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

interface Measured {
  table: string;
  column: string;
  id: string;
  url: string;
  legacy: boolean;
  slot: Slot | null;
  kb: number;
  width: number;
  height: number;
  /** Opaque bounding box after sharp().trim(). */
  trimmed: { width: number; height: number } | null;
  /** Off-standard against the slot's ratio (null when there is no slot). */
  offStandard: boolean | null;
}

async function measure(url: string): Promise<{
  kb: number;
  width: number;
  height: number;
  trimmed: { width: number; height: number } | null;
}> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const meta = await sharp(buf).metadata();

  // SVG has no meaningful raster trim box and reports nominal dimensions only.
  let trimmed: { width: number; height: number } | null = null;
  if (meta.format !== 'svg') {
    try {
      const out = await sharp(buf).trim().toBuffer({ resolveWithObject: true });
      trimmed = { width: out.info.width, height: out.info.height };
    } catch {
      // trim() throws when the whole image is one colour — nothing to trim.
      trimmed = null;
    }
  }

  return {
    kb: Math.round(buf.byteLength / 1024),
    width: meta.width ?? 0,
    height: meta.height ?? 0,
    trimmed,
  };
}

async function main() {
  const legacyOnly = process.argv.includes('--legacy');
  const results: Measured[] = [];
  const errors: string[] = [];

  for (const { table, column, slot } of COLUMNS) {
    const { data, error } = await supabase.from(table).select(`slug,${column}`);
    if (error) {
      errors.push(`${table}.${column}: ${error.message}`);
      continue;
    }

    for (const row of (data ?? []) as unknown as Record<string, string | null>[]) {
      const url = row[column];
      if (!url) continue;
      const legacy = url.includes(LEGACY_HOST);
      if (legacyOnly && !legacy) continue;

      try {
        const m = await measure(url);
        // Ratio is judged on the TRIMMED box where one exists: the baked-in
        // transparent margin is exactly what the migration removes, so grading
        // the raw file would flag assets that are already correct underneath.
        const w = m.trimmed?.width ?? m.width;
        const h = m.trimmed?.height ?? m.height;
        const actual = h > 0 ? w / h : 0;
        results.push({
          table,
          column,
          id: row.slug ?? '(no slug)',
          url,
          legacy,
          slot,
          ...m,
          offStandard: slot
            ? Math.abs(actual - slot.ratio) / slot.ratio > RATIO_TOLERANCE
            : null,
        });
      } catch (err) {
        errors.push(`${table}.${column} ${row.slug}: ${(err as Error).message}`);
      }
    }
  }

  const rendered = results.filter((r) => r.slot !== null);
  const orphaned = results.filter((r) => r.slot === null);
  const off = rendered.filter((r) => r.offStandard);
  const overBudget = results.filter((r) => r.kb > MAX_KB);
  const wasteful = results.filter(
    (r) => r.trimmed && r.trimmed.width * r.trimmed.height < r.width * r.height * 0.9
  );

  console.log(`\nCMS image ratio audit${legacyOnly ? ' (legacy refs only)' : ''}\n`);

  console.log(`Off-standard ratio (${off.length} of ${rendered.length} rendered)`);
  for (const r of off) {
    const w = r.trimmed?.width ?? r.width;
    const h = r.trimmed?.height ?? r.height;
    console.log(
      `  ${r.table}.${r.column} · ${r.id}\n` +
        `    is ${w}×${h} (${(w / h).toFixed(2)}) · target ${r.slot!.label}\n` +
        `    slot: ${r.slot!.source}`
    );
  }

  console.log(`\nTransparent margin >10% of the file (${wasteful.length})`);
  for (const r of wasteful) {
    const pct = Math.round(
      100 - (r.trimmed!.width * r.trimmed!.height * 100) / (r.width * r.height)
    );
    console.log(
      `  ${r.table}.${r.column} · ${r.id} — ${r.width}×${r.height} file, ` +
        `${r.trimmed!.width}×${r.trimmed!.height} opaque (${pct}% waste)`
    );
  }

  console.log(`\nOver the ${MAX_KB} KB budget (${overBudget.length})`);
  for (const r of overBudget) {
    console.log(`  ${r.table}.${r.column} · ${r.id} — ${r.kb} KB`);
  }

  console.log(
    `\nNo consumer in src/ — not graded (${orphaned.length})\n` +
      `  These columns have no reader, so the migration has no rendered slot to\n` +
      `  satisfy. Migrate for row hygiene (AC1 counts rows), not for appearance.`
  );
  const byCol = new Map<string, number>();
  for (const r of orphaned) {
    const k = `${r.table}.${r.column}`;
    byCol.set(k, (byCol.get(k) ?? 0) + 1);
  }
  for (const [k, n] of byCol) console.log(`  ${n}\t${k}`);

  if (errors.length > 0) {
    console.error(`\nUnreadable (${errors.length}):`);
    for (const e of errors) console.error(`  ${e}`);
  }

  console.log(
    `\nTOTAL measured ${results.length} · rendered ${rendered.length} · ` +
      `orphaned ${orphaned.length} · off-standard ${off.length} · ` +
      `over budget ${overBudget.length}`
  );

  // Exit 1 when anything is off-standard or over budget, so a verification step
  // can gate on the report without parsing it. Unreadable assets exit 2 — a
  // failed fetch is not a clean result.
  if (errors.length > 0) process.exit(2);
  process.exit(off.length + overBudget.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
