#!/usr/bin/env node
// Diff-aware pre-commit lint gating (ADR-040 slice 1 / brikdesigns#1280).
//
// The token / hardcoded / heading / section lints scan the whole `src/` tree on
// every commit, so a `class:content` edit (a data-object tweak, a copy string, a
// `public/` asset — no CSS, no structure) still pays a full CSS/token/heading/
// section scan it cannot possibly affect. That flat cost is what ADR-040
// fast-paths.
//
// This module is the single source of truth for WHICH of those four lints a
// staged diff warrants. `.husky/pre-commit` pipes the staged file list to the
// CLI below and runs only the named lints; a content-only commit runs none of
// the four. gitleaks + image-budget (and the other floors) are never gated here
// — they are ADR-040 invariant floors — and CI (verify.yml) always runs the
// full-tree lints regardless, so this only trims the LOCAL pre-commit path.
//
// Each lint gates on the file types it actually scans, keyed to the ratified
// ADR-040 decision row ("skip CSS/token lints when no `.css`/style `.ts`
// changed"):
//   • tokens    — .css or a style `.ts` (styles.ts / tokens.ts / *.styles.ts)
//   • hardcoded — .css
//   • heading   — a marketing .tsx (src/**/(marketing)/ or components/marketing/)
//   • section   — a .tsx under src/app/(marketing)/
//
// A raw `var(--…)` typo introduced in a .tsx inline style is the one case this
// skips locally (the ratified row keys the token skip to .css/style .ts, not
// .tsx); verify.yml's unconditional `lint:tokens` is the backstop for it.
//
// Usage (CLI): newline-separated staged paths on stdin, space-separated lint
// keys on stdout.
//   git diff --cached --name-only --diff-filter=ACM | node scripts/lib/diff-aware-lints.mjs
// Self-test:
//   npm run test:lint:diff-aware

import url from 'node:url';

/** The four lints this gate governs, in pre-commit run order. */
export const GATED_LINTS = ['tokens', 'hardcoded', 'heading', 'section'];

const norm = (p) => p.replace(/\\/g, '/').trim();

/** A CSS file the token / hardcoded scans read (any `.css` under `src/`). */
export const isCss = (p) => norm(p).startsWith('src/') && norm(p).endsWith('.css');

/** A "style `.ts`" per the change-class definition — the token layer, not data.
 *  The two that exist are src/lib/styles.ts and src/lib/tokens.ts; `*.styles.ts`
 *  is matched too so a future co-located style module is covered. */
export const isStyleTs = (p) => {
  const f = norm(p);
  return f === 'src/lib/styles.ts' || f === 'src/lib/tokens.ts' || f.endsWith('.styles.ts');
};

/** A marketing `.tsx` the heading-case scan reads (its own path filter). */
export const isMarketingTsx = (p) => {
  const f = norm(p);
  return f.endsWith('.tsx') && (f.includes('/(marketing)/') || f.includes('/components/marketing/'));
};

/** A `.tsx` under the section-id scan root, src/app/(marketing)/. */
export const isSectionTsx = (p) => {
  const f = norm(p);
  return f.endsWith('.tsx') && f.startsWith('src/app/(marketing)/');
};

/** Which of GATED_LINTS the staged `paths` warrant, in run order. */
export function lintsForStagedFiles(paths) {
  const files = (paths ?? []).map(norm).filter(Boolean);
  const anyCss = files.some(isCss);
  const anyStyleTs = files.some(isStyleTs);
  const run = new Set();
  if (anyCss || anyStyleTs) run.add('tokens');
  if (anyCss) run.add('hardcoded');
  if (files.some(isMarketingTsx)) run.add('heading');
  if (files.some(isSectionTsx)) run.add('section');
  return GATED_LINTS.filter((k) => run.has(k));
}

async function readStdin() {
  let s = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) s += chunk;
  return s;
}

async function main() {
  const argvPaths = process.argv.slice(2);
  const raw = argvPaths.length ? argvPaths.join('\n') : await readStdin();
  const paths = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  const lints = lintsForStagedFiles(paths);
  if (lints.length) process.stdout.write(lints.join(' ') + '\n');
}

// Importable for the self-test; only direct invocation runs the CLI.
if (process.argv[1] && import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  main();
}
