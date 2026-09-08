#!/usr/bin/env node
// Self-test for the diff-aware lint gate (ADR-040 slice 1 / brikdesigns#1280).
//
// The gate's whole value is that a content-only commit runs NONE of the four
// heavy lints while a .css / .tsx commit still runs the ones that can catch a
// regression. So the cases below pin exactly which staged file types warrant
// each lint, in both directions — the motivating home-tooling.ts case skips all
// four, a .css edit runs the CSS/token pair, marketing .tsx runs heading +
// section. The last case exercises the CLI so the hook's actual invocation path
// stays honest.
//
// The token/hardcoded skip is keyed to the ratified ADR-040 decision row
// ("skip CSS/token lints when no `.css`/style `.ts` changed"), NOT to the .tsx
// domain — hence a .tsx-only edit does not run the token lint here; verify.yml's
// unconditional lint:tokens is the backstop.
//
// Plain node:assert, no framework. Run via `npm run test:lint:diff-aware`.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { lintsForStagedFiles, GATED_LINTS } from './diff-aware-lints.mjs';

const tests = [];
const failures = [];
const test = (name, fn) => tests.push({ name, fn });
const eq = (paths, expected) =>
  assert.deepEqual(lintsForStagedFiles(paths), expected);

test('empty staged list runs nothing', () => {
  eq([], []);
});

test('the motivating case — a data .ts edit (home-tooling.ts) runs nothing', () => {
  eq(['src/lib/home-tooling.ts'], []);
});

test('a public/ asset add runs nothing', () => {
  eq(['public/logos/acme.webp'], []);
});

test('a docs/markdown edit runs nothing', () => {
  eq(['README.md', '.claude/references/change-class.md'], []);
});

test('a .css edit runs tokens + hardcoded', () => {
  eq(['src/app/globals.css'], ['tokens', 'hardcoded']);
});

test('a style .ts edit (styles.ts) runs tokens but NOT hardcoded', () => {
  eq(['src/lib/styles.ts'], ['tokens']);
});

test('tokens.ts is a style .ts too', () => {
  eq(['src/lib/tokens.ts'], ['tokens']);
});

test('a marketing .tsx edit runs heading + section, not tokens', () => {
  eq(['src/app/(marketing)/page.tsx'], ['heading', 'section']);
});

test('a marketing component .tsx runs heading only (outside the section root)', () => {
  eq(['src/components/marketing/Hero.tsx'], ['heading']);
});

test('a non-marketing component .tsx runs none of the four', () => {
  // The token skip is keyed to .css/style .ts, so an inline var() typo here is
  // the ratified local blind spot — CI's lint:tokens is the backstop.
  eq(['src/components/ui/Button.tsx'], []);
});

test('a mixed content + css commit runs the css pair (and any .tsx lints)', () => {
  eq(
    ['src/lib/home-tooling.ts', 'src/app/globals.css', 'src/app/(marketing)/page.tsx'],
    ['tokens', 'hardcoded', 'heading', 'section']
  );
});

test('output preserves the canonical run order', () => {
  // section listed before heading in the input must still come out heading→section.
  const out = lintsForStagedFiles([
    'src/app/(marketing)/page.tsx',
    'src/components/marketing/Hero.tsx',
    'src/app/globals.css',
  ]);
  assert.deepEqual(out, GATED_LINTS);
});

test('CLI reads stdin and prints space-separated keys', () => {
  const r = spawnSync(process.execPath, ['scripts/lib/diff-aware-lints.mjs'], {
    input: 'src/app/globals.css\nsrc/lib/home-tooling.ts\n',
    encoding: 'utf8',
  });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), 'tokens hardcoded');
});

test('CLI prints nothing for a content-only staged list', () => {
  const r = spawnSync(process.execPath, ['scripts/lib/diff-aware-lints.mjs'], {
    input: 'src/lib/home-tooling.ts\npublic/logos/acme.webp\n',
    encoding: 'utf8',
  });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), '');
});

for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failures.push({ name, err });
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message.split('\n').join('\n    ')}`);
  }
}

console.log(`\ndiff-aware-lints.test: ${tests.length - failures.length}/${tests.length} passed`);
process.exit(failures.length > 0 ? 1 : 0);
