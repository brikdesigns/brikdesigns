#!/usr/bin/env npx tsx
/**
 * Seed Supabase from Webflow CMS CSV exports.
 *
 * Reads CSV files from content/csv/ and upserts into the shared Supabase project.
 * Uses service role key (bypasses RLS) for admin writes.
 *
 * Run: npx tsx scripts/seed-from-webflow-csv.ts
 *
 * Prereqs:
 *   - Migration 00044_marketing_cms_schema.sql must be applied
 *   - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
 *
 * Strategy:
 *   1. Upsert service_categories (by slug)
 *   2. Upsert services (by slug, with category_id FK lookup)
 *   3. Upsert offerings (by slug, with service_id + category_id FK lookup)
 *   4. Upsert support_plans (by slug)
 *   5. Upsert customer_stories (by slug)
 *   6. Upsert industry_pages (by slug)
 *   7. Insert industry_page_topics (by industry_page_id + topic_number)
 *   8. Insert industry_page_topic_services (by topic_id + service_slug)
 */

import { createClient } from '@supabase/supabase-js';
import { parse } from 'csv-parse/sync';
import * as fs from 'fs';
import * as path from 'path';

const CSV_DIR = path.join(__dirname, '../content/csv');

// ─── Supabase client (service role = bypass RLS) ────────────────────────────

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ─── CSV helpers ─────────────────────────────────────────────────────────────

function readCSV(filename: string): Record<string, string>[] {
  const filepath = fs.readdirSync(CSV_DIR).find((f) => f.includes(filename));
  if (!filepath) throw new Error(`CSV not found matching: ${filename}`);
  const content = fs.readFileSync(path.join(CSV_DIR, filepath), 'utf8');
  return parse(content, { columns: true, skip_empty_lines: true });
}

function isPublished(row: Record<string, string>): boolean {
  return row['Draft'] !== 'true' && row['Archived'] !== 'true';
}

function toBool(val: string): boolean {
  return val === 'true';
}

function toInt(val: string, fallback = 0): number {
  const n = parseInt(val, 10);
  return isNaN(n) ? fallback : n;
}

// ─── Seed functions ──────────────────────────────────────────────────────────

async function seedServiceCategories() {
  console.log('\n📦 Seeding service_categories...');
  const rows = readCSV('Service Lines').filter(isPublished);

  for (const row of rows) {
    const { error } = await supabase
      .from('service_categories')
      .upsert({
        slug: row['Slug'],
        name: row['Name'],
        tagline: row['Tagline'] || null,
        description: row['Description'] || null,
        hero_image_url: row['Hero'] || null,
        card_image_url: row['Main Image'] || null,
        primary_badge_url: row['Primary Badge - light'] || null,
        secondary_badge_url: row['Secondary Badge'] || null,
        support_plan_slug: row['Support Plan'] || null,
        support_plan_image_url: row['Support Plan Img'] || null,
        brand_color_light: row['Light'] || null,
        brand_color_base: row['Base'] || null,
        brand_color_dark: row['Dark'] || null,
        is_public: true,
        rank: toInt(row['Rank']),
        // Preserve existing fields if they exist
        color_token: row['Slug'].replace('-design', ''), // brand, marketing, information, etc.
        sort_order: toInt(row['Rank']),
      }, { onConflict: 'slug' });

    if (error) console.error(`  ✗ ${row['Slug']}: ${error.message}`);
    else console.log(`  ✓ ${row['Slug']}`);
  }
}

async function seedServices() {
  console.log('\n📦 Seeding services...');
  const rows = readCSV('Services').filter(isPublished);

  // Build category slug → id lookup
  const { data: categories } = await supabase
    .from('service_categories')
    .select('id, slug');
  const catMap = new Map(categories?.map((c) => [c.slug, c.id]) || []);

  for (const row of rows) {
    const categoryId = catMap.get(row['Service Line']);

    const { error } = await supabase
      .from('services')
      .upsert({
        slug: row['Slug'],
        name: row['Name'],
        description: row['Description'] || null,
        tagline: row['Tagline'] || null,
        marketing_description: row['Description'] || null,
        image_url: row['Image'] || null,
        primary_badge_url: row['Primary Badge'] || null,
        secondary_badge_url: row['Secondary Badge'] || null,
        related_service_slug: row['Related'] || null,
        support_plan_slug: row['Support Plan'] || null,
        is_public: true,
        rank: toInt(row['Rank']),
        is_featured: toBool(row['Is featured service']),
        has_customer_story: toBool(row['Has customer story']),
        has_multiple_offerings: toBool(row['Has multiple offerings']),
        has_maintenance_addon: toBool(row['Has maintenance add-on']),
        category_id: categoryId || null,
        sort_order: toInt(row['Rank']),
        active: true,
      }, { onConflict: 'slug' });

    if (error) console.error(`  ✗ ${row['Slug']}: ${error.message}`);
    else console.log(`  ✓ ${row['Slug']}`);
  }
}

async function seedOfferings() {
  console.log('\n📦 Seeding offerings...');
  const rows = readCSV('Offerings').filter(isPublished);

  // Build lookups
  const { data: services } = await supabase.from('services').select('id, slug');
  const svcMap = new Map(services?.map((s) => [s.slug, s.id]) || []);

  const { data: categories } = await supabase.from('service_categories').select('id, slug');
  const catMap = new Map(categories?.map((c) => [c.slug, c.id]) || []);

  for (const row of rows) {
    const serviceId = svcMap.get(row['Service']);
    const categoryId = catMap.get(row['Service Line']);

    const priceModel = row['Price Model']?.toLowerCase().replace(/[- ]/g, '_') || null;
    const validModels = ['one_time', 'monthly', 'annual', 'custom'];
    const mappedModel = priceModel === 'one_time_charge' ? 'one_time' : priceModel;

    const { error } = await supabase
      .from('offerings')
      .upsert({
        slug: row['Slug'],
        name: row['Name'],
        service_id: serviceId || null,
        category_id: categoryId || null,
        description: row['Description'] || null,
        price_display: row['Price'] || null,
        price_model: validModels.includes(mappedModel || '') ? mappedModel : 'one_time',
        what_you_get: row['What You Get'] || null,
        icon_url: row['Icon'] || null,
        related_service_slug: row['Related Service'] || null,
        tier_rank: toInt(row['Tier Rank']),
        is_standalone: toBool(row['Standalone Service']),
        is_tier_option: toBool(row['Tier Options']),
        is_public: true,
      }, { onConflict: 'slug' });

    if (error) console.error(`  ✗ ${row['Slug']}: ${error.message}`);
    else console.log(`  ✓ ${row['Slug']}`);
  }
}

async function seedSupportPlans() {
  console.log('\n📦 Seeding support_plans...');

  // Support plans are derived from service_categories that have support_plan data
  // For now, seed the 3 known plans
  const plans = [
    {
      slug: 'marketing-support',
      name: 'Marketing Support',
      description: 'We act as your marketing department—handling everything from campaigns and emails to graphics and strategy.',
      home_description: 'One monthly fee. No juggling freelancers or doing it yourself.',
      monthly_price_display: '$1,250.00',
      annual_price_display: '$13,500.00',
      rank: 1,
    },
    {
      slug: 'back-office-support',
      name: 'Back Office Support',
      description: 'We streamline your behind-the-scenes operations—from workflows and automations to system cleanups and SOPs—so your team can focus on what matters.',
      home_description: 'Streamline operations without hiring a full-time ops team.',
      monthly_price_display: '$1,250.00',
      annual_price_display: '$13,500.00',
      rank: 2,
    },
    {
      slug: 'product-support',
      name: 'Product Design Support',
      description: 'Whether you\'re launching new features or improving your UX, we handle your product interface design from end to end—without slowing down your dev team.',
      home_description: 'Ship better products without expanding your design team.',
      monthly_price_display: '$1,650.00',
      annual_price_display: null,
      rank: 3,
    },
  ];

  for (const plan of plans) {
    const { error } = await supabase
      .from('support_plans')
      .upsert({ ...plan, is_public: true }, { onConflict: 'slug' });

    if (error) console.error(`  ✗ ${plan.slug}: ${error.message}`);
    else console.log(`  ✓ ${plan.slug}`);
  }
}

async function seedCustomerStories() {
  console.log('\n📦 Seeding customer_stories...');
  const rows = readCSV('Customer Stories').filter(isPublished);

  for (const row of rows) {
    const { error } = await supabase
      .from('customer_stories')
      .upsert({
        slug: row['Slug'],
        name: row['Name'],
        client_name: row['Client'] || null,
        short_description: row['Short Description'] || null,
        hero_image_url: row['Hero Image'] || null,
        hero_video_url: row['Hero Video'] || null,
        thumbnail_url: row['Thumbnail'] || null,
        client_logo_url: row['Client Logo'] || null,
        client_icon_url: row['Client Icon'] || null,
        industry: row['Industry'] || null,
        industry_badge_url: row['Industry Badge'] || null,
        launch_date: row['Launch Date'] || null,
        client_website: row['Client Website'] || null,
        the_challenge: row['The Challenge'] || null,
        the_solution: row['The Solution'] || null,
        results: row['Results'] || null,
        quote: row['Quote'] || null,
        quote_attribution: row['Customer Name'] || null,
        before_photo_url: row['Before Photo'] || null,
        after_photo_url: row['After Photo'] || null,
        results_photo_url: row['Results Photo'] || null,
        before_video_url: row['Before Video'] || null,
        after_video_url: row['After Video'] || null,
        results_video_url: row['Results Video'] || null,
        service_slug: row['Service'] || null,
        service_line_slug: row['Service Line'] || null,
        service_line_icon_url: row['Service Line Icon'] || null,
        is_public: true,
        rank: toInt(row['Rank']),
      }, { onConflict: 'slug' });

    if (error) console.error(`  ✗ ${row['Slug']}: ${error.message}`);
    else console.log(`  ✓ ${row['Slug']}`);
  }
}

async function seedIndustryPages() {
  console.log('\n📦 Seeding industry_pages + topics...');
  const rows = readCSV('Customers').filter(isPublished);

  for (const row of rows) {
    // Upsert the industry page
    const { data: page, error: pageError } = await supabase
      .from('industry_pages')
      .upsert({
        slug: row['Slug'],
        name: row['Name'],
        tagline: row['Tagline'] || null,
        intro_title: row['Intro Title'] || null,
        intro_description: row['Intro Description'] || null,
        image_url: row['Image'] || null,
        primary_badge_url: row['Primary Badge'] || null,
        secondary_badge_url: row['Secondary Badge'] || null,
        is_public: true,
        rank: 0,
      }, { onConflict: 'slug' })
      .select('id')
      .single();

    if (pageError) {
      console.error(`  ✗ ${row['Slug']}: ${pageError.message}`);
      continue;
    }
    console.log(`  ✓ ${row['Slug']} (page)`);

    // Delete existing topics for this page (clean re-seed)
    await supabase
      .from('industry_page_topics')
      .delete()
      .eq('industry_page_id', page.id);

    // Insert topics 1-4
    for (let t = 1; t <= 4; t++) {
      const title = row[`Topic ${t} Title`];
      if (!title) continue;

      const { data: topic, error: topicError } = await supabase
        .from('industry_page_topics')
        .insert({
          industry_page_id: page.id,
          topic_number: t,
          title,
          description: row[`Topic ${t} Description`] || null,
          service_line_slug: row[`Topic ${t} Service Line`] || null,
          image_url: row[`Topic ${t} Image`] || null,
        })
        .select('id')
        .single();

      if (topicError) {
        console.error(`    ✗ Topic ${t}: ${topicError.message}`);
        continue;
      }

      // Insert topic → services links
      const services = (row[`Topic ${t} Services`] || '').split(';').map((s) => s.trim()).filter(Boolean);
      for (const svcSlug of services) {
        await supabase
          .from('industry_page_topic_services')
          .upsert({ topic_id: topic.id, service_slug: svcSlug }, { onConflict: 'topic_id,service_slug' });
      }

      console.log(`    ✓ Topic ${t}: ${title} (${services.length} services)`);
    }
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  Seeding Supabase from Webflow CMS CSV exports');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  Supabase URL: ${supabaseUrl}`);
  console.log(`  CSV directory: ${CSV_DIR}`);

  await seedServiceCategories();
  await seedServices();
  await seedOfferings();
  await seedSupportPlans();
  await seedCustomerStories();
  await seedIndustryPages();

  console.log('\n═══════════════════════════════════════════════════');
  console.log('  Seed complete');
  console.log('═══════════════════════════════════════════════════');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
