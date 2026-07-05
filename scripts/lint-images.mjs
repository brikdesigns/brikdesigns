#!/usr/bin/env node
// Image-budget gate for brikdesigns.com.
//
// Fails when any raster image under public/ exceeds the per-file size budget.
// A static marketing site shouldn't ship multi-MB source images: next/image
// optimizes *delivery*, but oversized sources still cost optimization CPU on
// first request and bloat the repo + Netlify deploy. This gate keeps the
// public/ asset weight honest.
//
// Why: brikdesigns#625. The repo had shipped 8.3 MB of raster images — incl.
// three orphaned Webflow-port leftovers (img-3.png 3.4 MB, dock-ladder.png,
// rebrand-cs-block-img.png) and two 2400x2400 headshots rendered at 180px.
//
// The standard this enforces: see .claude/references/image-optimization.md
// (WebP/AVIF for photos + illustrations; size source to ~2x the largest render
// slot; keep each asset under the budget below).
//
// Usage:
//   npm run lint:images
//
// Escape hatch: if a genuinely-needed asset must exceed the budget, bump
// MAX_KB here in the same PR with a one-line justification — the budget is a
// deliberate, reviewed ceiling, not a hard physical limit.

import { readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

// Per-file ceiling for any raster image in public/. SVGs are vector and exempt.
const MAX_KB = 300;
const MAX_BYTES = MAX_KB * 1024;
const RASTER = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif']);
const ROOT = 'public';

/** @returns {string[]} every file path under dir, recursively */
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const offenders = walk(ROOT)
  .filter((f) => RASTER.has(extname(f).toLowerCase()))
  .map((f) => ({ f, bytes: statSync(f).size }))
  .filter(({ bytes }) => bytes > MAX_BYTES)
  .sort((a, b) => b.bytes - a.bytes);

if (offenders.length > 0) {
  console.error(`\n✗ ${offenders.length} image(s) over the ${MAX_KB}KB budget:\n`);
  for (const { f, bytes } of offenders) {
    console.error(`    ${(bytes / 1024).toFixed(0).padStart(5)}KB  ${f}`);
  }
  console.error(
    `\n   Convert photos/illustrations to WebP and size them to ~2x the largest`,
  );
  console.error(`   render slot. See .claude/references/image-optimization.md.`);
  console.error(
    `   If the asset genuinely needs the weight, bump MAX_KB in scripts/lint-images.mjs.\n`,
  );
  process.exit(1);
}

console.log(`OK — no public/ raster image over the ${MAX_KB}KB budget.`);
