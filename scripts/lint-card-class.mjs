#!/usr/bin/env node
// Fails CI when a new site-local `*-card` CSS class is applied to something
// other than a BDS `<Card>` (brikdesigns#1260).
//
// The problem: the marketing site grew two parallel card systems. ~37 BDS
// `<Card>` instances, and ~36 site-local `*-card` CSS blocks — 19 of which were
// hand-rolled `div`s that never touch `<Card>`. A hand-rolled card never becomes
// a `.bds-card` element, so it is invisible to the "Card chrome by band" rule in
// shared-sections.css AND to tests/a11y/card-treatment.spec.ts, which can only
// measure cards that rendered. Card chrome then drifts per page, and the name
// `-card` stops meaning anything: at audit time it was doing three different
// jobs (a Container, a media slot, and a whole Section shell).
//
// This gate closes the hole card-treatment.spec.ts cannot see. That spec asks
// "does every rendered card have the right chrome?"; this one asks "is every
// thing calling itself a card actually a card?".
//
// What is judged: a class name that (a) is DEFINED in a stylesheet under
// src/, (b) reads as a card — `card` appears as a `-`/`_`-delimited word in the
// name, (c) is a BLOCK, not an `__element` or a `--modifier`, and (d) is
// actually APPLIED in a `className` somewhere in .tsx. All four, so that a media
// slot (`service-card__media`), a modifier (`service-card--flat`), and a
// never-applied leftover are not mistaken for a card of their own. `bds-*` is
// excluded — those are BDS-owned classes this repo only overrides.
//
// Going-forward gate, not a big-bang conversion: the card-shaped things that
// deliberately are NOT BDS Cards (a dark-locked showcase panel, nav
// affordances, a numbered pillar tile, a semantic <article>) are grandfathered
// in scripts/card-class-baseline.json — as a name → reason map, so each keep
// carries its justification where the next reader will look. The gate is a
// ratchet both ways: a new unbacked card fails, and a baselined name that has
// since been converted or deleted ALSO fails, so the baseline cannot silently
// overstate the remaining debt.
//
// Why parse source text rather than assert on a rendered page: the failure is a
// `<div>` that should have been a `<Card>` — visible in the JSX, catchable on
// every commit without a browser, a build, or Supabase.
//
// Usage:
//   npm run lint:card-class
// Self-test:
//   npm run test:lint:card-class

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

export const SCAN_DIR = 'src';
export const BASELINE_PATH = 'scripts/card-class-baseline.json';

/** Walk a directory, returning every file with one of `exts` (posix-normalized). */
export function filesWithExt(dir, exts) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...filesWithExt(full, exts));
    else if (entry.isFile() && exts.some((e) => entry.name.endsWith(e))) {
      out.push(full.split(path.sep).join('/'));
    }
  }
  return out;
}

/** Strip `/* … *\/` comments so a class name mentioned in prose is not read as
 *  a definition. */
function stripCssComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Every class name that appears in a rule's selector prelude.
 *
 *  Splits on `{` and takes the text before it as the prelude. At-rule preludes
 *  (`@media (...)`, `@layer …`) are skipped — their nested rules produce their
 *  own preludes, so nothing is missed. */
export function definedClasses(source) {
  const names = new Set();
  for (const m of stripCssComments(source).matchAll(/([^{}]+)\{/g)) {
    const prelude = m[1];
    if (prelude.includes('@')) continue;
    for (const c of prelude.matchAll(/\.(-?[A-Za-z_][\w-]*)/g)) names.add(c[1]);
  }
  return names;
}

/** Does this class name read as a card? `card` must appear as a whole
 *  `-`/`_`-delimited word — so `card-grid` and `story-card` match, `cardigan`
 *  and `discard` do not. */
export function isCardName(name) {
  return /(?:^|[-_])card(?:[-_]|$)/.test(name);
}

/** A block is a class name with no BEM element (`__`) or modifier (`--`) part,
 *  and not a BDS-owned `bds-*` name. Only blocks are judged: an element or a
 *  modifier belongs to its block and is judged through it. */
export function isJudgedBlock(name) {
  return isCardName(name) && !name.includes('__') && !name.includes('--') && !name.startsWith('bds-');
}

/** Extract the opening-tag text for every `<Tag …>` in `source`.
 *
 *  Scans from each `<Tag` to the first `>` at JSX-expression brace-depth 0, so
 *  `style={{…}}`, ternaries, and template literals containing a `>` inside
 *  `{ }` don't end the tag early. Mirrors lint-section-id.mjs. */
export function openingTags(source, tagName) {
  const tags = [];
  const re = new RegExp(`<${tagName}\\b`, 'g');
  let m;
  while ((m = re.exec(source)) !== null) {
    let depth = 0;
    let end = -1;
    for (let i = m.index + m[0].length; i < source.length; i++) {
      const ch = source[i];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      else if (ch === '>' && depth === 0) {
        end = i;
        break;
      }
    }
    if (end === -1) break; // unterminated tag — malformed source, stop
    tags.push(source.slice(m.index, end + 1));
    re.lastIndex = end + 1;
  }
  return tags;
}

/** The BEM block a class name belongs to (`a-card__media` → `a-card`). */
function blockOf(name) {
  return name.split('--')[0].split('__')[0];
}

/** Class names appearing in a `className` value in `text`.
 *
 *  Deliberately loose: it takes every `className=…` value — string literal,
 *  template literal, ternary, or array `.join()` — and harvests the bare words
 *  out of it. A template literal whose modifier is interpolated
 *  (`` `service-card--${t}` ``) harvests as `service-card--`, so trailing BEM
 *  separators are trimmed off. */
function classNamesIn(text) {
  const names = new Set();
  for (const m of text.matchAll(/className\s*=\s*(?:"([^"]*)"|\{([\s\S]*?)\}(?=\s|\/|>|$))/g)) {
    const body = m[1] ?? m[2] ?? '';
    for (const w of body.matchAll(/[A-Za-z_][\w-]*/g)) {
      const name = w[0].replace(/[-_]+$/, '');
      if (name) names.add(name);
    }
  }
  return names;
}

/** Every class name applied via `className` in a file.
 *
 *  Block forms are NOT derived here: a media slot (`plan-card__media`) applied
 *  on a `<Frame>` must not make the never-applied block `plan-card` look like a
 *  card in use, which would fail the gate on a card that does not exist. */
export function appliedClasses(source) {
  return classNamesIn(source);
}

/** Every class name applied via `className` on a BDS `<Card>` opening tag,
 *  plus the BEM block of each — a family whose element or modifier lands on a
 *  real `<Card>` is a real card family.
 *
 *  `<Card>` only — not `<PricingCard>` / `<CardGrid>`, which the `<Card\b`
 *  word boundary already excludes, and whose own `bds-*` classes are out of
 *  scope anyway. */
export function cardBackedClasses(source) {
  const names = new Set();
  for (const tag of openingTags(source, 'Card')) {
    for (const n of classNamesIn(tag)) {
      names.add(n);
      names.add(blockOf(n));
    }
  }
  return names;
}

function main() {
  const cssFiles = filesWithExt(SCAN_DIR, ['.css']);
  const tsxFiles = filesWithExt(SCAN_DIR, ['.tsx']);
  if (cssFiles.length === 0 || tsxFiles.length === 0) {
    console.error(
      `lint-card-class: found ${cssFiles.length} .css and ${tsxFiles.length} .tsx ` +
        `file(s) under ${SCAN_DIR} — the source tree moved. Fix this path before ` +
        `trusting the gate.`
    );
    return 2;
  }

  // name → the stylesheet(s) that define it, for the failure message.
  const definedIn = new Map();
  for (const file of cssFiles) {
    for (const name of definedClasses(fs.readFileSync(file, 'utf8'))) {
      if (!isJudgedBlock(name)) continue;
      if (!definedIn.has(name)) definedIn.set(name, []);
      definedIn.get(name).push(file);
    }
  }

  const applied = new Set();
  const backed = new Set();
  for (const file of tsxFiles) {
    const source = fs.readFileSync(file, 'utf8');
    for (const n of appliedClasses(source)) applied.add(n);
    for (const n of cardBackedClasses(source)) backed.add(n);
  }

  let baseline = {};
  if (fs.existsSync(BASELINE_PATH)) {
    try {
      const raw = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
      baseline = raw.allowed ?? raw;
    } catch (err) {
      console.error(`lint-card-class: ${BASELINE_PATH} is not valid JSON — ${err.message}`);
      return 2;
    }
  }

  const problems = [];
  const unbacked = new Set();

  for (const [name, files] of definedIn) {
    if (!applied.has(name)) continue; // defined but never applied — not a card in use
    if (backed.has(name)) continue; // on a BDS <Card> — correct by construction
    unbacked.add(name);
    if (name in baseline) continue; // grandfathered, with its reason recorded
    problems.push(
      `.${name} (defined in ${files.join(', ')}) is applied in .tsx but never on a ` +
        `BDS <Card>. Render it as <Card …className="${name}"> so it inherits the ` +
        `"Card chrome by band" rule and is visible to card-treatment.spec.ts — or, ` +
        `if it is deliberately not a Card, add it to ${BASELINE_PATH} with the reason.`
    );
  }

  // A baselined name that is now backed, or gone, is stale debt that reads as
  // coverage — flag it so the ratchet stays honest and can only move down.
  for (const name of Object.keys(baseline)) {
    if (unbacked.has(name)) continue;
    const why = backed.has(name)
      ? 'it now renders on a BDS <Card>'
      : 'it is no longer defined-and-applied';
    problems.push(
      `.${name} is listed in ${BASELINE_PATH} but ${why}. Remove its entry so the ` +
        `baseline cannot overstate the remaining debt.`
    );
  }

  if (problems.length > 0) {
    console.error(`lint-card-class: ${problems.length} problem(s):`);
    for (const p of problems) console.error(`  ${p}`);
    console.error(
      '\n  A class that calls itself a card should BE a card: only a rendered ' +
        '.bds-card element is reached by the "Card chrome by band" rule in ' +
        'shared-sections.css and measured by tests/a11y/card-treatment.spec.ts. ' +
        'See .claude/references/card-treatment.md (brikdesigns#1260).'
    );
    return 1;
  }

  console.log(
    `lint-card-class: clean — ${cssFiles.length} stylesheet(s) and ${tsxFiles.length} ` +
      `.tsx file(s) scanned, ${unbacked.size} grandfathered non-Card card class(es) remaining.`
  );
  return 0;
}

// Importable for the self-test; only the direct invocation exits.
if (process.argv[1] && import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
