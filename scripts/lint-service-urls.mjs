#!/usr/bin/env node
// Static smoke check for hardcoded `/services/*` URLs.
//
// Fails CI when a hardcoded URL points at a non-canonical category slug —
// specifically the long-form Webflow slugs (brand-design / marketing-design /
// information-design / product-design / back-office-design) that DO NOT
// resolve under the Next.js dynamic route `/services/[categorySlug]`. The
// Supabase `service_lines.slug` schema is short-form (brand / marketing /
// information / product / service).
//
// brikdesigns#113 was caused by 6 hardcoded references using the old
// Webflow long-form slugs. This check would have caught all of them.
//
// Scope: hardcoded string literals only. Template strings interpolating
// runtime values (e.g. `/services/${slug}`) are skipped — the dynamic
// values come from Supabase, which is already the source of truth.
//
// Usage:
//   npm run lint:service-urls

import fs from 'node:fs';
import { glob } from 'glob';

// Canonical Supabase `service_lines.slug` values. Source of truth:
// `service_lines` table in the shared Supabase project (mirrored in
// scripts/audit-supabase-drift.ts SERVICE_LINE_ALIASES values).
const CANONICAL_SLUGS = new Set([
  'brand',
  'marketing',
  'information',
  'product',
  'service',
]);

// Long-form Webflow slugs — explicitly named so the error message can suggest
// the correct short-form. Anything else (typos, future renames) gets a
// generic "not in canonical set" error.
const WEBFLOW_TO_CANONICAL = {
  'brand-design': 'brand',
  'marketing-design': 'marketing',
  'information-design': 'information',
  'product-design': 'product',
  'back-office-design': 'service',
};

// Match `/services/<slug>` and `/services/<slug>/<slug>` inside string
// literals (single or double quotes). Excludes template strings — those
// interpolate at runtime and are out of scope here.
const URL_RE =
  /['"]\/services\/([a-z][a-z0-9-]*)(?:\/([a-z][a-z0-9-]*))?['"]/g;

const files = await glob('src/**/*.{ts,tsx}', {
  ignore: ['**/*.d.ts', '**/node_modules/**'],
});

const violations = [];

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n');
  lines.forEach((line, idx) => {
    for (const m of line.matchAll(URL_RE)) {
      const categorySlug = m[1];
      const serviceSlug = m[2]; // may be undefined
      const url = `/services/${categorySlug}${serviceSlug ? `/${serviceSlug}` : ''}`;

      if (CANONICAL_SLUGS.has(categorySlug)) continue;

      const suggested = WEBFLOW_TO_CANONICAL[categorySlug];
      violations.push({
        file,
        line: idx + 1,
        url,
        categorySlug,
        suggested,
        snippet: line.trim().slice(0, 120),
      });
    }
  });
}

if (violations.length === 0) {
  console.log(`OK — ${files.length} files scanned, no broken /services/* URLs.`);
  process.exit(0);
}

console.error(`FAIL — ${violations.length} hardcoded /services/* URL(s) point at non-canonical category slugs:\n`);
for (const v of violations) {
  console.error(`  ${v.file}:${v.line}`);
  console.error(`    URL: ${v.url}`);
  console.error(`    Category slug "${v.categorySlug}" is not a canonical Supabase service_lines.slug.`);
  if (v.suggested) {
    console.error(`    Suggestion: use /services/${v.suggested} instead (this is the Webflow long-form → short-form rename).`);
  } else {
    console.error(`    Canonical category slugs: ${[...CANONICAL_SLUGS].join(', ')}`);
  }
  console.error(`    Source: ${v.snippet}`);
  console.error('');
}
console.error(
  'Note: only hardcoded string literals are checked. Template strings\n' +
  'interpolating runtime values (e.g. `/services/${slug}`) are skipped\n' +
  '— Supabase is the source of truth for those.\n'
);
process.exit(1);
