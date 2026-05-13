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

// ─────────────────────────────────────────────────────────────────────────────
// Service-token family rule
//
// Canon (node_modules/@brikdesigns/bds/dist/tokens.css L980+):
//   --surface-service-{slug}    container surface (sections, cards, hero bands)
//   --background-service-{slug} component fill   (badges, tags, buttons, pills)
//   --border-service-{slug}     component border
//   --text-service-{slug}       text on any of the above
//
// `surface-*` and `background-*` resolve to the same color ramp with different
// intents — either compiles, the wrong family is silently wrong until canon
// shifts. This check enforces the choice at CI based on the CSS selector's
// last simple selector (the element actually being styled).
//
// Rule docs: .claude/references/service-token-decision-tree.md
// ─────────────────────────────────────────────────────────────────────────────

const SURFACE_KEYWORDS = [
  'section',
  'hero',
  'band',
  'callout',
  'panel',
  'surface',
  'container',
  'wrapper',
  'wrap',
];
const COMPONENT_KEYWORDS = [
  'tag',
  'badge',
  'pill',
  'btn',
  'button',
  'chip',
  'dot',
  'marker',
];

// Capture `--surface-service-foo` / `--background-service-foo` references.
// The slug stops at a non-name char so any modifier suffix (-on-light,
// -inverse, etc.) is part of the matched name but doesn't affect family.
const FAMILY_RE =
  /--(surface|background)-service-([a-z][a-z0-9-]*)/g;

const IGNORE_PRAGMA = /lint-tokens-ignore-family/;

// Pull the last simple selector out of a comma-list, ignoring pseudo-classes,
// attribute selectors, and combinators. `.hero .btn` → `.btn`; `.tag, .pill`
// → ['.tag', '.pill'].
export function lastSimpleSelectors(selector) {
  if (!selector) return [];
  return selector
    .split(',')
    .map((branch) =>
      branch
        .replace(/::?[a-z-]+(\([^)]*\))?/gi, '')
        .replace(/\[[^\]]*\]/g, '')
        .trim()
    )
    .map((branch) => {
      const parts = branch.split(/[\s>+~]+/);
      return (parts[parts.length - 1] || '').toLowerCase();
    })
    .filter(Boolean);
}

// Returns one of:
//   'surface'    — the last selector matches a surface keyword (section/hero/…)
//   'component'  — the last selector matches a component keyword (tag/badge/…)
//   'mixed'      — comma-list has both, or one branch hits both; ambiguous
//   'theme'      — :root / html / body / * — theme-level declarations
//   'at-rule'    — @media / @layer / @supports — pass through to inner rule
//   'neutral'    — no keyword match; opinion-free, skip
export function classifySelector(selector) {
  if (!selector) return 'neutral';
  const trimmed = selector.trim();
  if (!trimmed) return 'neutral';
  if (trimmed.startsWith('@')) return 'at-rule';
  if (/^(:root|html|body|\*)\b/i.test(trimmed)) return 'theme';

  const branches = lastSimpleSelectors(trimmed);
  if (branches.length === 0) return 'neutral';

  let surfaceHits = 0;
  let componentHits = 0;
  for (const branch of branches) {
    const hasSurface = SURFACE_KEYWORDS.some((k) => branch.includes(k));
    const hasComponent = COMPONENT_KEYWORDS.some((k) => branch.includes(k));
    if (hasSurface && hasComponent) return 'mixed';
    if (hasSurface) surfaceHits++;
    else if (hasComponent) componentHits++;
  }
  if (surfaceHits > 0 && componentHits > 0) return 'mixed';
  if (surfaceHits > 0) return 'surface';
  if (componentHits > 0) return 'component';
  return 'neutral';
}

// Walk CSS text tracking the current selector via a depth stack. For each
// declaration containing a service-family var() ref, check the family against
// the innermost selector's classification and emit a violation when they
// disagree.
//
// Flat CSS is fully handled. Nested CSS (Tailwind v4 / native nesting) works
// because the walker tracks the stack — the innermost selector wins.
//
// Two carve-outs:
//   1. Cascade setters — `--foo: var(--background-service-X)` defines a value
//      for downstream consumers, not a paint on the current element. Skipped.
//   2. Inline pragma — `/* lint-tokens-ignore-family */` on the same line as
//      the var() ref suppresses the check for that line.
export function findFamilyViolations(file, text) {
  const violations = [];

  // Replace comments with whitespace (preserving newlines) so the walker
  // ignores them without losing line accuracy. The escape-hatch pragma is
  // detected later from the ORIGINAL text, so this strip is safe.
  const stripped = text.replace(/\/\*[\s\S]*?\*\//g, (m) =>
    m.replace(/[^\n]/g, ' ')
  );
  const originalLines = text.split('\n');

  const stack = []; // entries: { selector, classification }
  let buffer = '';
  let line = 1;
  let buffStartLine = null; // set on first non-whitespace char of each decl

  function currentContext() {
    for (let i = stack.length - 1; i >= 0; i--) {
      const s = stack[i];
      if (s.classification === 'surface' || s.classification === 'component') {
        return s;
      }
      // First concrete selector that isn't surface/component → no opinion;
      // don't bubble past it to a grandparent.
      if (s.classification !== 'at-rule') return null;
    }
    return null;
  }

  function flushDeclaration(declText, declLine) {
    if (!declText.includes('var(--')) return;
    const ctx = currentContext();
    if (!ctx) return;

    // Cascade setters (LHS is a CSS custom property) are exempt from the
    // family rule. The element doesn't paint with the value; it defines a
    // variable for a downstream consumer to paint with. Example:
    //   .hero-wrap { --background-inverse: var(--background-service-X-inverse); }
    // Here `.hero-wrap` isn't using `--background-service-*` as its own
    // background — it's relaying it to a child CTA. The family appropriate
    // to that child is what matters, not the wrapper's classification.
    const colonIdx = declText.indexOf(':');
    if (colonIdx !== -1) {
      const propName = declText.slice(0, colonIdx).trim();
      if (propName.startsWith('--')) return;
    }

    for (const m of declText.matchAll(FAMILY_RE)) {
      const family = m[1]; // 'surface' | 'background'
      const slug = m[2];
      const expected =
        ctx.classification === 'surface' ? 'surface' : 'background';
      if (family === expected) continue;

      const sourceLine = originalLines[declLine - 1] || '';
      if (IGNORE_PRAGMA.test(sourceLine)) continue;

      violations.push({
        file,
        line: declLine,
        selector: ctx.selector,
        classification: ctx.classification,
        actualFamily: family,
        expectedFamily: expected,
        slug,
        token: `--${family}-service-${slug}`,
        suggestedToken: `--${expected}-service-${slug}`,
        snippet: sourceLine.trim().slice(0, 120),
      });
    }
  }

  for (let i = 0; i < stripped.length; i++) {
    const ch = stripped[i];

    if (ch === '{') {
      const rawSel = buffer.trim().replace(/\s+/g, ' ');
      stack.push({ selector: rawSel, classification: classifySelector(rawSel) });
      buffer = '';
      buffStartLine = null;
    } else if (ch === '}') {
      flushDeclaration(buffer, buffStartLine ?? line);
      stack.pop();
      buffer = '';
      buffStartLine = null;
    } else if (ch === ';') {
      flushDeclaration(buffer, buffStartLine ?? line);
      buffer = '';
      buffStartLine = null;
    } else {
      if (buffStartLine === null && ch !== '\n' && ch !== ' ' && ch !== '\t') {
        buffStartLine = line;
      }
      buffer += ch;
    }

    if (ch === '\n') line++;
  }

  return violations;
}
