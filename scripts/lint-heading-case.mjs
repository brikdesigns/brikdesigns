#!/usr/bin/env node
// Heading title-case lint gate for brikdesigns.com marketing pages (#491).
//
// #490 title-cased ~25 hardcoded marketing headings to match the site casing
// standard; this gate stops the next PR from silently regressing it. The
// canonical rule is BDS canon — brik-bds#910 / typography.mdx "Heading casing".
//
// Flags hardcoded sentence-case `<h1|h2|h3>` literals and `title="…"` props in
// marketing JSX where a major word is lowercased. Detection is heuristic:
//   - CMS-interpolated text ({…}) is skipped — editor-owned, not lintable here.
//   - Conversational / status / confirmation copy (ends in . ! ?) is skipped.
//   - Legitimate exceptions go in scripts/heading-case-allowlist.txt, or use an
//     inline `/* lint-heading-case-ignore */` comment on the same line.
//
// Usage:
//   npm run lint:heading-case
//
// Why: brikdesigns#491 (consumer-side gate for the #490 sweep), under #449.

import fs from 'node:fs';
import { glob } from 'glob';
import { findHeadingViolations, loadAllowlist } from './lib/heading-case.mjs';

const STANDARD_URL =
  'https://design.brikdesigns.com/docs/primitives/typography#heading-casing';

// Marketing JSX only. The route group dir is literally "(marketing)"; glob's
// paren handling is finicky, so glob broadly and filter by path.
const files = (await glob('src/**/*.tsx', { ignore: ['**/*.d.ts', '**/node_modules/**'] }))
  .filter((f) => f.includes('/(marketing)/') || f.includes('/components/marketing/'))
  .sort();

const allowlist = loadAllowlist();
const violations = [];
for (const file of files) {
  violations.push(...findHeadingViolations(fs.readFileSync(file, 'utf8'), file, allowlist));
}

if (violations.length === 0) {
  console.log(`OK — ${files.length} marketing files scanned, no sentence-case headings.`);
  process.exit(0);
}

console.error(`FAIL — ${violations.length} sentence-case heading(s) in marketing JSX:\n`);
for (const v of violations) {
  console.error(`  ${v.file}:${v.line}  [${v.kind}]  "${v.text}"`);
  console.error(`    lowercased major word(s): ${v.words.join(', ')}`);
}
console.error(`\nHeadings use title case — see ${STANDARD_URL} (brik-bds#910).`);
console.error('Fix options:');
console.error('  1. Title-case it: capitalize the first, last, and every major word.');
console.error('  2. If CMS-driven, render from data ({…}) instead of a literal — CMS copy is editor-owned.');
console.error('  3. Brand string / acronym exception: add the exact string to');
console.error('     scripts/heading-case-allowlist.txt, or put');
console.error('     `/* lint-heading-case-ignore */` on the same line.');
process.exit(1);
