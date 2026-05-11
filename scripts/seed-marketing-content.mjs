#!/usr/bin/env node

/**
 * Seed marketing content from Webflow CMS export (cms-data.json) into Supabase.
 *
 * Prerequisites:
 *   1. Run migration 00048_marketing_tables.sql first
 *   2. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars (or .env file)
 *
 * Usage:
 *   node scripts/seed-marketing-content.mjs [path-to-cms-data.json]
 *
 * Default CMS data path: ../brikdesigns/cms-data.json
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Load CMS data
const cmsPath = process.argv[2] || resolve(__dirname, '../../brikdesigns/cms-data.json');
console.log(`Loading CMS data from: ${cmsPath}`);
const cms = JSON.parse(readFileSync(cmsPath, 'utf-8'));

// ============================================================
// Helpers
// ============================================================

function parsePriceCents(priceStr) {
  if (!priceStr) return null;
  // "$1,250.00" → 125000
  const cleaned = priceStr.replace(/[$,]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : Math.round(num * 100);
}

function mapPriceModel(model) {
  const map = {
    'One-Time Charge': 'one_time',
    'Monthly Subscription': 'subscription',
    'Fixed Timeframe': 'fixed_timeframe',
    'Contact for Pricing': 'contact',
  };
  return map[model] || 'one_time';
}

// ============================================================
// Step 1: Fetch existing service_categories and services by slug
// ============================================================

async function fetchExisting() {
  const { data: categories, error: catErr } = await supabase
    .from('service_categories')
    .select('id, slug, name');
  if (catErr) throw catErr;

  const { data: services, error: svcErr } = await supabase
    .from('services')
    .select('id, slug, name, category_id');
  if (svcErr) throw svcErr;

  return {
    categoryBySlug: Object.fromEntries(categories.map((c) => [c.slug, c])),
    serviceBySlug: Object.fromEntries(services.map((s) => [s.slug, s])),
  };
}

// ============================================================
// Step 2: Update service_categories with marketing content
// ============================================================

async function seedCategories(categoryBySlug) {
  console.log('\n--- Seeding service_categories marketing columns ---');

  for (const line of cms.serviceLines) {
    const existing = categoryBySlug[line.slug];
    if (!existing) {
      console.warn(`  SKIP: No existing category for slug "${line.slug}"`);
      continue;
    }

    const { error } = await supabase
      .from('service_categories')
      .update({
        tagline: line.tagline,
        description: line.description,
        hero_image_url: line.hero || null,
        card_image_url: line.image || null,
        color_light: line.light || null,
        color_base: line.base || null,
        color_dark: line.dark || null,
        rank: line.rank || 0,
        is_public: true,
      })
      .eq('id', existing.id);

    if (error) {
      console.error(`  ERROR updating "${line.slug}":`, error.message);
    } else {
      console.log(`  Updated: ${line.name} (${line.slug})`);
    }
  }
}

// ============================================================
// Step 3: Update services with marketing content
// ============================================================

async function seedServices(serviceBySlug) {
  console.log('\n--- Seeding services marketing columns ---');

  for (const svc of cms.services) {
    const existing = serviceBySlug[svc.slug];
    if (!existing) {
      console.warn(`  SKIP: No existing service for slug "${svc.slug}"`);
      continue;
    }

    const { error } = await supabase
      .from('services')
      .update({
        tagline: svc.tagline,
        marketing_description: svc.description,
        hero_image_url: svc.image || null,
        is_featured: svc.is_featured_service || false,
        has_customer_story: svc.has_customer_story || false,
        has_multiple_offerings: svc.has_multiple_offerings || false,
        has_maintenance_add_on: svc.has_maintenance_add_on || false,
        rank: svc.rank || 0,
        is_public: true,
      })
      .eq('id', existing.id);

    if (error) {
      console.error(`  ERROR updating "${svc.slug}":`, error.message);
    } else {
      console.log(`  Updated: ${svc.name} (${svc.slug})`);
    }
  }
}

// ============================================================
// Step 4: Seed offerings
// ============================================================

async function seedOfferings(serviceBySlug, categoryBySlug) {
  console.log('\n--- Seeding offerings ---');

  for (const off of cms.offerings) {
    const service = serviceBySlug[off.service];
    const category = categoryBySlug[off.service_line];

    const { error } = await supabase.from('offerings').upsert(
      {
        service_id: service?.id || null,
        category_id: category?.id || null,
        name: off.name,
        slug: off.slug,
        price_model: mapPriceModel(off.price_model),
        price_cents: parsePriceCents(off.price),
        price_display: off.price || null,
        description: off.description || null,
        what_you_get: off.what_you_get || null,
        is_standalone: off.standalone_service || false,
        has_tier_options: off.tier_options || false,
        tier_rank: off.tier_rank || 0,
        sort_order: off.tier_rank || 0,
        is_public: true,
      },
      { onConflict: 'slug' }
    );

    if (error) {
      console.error(`  ERROR "${off.slug}":`, error.message);
    } else {
      console.log(`  Upserted: ${off.name} (${off.slug})`);
    }
  }
}

// ============================================================
// Step 5: Seed support_plans + junction tables
// ============================================================

async function seedSupportPlans(serviceBySlug, categoryBySlug) {
  console.log('\n--- Seeding support_plans ---');

  for (const plan of cms.supportPlans) {
    const { data, error } = await supabase
      .from('support_plans')
      .upsert(
        {
          name: plan.name,
          slug: plan.slug,
          monthly_price_cents: parsePriceCents(plan.monthly_price),
          annual_price_cents: parsePriceCents(plan.annual_price),
          monthly_price_display: plan.monthly_price || null,
          annual_price_display: plan.annual_price || null,
          description: plan.description || null,
          home_description: plan.home_description || null,
          image_url: plan.image || null,
          note: plan.note || null,
          discount_label: plan.discount || null,
          rank: plan.rank || 0,
          is_public: true,
        },
        { onConflict: 'slug' }
      )
      .select()
      .single();

    if (error) {
      console.error(`  ERROR "${plan.slug}":`, error.message);
      continue;
    }
    console.log(`  Upserted: ${plan.name} (${plan.slug})`);

    // Junction: categories
    if (plan.service_lines?.length) {
      for (const catSlug of plan.service_lines) {
        const cat = categoryBySlug[catSlug];
        if (!cat) continue;
        await supabase.from('support_plan_categories').upsert(
          { support_plan_id: data.id, category_id: cat.id },
          { onConflict: 'support_plan_id,category_id' }
        );
      }
    }

    // Junction: services
    if (plan.services?.length) {
      for (const svcSlug of plan.services) {
        const svc = serviceBySlug[svcSlug];
        if (!svc) continue;
        await supabase.from('support_plan_services').upsert(
          { support_plan_id: data.id, service_id: svc.id },
          { onConflict: 'support_plan_id,service_id' }
        );
      }
    }
  }
}

// ============================================================
// Step 6: Seed customer_stories + junction
// ============================================================

async function seedCustomerStories(serviceBySlug, categoryBySlug) {
  console.log('\n--- Seeding customer_stories ---');

  for (const story of cms.customerStories) {
    const primaryService = serviceBySlug[story.service];
    const primaryCategory = categoryBySlug[story.service_line];

    const { data, error } = await supabase
      .from('customer_stories')
      .upsert(
        {
          name: story.name,
          slug: story.slug,
          client_name: story.client || '',
          short_description: story.short_description || null,
          hero_image_url: story.hero_image || null,
          industry: story.industry || null,
          website_url: story.url || null,
          client_website_display: story.client_website || null,
          the_challenge: story.the_challenge || null,
          the_solution: story.the_solution || null,
          results: story.results || null,
          quote: story.quote || null,
          quote_attribution: story.customer_name || null,
          primary_service_id: primaryService?.id || null,
          primary_category_id: primaryCategory?.id || null,
          rank: story.rank || 0,
          is_public: true,
        },
        { onConflict: 'slug' }
      )
      .select()
      .single();

    if (error) {
      console.error(`  ERROR "${story.slug}":`, error.message);
      continue;
    }
    console.log(`  Upserted: ${story.name} (${story.slug})`);

    // Junction: services
    if (story.services?.length) {
      for (const svcSlug of story.services) {
        const svc = serviceBySlug[svcSlug];
        if (!svc) continue;
        await supabase.from('customer_story_services').upsert(
          { customer_story_id: data.id, service_id: svc.id },
          { onConflict: 'customer_story_id,service_id' }
        );
      }
    }
  }
}

// ============================================================
// Step 7: Seed industry_pages + topics + junction
// ============================================================

async function seedIndustryPages(serviceBySlug, categoryBySlug) {
  console.log('\n--- Seeding industry_pages ---');

  for (const cust of cms.customers) {
    const { data: page, error } = await supabase
      .from('industry_pages')
      .upsert(
        {
          name: cust.name,
          slug: cust.slug,
          tagline: cust.tagline || null,
          intro_title: cust.intro_title || null,
          intro_description: cust.intro_description || null,
          primary_badge_url: cust.primary_badge || null,
          secondary_badge_url: cust.secondary_badge || null,
          hero_image_url: cust.image || null,
          is_public: true,
          rank: 0,
        },
        { onConflict: 'slug' }
      )
      .select()
      .single();

    if (error) {
      console.error(`  ERROR "${cust.slug}":`, error.message);
      continue;
    }
    console.log(`  Upserted: ${cust.name} (${cust.slug})`);

    // Seed topics 1-4
    for (let i = 1; i <= 4; i++) {
      const title = cust[`topic_${i}_title`];
      if (!title) continue;

      const catSlug = cust[`topic_${i}_service_line`];
      const cat = catSlug ? categoryBySlug[catSlug] : null;

      const { data: topic, error: topicErr } = await supabase
        .from('industry_page_topics')
        .upsert(
          {
            industry_page_id: page.id,
            topic_number: i,
            title,
            description: cust[`topic_${i}_description`] || null,
            category_id: cat?.id || null,
            sort_order: i,
          },
          { onConflict: 'industry_page_id,topic_number' }
        )
        .select()
        .single();

      if (topicErr) {
        console.error(`    ERROR topic ${i}:`, topicErr.message);
        continue;
      }

      // Junction: topic services
      const svcSlugs = cust[`topic_${i}_services`] || [];
      for (const svcSlug of svcSlugs) {
        const svc = serviceBySlug[svcSlug];
        if (!svc) continue;
        await supabase.from('industry_page_topic_services').upsert(
          { topic_id: topic.id, service_id: svc.id, sort_order: 0 },
          { onConflict: 'topic_id,service_id' }
        );
      }
    }
  }
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log('=== Brik Marketing Content Seed ===\n');
  console.log(`Supabase: ${SUPABASE_URL}`);
  console.log(`Collections: ${cms.serviceLines.length} lines, ${cms.services.length} services, ${cms.offerings.length} offerings`);
  console.log(`  ${cms.supportPlans.length} plans, ${cms.customerStories.length} stories, ${cms.customers.length} industries\n`);

  const { categoryBySlug, serviceBySlug } = await fetchExisting();

  console.log(`Found ${Object.keys(categoryBySlug).length} existing categories`);
  console.log(`Found ${Object.keys(serviceBySlug).length} existing services`);

  // Check slug matches
  const cmsServiceSlugs = cms.services.map((s) => s.slug);
  const matched = cmsServiceSlugs.filter((s) => serviceBySlug[s]);
  const unmatched = cmsServiceSlugs.filter((s) => !serviceBySlug[s]);
  console.log(`\nSlug matches: ${matched.length}/${cmsServiceSlugs.length}`);
  if (unmatched.length) {
    console.warn(`Unmatched CMS slugs (will skip): ${unmatched.join(', ')}`);
  }

  await seedCategories(categoryBySlug);
  await seedServices(serviceBySlug);
  await seedOfferings(serviceBySlug, categoryBySlug);
  await seedSupportPlans(serviceBySlug, categoryBySlug);
  await seedCustomerStories(serviceBySlug, categoryBySlug);
  await seedIndustryPages(serviceBySlug, categoryBySlug);

  console.log('\n=== Seed complete ===');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
