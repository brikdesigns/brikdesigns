#!/usr/bin/env npx tsx
/**
 * Icon audit (brikdesigns#144).
 *
 * Checks:
 *  1. No git-tracked symlinks under public/ (symlinks 404 on Netlify CDN)
 *  2. Every SVG in public/icons/ is a regular file with non-zero size
 *
 * Run:
 *   npx tsx scripts/audit-icons.ts
 *
 * Exits 1 if any check fails so it can gate CI.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const ICONS_DIR = path.join(__dirname, '../public/icons');
const PUBLIC_DIR = path.join(__dirname, '../public');

function getAllFiles(dir: string, files: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = fs.lstatSync(full);
    if (stat.isDirectory()) {
      getAllFiles(full, files);
    } else {
      files.push(full);
    }
  }
  return files;
}

function main() {
  let failures = 0;

  // ── 1. Symlink check ───────────────────────────────────────────────────
  console.log('## 1. Symlink check (public/)\n');

  let symlinks: string[];
  try {
    const out = execSync('find public -type l', {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
    }).trim();
    symlinks = out ? out.split('\n') : [];
  } catch {
    symlinks = [];
  }

  if (symlinks.length === 0) {
    console.log('✓ No symlinks found under public/\n');
  } else {
    console.log(`❌ ${symlinks.length} symlink(s) found — these 404 on Netlify:\n`);
    for (const s of symlinks) {
      const target = fs.readlinkSync(path.join(__dirname, '..', s));
      console.log(`  ${s} -> ${target}`);
      failures++;
    }
    console.log();
  }

  // ── 2. Icon file integrity ─────────────────────────────────────────────
  console.log('## 2. Icon file integrity (public/icons/)\n');

  if (!fs.existsSync(ICONS_DIR)) {
    console.log('❌ public/icons/ directory not found\n');
    failures++;
  } else {
    const svgs = getAllFiles(ICONS_DIR).filter((f) => f.endsWith('.svg'));
    const empty: string[] = [];

    for (const f of svgs) {
      const stat = fs.lstatSync(f);
      if (stat.isSymbolicLink()) continue; // already caught in check 1
      if (stat.size === 0) empty.push(f);
    }

    if (empty.length > 0) {
      console.log(`❌ ${empty.length} empty SVG file(s):\n`);
      for (const f of empty) {
        console.log(`  ${path.relative(PUBLIC_DIR, f)}`);
        failures++;
      }
      console.log();
    } else {
      console.log(`✓ ${svgs.length} SVG files — all non-empty\n`);
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────
  if (failures > 0) {
    console.log(`**Status: ${failures} failure(s). Fix before deploying.**\n`);
    process.exit(1);
  }
  console.log('**Status: clean.**\n');
}

main();
