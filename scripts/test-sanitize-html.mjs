#!/usr/bin/env node
// Behaviour test for `src/lib/sanitize.ts` (brikdesigns#809).
//
// `sanitizeHtml` is the ONLY sanitizer between an admin textarea and the public
// page. The portal writes `events.description_html` raw through a bare
// `z.string().nullable()`, and its DOMPurify pass covers SVG file uploads only —
// so nothing upstream strips active content. That makes this file the security
// boundary, and #809 replaced the library implementing it.
//
// Two directions matter and each fails differently:
//
//   - a vector survives  → stored XSS on a public marketing page
//   - legitimate prose is stripped → silent content loss in published CMS rows,
//     which nobody notices until a client asks where their table went
//
// The second is why this is not just an XSS corpus. The DOMPurify allowlist this
// replaced was permissive, and existing rows were authored against it.
//
// The vectors are asserted structurally, not by string equality: any allowlist
// change that starts emitting `<script>`, an `on*` handler, or a `javascript:`
// URL fails regardless of how the output is otherwise shaped.
//
// Run via `npm run test:sanitize`.

import assert from 'node:assert/strict';
import { sanitizeHtml } from '../src/lib/sanitize.ts';

const tests = [];
const failures = [];
const test = (name, fn) => tests.push({ name, fn });

/** Active content in any form. Checked against output, never against input. */
function assertInert(out, label) {
  assert.doesNotMatch(out, /<script/i, `${label}: <script> survived`);
  assert.doesNotMatch(out, /<iframe/i, `${label}: <iframe> survived`);
  assert.doesNotMatch(out, /<object|<embed|<base/i, `${label}: embedding tag survived`);
  // An on* handler as a live attribute. Entity-escaped text inside an attribute
  // VALUE is inert, so this deliberately matches only unescaped occurrences.
  assert.doesNotMatch(out, /\son[a-z]+\s*=\s*["']?[^"'&]/i, `${label}: event handler survived`);
  assert.doesNotMatch(out, /(href|src|action|formaction)\s*=\s*["']?\s*javascript:/i,
    `${label}: javascript: URL survived`);
  assert.doesNotMatch(out, /expression\s*\(/i, `${label}: CSS expression() survived`);
}

// ── vectors must not survive ─────────────────────────────────────────────────
const VECTORS = {
  'script tag': '<p>copy</p><script>alert(1)</script>',
  'script with entities': '<script>alert(String.fromCharCode(88))</script>',
  'img onerror': '<img src=x onerror=alert(1)>',
  'img onerror quoted': '<img src="x" onerror="alert(1)">',
  'svg onload': '<svg><g onload="alert(1)"/></svg>',
  'anchor javascript:': '<a href="javascript:alert(1)">click</a>',
  'anchor JaVaScRiPt: mixed case': '<a href="JaVaScRiPt:alert(1)">click</a>',
  'anchor with leading whitespace scheme': '<a href=" javascript:alert(1)">click</a>',
  'iframe': '<iframe src="https://evil.example"></iframe>',
  'iframe srcdoc': '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
  'form + formaction': '<form action="/x"><button formaction="javascript:alert(1)">go</button></form>',
  'style tag': '<style>body{display:none}</style><p>copy</p>',
  'style attr url()': '<p style="background-image:url(javascript:alert(1))">copy</p>',
  'style attr expression()': '<p style="width:expression(alert(1))">copy</p>',
  'mXSS noscript': '<noscript><p title="</noscript><img src=x onerror=alert(1)>">',
  'object': '<object data="data:text/html,<script>alert(1)</script>"></object>',
  'base tag': '<base href="https://evil.example/">',
  'anchor data: URL': '<a href="data:text/html,<script>alert(1)</script>">click</a>',
  'meta refresh': '<meta http-equiv="refresh" content="0;url=https://evil.example">',
  'onfocus autofocus': '<input autofocus onfocus=alert(1)>',
};

for (const [name, dirty] of Object.entries(VECTORS)) {
  test(`vector neutralized — ${name}`, () => assertInert(sanitizeHtml(dirty), name));
}

// The style-attribute filter is the one place a vector could survive as a
// *permitted* attribute, so assert the payload is gone rather than only inert.
test('style attr keeps declarative values and drops payloads', () => {
  assert.match(sanitizeHtml('<p style="color:red">copy</p>'), /style="color:red"/);
  const out = sanitizeHtml('<p style="background-image:url(javascript:alert(1))">copy</p>');
  assert.doesNotMatch(out, /url\(/i);
  assert.doesNotMatch(out, /javascript/i);
});

// ── legitimate prose must survive ────────────────────────────────────────────
const PRESERVED = {
  'headings': ['<h2>Agenda</h2><h3>Morning</h3>', ['<h2>', 'Agenda', '<h3>']],
  'paragraph emphasis': ['<p><strong>Bold</strong> and <em>italic</em></p>', ['<strong>', '<em>']],
  'unordered list': ['<ul><li>One</li><li>Two</li></ul>', ['<ul>', '<li>', 'Two']],
  'ordered list with start': ['<ol start="3"><li>Three</li></ol>', ['<ol', 'start="3"', '<li>']],
  'nested list': ['<ol><li>a<ul><li>b</li></ul></li></ol>', ['<ol>', '<ul>', '<li>']],
  'safe link': ['<a href="https://brikdesigns.com">Brik</a>', ['href="https://brikdesigns.com"', 'Brik']],
  'mailto link': ['<a href="mailto:nick@brikdesigns.com">Email</a>', ['mailto:nick@brikdesigns.com']],
  'tel link': ['<a href="tel:+19015551234">Call</a>', ['tel:+19015551234']],
  'image with dimensions': [
    '<img src="/hero.webp" alt="Hero" width="800" height="600" loading="lazy">',
    ['src="/hero.webp"', 'alt="Hero"', 'width="800"', 'loading="lazy"'],
  ],
  'image srcset': ['<img src="/a.webp" srcset="/a.webp 1x, /a@2x.webp 2x" alt="">', ['srcset=']],
  'inline data image': ['<img src="data:image/png;base64,iVBORw0KGgo=" alt="">', ['data:image/png']],
  'table': [
    '<table><thead><tr><th scope="col">H</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>',
    ['<table>', '<thead>', 'scope="col"', '<td>'],
  ],
  'blockquote and code': [
    '<blockquote><p>Quoted</p></blockquote><pre><code>npm run build</code></pre>',
    ['<blockquote>', '<pre>', '<code>', 'npm run build'],
  ],
  'definition list': ['<dl><dt>Term</dt><dd>Def</dd></dl>', ['<dl>', '<dt>', '<dd>']],
  'figure with caption': [
    '<figure><img src="/a.webp" alt="A"><figcaption>Cap</figcaption></figure>',
    ['<figure>', '<figcaption>', 'Cap'],
  ],
  'heading anchor id': ['<h2 id="agenda">Agenda</h2>', ['id="agenda"']],
  'line break and rule': ['<p>a<br>b</p><hr>', ['<br', '<hr']],
  'entities preserved': ['<p>caf&eacute; &amp; more</p>', ['&amp;']],
  'time element': ['<time datetime="2026-08-05">Aug 5</time>', ['datetime="2026-08-05"']],
  'text-align style': ['<p style="text-align:center">c</p>', ['text-align:center']],
};

for (const [name, [dirty, expectations]] of Object.entries(PRESERVED)) {
  test(`prose preserved — ${name}`, () => {
    const out = sanitizeHtml(dirty);
    for (const fragment of expectations) {
      assert.ok(out.includes(fragment), `${name}: lost ${JSON.stringify(fragment)} — got ${out}`);
    }
    assertInert(out, name);
  });
}

// Accented text must survive as text, whichever way the parser emits it.
test('accented characters survive', () => {
  const out = sanitizeHtml('<p>caf&eacute;</p>');
  assert.ok(/caf(é|&eacute;)/.test(out), `lost accent — got ${out}`);
});

// ── contract edges ───────────────────────────────────────────────────────────
test('nullish and empty input return an empty string', () => {
  assert.equal(sanitizeHtml(null), '');
  assert.equal(sanitizeHtml(undefined), '');
  assert.equal(sanitizeHtml(''), '');
});

test('a stripped script contributes no visible text', () => {
  // `nonTextTags` matters here: without it the payload reflows into the document
  // as readable body copy instead of vanishing.
  assert.doesNotMatch(sanitizeHtml('<script>alert(1)</script>'), /alert/);
  assert.doesNotMatch(sanitizeHtml('<style>body{display:none}</style>'), /display/);
});

test('plain text passes through unchanged', () => {
  assert.equal(sanitizeHtml('Just words.'), 'Just words.');
});

// ── runner ───────────────────────────────────────────────────────────────────
let passed = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures.push({ name, err });
    console.log(`  FAIL ${name}`);
    console.log(`         ${err.message.split('\n')[0]}`);
  }
}
console.log(`\n${passed}/${tests.length} passed.`);
if (failures.length) {
  console.error('\nFailures:');
  for (const { name, err } of failures) {
    console.error(`  ${name}`);
    console.error(err.message);
  }
  process.exit(1);
}
