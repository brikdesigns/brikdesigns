// Shared helpers for token-lint: extract declared `--name` tokens from BDS dist
// + project-local globals.css, plus the transitional allowlist for tokens we
// know are invented but haven't migrated yet.
//
// Used by:
//   - scripts/lint-tokens.mjs (CLI gate, runs in CI)
//   - scripts/lib/eslint-brik-tokens.mjs (in-editor feedback)

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

export const PATHS = {
  bdsTokens: path.join(ROOT, 'node_modules/@brikdesigns/bds/dist/tokens.css'),
  globals: path.join(ROOT, 'src/app/globals.css'),
  allowlist: path.join(ROOT, 'scripts/tokens-allowlist.txt'),
};

export function readDeclaredTokens(file) {
  if (!fs.existsSync(file)) return new Set();
  const text = fs.readFileSync(file, 'utf8');
  const names = new Set();
  for (const m of text.matchAll(/^\s*(--[a-z][a-z0-9-]*)\s*:/gim)) {
    names.add(m[1]);
  }
  return names;
}

export function readAllowlist() {
  if (!fs.existsSync(PATHS.allowlist)) return new Set();
  return new Set(
    fs
      .readFileSync(PATHS.allowlist, 'utf8')
      .split('\n')
      .map((l) => l.replace(/#.*$/, '').trim())
      .filter(Boolean)
      .map((l) => (l.startsWith('--') ? l : `--${l}`))
  );
}

export function loadTokenSets() {
  const canonical = readDeclaredTokens(PATHS.bdsTokens);
  if (canonical.size === 0) {
    throw new Error(
      `Canonical tokens not found at ${PATHS.bdsTokens}. Run \`npm install\` first.`
    );
  }
  return {
    canonical,
    projectLocal: readDeclaredTokens(PATHS.globals),
    allowlist: readAllowlist(),
  };
}

// Match `var(--name)` and `var(--name, fallback)`. Captures the bare name
// including the leading `--`. `matchAll` clones internally, so a shared
// regex instance is safe.
export const VAR_RE = /var\(\s*(--[a-zA-Z][\w-]*)/g;

export function findVarRefs(text) {
  const refs = [];
  for (const m of text.matchAll(VAR_RE)) {
    refs.push({ name: m[1], index: m.index });
  }
  return refs;
}

export function isViolation(name, { canonical, projectLocal, allowlist }) {
  return !canonical.has(name) && !projectLocal.has(name) && !allowlist.has(name);
}
