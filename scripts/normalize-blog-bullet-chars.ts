#!/usr/bin/env npx tsx
/**
 * Normalize bullet-character lines in `blog_posts.content` to markdown lists.
 *
 * Legacy posts seeded from Webflow store list items as `•`-prefixed lines
 * inside paragraphs — the renderer (MDXRemote on brikdesigns) only emits
 * `<ul>` for proper `- item` markdown, so legacy posts render bullets as
 * inline text without markers. This script normalizes the stored content.
 *
 * Transformation:
 *   `• item`              → `- item`
 *   ensures a blank line above the first item of each contiguous bullet block
 *   so CommonMark parses the block as a list rather than a paragraph-interrupt.
 *
 * Idempotent: re-running on already-normalized content is a no-op (the regex
 * only matches `•`-prefixed lines, which no longer exist after the first run).
 *
 * Runs against the URL + service-role key in `.env.local` (staging Supabase
 * project, shared with brik-client-portal). Per repo policy, prod migrations
 * require explicit user confirmation — this script intentionally targets
 * whichever Supabase project `.env.local` points at.
 *
 *   npx tsx scripts/normalize-blog-bullet-chars.ts            # dry-run by default
 *   npx tsx scripts/normalize-blog-bullet-chars.ts --apply    # write changes
 */

import { createClient } from '@supabase/supabase-js';
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

const APPLY = process.argv.includes('--apply');
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const BULLET_LINE = /^(\s*)[•·](\s+)(.*)$/;
// Mid-line bullet — preceded by a non-whitespace char (typical Webflow lost-linebreak
// artifact, e.g. "...offer?• Know what to do next?"). Splitting here puts each item on
// its own line so the line-start pass below can convert them uniformly.
const INLINE_BULLET = /([^\s])[•·]\s*/g;

function normalizeBulletChars(content: string): { normalized: string; changed: boolean; itemCount: number } {
  const presplit = content.replace(INLINE_BULLET, '$1\n• ');
  const lines = presplit.split('\n');
  const result: string[] = [];
  let changed = presplit !== content;
  let itemCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(BULLET_LINE);
    if (match) {
      const indent = match[1];
      const text = match[3];
      const prevIsNotBullet = i === 0 || !BULLET_LINE.test(lines[i - 1]);
      const prevRendered = result[result.length - 1];
      if (prevIsNotBullet && result.length > 0 && prevRendered.trim() !== '') {
        result.push('');
      }
      result.push(`${indent}- ${text}`);
      changed = true;
      itemCount += 1;
    } else {
      result.push(line);
    }
  }

  return { normalized: result.join('\n'), changed, itemCount };
}

async function main() {
  const { data: rows, error } = await supabase
    .from('blog_posts')
    .select('id, slug, content');
  if (error) throw error;
  if (!rows) {
    console.error('No rows returned');
    process.exit(1);
  }

  console.log(`Scanned ${rows.length} blog_posts rows. Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}\n`);

  let touched = 0;
  let totalItems = 0;
  for (const row of rows) {
    if (!row.content) continue;
    const { normalized, changed, itemCount } = normalizeBulletChars(row.content);
    if (!changed) continue;

    touched += 1;
    totalItems += itemCount;
    console.log(`• ${row.slug} — ${itemCount} bullet item(s) normalized`);

    if (APPLY) {
      const { error: updateError } = await supabase
        .from('blog_posts')
        .update({ content: normalized })
        .eq('id', row.id);
      if (updateError) {
        console.error(`  ✗ failed to update ${row.slug}: ${updateError.message}`);
        process.exit(1);
      }
    }
  }

  console.log(`\n${APPLY ? 'Applied' : 'Would apply'}: ${touched} post(s), ${totalItems} bullet line(s).`);
  if (!APPLY && touched > 0) {
    console.log('\nRe-run with --apply to write changes.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
