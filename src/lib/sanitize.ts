import sanitize from 'sanitize-html';

/**
 * Server-side HTML sanitization for admin-authored CMS rich text
 * (`events.description_html`, `prose`/`rich-content` blocks). Runs in the
 * Server Component at ISR time — no client bundle cost.
 *
 * This is the ONLY sanitizer in the path, not defense-in-depth. The portal
 * writes `description_html` straight from a textarea through a bare
 * `z.string().nullable()` (`settings-event-edit-page.tsx` / `events/actions.ts`);
 * its DOMPurify pass is scoped to SVG file uploads (`file-uploader.tsx`) and
 * never sees this field. An earlier version of this comment claimed the portal
 * sanitized on write — it does not.
 *
 * Why `sanitize-html` and not DOMPurify: DOMPurify needs a real DOM, and in Node
 * that means jsdom. jsdom >= 28 CJS-`require()`s the ESM-only `@exodus/bytes` in
 * eight of its own modules, which throws `ERR_REQUIRE_ESM` inside the Netlify
 * function whenever a page renders on demand rather than at build time — every
 * CMS page 500ed one hour after each deploy (brikdesigns#809). Pinning jsdom
 * back to 27.3.0 (the last release before that dependency) is out of semver
 * range for `isomorphic-dompurify`, so the durable fix is to stop needing a DOM
 * at all: `sanitize-html` parses with htmlparser2 and pulls in no DOM library.
 *
 * The lighter DOM shims were both measured and rejected — `linkedom` leaves
 * DOMPurify's `isSupported` undefined so `sanitize()` returns its input
 * unchanged, and `happy-dom` reports `isSupported: true` while still passing
 * `<script>` and `onload` through. Both fail open; see the issue for the runs.
 *
 * The allowlist below tracks what DOMPurify's `USE_PROFILES: { html: true }`
 * emitted for this content, so existing rows render unchanged. Deliberate
 * departures: `<form>`/`<input>`/`<button>` are dropped rather than kept (this
 * is prose, and DOMPurify's html profile admitted them), and `target` is not
 * allowed — matching DOMPurify, which stripped it while keeping `rel`.
 */
const ALLOWED_TAGS = [
  // Block
  'p', 'div', 'section', 'article', 'blockquote', 'pre', 'hr',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'figure', 'figcaption',
  // Inline
  'a', 'span', 'br', 'wbr',
  'strong', 'b', 'em', 'i', 'u', 's', 'del', 'ins', 'mark', 'small',
  'sub', 'sup', 'abbr', 'cite', 'q', 'code', 'kbd', 'samp', 'var', 'time',
  // Media
  'img', 'picture', 'source',
  // Tables
  'table', 'caption', 'colgroup', 'col', 'thead', 'tbody', 'tfoot',
  'tr', 'th', 'td',
];

/**
 * `style` is allowed because DOMPurify's html profile kept it and stored rows may
 * rely on it, but the value is filtered to declarative properties — that closes
 * `url(...)` and legacy `expression(...)` payloads, which an unfiltered `style`
 * attribute would otherwise carry straight through an allowlist.
 */
const ALLOWED_STYLES = {
  '*': {
    color: [/^[#(),.\-\s\w%]+$/],
    'background-color': [/^[#(),.\-\s\w%]+$/],
    'text-align': [/^(left|right|center|justify)$/],
    'text-decoration': [/^[\w\-\s]+$/],
    'font-weight': [/^(normal|bold|bolder|lighter|[1-9]00)$/],
    'font-style': [/^(normal|italic|oblique)$/],
  },
};

const OPTIONS: sanitize.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    a: ['href', 'title', 'rel', 'hreflang'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'decoding', 'srcset', 'sizes'],
    source: ['src', 'srcset', 'sizes', 'type', 'media'],
    time: ['datetime'],
    abbr: ['title'],
    blockquote: ['cite'],
    q: ['cite'],
    ol: ['start', 'reversed', 'type'],
    col: ['span'],
    colgroup: ['span'],
    th: ['colspan', 'rowspan', 'scope', 'abbr', 'headers'],
    td: ['colspan', 'rowspan', 'headers'],
    '*': ['id', 'class', 'dir', 'lang', 'style'],
  },
  allowedStyles: ALLOWED_STYLES,
  // `data:` stays on <img> only — DOMPurify admitted inline image payloads, and
  // an <img> cannot execute one. It is not extended to <a>, where a data: URL
  // is a navigation target.
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https', 'data'], source: ['http', 'https', 'data'] },
  allowedSchemesAppliedToAttributes: ['href', 'src', 'cite', 'srcset'],
  // Drop the *contents* of a stripped <script>/<style>, rather than reflowing the
  // payload into the document as visible text.
  nonTextTags: ['script', 'style', 'textarea', 'option', 'noscript'],
  disallowedTagsMode: 'discard',
  allowVulnerableTags: false,
};

export function sanitizeHtml(dirty: string | null | undefined): string {
  if (!dirty) return '';
  return sanitize(dirty, OPTIONS);
}
