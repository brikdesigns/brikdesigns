#!/usr/bin/env node
// Fails CI when a theme text token doesn't clear WCAG AA on its own page surface.
//
// `lint:tokens` validates token NAMES and family usage. It cannot see values, so
// a brand override that repoints --text-muted at a stop with 2.17:1 on white is
// a clean pass. The axe suite scores what a page RENDERS, so it only fires if
// that token happens to paint visible text on an audited route — and
// --text-muted paints none in this repo (BDS uses it on `__helper` / `__error`
// sub-elements that no brikdesigns form renders). Between the two gates the
// value sat under AA-large for months (#851).
//
// This closes that seam at the only place it is cheap to close: the declaration.
// A text token's contrast against the page surface is a property of two numbers
// in globals.css — no browser, no route, no render state needed.
//
// Scope, deliberately narrow:
//   - Only the three page-level text tokens: --text-primary/-secondary/-muted.
//     They are the ones that inherit onto arbitrary copy, so the page surface is
//     the backdrop they must clear. Tokens like --text-on-color-dark are pinned
//     to a specific tint by definition and a page-surface check would be wrong
//     for them, not merely noisy.
//   - Only the two theme blocks that set page tokens (light `.theme-brand-brik`,
//     dark `:root[data-theme="dark"] .theme-brand-brik`). The component-scoped
//     overrides further down globals.css pin text against a surface they
//     establish themselves; they carry `bds-lint-ignore` markers and their own
//     rationale, and are out of scope here.
//   - Light checks BOTH light surfaces (--surface-primary and the branded
//     --surface-secondary tan-100): #851's fix hinged on the tan surface, where
//     grayscale-600 misses AA by 0.03 while clearing white.
//
// Usage:
//   npm run lint:theme-contrast
// Self-test:
//   npm run test:lint:theme-contrast

import fs from 'node:fs';
import url from 'node:url';

export const CSS_PATH = 'src/app/globals.css';
export const TOKENS_PATH = 'node_modules/@brikdesigns/bds/dist/tokens.css';

/** WCAG 2.1 AA for body text. AA-large (3.0) is deliberately not an escape
 *  hatch here: these tokens inherit onto copy of unknown size. */
export const AA = 4.5;

/** The page-level text tokens, and the surface tokens each theme paints them on.
 *
 *  `layers` is the cascade the browser resolves, lowest precedence first. It has
 *  to be spelled out: BDS `dist/tokens.css` declares --surface-primary four
 *  times across its four theme blocks, so a flat last-wins read of that file
 *  hands back the dark value for a light-mode lookup (and resolved
 *  --surface-primary to #000000 while this gate was being written). Primitives
 *  (`--color-*`) are declared once and are theme-invariant, so only the semantic
 *  layers need ordering. */
export const CHECKS = [
  {
    theme: 'light',
    layers: [
      { file: 'bds', selector: ':root' },
      { file: 'bds', selector: '.theme-brand-brik' },
      { file: 'css', selector: '.theme-brand-brik' },
    ],
    surfaces: ['--surface-primary', '--surface-secondary'],
  },
  {
    theme: 'dark',
    layers: [
      { file: 'bds', selector: ':root' },
      { file: 'bds', selector: ':root[data-theme="dark"]' },
      { file: 'bds', selector: '.theme-brand-brik' },
      { file: 'bds', selector: ':root[data-theme="dark"] .theme-brand-brik' },
      { file: 'css', selector: ':root[data-theme="dark"] .theme-brand-brik' },
    ],
    // Both, and --surface-secondary is the BINDING one. Dark --surface-primary
    // is true black (#000000, BDS "surfaces sit flush with the page" #1689), so
    // it has the most headroom of any surface in either theme and a check
    // against it alone is nearly free. --surface-secondary is grayscale-950
    // (#1b1b1b) and is where a dark text token actually runs out of room —
    // exactly the shape of #851 in light mode, where white passed and the
    // branded tan-100 --surface-secondary was the constraint that ruled out 600.
    surfaces: ['--surface-primary', '--surface-secondary'],
  },
];
export const TEXT_TOKENS = ['--text-primary', '--text-secondary', '--text-muted'];

/** The globals.css block each theme's own overrides live in — the one a rename
 *  must fail loudly on, since that is the file this repo controls. */
export const OWN_BLOCK = {
  light: '.theme-brand-brik',
  dark: ':root[data-theme="dark"] .theme-brand-brik',
};

const srgb = (v) => {
  v /= 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};

/** WCAG relative luminance of a #rrggbb string. */
export function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
}

/** WCAG contrast ratio between two #rrggbb strings. */
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Strip `/* … *\/` comments. Required before matching declarations: these theme
 *  blocks carry long rationale comments that name tokens in prose, and
 *  `--surface-primary:` inside a sentence is indistinguishable from a real
 *  declaration to the regex below. Writing exactly that comment in globals.css
 *  poisoned this gate's own cascade during development. */
export function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Every `--name: value` declaration in a source, last-wins. */
export function declarations(source) {
  const out = new Map();
  for (const m of stripComments(source).matchAll(/(--[a-z0-9-]+)\s*:\s*([^;}]+)/gi)) {
    out.set(m[1], m[2].trim());
  }
  return out;
}

/** Declarations from EVERY block whose selector matches exactly, merged in file
 *  order (later wins, as the cascade does). Returns null when the selector never
 *  appears, so a rename is distinguishable from an empty block.
 *
 *  Only top-level declarations count: a nested rule's own body is skipped, so a
 *  descendant selector inside a theme block can't leak its values into the
 *  block's own set. Brace-counted for the same reason. */
export function blockDeclarations(rawSource, selector) {
  // Strip comments FIRST: a brace inside a comment would desynchronise the
  // depth counter below, and a token named in prose would read as a declaration.
  const source = stripComments(rawSource);
  const needle = selector + ' {';
  let found = false;
  const merged = new Map();
  for (let at = source.indexOf(needle); at !== -1; at = source.indexOf(needle, at + 1)) {
    // Exact selector match only — without this, `.theme-brand-brik {` would also
    // match the tail of `:root[data-theme="dark"] .theme-brand-brik {`.
    const lineStart = source.lastIndexOf('\n', at) + 1;
    if (source.slice(lineStart, at).trim() !== '') continue;
    found = true;
    let depth = 0;
    let i = source.indexOf('{', at);
    let own = '';
    let sliceFrom = i + 1;
    for (; i < source.length; i++) {
      if (source[i] === '{') {
        depth++;
        if (depth === 2) own += source.slice(sliceFrom, i);
      } else if (source[i] === '}') {
        if (--depth === 0) break;
        if (depth === 1) sliceFrom = i + 1;
      }
    }
    own += source.slice(sliceFrom, i);
    for (const [k, v] of declarations(own)) merged.set(k, v);
  }
  return found ? merged : null;
}

/** Resolve a value to #rrggbb, following `var(--x)` through an ordered cascade
 *  of declaration maps (highest precedence first). */
export function resolveHex(value, theme, registry, seen = new Set()) {
  let v = (value ?? '').trim();
  for (let hops = 0; hops < 12; hops++) {
    if (/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase();
    if (/^#[0-9a-f]{3}$/i.test(v)) {
      return ('#' + [...v.slice(1)].map((c) => c + c).join('')).toLowerCase();
    }
    const ref = v.match(/^var\(\s*(--[a-z0-9-]+)/i)?.[1];
    if (!ref || seen.has(ref)) return null;
    seen.add(ref);
    const next = theme.get(ref) ?? registry.get(ref);
    if (next === undefined) return null;
    v = next;
  }
  return null;
}

function main() {
  for (const p of [CSS_PATH, TOKENS_PATH]) {
    if (!fs.existsSync(p)) {
      console.error(`lint-theme-contrast: ${p} not found — cannot assert anything.`);
      return 2;
    }
  }
  const sources = {
    css: fs.readFileSync(CSS_PATH, 'utf8'),
    bds: fs.readFileSync(TOKENS_PATH, 'utf8'),
  };
  // Primitives (`--color-*`) are declared once in BDS and are theme-invariant, so
  // a flat read is the correct fallback for them — and only them.
  const primitives = declarations(sources.bds);
  if (primitives.size === 0) {
    console.error(`lint-theme-contrast: parsed 0 declarations out of ${TOKENS_PATH}.`);
    return 2;
  }

  const problems = [];
  let checked = 0;

  for (const { theme, layers, surfaces } of CHECKS) {
    // Flatten the cascade: later layers win, so merge in order.
    const cascade = new Map();
    let missingLayer = false;
    for (const { file, selector } of layers) {
      const block = blockDeclarations(sources[file], selector);
      if (!block) {
        // A renamed selector must fail loudly. Skipping it silently is how a gate
        // starts passing vacuously while asserting nothing.
        const where = file === 'css' ? CSS_PATH : TOKENS_PATH;
        problems.push(
          `${theme}: no \`${selector} {\` block in ${where} — the theme selector ` +
            `was renamed. Update CHECKS in this script.`
        );
        missingLayer = true;
        continue;
      }
      for (const [k, v] of block) cascade.set(k, v);
    }
    if (missingLayer) continue;

    // The block this repo owns must declare at least one of the tokens under
    // test, or the gate is watching a file that no longer drives the theme.
    const own = blockDeclarations(sources.css, OWN_BLOCK[theme]);
    if (!own || !TEXT_TOKENS.some((t) => own.has(t))) {
      problems.push(
        `${theme}: \`${OWN_BLOCK[theme]}\` in ${CSS_PATH} declares none of ` +
          `${TEXT_TOKENS.join(' / ')} — this gate would assert nothing about it.`
      );
      continue;
    }

    for (const surfaceToken of surfaces) {
      const bg = resolveHex(cascade.get(surfaceToken) ?? null, cascade, primitives);
      if (!bg) {
        problems.push(`${theme}: could not resolve ${surfaceToken} to a hex value.`);
        continue;
      }
      for (const textToken of TEXT_TOKENS) {
        const fg = resolveHex(cascade.get(textToken) ?? null, cascade, primitives);
        if (!fg) {
          problems.push(`${theme}: could not resolve ${textToken} to a hex value.`);
          continue;
        }
        checked += 1;
        const ratio = contrast(fg, bg);
        if (ratio < AA) {
          problems.push(
            `${theme}: ${textToken} (${fg}) on ${surfaceToken} (${bg}) is ` +
              `${ratio.toFixed(2)}:1 — under AA ${AA}:1.`
          );
        }
      }
    }
  }

  if (checked === 0 && problems.length === 0) {
    console.error(
      `lint-theme-contrast: 0 pairs checked — nothing was asserted. Fix the parser.`
    );
    return 2;
  }

  if (problems.length > 0) {
    console.error(`lint-theme-contrast: ${problems.length} problem(s):`);
    for (const p of problems) console.error(`  ${p}`);
    console.error(
      '\n  A page-level text token inherits onto copy of unknown size, so it ' +
        'must clear AA 4.5:1 on the surface its theme paints. Pick a darker (or ' +
        'in dark mode, lighter) stop from the grayscale ramp. Text pinned to a ' +
        'specific tint belongs on a service/on-color token, not these three. ' +
        'See brikdesigns#851.'
    );
    return 1;
  }

  console.log(`lint-theme-contrast: clean — ${checked} text/surface pair(s) clear AA ${AA}:1`);
  return 0;
}

// Importable for the self-test; only the direct invocation exits.
if (process.argv[1] && import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
