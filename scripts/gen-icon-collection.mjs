#!/usr/bin/env node
/**
 * gen-icon-collection.mjs — Offline Phosphor subset for the site's <Icon>.
 *
 * Scans `src` for `ph:*` icon references, extracts just those icons from
 * `@iconify-json/ph` (the full ~4.4 MB / 9k-icon set), and emits a trimmed
 * IconifyJSON collection at `src/lib/icons.generated.json`. `src/lib/icon.ts`
 * registers this subset via `@iconify/react`'s `addCollection` at module load,
 * so every `ph:*` icon resolves with NO runtime fetch to api.iconify.design —
 * while the shipped bundle carries only the icons actually used (~23, ~10 KB)
 * instead of the whole set.
 *
 * Modes:
 *   node scripts/gen-icon-collection.mjs           # write the collection
 *   node scripts/gen-icon-collection.mjs --check   # fail if file differs / icons missing
 *
 * The --check mode is the drift gate (verify.yml + .husky/pre-commit): it fails
 * when a `ph:*` icon used in source is absent from the committed collection (so
 * a new icon can't silently fall through to the CDN), and when a referenced
 * icon does not exist in the Phosphor set at all (catches typos).
 *
 * Ported from brik-bds scripts/gen-icon-collection.mjs (brikdesigns/brik-bds#1002).
 * Companion: brikdesigns/brikdesigns#626.
 */

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const phData = require('@iconify-json/ph/icons.json');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const OUTPUT_PATH = path.join(REPO_ROOT, 'src', 'lib', 'icons.generated.json');

// Source root to scan. Tests/stories are excluded — their demo icons must not
// bloat the shipped bundle.
const SCAN_DIRS = ['src'];
const SOURCE_EXT = /\.(ts|tsx)$/;
const EXCLUDE_FILE = /\.(stories|test|spec)\.(ts|tsx)$/;

const PH_REF = /ph:[a-z0-9-]+/g;

const checkMode = process.argv.includes('--check');

// ── Walk source and collect distinct `ph:*` references ─────────────────────

function collectReferences() {
  const names = new Set();

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules') continue;
        walk(full);
      } else if (SOURCE_EXT.test(entry.name) && !EXCLUDE_FILE.test(entry.name)) {
        const text = fs.readFileSync(full, 'utf8');
        const matches = text.match(PH_REF);
        if (matches) for (const m of matches) names.add(m.slice('ph:'.length));
      }
    }
  }

  for (const rel of SCAN_DIRS) {
    const abs = path.join(REPO_ROOT, rel);
    if (fs.existsSync(abs)) walk(abs);
  }

  return [...names].sort();
}

// ── Resolve requested names → trimmed IconifyJSON collection ───────────────
// Copies each icon's data verbatim. If a name is an alias, the alias entry is
// kept and its parent chain pulled into `icons` so the collection is closed.

function buildCollection(names) {
  const icons = {};
  const aliases = {};
  const missing = [];

  function include(name) {
    if (phData.icons[name]) {
      icons[name] = phData.icons[name];
      return true;
    }
    const alias = phData.aliases?.[name];
    if (alias) {
      aliases[name] = alias;
      return include(alias.parent); // ensure parent resolves
    }
    return false;
  }

  for (const name of names) {
    if (!include(name)) missing.push(name);
  }

  const collection = {
    prefix: phData.prefix,
    icons: Object.fromEntries(Object.keys(icons).sort().map((k) => [k, icons[k]])),
    width: phData.width,
    height: phData.height,
  };
  if (Object.keys(aliases).length > 0) {
    collection.aliases = Object.fromEntries(
      Object.keys(aliases).sort().map((k) => [k, aliases[k]]),
    );
  }

  return { collection, missing };
}

// ── Generate ───────────────────────────────────────────────────────────────

const referenced = collectReferences();
const { collection, missing } = buildCollection(referenced);
const output = JSON.stringify(collection, null, 2) + '\n';
const iconCount = Object.keys(collection.icons).length;

if (missing.length > 0) {
  console.error('ERROR: these `ph:*` icons are referenced in source but do');
  console.error('not exist in @iconify-json/ph (typo, or wrong icon name):');
  for (const m of missing) console.error(`  ph:${m}`);
  console.error('\nFix the reference to a real Phosphor icon, then re-run.');
  process.exit(1);
}

// ── Check mode: fail if committed file differs ─────────────────────────────

if (checkMode) {
  if (!fs.existsSync(OUTPUT_PATH)) {
    console.error('ERROR: src/lib/icons.generated.json does not exist.');
    console.error('Run: npm run gen:icons');
    process.exit(1);
  }

  const committed = fs.readFileSync(OUTPUT_PATH, 'utf8');
  if (output === committed) {
    console.log(`✓ src/lib/icons.generated.json in sync (${iconCount} icons).`);
    process.exit(0);
  }

  const committedIcons = new Set(Object.keys(JSON.parse(committed).icons));
  const generatedIcons = Object.keys(collection.icons);
  const added = generatedIcons.filter((k) => !committedIcons.has(k));
  const removed = [...committedIcons].filter((k) => !collection.icons[k]);

  console.error('ERROR: src/lib/icons.generated.json is out of sync with `ph:*` usage.');
  console.error('Run: npm run gen:icons\n');
  if (added.length) console.error(`  + ${added.map((k) => 'ph:' + k).join(', ')}`);
  if (removed.length) console.error(`  - ${removed.map((k) => 'ph:' + k).join(', ')}`);
  process.exit(1);
}

// ── Write mode ──────────────────────────────────────────────────────────────

fs.writeFileSync(OUTPUT_PATH, output, 'utf8');
console.log(`✓ Wrote src/lib/icons.generated.json (${iconCount} icons from ${referenced.length} referenced)`);
