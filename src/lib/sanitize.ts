import DOMPurify from 'isomorphic-dompurify';

/**
 * Server-side HTML sanitization for admin-authored CMS rich text
 * (events.description_html). Defense-in-depth: the portal CMS already
 * sanitizes on write (DOMPurify in the uploader), this guards the render
 * path so a stored payload can never inject script/handlers into the public
 * page. Runs in the Server Component at ISR time — no client bundle cost.
 */
export function sanitizeHtml(dirty: string | null | undefined): string {
  if (!dirty) return '';
  return DOMPurify.sanitize(dirty, { USE_PROFILES: { html: true } });
}
