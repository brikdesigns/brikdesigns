#!/usr/bin/env node
// Fails CI when something read-only is called a "chip" (brikdesigns#1395).
//
// In Brik, `Chip` names ONE component: the interactive pill for filter toggles,
// selections, removable tokens and dropdown triggers. It renders only when
// `onChipClick`, `onRemove`, or `showDropdown` is wired up. Everything else
// pill-shaped is a read-only INDICATOR — `Tag` (categorization), `Badge`
// (semantic status), `Dot`, `Counter`, `ServiceTag`. The discriminator is one
// question: does clicking it change anything?
//
// The canon was never missing. Chip.mdx has said "Chip is interactive only"
// since v0.66, prop-axes.mdx encodes the Indicators-vs-Interactions split, and
// both retrieve at rank 1 in brik-rag. What was missing is anything that fires
// the query at NAMING time — so "chip" kept arriving from a mockup, surviving
// into a code comment, and settling into a classname. This repo imports BDS
// `Chip` zero times and still ships two hand-rolled `*__chip` families.
//
// That matters beyond vocabulary: a hand-rolled pill carries chrome the
// indicator components already own, and it is invisible to every gate that
// measures indicators, because those can only measure a component that
// rendered.
//
// What is judged, in two arms:
//
//  1. CLASSNAME — a class with `chip` as a `-`/`_`-delimited word, DEFINED in a
//     stylesheet under src/ and APPLIED via `className` in .tsx, in a repo with
//     no BDS `Chip` import. Both halves are required so a never-applied
//     leftover and a name that only appears in prose are not mistaken for a
//     shipped pill. `bds-*` is excluded — those are BDS-owned classes this repo
//     only overrides.
//
//  2. COMMENT — the word `chip` inside a comment, in a file that does not
//     import BDS `Chip`, UNLESS that same comment also names an indicator
//     (`Tag` / `Badge` / `Dot` / `Counter` / `ServiceTag`). The exemption is
//     load-bearing, not a loophole: a comment that says "Tag, not a chip" is
//     the behaviour this gate wants, and flagging it would punish the one
//     correct-usage precedent in the tree (PlanCoverageRow.tsx). A comment that
//     calls the thing a chip with no indicator in sight is the drift.
//
// Going-forward gate, not a big-bang rename: #1395 puts migrating the existing
// `*__chip` classnames out of scope — flag in place, rename when those files
// are next touched. The existing occurrences are grandfathered in
// scripts/indicator-vocabulary-baseline.json as a key → reason map, so each
// keep carries its justification where the next reader will look. The ratchet
// moves one way only: a new offender fails, and a baselined entry that has
// since been renamed or deleted ALSO fails, so the baseline cannot silently
// overstate the remaining debt.
//
// Canon: brik-bds/docs-site/content/docs/build-standards/indicators.mdx
//        (design.brikdesigns.com/docs/build-standards/indicators)
//        the `design-decisions` skill § Indicators — the agent-loaded mirror
//
// Usage:
//   npm run lint:indicator-vocabulary
// Self-test:
//   npm run test:lint:indicator-vocabulary

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

export const SCAN_DIR = 'src';
export const BASELINE_PATH = 'scripts/indicator-vocabulary-baseline.json';

/** The read-only indicators `chip` gets misused for. Naming one of these in a
 *  comment is what distinguishes "Tag, not a chip" from "the chip". */
export const INDICATORS = ['Tag', 'Badge', 'Dot', 'Counter', 'ServiceTag'];

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

/** Does this class name read as a chip? `chip` must appear as a whole
 *  `-`/`_`-delimited word — so `mode__chip` and `chip-icon` match, while
 *  `chipboard` and `microchip` do not. Mirrors lint-card-class.mjs's
 *  `isCardName`. */
export function isChipWord(name) {
  return /(?:^|[-_])chip(?:[-_]|$)/i.test(name);
}

/** A judged class name: reads as a chip, and is not a BDS-owned `bds-*` name.
 *  BEM elements and modifiers ARE judged here — unlike lint-card-class, where
 *  a `__element` belongs to its block. `.engagement-mode__chip` puts the wrong
 *  word in the ELEMENT, so judging blocks only would miss every real case. */
export function isJudgedClass(name) {
  return isChipWord(name) && !name.startsWith('bds-');
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
 *  own preludes, so nothing is missed. Mirrors lint-card-class.mjs. */
export function definedClasses(source) {
  const names = new Set();
  for (const m of stripCssComments(source).matchAll(/([^{}]+)\{/g)) {
    const prelude = m[1];
    if (prelude.includes('@')) continue;
    for (const c of prelude.matchAll(/\.(-?[A-Za-z_][\w-]*)/g)) names.add(c[1]);
  }
  return names;
}

/** Class names appearing in a `className` value in `source`.
 *
 *  Deliberately loose: it takes every `className=…` value — string literal,
 *  template literal, ternary, or array `.join()` — and harvests the bare words
 *  out of it, trimming trailing BEM separators left by an interpolated
 *  modifier. Mirrors lint-card-class.mjs. */
export function appliedClasses(source) {
  const names = new Set();
  for (const m of source.matchAll(/className\s*=\s*(?:"([^"]*)"|\{([\s\S]*?)\}(?=\s|\/|>|$))/g)) {
    const body = m[1] ?? m[2] ?? '';
    for (const w of body.matchAll(/[A-Za-z_][\w-]*/g)) {
      const name = w[0].replace(/[-_]+$/, '');
      if (name) names.add(name);
    }
  }
  return names;
}

/** Does this file import `Chip` from BDS?
 *
 *  Matches a `Chip` specifier — bare, aliased, or `type`-prefixed — inside an
 *  import whose source is `@brikdesigns/bds…`. A file that genuinely renders a
 *  Chip is entitled to the word, in its classnames and its comments alike. */
export function importsBdsChip(source) {
  for (const m of source.matchAll(/import\s+([\s\S]*?)\s+from\s+['"](@brikdesigns\/bds[^'"]*)['"]/g)) {
    if (/\bChip\w*\b/.test(m[1])) return true;
  }
  return false;
}

/** Every comment in `source`, as text — CSS/JS block comments and JS line
 *  comments.
 *
 *  Line comments stop at the newline. A `//` inside a string or a URL is
 *  harvested as a comment too; that over-reach is harmless here, because the
 *  only thing read out of a comment is whether it contains the word `chip`. */
export function commentsIn(source) {
  const out = [];
  for (const m of source.matchAll(/\/\*[\s\S]*?\*\//g)) out.push(m[0]);
  for (const m of source.matchAll(/\/\/[^\n]*/g)) out.push(m[0]);
  return out;
}

/** Does this comment name a read-only indicator? If so it is drawing the
 *  distinction rather than getting it wrong, and is exempt. */
export function namesAnIndicator(comment) {
  return INDICATORS.some((n) => new RegExp(`\\b${n}\\b`).test(comment));
}

/** The comments in `source` that use the word `chip` without naming an
 *  indicator — the drift this arm catches. */
export function offendingComments(source) {
  return commentsIn(source).filter((c) => /\bchips?\b/i.test(c) && !namesAnIndicator(c));
}

function loadBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) return { classnames: {}, comments: {} };
  const raw = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
  return { classnames: raw.classnames ?? {}, comments: raw.comments ?? {} };
}

function main() {
  const cssFiles = filesWithExt(SCAN_DIR, ['.css']);
  const codeFiles = filesWithExt(SCAN_DIR, ['.tsx', '.ts']);
  if (cssFiles.length === 0 || codeFiles.length === 0) {
    console.error(
      `lint-indicator-vocabulary: found ${cssFiles.length} .css and ${codeFiles.length} ` +
        `.tsx/.ts file(s) under ${SCAN_DIR} — the source tree moved. Fix this path ` +
        `before trusting the gate.`
    );
    return 2;
  }

  let baseline;
  try {
    baseline = loadBaseline();
  } catch (err) {
    console.error(`lint-indicator-vocabulary: ${BASELINE_PATH} is not valid JSON — ${err.message}`);
    return 2;
  }

  // name → the stylesheet(s) that define it, for the failure message.
  const definedIn = new Map();
  for (const file of cssFiles) {
    for (const name of definedClasses(fs.readFileSync(file, 'utf8'))) {
      if (!isJudgedClass(name)) continue;
      if (!definedIn.has(name)) definedIn.set(name, []);
      definedIn.get(name).push(file);
    }
  }

  // name → the .tsx/.ts file(s) that apply it, and whether EVERY one of them
  // imports BDS `Chip`. Per-applying-file, not repo-wide: one file rendering a
  // real Chip must not launder a hand-rolled pill in a different file.
  const appliedIn = new Map();
  const commentOffenders = new Map(); // file → count
  for (const file of codeFiles) {
    const source = fs.readFileSync(file, 'utf8');
    const importsChip = importsBdsChip(source);
    for (const n of appliedClasses(source)) {
      if (!appliedIn.has(n)) appliedIn.set(n, []);
      appliedIn.get(n).push({ file, importsChip });
    }
    if (importsChip) continue; // entitled to the word
    const bad = offendingComments(source);
    if (bad.length > 0) commentOffenders.set(file, bad.length);
  }
  // Stylesheets carry comments too, and cannot import anything.
  for (const file of cssFiles) {
    const bad = offendingComments(fs.readFileSync(file, 'utf8'));
    if (bad.length > 0) commentOffenders.set(file, bad.length);
  }

  const problems = [];
  const liveClassnames = new Set();
  const liveComments = new Set();

  for (const [name, files] of definedIn) {
    const sites = appliedIn.get(name);
    if (!sites) continue; // defined but never applied — not a pill in use
    // Earned only if EVERY applying file renders a real BDS Chip. One file that
    // does must not launder a hand-rolled pill applied in another.
    const unearned = sites.filter((s) => !s.importsChip);
    if (unearned.length === 0) continue;
    liveClassnames.add(name);
    if (name in baseline.classnames) continue; // grandfathered, with its reason recorded
    problems.push(
      `.${name} (defined in ${files.join(', ')}) is applied in ` +
        `${unearned.map((s) => s.file).join(', ')}, which do not import BDS \`Chip\`. ` +
        `A read-only pill is a \`Tag\` (categorization) or a \`Badge\` (semantic ` +
        `status) — \`Chip\` is the interactive one. Rename it, or add it to ` +
        `${BASELINE_PATH} with the reason.`
    );
  }

  for (const [file, count] of commentOffenders) {
    liveComments.add(file);
    if (file in baseline.comments) continue;
    problems.push(
      `${file} calls something a "chip" in ${count} comment(s) without naming an ` +
        `indicator, and does not import BDS \`Chip\`. Say \`Tag\` or \`Badge\` — or, ` +
        `if the comment is drawing the Chip/indicator distinction, name the ` +
        `indicator in it. Otherwise add the file to ${BASELINE_PATH} with the reason.`
    );
  }

  // A baselined entry that no longer offends is stale debt that reads as
  // coverage — flag it so the ratchet stays honest and can only move down.
  for (const name of Object.keys(baseline.classnames)) {
    if (liveClassnames.has(name)) continue;
    problems.push(
      `.${name} is listed in ${BASELINE_PATH} (classnames) but is no longer ` +
        `defined-and-applied. Remove its entry so the baseline cannot overstate ` +
        `the remaining debt.`
    );
  }
  for (const file of Object.keys(baseline.comments)) {
    if (liveComments.has(file)) continue;
    problems.push(
      `${file} is listed in ${BASELINE_PATH} (comments) but no longer has an ` +
        `offending comment. Remove its entry so the baseline cannot overstate ` +
        `the remaining debt.`
    );
  }

  if (problems.length > 0) {
    console.error(`lint-indicator-vocabulary: ${problems.length} problem(s):`);
    for (const p of problems) console.error(`  ${p}`);
    console.error(
      '\n  "Chip" names ONE component — the interactive pill (filter toggle, ' +
        'selection, removable token, dropdown trigger). Read-only pills are ' +
        '`Tag` / `Badge` / `Dot` / `Counter` / `ServiceTag`. The discriminator: ' +
        'does clicking it change anything?\n' +
        '  Canon: design.brikdesigns.com/docs/build-standards/indicators — or ' +
        'the `design-decisions` skill § Indicators (brikdesigns#1395).'
    );
    return 1;
  }

  console.log(
    `lint-indicator-vocabulary: clean — ${cssFiles.length} stylesheet(s) and ` +
      `${codeFiles.length} .tsx/.ts file(s) scanned, ${liveClassnames.size} ` +
      `grandfathered classname(s) and ${liveComments.size} grandfathered file(s) ` +
      `with chip prose remaining.`
  );
  return 0;
}

// Importable for the self-test; only the direct invocation exits.
if (process.argv[1] && import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}

export { main };
