#!/usr/bin/env node
// Fails CI when a top-level `<section>` in the marketing app, or in the shared
// landing blocks it renders through, has no stable identifier (brikdesigns#942,
// scope widened in #1420).
//
// The convention: every hand-built `<section>` carries `data-section="<key>"`
// (or, when a visible heading already provides one, `aria-labelledby`). Without
// it, sibling sections collapse to the same generic utility classes — on
// /industries/[slug] all three topic sections render as
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

// Both trees that emit a page-level `<section>`.
//
// `src/components/blocks` was outside the scan until #1420, and the gap did not
// read as a gap: a block-rendered landing route emits every `<section>` from
// there, so `/offers/brikdown` rendered ZERO identifiers while this gate said
// "clean" and the baseline listed no debt for it. Un-scanned is not the same as
// grandfathered — grandfathered debt is counted and drains; un-scanned debt is
// invisible in both directions. New files default to a baseline of 0, so every
// section in the new tree had to ship identified.
export const SCAN_DIRS = ['src/app/(marketing)', 'src/components/blocks'];
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

/** Strip block comments so a `<section>` written in prose isn't counted as one.
 *
 *  Both trees document themselves heavily, and two JSDoc blocks in
 *  `src/components/blocks` describe what a BDS blueprint "renders its own
 *  `<section>`" for. Those read to the parser as real un-identified sections,
 *  which is not a cosmetic miscount: the ratchet compares against a baseline, so
 *  a phantom inflates a file's allowance and hides a real one added later behind
 *  it. `services/[serviceLineSlug]/[serviceSlug]/page.tsx` carried a baseline of
 *  3 for a file with 1 section (#1420).
 *
 *  Comments carrying the escape hatch are preserved. The documented way to
 *  exempt a section puts the `lint-section-id-ignore` marker in a block comment
 *  INSIDE the opening tag, so a blanket strip would silently disarm it — the
 *  gate would then read the tag as plain and start failing the file it was told
 *  to skip.
 *
 *  Line comments are deliberately left alone. A double-slash also opens every
 *  URL, and no `<section` mention in either scanned tree sits in a line comment
 *  — ripgrepping both trees for one returned empty on 2026-09-11. Stripping
 *  them would buy nothing and risk cutting a `https:` or protocol-relative URL
 *  mid-string. */
export function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, (match) =>
    match.includes('lint-section-id-ignore') ? match : ' '
  );
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
  return sectionOpeningTags(stripComments(source)).filter((t) => !isIdentified(t)).length;
}

function main() {
  // Checked per directory, not on the union: one empty tree in a two-tree scan
  // would otherwise be absorbed by the other's file count — the exact shape of
  // failure this gate had before #1420, where a whole tree was silently absent.
  const files = [];
  for (const dir of SCAN_DIRS) {
    const found = tsxFiles(dir);
    if (found.length === 0) {
      console.error(
        `lint-section-id: found 0 .tsx files under ${dir} — that tree moved. ` +
          `Fix this path before trusting the gate.`
      );
      return 2;
    }
    files.push(...found);
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
      '\n  Every top-level <section> — on a marketing page or in the shared ' +
        'landing blocks — needs a stable identifier so it is addressable in ' +
        'devtools, in change requests, and to the figma-parity gate (#1392). ' +
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
