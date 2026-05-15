#!/usr/bin/env npx tsx
/**
 * Migrate plans/standard orphan rows → offerings table.
 *
 * Context (brikdesigns#149 reconciliation):
 *   - Webflow CMS has 51 published Offerings
 *   - Supabase `offerings` only has 20 (partial migration)
 *   - Supabase `plans` where plan_type='standard' has 54 rows that are mostly
 *     orphaned Webflow imports (no plan_items, no consumer code reads them).
 *   - Marketing queries only ever pull plan_type='support', so plans/standard
 *     is functionally invisible to the marketing site.
 *
 * Target architecture (per user 2026-05-15):
 *   - services = 33 (catalog, /services/{slug} pages) — ALREADY CORRECT
 *   - offerings = ~51 (pricing tiers per service, rendered ON service pages,
 *     no standalone pages) — THIS SCRIPT BACKFILLS
 *   - plans = 3 (marketing-support, back-office-support, product-support;
 *     /plans/{slug} pages) — separate cleanup, not this script
 *
 * What this script does:
 *   1. Reads `plans` where plan_type='standard' AND offering_id IS NULL
 *   2. Skips 6 support-tier rows (back-office/marketing/product-support-{annual,}-plan)
 *      — those need plans/support billing fields, not offerings
 *   3. For each remaining orphan, resolves the parent service_id via slug-prefix
 *      mapping (defined explicitly in OFFERING_MAP below)
 *   4. INSERTs an `offerings` row with canonical slug, copying name/description/
 *      price_display/etc. base_price_cents left NULL (operations sets via Stripe).
 *   5. Reports skipped, mapped, conflicts.
 *
 * Default mode: DRY RUN. Pass --apply to execute.
 *
 * Requires service_role (writes bypass RLS for the public.offerings table).
 *
 * Run:
 *   set -a; source ~/.secrets/brik-client-portal-staging.env; set +a
 *   npx tsx scripts/migrate-offerings-from-plans-standard.ts          # dry run
 *   npx tsx scripts/migrate-offerings-from-plans-standard.ts --apply  # execute
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    'Missing env. Source the staging env first:\n' +
    '  set -a; source ~/.secrets/brik-client-portal-staging.env; set +a'
  );
  process.exit(1);
}

const APPLY = process.argv.includes('--apply');
const sb = createClient(supabaseUrl, serviceRoleKey);

// ─── Source → Target mapping ─────────────────────────────────────────────────
//
// Each entry maps a plans/standard orphan slug to:
//   service:   the parent service slug (FK target on offerings.service_id)
//   newSlug:   canonical offering slug after migration
//   note:      optional rationale for the rename
//
// Conventions:
//   - Single-tier offerings: slug matches service slug (e.g., infographics)
//   - Multi-tier offerings: {service-slug}-{tier-name} (e.g., logo-design-basic)
//   - Drop '-offering' suffix when no other tier exists
//   - Fix typos in source slugs (logoo→logo, sop-creating→sop-creation)

const OFFERING_MAP: Record<string, { service: string; newSlug: string; note?: string }> = {
  // ── Logo Design tiers ──
  'logoo-design-basic':              { service: 'logo-design', newSlug: 'logo-design-basic', note: 'typo fix: logoo→logo' },
  'logo-design-refresh':             { service: 'logo-design', newSlug: 'logo-design-refresh' },
  'logo-design-premium':             { service: 'logo-design', newSlug: 'logo-design-premium' },

  // ── Email Marketing tiers ──
  'email-marketing-single':          { service: 'email-marketing', newSlug: 'email-marketing-single' },
  'email-marketing-drip':            { service: 'email-marketing', newSlug: 'email-marketing-drip' },
  'email-marketing-monthly':         { service: 'email-marketing', newSlug: 'email-marketing-monthly' },
  'email-marketing-bundle':          { service: 'email-marketing', newSlug: 'email-marketing-bundle' },

  // ── Web Design tiers ──
  'web-design-one-page':             { service: 'web-design', newSlug: 'web-design-one-page' },
  'web-design-e-commerce':           { service: 'web-design', newSlug: 'web-design-e-commerce' },
  'web-design-custom':               { service: 'web-design', newSlug: 'web-design-custom' },
  'website-custom':                  { service: 'web-design', newSlug: 'web-design-standard', note: 'rename: ambiguous "Custom" $4500 → standard tier' },
  'web-design-template-dental':      { service: 'web-design', newSlug: 'web-design-template-dental' },
  'web-design-template-real-estate': { service: 'web-design', newSlug: 'web-design-template-real-estate' },
  'web-design-template-small-business': { service: 'web-design', newSlug: 'web-design-template-small-business' },

  // ── Signage Design tiers ──
  'signage-design-sm':               { service: 'signage-design', newSlug: 'signage-design-sm' },
  'signage-design-lg':               { service: 'signage-design', newSlug: 'signage-design-lg' },

  // ── Social Media Graphics tiers ──
  'social-media-graphic-sm':         { service: 'social', newSlug: 'social-graphic-sm', note: 'shortened to match service slug "social"' },
  'social-media-graphic-lg':         { service: 'social', newSlug: 'social-graphic-lg' },

  // ── Swag tiers ──
  'services-marketing-design-swag-merchandise-design': { service: 'swag', newSlug: 'swag-single', note: 'rename: verbose legacy slug → tier name' },
  'swag-and-merchandise-design-bundle': { service: 'swag', newSlug: 'swag-bundle' },

  // ── Single-tier offerings (slug usually = service slug or service-slug-{tier}) ──
  'customer-journey-mapping-standard':       { service: 'customer-journey-mapping', newSlug: 'customer-journey-mapping-standard' },
  'infographics':                            { service: 'infographics', newSlug: 'infographics' },
  'landing-page-design-offering':            { service: 'landing-pages', newSlug: 'landing-page-design', note: 'drop -offering suffix' },
  'letterhead-stationary-offering':          { service: 'business-stationery', newSlug: 'letterhead-stationary', note: 'drop -offering suffix' },
  'marketing-consulting-comprehensive':      { service: 'marketing-consulting', newSlug: 'marketing-consulting-comprehensive' },
  'mobile-app-design-offering':              { service: 'mobile-app-design', newSlug: 'mobile-app-design', note: 'drop -offering suffix' },
  'online-business-listings-setup':          { service: 'online-business-listings', newSlug: 'online-business-listings-setup' },
  'saas-basic':                              { service: 'saas', newSlug: 'saas-basic' },
  'software-subscription-audit-offering':    { service: 'software-subscription-audit', newSlug: 'software-subscription-audit', note: 'drop -offering suffix' },
  'sop-creating-offering':                   { service: 'sop-creation', newSlug: 'sop-creation', note: 'typo fix: creating→creation; drop -offering' },
  'automated-workflow-offering':             { service: 'automated-workflow-and-ai-integration', newSlug: 'automated-workflow', note: 'shortened from service slug' },
  'crm-setup-and-data-cleanup-offering':     { service: 'crm-setup-and-data-cleanup', newSlug: 'crm-setup-and-data-cleanup', note: 'drop -offering suffix' },
};

// Support-plan billing tiers (NOT offerings — fold into plans/support billing fields separately).
const SKIP_SUPPORT_TIERS = new Set([
  'back-office-support-plan',
  'back-office-support-annual-plan',
  'marketing-support-plan',
  'marketing-support-annual-plan',
  'product-support-plan',
  'product-support-annual-plan',
]);

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`# Migrate plans/standard → offerings (${APPLY ? 'APPLY' : 'DRY RUN'})\n`);

  const { data: orphans, error: orphErr } = await sb
    .from('plans')
    .select('id,slug,name,description,price_display,monthly_price_display,image_url,icon_url,rank,is_public')
    .eq('plan_type', 'standard')
    .is('offering_id', null)
    .order('slug');
  if (orphErr) { console.error('orphan fetch failed:', orphErr); process.exit(1); }

  const { data: services, error: svcErr } = await sb
    .from('services')
    .select('id,slug,name')
    .eq('is_public', true);
  if (svcErr) { console.error('services fetch failed:', svcErr); process.exit(1); }
  const svcBySlug = new Map((services ?? []).map(s => [s.slug, s]));

  const { data: existingOff, error: offErr } = await sb
    .from('offerings')
    .select('slug,name');
  if (offErr) { console.error('offerings fetch failed:', offErr); process.exit(1); }
  const offBySlug = new Map((existingOff ?? []).map(o => [o.slug, o]));

  const skipped: string[] = [];
  const unmapped: string[] = [];
  const conflicts: string[] = [];
  const toInsert: Array<{ src: string; tgt: { slug: string; service: string }; row: Record<string, unknown> }> = [];

  for (const p of orphans ?? []) {
    if (SKIP_SUPPORT_TIERS.has(p.slug)) {
      skipped.push(`${p.slug}  (support-plan tier, handle in plans/support)`);
      continue;
    }
    const map = OFFERING_MAP[p.slug];
    if (!map) {
      unmapped.push(`${p.slug}  ← no entry in OFFERING_MAP`);
      continue;
    }
    const svc = svcBySlug.get(map.service);
    if (!svc) {
      unmapped.push(`${p.slug}  → service '${map.service}' not found`);
      continue;
    }
    if (offBySlug.has(map.newSlug)) {
      conflicts.push(`${p.slug}  → '${map.newSlug}' already exists in offerings`);
      continue;
    }

    toInsert.push({
      src: p.slug,
      tgt: { slug: map.newSlug, service: map.service },
      row: {
        slug: map.newSlug,
        name: p.name?.trim() || null,
        description: p.description ?? null,
        price_display: p.price_display ?? p.monthly_price_display ?? null,
        image_url: p.image_url ?? null,
        service_id: svc.id,
        is_public: p.is_public ?? true,
        rank: p.rank ?? 0,
        // base_price_cents intentionally NULL — operations sets via Stripe sync
      },
    });
  }

  console.log(`## Plan\n`);
  console.log(`- Orphans found:        ${orphans?.length ?? 0}`);
  console.log(`- Skipped (support tier): ${skipped.length}`);
  console.log(`- Conflicts:            ${conflicts.length}`);
  console.log(`- Unmapped:             ${unmapped.length}`);
  console.log(`- To insert:            ${toInsert.length}\n`);

  if (skipped.length) {
    console.log(`### Skipped\n`);
    for (const s of skipped) console.log(`  - ${s}`);
    console.log();
  }
  if (conflicts.length) {
    console.log(`### Conflicts (target slug already exists)\n`);
    for (const c of conflicts) console.log(`  - ${c}`);
    console.log();
  }
  if (unmapped.length) {
    console.log(`### Unmapped (no rule, fix OFFERING_MAP)\n`);
    for (const u of unmapped) console.log(`  - ${u}`);
    console.log();
  }

  console.log(`### Proposed inserts (${toInsert.length})\n`);
  console.log(`| src plan slug | → | new offering slug | parent service | price |`);
  console.log(`|---|---|---|---|---|`);
  for (const ti of toInsert) {
    const price = (ti.row.price_display as string | null) ?? '∅';
    console.log(`| \`${ti.src}\` | → | \`${ti.tgt.slug}\` | \`${ti.tgt.service}\` | ${price} |`);
  }
  console.log();

  if (!APPLY) {
    console.log(`---\n\nDry run complete. Re-run with --apply to execute on staging.\n`);
    return;
  }

  console.log(`---\n\n## Applying ${toInsert.length} inserts...\n`);
  let ok = 0, fail = 0;
  for (const ti of toInsert) {
    const { error } = await sb.from('offerings').insert(ti.row);
    if (error) {
      console.log(`  ✗ ${ti.tgt.slug}: ${error.message}`);
      fail++;
    } else {
      console.log(`  ✓ ${ti.tgt.slug}`);
      ok++;
    }
  }
  console.log(`\nResult: ${ok} ok, ${fail} failed.`);
}

main().catch(err => { console.error('Migration failed:', err); process.exit(1); });
