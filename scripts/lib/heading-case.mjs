// Pure logic for the marketing heading title-case lint (brikdesigns#491).
//
// The canonical rule lives in BDS canon (brik-bds#910):
//   design.brikdesigns.com/docs/primitives/typography#heading-casing
// Capitalize the first, last, and every major word; lowercase short articles,
// coordinating conjunctions, and prepositions of <=3 letters; capitalize both
// parts of a hyphenated compound; pronouns are always capitalized.
//
// Detection is intentionally HEURISTIC and conservative — proper nouns,
// acronyms, and brand strings can false-positive, so an allowlist + an inline
// ignore comment are load-bearing. It skips anything that reads as
// CMS-interpolated ({…}) or conversational/status copy (ends in . ! ?).

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
export const ALLOWLIST_PATH = path.join(__dirname, '..', 'heading-case-allowlist.txt');

// Minor words that may stay lowercase when they are NOT the first or last word:
// articles + coordinating conjunctions + prepositions of three letters or fewer.
export const MINOR_WORDS = new Set([
  'a', 'an', 'the',
  'and', 'but', 'or', 'nor', 'for', 'so', 'yet',
  'of', 'in', 'to', 'on', 'at', 'by', 'up', 'as', 'off', 'out', 'per', 'via',
]);

const STARTS_LOWER = /^[a-z]/;
const STARTS_ALPHA = /^[A-Za-z]/;

// Match a single-line `<h1|h2|h3 …>TEXT</hN>` with literal-only inner text
// (no `<` child elements, no `{…}` interpolation), and a literal `title="…"` /
// `title='…'` prop. Brace exclusion is the CMS scope guard.
const H_RE = /<h([1-3])\b[^>]*>([^<>{}]*)<\/h\1>/g;
const TITLE_RE = /\btitle=(?:"([^"{}]*)"|'([^'{}]*)')/g;

// Same-line escape hatch for legitimate exceptions.
const INLINE_IGNORE = /\/\*\s*lint-heading-case-ignore/;

// Headings are noun phrases; they don't end in sentence punctuation. A trailing
// `.` `!` or `?` marks conversational / status / confirmation copy, which the
// standard explicitly does NOT govern ("Message sent!", "Thanks! We'll be in
// touch.", "You're registered!", "Not sure what you need yet?").
export function isExemptCopy(text) {
  return /[.!?]["')\]]?\s*$/.test(text.trim());
}

// Returns the lowercased major words that violate title case, or [] if clean.
export function titleCaseViolations(text) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const bad = [];
  words.forEach((rawWord, i) => {
    const isEdge = i === 0 || i === words.length - 1;
    // Hyphenated compound: every part must be capitalized (Full-Time, Inside-Out).
    const parts = rawWord.split('-');
    for (const part of parts) {
      const w = part.replace(/^[^A-Za-z0-9]+/, '').replace(/[^A-Za-z0-9]+$/, '');
      if (!w || !STARTS_ALPHA.test(w)) continue;   // numbers, symbols, "&"
      if (!STARTS_LOWER.test(w)) continue;         // already capitalized / acronym
      const minorAllowed =
        MINOR_WORDS.has(w.toLowerCase()) && !isEdge && parts.length === 1;
      if (!minorAllowed) bad.push(part);
    }
  });
  return bad;
}

export function loadAllowlist(allowlistPath = ALLOWLIST_PATH) {
  if (!fs.existsSync(allowlistPath)) return new Set();
  return new Set(
    fs
      .readFileSync(allowlistPath, 'utf8')
      .split('\n')
      .map((l) => l.replace(/\r$/, '').trim())
      .filter((l) => l && !l.startsWith('#'))
  );
}

// Scan one file's text; return [{ file, line, kind, text, words }].
export function findHeadingViolations(text, file, allowlist = loadAllowlist()) {
  const out = [];
  const lines = text.split('\n');
  lines.forEach((line, idx) => {
    if (INLINE_IGNORE.test(line)) return;
    const candidates = [];
    let m;
    H_RE.lastIndex = 0;
    while ((m = H_RE.exec(line))) candidates.push({ kind: `h${m[1]}`, str: m[2] });
    TITLE_RE.lastIndex = 0;
    while ((m = TITLE_RE.exec(line))) candidates.push({ kind: 'title', str: m[1] ?? m[2] });
    for (const c of candidates) {
      const str = c.str.trim();
      if (!str || !STARTS_ALPHA.test(str)) continue; // empty / non-text
      if (allowlist.has(str)) continue;
      if (isExemptCopy(str)) continue;
      const words = titleCaseViolations(str);
      if (words.length) out.push({ file, line: idx + 1, kind: c.kind, text: str, words });
    }
  });
  return out;
}
