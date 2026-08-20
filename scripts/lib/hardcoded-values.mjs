// Hardcoded-value detector for brikdesigns.com CSS.
//
// The sibling `lint-tokens.mjs` gate only inspects `var(--…)` *references* —
// invented names, wrong family, wrong property pairing. A raw literal like
// `gap: 2px` carries no `var()`, so nothing there can see it. That blind spot
// is exactly how the /customers/[slug] `.story-meta__item { gap: 2px }` shipped
// (this file's raison d'être). This module closes it: it flags raw spatial,
// radius, border-width, typographic, and colour literals in token-governed CSS
// properties, and — for length families — tells you whether an exact token
// exists (a fix) or none does (a candidate design-system gap).
//
// Categories & their token families:
//   spacing   gap/row-gap/column-gap, margin*, padding*   → --gap-* / --padding-* / --space-*
//   radius    border-radius, border-*-radius               → --border-radius-*
//   border    border-width, border-*-width                 → --border-width-*
//   typography font-size, line-height                       → font-size scale / --font-line-height-*
//   colour    color, background*, border*-color, fill,     → --text-* / --surface-* /
//             stroke, outline*, box-shadow, text-shadow       --background-* / --border-* / --color-*
//   token-definition  a raw colour written straight into a semantic token
//             (`--text-*`/`--surface-*`/`--background-*`/`--border-*`)  →  a --color-* primitive
//             Semantic tokens must resolve THROUGH a primitive; the value
//             belongs in the Figma → Style Dictionary chain. `--color-*` is
//             exempt — the primitive layer is where the chain bottoms out.
//
// Deliberately NOT scanned (would be noise, not signal):
//   • width/height/min-*/max-*/inset/top/left/grid-template — arbitrary layout
//     dimensions, mostly no token equivalent.
//   • font-weight — owned by lint-font-weight.mjs (TSX token layer).
//   • literals inside var()/calc()/clamp()/min()/max() — fluid primitives are
//     the sanctioned escape when a token doesn't abide (CLAUDE.md).
//   • zero (0/0px/0rem) — a no-op, no token buys anything.
//
// Escape hatch (rare, per-line): `/* bds-lint-ignore hardcoded — <reason> */`.

import fs from 'node:fs';

export const IGNORE_RE = /bds-lint-ignore\s+hardcoded/;

// ── Property → category ──────────────────────────────────────────────────────
// Matched against the declaration's property name (lower-cased, trimmed).
const SPACING_PROP_RE =
  /^(gap|row-gap|column-gap|margin|margin-(top|right|bottom|left|block|inline|block-start|block-end|inline-start|inline-end)|padding|padding-(top|right|bottom|left|block|inline|block-start|block-end|inline-start|inline-end))$/;
const RADIUS_PROP_RE =
  /^(border-radius|border-(top-left|top-right|bottom-left|bottom-right|start-start|start-end|end-start|end-end)-radius)$/;
const BORDER_WIDTH_PROP_RE = /^(border-width|border-(top|right|bottom|left|block|inline)-width)$/;
const TYPO_PROP_RE = /^(font-size|line-height)$/;
// Colour-bearing properties. `border`/`outline`/`box-shadow`/`text-shadow` are
// shorthands whose colour component we still want; their length component is
// handled by the dedicated border-width family (shorthand widths are ignored to
// avoid double-flagging hairlines).
const COLOUR_PROP_RE =
  /^(color|background|background-color|border|border-color|border-(top|right|bottom|left)-color|outline|outline-color|fill|stroke|box-shadow|text-shadow|caret-color|text-decoration-color)$/;
// Semantic *token definitions*. Every regex above is anchored to a real CSS
// property name, so a custom property never matched any of them and a raw
// colour written straight into a semantic token — `--surface-negative:
// #fdeaea` — was invisible to the gate. A semantic token must resolve THROUGH
// a primitive: the value belongs in the Figma → Style Dictionary chain, not
// hand-written in a consumer stylesheet. The primitive layer (`--color-*`) is
// deliberately outside this set — that IS where the chain bottoms out.
const SEMANTIC_TOKEN_RE = /^--(text|surface|background|border)-/;

// ── Literal patterns (scanned in the value AFTER stripping var/calc/clamp) ────
const LENGTH_RE = /-?\d*\.?\d+(px|rem|em)\b/g;
const COLOUR_RE = /#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?)\s*\(/g;
// Spans that are legitimate primitives — strip before scanning for literals.
const PRIMITIVE_SPAN_RE = /(?:var|calc|clamp|min|max|env)\s*\([^()]*(?:\([^()]*\)[^()]*)*\)/g;

/** Resolve `--name: value` declarations from a token stylesheet to concrete
 *  strings, following one-level `var()` indirection until it bottoms out. */
export function resolveTokenValues(cssText) {
  const raw = new Map();
  // Strip block comments first — an unterminated `--foo:` inside a comment
  // would otherwise let the value class run across newlines into the next real
  // declaration and swallow it (observed: a commented `--gap-component:` note
  // ate the real token's value).
  const src = cssText.replace(/\/\*[^]*?\*\//g, ' ');
  const DECL_RE = /(--[a-zA-Z][\w-]*)\s*:\s*([^;{}]+);/g;
  let m;
  while ((m = DECL_RE.exec(src))) {
    // First declaration wins → the `:root` base scope, before responsive/theme
    // overrides later in the file redefine the same name.
    if (!raw.has(m[1])) raw.set(m[1], m[2].trim());
  }
  const resolved = new Map();
  const resolve = (name, seen = new Set()) => {
    if (resolved.has(name)) return resolved.get(name);
    if (seen.has(name)) return null;
    seen.add(name);
    let val = raw.get(name);
    if (val == null) return null;
    const ref = val.match(/^var\(\s*(--[a-zA-Z][\w-]*)\s*\)$/);
    if (ref) val = resolve(ref[1], seen);
    resolved.set(name, val);
    return val;
  };
  for (const name of raw.keys()) resolve(name);
  return resolved;
}

/** Normalise a length literal to a px number (1rem = 1em = 16px). null if not
 *  a simple length. */
export function lengthToPx(literal) {
  const m = String(literal).trim().match(/^(-?\d*\.?\d+)(px|rem|em)$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return m[2] === 'px' ? n : n * 16;
}

/** Build px → [tokenName] indexes per length family from the resolved token
 *  map, so a raw literal can be matched to an exact token (or flagged as
 *  having none). */
export function buildTokenIndex(resolved) {
  const spacing = new Map(); // px → names (gap/padding/space)
  const radius = new Map();
  const border = new Map();
  const add = (map, px, name) => {
    if (px == null) return;
    if (!map.has(px)) map.set(px, []);
    if (!map.get(px).includes(name)) map.get(px).push(name);
  };
  // Index the WHOLE family, numeric scale steps included — not just the
  // semantic aliases. BDS ships 17 radius steps and 8 border widths, but only
  // ~6 aliases each; matching aliases alone made every off-alias value (4px
  // radius = --border-radius-100, 3px border = --border-width-200) report as
  // "no token exists", inventing design-system gaps that BDS already fills.
  // `preferSemantic` still surfaces the alias when one resolves to the same px.
  for (const [name, value] of resolved) {
    const px = lengthToPx(value);
    if (/^--(gap|padding|space)-/.test(name)) add(spacing, px, name);
    else if (/^--border-radius-/.test(name)) add(radius, px, name);
    else if (/^--border-width-/.test(name)) add(border, px, name);
  }
  return { spacing, radius, border };
}

/** Prefer the semantic scale token(s) for a suggestion, de-duping primitives
 *  when a semantic alias resolves to the same value. */
function preferSemantic(names) {
  const semantic = names.filter((n) => !/-\d+$/.test(n));
  return (semantic.length ? semantic : names).join(' / ');
}

/** Split a declaration list into `{ prop, value }` pairs with the line offset
 *  of each, tolerant of multiple declarations per physical line. */
function* declarations(line) {
  // Only the part before a trailing comment counts as CSS; keep the comment for
  // the ignore check upstream.
  for (const raw of line.split(';')) {
    // Strip the rule's braces so a single-line rule parses like a multi-line
    // one. `.foo { gap: 7px; }` splits into `.foo { gap: 7px`, whose first
    // colon belongs to the declaration — but everything left of `{` is the
    // selector, and without dropping it the property name is `.foo { gap` and
    // the `^[a-z-]+$` guard below discards the whole declaration. Worse for a
    // pseudo-class: `a:hover { gap: 7px` yields prop `a`, value `hover { gap:
    // 7px` — a *parse*, just not of the declaration, so it fails silently.
    // Take what follows the last `{`, then cut at the first `}` (the closer of
    // a `;`-less final declaration, or of a preceding rule on the same line).
    const open = raw.lastIndexOf('{');
    const chunk = (open === -1 ? raw : raw.slice(open + 1)).split('}')[0];
    const idx = chunk.indexOf(':');
    if (idx === -1) continue;
    const prop = chunk.slice(0, idx).trim().toLowerCase();
    const value = chunk.slice(idx + 1).trim();
    if (!prop || !value || !/^[a-z-]+$/.test(prop)) continue;
    yield { prop, value };
  }
}

/** Scan one CSS file's text for hardcoded-literal violations. Returns an array
 *  of `{ file, line, category, prop, literal, snippet, suggestion, dsGap }`. */
export function findHardcodedViolations(file, text, index) {
  const violations = [];
  const lines = text.split('\n');
  let inComment = false;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    if (IGNORE_RE.test(rawLine)) continue;

    // Track /* … */ block comments so commented-out CSS isn't flagged.
    let line = rawLine;
    if (inComment) {
      const end = line.indexOf('*/');
      if (end === -1) continue;
      line = line.slice(end + 2);
      inComment = false;
    }
    line = line.replace(/\/\*[^]*?\*\//g, ' ');
    const open = line.indexOf('/*');
    if (open !== -1) { line = line.slice(0, open); inComment = true; }

    for (const { prop, value } of declarations(line)) {
      // Strip var()/calc()/clamp()/… spans — literals inside them are primitives.
      const scan = value.replace(PRIMITIVE_SPAN_RE, ' ');

      const pushLength = (category, tokenMap) => {
        for (const lit of scan.match(LENGTH_RE) ?? []) {
          const px = lengthToPx(lit);
          if (px === 0) continue; // zero is a no-op
          const names = tokenMap?.get(px);
          violations.push({
            file, line: i + 1, category, prop, literal: lit,
            snippet: `${prop}: ${value}`.slice(0, 100),
            suggestion: names ? preferSemantic(names) : null,
            dsGap: tokenMap ? !names : false,
          });
        }
      };

      if (SPACING_PROP_RE.test(prop)) pushLength('spacing', index.spacing);
      else if (RADIUS_PROP_RE.test(prop)) pushLength('radius', index.radius);
      else if (BORDER_WIDTH_PROP_RE.test(prop)) pushLength('border-width', index.border);
      else if (TYPO_PROP_RE.test(prop)) {
        for (const lit of scan.match(LENGTH_RE) ?? []) {
          if (lengthToPx(lit) === 0) continue;
          violations.push({
            file, line: i + 1, category: 'typography', prop, literal: lit,
            snippet: `${prop}: ${value}`.slice(0, 100),
            suggestion: prop === 'line-height' ? '--font-line-height-*' : '--heading-* / --body-* / --label-*',
            dsGap: false,
          });
        }
      }

      if (COLOUR_PROP_RE.test(prop)) {
        for (const lit of scan.match(COLOUR_RE) ?? []) {
          violations.push({
            file, line: i + 1, category: 'colour', prop, literal: lit.replace(/\s*\($/, ''),
            snippet: `${prop}: ${value}`.slice(0, 100),
            suggestion: '--text-* / --surface-* / --background-* / --border-* / --color-*',
            dsGap: false,
          });
        }
      } else if (SEMANTIC_TOKEN_RE.test(prop)) {
        for (const lit of scan.match(COLOUR_RE) ?? []) {
          violations.push({
            file, line: i + 1, category: 'token-definition', prop, literal: lit.replace(/\s*\($/, ''),
            snippet: `${prop}: ${value}`.slice(0, 100),
            suggestion: 'a --color-* primitive — add the primitive upstream, don\'t inline the value',
            dsGap: false,
          });
        }
      }
    }
  }
  return violations;
}

/** Read + resolve the canonical token stylesheets into a length index. */
export function loadTokenIndex(paths) {
  let css = '';
  for (const p of paths) {
    if (fs.existsSync(p)) css += '\n' + fs.readFileSync(p, 'utf8');
  }
  return buildTokenIndex(resolveTokenValues(css));
}
