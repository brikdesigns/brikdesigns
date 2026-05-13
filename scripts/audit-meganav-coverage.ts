#!/usr/bin/env npx tsx
/**
 * Meganav coverage audit (brikdesigns#112).
 *
 * Read-only diff between the hand-curated `NAV_COLUMNS` in
 * `src/lib/meganav-columns.ts` and the live Supabase `service_lines` +
 * `services` tables (filtered to `is_public = true`).
 *
 * Surfaces:
 *  1. Services public in Supabase but NOT in any nav column        (silent omissions)
 *  2. Slugs in NAV_COLUMNS that don't match a row in Supabase       (silent drops)
 *  3. Slugs in NAV_COLUMNS placed under the wrong category column   (cross-line drift)
 *  4. Public categories in Supabase without a NAV_COLUMNS entry     (e.g. new lines)
 *
 * Anon key is sufficient — `services` and `service_lines` allow RLS-public reads.
 *
 * Run:
 *   netlify dev exec -- npx tsx scripts/audit-meganav-coverage.ts
 *   netlify dev exec -- npx tsx scripts/audit-meganav-coverage.ts > tmp/meganav-coverage.md
 *
 * Or with env directly:
 *   NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
 *     npx tsx scripts/audit-meganav-coverage.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { NAV_COLUMNS } from '../src/lib/meganav-columns';

dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Missing Supabase env. Set NEXT_PUBLIC_SUPABASE_URL +\n' +
      'NEXT_PUBLIC_SUPABASE_ANON_KEY, or run via `netlify dev exec --`.'
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// `product` is intentionally absent from NAV_COLUMNS — it renders as a
// promo card in the meganav, not a column. Flagging it as "missing" would
// be a false alarm. This audit treats it as an expected exclusion.
const EXPECTED_NON_COLUMN_CATEGORIES = new Set(['product']);

interface ServiceLine {
  id: string;
  slug: string;
  name: string;
  is_public: boolean;
}
interface ServiceRow {
  id: string;
  slug: string;
  name: string;
  is_public: boolean;
  service_lines: { slug: string } | null;
}

async function fetchAll() {
  const [linesRes, servicesRes] = await Promise.all([
    supabase
      .from('service_lines')
      .select('id, slug, name, is_public')
      .eq('is_public', true)
      .order('rank', { ascending: true }),
    supabase
      .from('services')
      .select('id, slug, name, is_public, service_lines(slug)')
      .eq('is_public', true)
      .order('rank', { ascending: true }),
  ]);

  if (linesRes.error) throw linesRes.error;
  if (servicesRes.error) throw servicesRes.error;
  return {
    lines: (linesRes.data ?? []) as ServiceLine[],
    services: (servicesRes.data ?? []) as ServiceRow[],
  };
}

function header() {
  console.log('# Meganav coverage audit\n');
  console.log(`- Generated: ${new Date().toISOString()}`);
  console.log(`- Supabase: ${supabaseUrl}`);
  console.log(`- NAV_COLUMNS source: src/lib/meganav-columns.ts`);
  console.log(`- Mode: **read-only** (no mutations)\n`);
}

async function main() {
  header();

  const { lines, services } = await fetchAll();
  const lineBySlug = new Map(lines.map((l) => [l.slug, l]));
  const servicesByLineSlug = new Map<string, ServiceRow[]>();
  for (const s of services) {
    const lineSlug = s.service_lines?.slug ?? '__unknown__';
    if (!servicesByLineSlug.has(lineSlug)) servicesByLineSlug.set(lineSlug, []);
    servicesByLineSlug.get(lineSlug)!.push(s);
  }

  // ── 1. Categories check ────────────────────────────────────────────────
  console.log('## 1. Categories (`service_lines`)\n');
  console.log('| service_lines.slug | name | in NAV_COLUMNS? | services public |');
  console.log('|---|---|---|---|');
  for (const line of lines) {
    const inNav = line.slug in NAV_COLUMNS;
    const expectedOut = EXPECTED_NON_COLUMN_CATEGORIES.has(line.slug);
    const status = inNav
      ? '✓ yes'
      : expectedOut
        ? '— (promo card)'
        : '**❌ missing**';
    const count = servicesByLineSlug.get(line.slug)?.length ?? 0;
    console.log(`| \`${line.slug}\` | ${line.name} | ${status} | ${count} |`);
  }
  console.log();

  const navOnlyCategories = Object.keys(NAV_COLUMNS).filter(
    (slug) => !lineBySlug.has(slug)
  );
  if (navOnlyCategories.length > 0) {
    console.log('### Categories in NAV_COLUMNS but NOT in Supabase\n');
    for (const slug of navOnlyCategories) {
      console.log(`- \`${slug}\` — stale; either rename in nav or add to DB`);
    }
    console.log();
  }

  // ── 2. Service-slug coverage per nav column ───────────────────────────
  console.log('## 2. Service slugs (per nav column)\n');

  let totalMissingFromNav = 0;
  let totalStaleInNav = 0;
  let totalCrossLineDrift = 0;

  for (const [navKey, col] of Object.entries(NAV_COLUMNS)) {
    console.log(`### \`${navKey}\` — ${col.tagline}\n`);

    const navSlugs = new Set(col.slugs);
    const dbServicesForLine = servicesByLineSlug.get(navKey) ?? [];
    const dbSlugsForLine = new Set(dbServicesForLine.map((s) => s.slug));

    // Stale in nav: in NAV_COLUMNS[navKey].slugs but no public service has that slug
    // (in ANY line — could be cross-line placement, which is reported separately).
    const allPublicServiceSlugs = new Set(services.map((s) => s.slug));
    const staleInNav = col.slugs.filter((s) => !allPublicServiceSlugs.has(s));
    if (staleInNav.length > 0) {
      console.log('**Stale in NAV (slug not in any public service):**\n');
      for (const slug of staleInNav) console.log(`- \`${slug}\``);
      console.log();
      totalStaleInNav += staleInNav.length;
    }

    // Cross-line drift: in NAV_COLUMNS[navKey].slugs, exists in services,
    // but its service_lines.slug isn't navKey.
    const crossLine = col.slugs
      .map((slug) => services.find((s) => s.slug === slug))
      .filter((s): s is ServiceRow => Boolean(s))
      .filter((s) => s.service_lines?.slug !== navKey);
    if (crossLine.length > 0) {
      console.log('**Cross-line placement (nav says ' + navKey + ', DB says other):**\n');
      for (const svc of crossLine) {
        console.log(
          `- \`${svc.slug}\` — DB line: \`${svc.service_lines?.slug ?? '(none)'}\``
        );
      }
      console.log();
      totalCrossLineDrift += crossLine.length;
    }

    // Missing from nav: public services in this DB line not in NAV_COLUMNS[navKey].slugs
    const missingFromNav = dbServicesForLine.filter((s) => !navSlugs.has(s.slug));
    if (missingFromNav.length > 0) {
      console.log('**Public in DB but missing from this nav column:**\n');
      for (const svc of missingFromNav) {
        console.log(`- \`${svc.slug}\` — ${svc.name}`);
      }
      console.log();
      totalMissingFromNav += missingFromNav.length;
    }

    if (staleInNav.length === 0 && crossLine.length === 0 && missingFromNav.length === 0) {
      console.log('_All slugs reconciled._\n');
    }

    // Ignore unused warnings on dbSlugsForLine in this version; reserved for future.
    void dbSlugsForLine;
  }

  // ── 3. Services in DB with no nav column at all ────────────────────────
  const allNavSlugs = new Set(Object.values(NAV_COLUMNS).flatMap((c) => c.slugs));
  const orphanedServices = services.filter((s) => {
    if (allNavSlugs.has(s.slug)) return false;
    const lineSlug = s.service_lines?.slug;
    if (!lineSlug) return true;
    // If the service belongs to a category that's intentionally not in nav
    // (e.g. product → promo card), don't flag.
    return !EXPECTED_NON_COLUMN_CATEGORIES.has(lineSlug);
  });

  console.log('## 3. Public services with no nav placement (anywhere)\n');
  if (orphanedServices.length === 0) {
    console.log('_None — every public service appears in some nav column._\n');
  } else {
    console.log('| service slug | name | DB line slug |');
    console.log('|---|---|---|');
    for (const s of orphanedServices) {
      console.log(
        `| \`${s.slug}\` | ${s.name} | \`${s.service_lines?.slug ?? '(none)'}\` |`
      );
    }
    console.log();
  }

  // ── 4. Summary ─────────────────────────────────────────────────────────
  console.log('## Summary\n');
  console.log('| Metric | Count |');
  console.log('|---|---|');
  console.log(`| NAV_COLUMNS keys | ${Object.keys(NAV_COLUMNS).length} |`);
  console.log(`| service_lines rows (public) | ${lines.length} |`);
  console.log(`| services rows (public) | ${services.length} |`);
  console.log(`| Total slugs across NAV_COLUMNS | ${[...allNavSlugs].length} |`);
  console.log(`| Stale slugs in NAV | ${totalStaleInNav} |`);
  console.log(`| Cross-line drift | ${totalCrossLineDrift} |`);
  console.log(`| Missing from nav column | ${totalMissingFromNav} |`);
  console.log(`| Fully orphaned (no nav placement) | ${orphanedServices.length} |`);

  const fail =
    totalStaleInNav + totalCrossLineDrift + orphanedServices.length > 0;
  if (fail) {
    console.log('\n**Status: drift detected.** Reconcile per the categories above.\n');
    process.exit(1);
  }
  console.log('\n**Status: coverage clean.**\n');
}

main().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
