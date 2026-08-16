#!/usr/bin/env node
// Fails CI when a top-level `<section>` in the marketing app has no stable
// identifier (brikdesigns#942).
//
// The convention: every hand-built `<section>` carries `data-section="<key>"`
// (or, when a visible heading already provides one, `aria-labelledby`). Without
// it, sibling sections collapse to the same generic utility classes — on
// /customers/[slug] all three topic sections render as
// `section.page-section.service-surface`, indistinguishable in devtools, so
// "change the 2nd one" is the only way to reference a section. An identifier
// makes each section addressable. See .claude/references/section-identification.md.
//
// Going-forward gate, not a big-bang backfill: existing un-identified sections
// are grandfathered in scripts/section-id-baseline.json as a per-file count.
// The gate is a ratchet — a new un-identified `<section>` pushes a file's count
// above its baseline and fails; paying debt below the baseline also fails, so
// the baseline can't silently overstate the remaining debt. Fully-converted
// files (baseline 0, or absent) must stay clean.
//
// Why parse source text rather than assert on a rendered page: the failure is a
// missing attribute in the JSX, caught at lint time on every commit without a
// browser, a build, or Supabase.
//
// Escape hatch: put `lint-section-id-ignore` in a comment inside the opening
// tag for a genuinely un-addressable section (e.g. a loading skeleton).
//
// Usage:
//   npm run lint:section-id
// Self-test:
//   npm run test:lint:section-id

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

export const SCAN_DIR = 'src/app/(marketing)';
export const BASELINE_PATH = 'scripts/section-id-baseline.json';

/** Walk a directory, returning every `.tsx` file path (posix-normalized). */
export function tsxFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...tsxFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.tsx')) out.push(full.split(path.sep).join('/'));
  }
  return out;
}

/** Extract the opening-tag text for every `<section …>` in `source`.
 *
 *  Scans from each `<section` to the first `>` at JSX-expression brace-depth 0,
 *  so `style={{…}}`, ternaries, and template literals that contain a `>` inside
 *  `{ }` don't end the tag early. Returns the raw tag strings (incl. attributes
 *  spanning multiple lines). */
export function sectionOpeningTags(source) {
  const tags = [];
  const re = /<section\b/g;
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

/** A section is identified if its opening tag declares `data-section` or
 *  `aria-labelledby`, or carries the inline ignore marker. */
export function isIdentified(tag) {
  return (
    /\bdata-section\s*=/.test(tag) ||
    /\baria-labelledby\s*=/.test(tag) ||
    /lint-section-id-ignore/.test(tag)
  );
}

/** Count of un-identified `<section>`s in one file's source. */
export function unidentifiedCount(source) {
  return sectionOpeningTags(source).filter((t) => !isIdentified(t)).length;
}

function main() {
  const files = tsxFiles(SCAN_DIR);
  if (files.length === 0) {
    console.error(
      `lint-section-id: found 0 .tsx files under ${SCAN_DIR} — the marketing app ` +
        `moved. Fix this path before trusting the gate.`
    );
    return 2;
  }

  let baseline = {};
  if (fs.existsSync(BASELINE_PATH)) {
    try {
      const raw = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
      // `files` is the map; a sibling `_comment` key documents the file (JSON
      // has no comments). A bare flat map is also accepted.
      baseline = raw.files ?? raw;
    } catch (err) {
      console.error(`lint-section-id: ${BASELINE_PATH} is not valid JSON — ${err.message}`);
      return 2;
    }
  }

  const problems = [];
  const seen = new Set();

  for (const file of files) {
    const count = unidentifiedCount(fs.readFileSync(file, 'utf8'));
    const allowed = baseline[file] ?? 0;
    seen.add(file);
    if (count > allowed) {
      problems.push(
        `${file}: ${count} un-identified <section>(s), baseline allows ${allowed}. ` +
          `Add \`data-section="<key>"\` to the new section(s), or (rarely) an inline ` +
          `\`lint-section-id-ignore\` comment.`
      );
    } else if (count < allowed) {
      problems.push(
        `${file}: ${count} un-identified <section>(s) but baseline still allows ${allowed}. ` +
          `You converted section(s) — lower this file's count in ${BASELINE_PATH} to ${count} ` +
          `(or remove the entry if 0) so the baseline can't overstate the debt.`
      );
    }
  }

  // A baseline entry for a file that no longer exists is stale debt that reads
  // as coverage — flag it so the ratchet stays honest.
  for (const file of Object.keys(baseline)) {
    if (!seen.has(file)) {
      problems.push(
        `${file}: listed in ${BASELINE_PATH} but no longer scanned (moved/deleted). ` +
          `Remove its baseline entry.`
      );
    }
  }

  if (problems.length > 0) {
    console.error(`lint-section-id: ${problems.length} problem(s):`);
    for (const p of problems) console.error(`  ${p}`);
    console.error(
      '\n  Every top-level marketing <section> needs a stable identifier so it ' +
        'is addressable in devtools and change requests. ' +
        'See .claude/references/section-identification.md (brikdesigns#942).'
    );
    return 1;
  }

  const debt = Object.values(baseline).reduce((a, b) => a + b, 0);
  console.log(
    `lint-section-id: clean — ${files.length} file(s) scanned, ` +
      `${debt} grandfathered un-identified section(s) remaining.`
  );
  return 0;
}

// Importable for the self-test; only the direct invocation exits.
if (process.argv[1] && import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
