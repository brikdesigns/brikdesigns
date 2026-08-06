#!/usr/bin/env node
// Font-weight lint gate for brikdesigns.com (composite-typography initiative).
//
// Weight must always reach the themed CSS cascade through the token layer, and
// every heading must be semibold via the shared heading-weight token. Two repos
// (portal + brikdesigns) drifted off this: literal `fontWeight: 700`, raw
// `var(--font-weight-*)` strings, and heading presets pinned to bold — the
// defect behind the /events/grind-after-graduation two-`<h2>`-at-600-vs-700 bug.
//
// Two fatal checks over `src/lib/styles.ts` + `src/**/*.tsx`:
//
//   (i)  A literal numeric `fontWeight:` (e.g. `fontWeight: 700`) OR a raw
//        `var(--font-weight-*)` string. Weight must come via `font.weight.*`
//        (the sanctioned token layer) — mirrors the "no raw var() in TS" rule.
//
//   (ii) A heading style object (`fontFamily: font.family.heading` or the raw
//        `'var(--font-family-heading)'` equivalent) whose `fontWeight` is not
//        the heading token — catches a heading drifting off semibold.
//
// Escape hatch (rare): add `/* lint-font-weight-ignore */` on the same line.
//
// Usage:
//   npm run lint:font-weight
//
// Why: composite-typography-token initiative, PR 4. Ships in the same change as
// the fix, per CLAUDE.md ("ship the gate in the same change as the fix").

import fs from 'node:fs';
import { glob } from 'glob';

const IGNORE = '/* lint-font-weight-ignore */';

// Check (i): literal numeric weight, or a raw --font-weight-* var string.
const LITERAL_RE = /fontWeight:\s*\d/;
const RAW_VAR_RE = /fontWeight:\s*['"`]var\(--font-weight-[^)]*\)['"`]/;

// Check (ii): a heading-family marker (typed token or raw var), and whether an
// object carries the heading weight token.
const HEADING_FAMILY_RE = /fontFamily:\s*(?:font\.family\.heading\b|['"`]var\(--font-family-heading\)['"`])/g;
const HEADING_WEIGHT_OK_RE = /fontWeight:\s*(?:font\.weight\.heading\b|['"`]var\(--font-weight-heading\)['"`])/;
const ANY_FONT_WEIGHT_RE = /fontWeight:\s*([^,\n}]+)/;

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

/** Return the enclosing `{ … }` object literal text around a char offset. */
function enclosingObject(text, idx) {
  let depth = 0;
  let start = -1;
  for (let k = idx; k >= 0; k--) {
    const c = text[k];
    if (c === '}') depth++;
    else if (c === '{') {
      if (depth === 0) { start = k; break; }
      depth--;
    }
  }
  let depth2 = 0;
  let end = -1;
  for (let k = idx; k < text.length; k++) {
    const c = text[k];
    if (c === '{') depth2++;
    else if (c === '}') {
      if (depth2 === 0) { end = k; break; }
      depth2--;
    }
  }
  if (start === -1 || end === -1) return null;
  return text.slice(start, end + 1);
}

const files = (await glob('src/**/*.{ts,tsx}', { ignore: ['**/*.d.ts', '**/node_modules/**'] }))
  .filter((f) => f.endsWith('.tsx') || f.replace(/\\/g, '/').endsWith('src/lib/styles.ts'))
  .sort();

const violations = [];

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n');

  // ── Check (i): per-line literal / raw-var weights ──
  lines.forEach((line, i) => {
    if (line.includes(IGNORE)) return;
    if (LITERAL_RE.test(line)) {
      violations.push({
        file, line: i + 1, kind: 'literal-weight', snippet: line.trim().slice(0, 100),
      });
    } else if (RAW_VAR_RE.test(line)) {
      violations.push({
        file, line: i + 1, kind: 'raw-var-weight', snippet: line.trim().slice(0, 100),
      });
    }
  });

  // ── Check (ii): heading objects must use the heading weight token ──
  let m;
  HEADING_FAMILY_RE.lastIndex = 0;
  while ((m = HEADING_FAMILY_RE.exec(text))) {
    const ln = lineOf(text, m.index);
    if (lines[ln - 1]?.includes(IGNORE)) continue;
    const obj = enclosingObject(text, m.index);
    if (!obj) continue;
    const fw = obj.match(ANY_FONT_WEIGHT_RE);
    // A heading object with an explicit non-heading weight is a violation.
    if (fw && !HEADING_WEIGHT_OK_RE.test(obj)) {
      violations.push({
        file, line: ln, kind: 'heading-off-token', snippet: fw[0].trim().slice(0, 100),
      });
    }
  }
}

if (violations.length === 0) {
  console.log(`OK — ${files.length} files scanned, weight always tokenized, headings semibold.`);
  process.exit(0);
}

console.error(`FAIL — ${violations.length} font-weight violation(s):\n`);
for (const v of violations) {
  console.error(`  ${v.file}:${v.line}  [${v.kind}]  ${v.snippet}`);
}
console.error('\nRules:');
console.error('  (i)  Weight must come via `font.weight.*` — no literal numbers,');
console.error('       no raw `--font-weight-*` var() strings in TS/TSX.');
console.error('  (ii) A heading (`fontFamily: font.family.heading`) must use');
console.error('       `font.weight.heading` — every heading is semibold.');
console.error('Escape hatch (rare): add `/* lint-font-weight-ignore */` on the same line.');
process.exit(1);
