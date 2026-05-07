#!/usr/bin/env npx tsx
/**
 * Seed Supabase `blog_posts` from `content/blog/*.mdx`.
 *
 * One-time-ish: idempotent via upsert on `slug`. Runs against the URL +
 * service-role key in `.env.local` (typically the staging Supabase project
 * shared with brik-client-portal).
 *
 * Frontmatter → column mapping:
 *   title           → title
 *   slug (filename) → slug
 *   summary         → excerpt
 *   image           → featured_image_url
 *   date            → published_at (ISO date string)
 *   category        → tags  (single-element array; multi-tag editing
 *                            comes via the admin form)
 *   duration        → duration
 *   featured        → featured
 *   ctaTitle        → cta_title
 *   ctaDescription  → cta_description
 *   body content    → content
 *
 * Defaults:
 *   status = 'published'  — these MDX files are the live blog
 *   author = 'Brik Designs'
 *
 * Run from the brikdesigns repo root:
 *   npx tsx scripts/seed-blog-from-mdx.ts
 */

import { createClient } from '@supabase/supabase-js';
import matter from 'gray-matter';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { config } from 'dotenv';

config({ path: path.resolve(__dirname, '../.env.local') });
config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const POSTS_DIR = path.resolve(__dirname, '../content/blog');

interface Frontmatter {
  title?: string;
  summary?: string;
  date?: string;
  category?: string;
  duration?: string;
  featured?: boolean;
  image?: string;
  ctaTitle?: string;
  ctaDescription?: string;
}

async function main() {
  if (!fs.existsSync(POSTS_DIR)) {
    console.error(`MDX dir not found: ${POSTS_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith('.mdx'));
  console.log(`Found ${files.length} MDX files in content/blog/`);

  let inserted = 0;
  let updated = 0;
  let failed = 0;

  for (const file of files) {
    const slug = file.replace(/\.mdx$/, '');
    const raw = fs.readFileSync(path.join(POSTS_DIR, file), 'utf-8');
    const { data, content } = matter(raw);
    const fm = data as Frontmatter;

    if (!fm.title) {
      console.warn(`✗ ${slug}: missing title in frontmatter, skipping`);
      failed += 1;
      continue;
    }

    const row = {
      title: fm.title,
      slug,
      excerpt: fm.summary ?? null,
      content,
      featured_image_url: fm.image ?? null,
      author: 'Brik Designs',
      status: 'published',
      published_at: fm.date ? new Date(fm.date).toISOString() : null,
      seo_title: null,
      seo_description: null,
      tags: fm.category ? [fm.category] : null,
      duration: fm.duration ?? null,
      featured: Boolean(fm.featured),
      cta_title: fm.ctaTitle ?? null,
      cta_description: fm.ctaDescription ?? null,
    };

    // Detect insert vs update for the log
    const { data: existing } = await supabase
      .from('blog_posts')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    const { error } = await supabase
      .from('blog_posts')
      .upsert(row, { onConflict: 'slug' });

    if (error) {
      console.error(`✗ ${slug}: ${error.message}`);
      failed += 1;
      continue;
    }

    if (existing) {
      console.log(`↻ ${slug}: updated`);
      updated += 1;
    } else {
      console.log(`+ ${slug}: inserted`);
      inserted += 1;
    }
  }

  console.log(`\nDone — ${inserted} inserted, ${updated} updated, ${failed} failed.`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
