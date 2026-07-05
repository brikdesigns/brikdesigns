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
// Rule 5: Token-family ↔ property pairing
//
// Flags `var(--TOKEN)` uses where the token's family doesn't match the
// property's allowlist. Three shapes:
//
//   CSS property:           background-color: var(--text-foo);
//   CSS custom-property:   --background-inverse: var(--text-foo);
//   TSX inline-style:      style={{ backgroundColor: 'var(--text-foo)' }}
//
// Mirrors brik-bds/scripts/lint-tokens.js Rule 5 (brik-bds#578 / #778).
// ─────────────────────────────────────────────────────────────────────────────

const TOKEN_FAMILY_RULES = {
  'background-color': {
    allowed: ['--background-', '--surface-'],
    label: 'background',
    suggestion: 'use a --background-* or --surface-* token',
  },
  'background': {
    allowed: ['--background-', '--surface-'],
    label: 'background',
    suggestion: 'use a --background-* or --surface-* token',
  },
  'color': {
    allowed: ['--text-', '--color-'],
    label: 'text',
    suggestion: 'use a --text-* token or a --color-* primitive',
  },
  'border-color': {
    allowed: ['--border-', '--background-'],
    label: 'border',
    suggestion: 'use a --border-* token (or matching --background-* for fill-style borders)',
  },
  'border-top-color': {
    allowed: ['--border-', '--background-'],
    label: 'border',
    suggestion: 'use a --border-* token',
  },
  'border-bottom-color': {
    allowed: ['--border-', '--background-'],
    label: 'border',
    suggestion: 'use a --border-* token',
  },
  'border-left-color': {
    allowed: ['--border-', '--background-'],
    label: 'border',
    suggestion: 'use a --border-* token',
  },
  'border-right-color': {
    allowed: ['--border-', '--background-'],
    label: 'border',
    suggestion: 'use a --border-* token',
  },
  'outline-color': {
    allowed: ['--border-'],
    label: 'outline',
    suggestion: 'use a --border-* token',
  },
};

const TSX_STYLE_PROP_TO_CSS = {
  backgroundColor: 'background-color',
  background: 'background',
  color: 'color',
  borderColor: 'border-color',
  borderTopColor: 'border-top-color',
  borderBottomColor: 'border-bottom-color',
  borderLeftColor: 'border-left-color',
  borderRightColor: 'border-right-color',
  outlineColor: 'outline-color',
};

// CSS custom-property LHS prefixes that inherit a TOKEN_FAMILY_RULES allowlist.
const CUSTOM_PROP_TO_RULE = {
  '--background-': 'background-color',
  '--surface-': 'background-color',
  '--text-': 'color',
  '--border-': 'border-color',
};

// Token value-side prefixes in scope for Rule 5.
// Values pointing to other namespaces (--bds-*, --font-*, --space-*, etc.) are out of scope.
const FAMILY_PREFIXES_FOR_VALUES = [
  '--background-', '--surface-', '--text-', '--border-', '--color-',
];

export function classifyTokenFamily(tokenName) {
  for (const prefix of FAMILY_PREFIXES_FOR_VALUES) {
    if (tokenName.startsWith(prefix)) return prefix;
  }
  return null;
}

export function tokenFamilyMatchesAllowlist(tokenName, allowed) {
  const family = classifyTokenFamily(tokenName);
  if (family === null) return true; // out of scope — Rule 1 handles unknown tokens
  return allowed.includes(family);
}

// options.skipShapeB — set true when the caller knows the current line is
// inside a :root {} theme-definition block. Cross-family assignments there
// are intentional (semantic token ← primitive mapping), not violations.
export function checkTokenFamilyPairing(line, lineNum, file, { skipShapeB = false } = {}) {
  const violations = [];

  const trimmed = line.trim();
  if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
    return violations;
  }
  if (line.includes('bds-lint-ignore')) return violations;

  const isTsx = /\.tsx?$/.test(file);
  const isCss = /\.css$/.test(file);

  function pushViolation(prop, tokenName, ruleKey) {
    const rule = TOKEN_FAMILY_RULES[ruleKey];
    if (!rule) return;
    if (tokenFamilyMatchesAllowlist(tokenName, rule.allowed)) return;
    const family = classifyTokenFamily(tokenName);
    violations.push({
      file,
      line: lineNum,
      prop,
      tokenName,
      family: family ? family.slice(2, -1) : 'unknown',
      label: rule.label,
      suggestion: rule.suggestion,
      snippet: line.trim().slice(0, 120),
    });
  }

  if (isCss) {
    // Shape A: standard CSS property declaration
    const propRegex = /(^|[\s;{])(background-color|background|color|border-color|border-top-color|border-bottom-color|border-left-color|border-right-color|outline-color)\s*:\s*var\((--[\w-]+)(?:\s*,[^)]*)?\)/g;
    let m;
    while ((m = propRegex.exec(line)) !== null) {
      pushViolation(m[2], m[3], m[2]);
    }

    // Shape B: CSS custom-property declaration (--family-*: var(--other-family-*))
    // Skipped inside :root blocks — those are theme definitions where mapping
    // a semantic slot (--background-*) to a color primitive (--color-*) is correct.
    if (!skipShapeB) {
      const declRegex = /(^|[\s;{])(--[\w-]+)\s*:\s*var\((--[\w-]+)(?:\s*,[^)]*)?\)/g;
      while ((m = declRegex.exec(line)) !== null) {
        const lhs = m[2];
        if (lhs.startsWith('--bds-')) continue;
        const ruleKey = Object.entries(CUSTOM_PROP_TO_RULE).find(([prefix]) => lhs.startsWith(prefix))?.[1];
        if (!ruleKey) continue;
        pushViolation(lhs, m[3], ruleKey);
      }
    }
  }

  if (isTsx) {
    // Shape C: TSX inline-style object (camelProp: 'var(--token)')
    const tsxRegex = /\b(backgroundColor|background|color|borderColor|borderTopColor|borderBottomColor|borderLeftColor|borderRightColor|outlineColor)\s*:\s*['"]var\((--[\w-]+)(?:\s*,[^)]*)?\)['"]/g;
    let m;
    while ((m = tsxRegex.exec(line)) !== null) {
      const cssProp = TSX_STYLE_PROP_TO_CSS[m[1]];
      if (!cssProp) continue;
      pushViolation(m[1], m[2], cssProp);
    }
  }

  return violations;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rule 6: Wrapper-definition family (src/lib/tokens.ts)
//
// The three checks above operate on `var(--TOKEN)` literals at the point of
// USE. But our TSX consumers assign through the typed wrapper
// (`svcColors.inverse`, `color.surface.tertiary`) — no literal var() is on the
// consumer line, so Rules 3/5 never see it. The family decision actually lives
// in the wrapper DEFINITION, where a `surface`-namespace key can silently hold
// a `--background-*` value (or a service `bg`/`onLight` key hold a `--surface-*`
// value). That alias→alias, surface↔background drift is exactly how BACKLOG-318
// shipped green. This rule closes the hole at the definition site.
//
// The rule: a wrapper value's token family must match the family its key
// declares —
//   • top-level `surface:` namespace   → values must be `--surface-*`
//   • top-level `background:` namespace → values must be `--background-*`
//   • `service.{slug}.{key}` sub-keys   → family inferred from the key name
//       surface / surfaceLight / surfaceDark / inverse → `--surface-*`
//       bg / background* / onLight / onDark / onColor* → `--background-*`
//       text → `--text-*`   border → `--border-*`
// Keys whose intent we can't infer are skipped (no false positives).
// Escape hatch: `bds-lint-ignore token-family` on the same line.
// ─────────────────────────────────────────────────────────────────────────────

// service.{slug} sub-key → expected value family. The key name IS the intent.
function serviceKeyExpectedFamily(key) {
  // `inverse` is surface-only per ADR-012 (--surface-service-{slug}-inverse,
  // white in light / {hue}-darkest in dark). It is NOT the retired background
  // alias ADR-011 removed.
  if (key.startsWith('surface') || key === 'inverse') return '--surface-';
  if (
    key === 'bg' ||
    key.startsWith('background') ||
    key === 'onLight' ||
    key === 'onDark' ||
    key.startsWith('onColor')
  ) {
    return '--background-';
  }
  if (key === 'text') return '--text-';
  if (key === 'border') return '--border-';
  return null;
}

// Walk a typed-wrapper source file, tracking the object-key path via a brace
// stack, and flag value lines whose token family disagrees with the family
// their key context declares.
export function checkWrapperFamily(text, file) {
  const violations = [];
  const lines = text.split('\n');
  const stack = []; // object-key path, e.g. ['service', 'brand']

  // `key: {`  — opens a nested object.
  const openRe = /^\s*['"]?([A-Za-z][\w-]*)['"]?\s*:\s*\{/;
  // `key: 'var(--token)'`  — a token-valued leaf.
  const leafRe = /^\s*['"]?([A-Za-z][\w-]*)['"]?\s*:\s*['"]var\((--[\w-]+)/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    // Wrapper comments don't carry unbalanced braces, so skipping them keeps
    // the brace stack accurate.
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
      continue;
    }

    const openM = line.match(openRe);
    if (openM) {
      stack.push(openM[1]);
      continue;
    }

    const leafM = line.match(leafRe);
    if (leafM) {
      const key = leafM[1];
      const tokenName = leafM[2];
      let expected = null;
      if (stack.length === 1 && (stack[0] === 'surface' || stack[0] === 'background')) {
        expected = stack[0] === 'surface' ? '--surface-' : '--background-';
      } else if (stack[0] === 'service' && stack.length === 2) {
        expected = serviceKeyExpectedFamily(key);
      }
      if (expected) {
        const family = classifyTokenFamily(tokenName);
        if (family && family !== expected && !line.includes('bds-lint-ignore')) {
          violations.push({
            file,
            line: i + 1,
            keyPath: [...stack, key].join('.'),
            tokenName,
            expectedFamily: expected.slice(2, -1),
            actualFamily: family.slice(2, -1),
            snippet: trimmed.slice(0, 120),
          });
        }
      }
      // a leaf line never opens a block; fall through to brace bookkeeping below
    }

    // Brace bookkeeping for closes (`}`, `},`, `} as const;`). A leaf line has
    // balanced quotes and no stray braces, so only true block-closers pop.
    const closes = (line.match(/\}/g) ?? []).length;
    for (let c = 0; c < closes; c++) stack.pop();
  }

  return violations;
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
