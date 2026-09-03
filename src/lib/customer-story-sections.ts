/**
 * Customer-story flexible sections — the type ⇄ wire contract for
 * `customer_stories.sections` (brikdesigns#1205).
 *
 * The column is a nullable `jsonb` added by portal migration for
 * brik-client-portal#3768; the portal validates on write with a Zod
 * `CustomerStorySection[]` schema. This module is the read side: it narrows
 * the untyped payload at the render boundary, exactly as `blocks.ts` does for
 * `events.blocks`.
 *
 * Narrowing is not belt-and-braces here — brikdesigns' Supabase client is not
 * generic-typed (`getCustomerStoryBySlug` returns raw `data` from
 * `.select('*')`, src/lib/supabase/queries.ts:461-476), so nothing upstream of
 * this function has checked the shape.
 *
 * Every row carries `sections` since the brik-client-portal#3770 backfill
 * (migration 00374), and the legacy `the_challenge` / `the_solution` /
 * `results` columns are dropped — this is the only narrative source.
 */

/** A single titled prose section, with an optional titled bullet list. */
export interface CustomerStorySection {
  /** Stable uuid from the portal — React key and reorder anchor. */
  id: string;
  /** TOC label and section heading; slugified into the `#anchor`. */
  title: string;
  /** HTML string, same authoring convention as `the_challenge`. */
  body: string;
  /** Figma "Highlights" block — optional titled bullet list. */
  list?: { title?: string | null; items: string[] } | null;
}

/**
 * Anchor id for a section. Derived from the title rather than the uuid so the
 * URL fragment is readable and stable across a reorder; `index` disambiguates
 * two sections that slugify identically, which the portal does not prevent.
 */
export function sectionAnchorId(title: string, index: number): string {
  const slug = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug ? `story-${slug}` : `story-section-${index + 1}`;
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function parseList(raw: unknown): CustomerStorySection['list'] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const { title, items } = raw as { title?: unknown; items?: unknown };
  if (!Array.isArray(items)) return null;
  const kept = items.filter(isNonEmptyString);
  if (kept.length === 0) return null;
  return { title: isNonEmptyString(title) ? title : null, items: kept };
}

/**
 * Narrow the raw `sections` column to renderable sections.
 *
 * Returns `[]` when there is nothing renderable — a null/absent column, a
 * non-array, or an array of malformed entries. That used to return `null` to
 * select the fixed template; the template is gone (brik-client-portal#3770),
 * so an empty result now renders the rail, quote and media with no narrative
 * body rather than falling back. Reaching it means a row violated the portal's
 * write-time Zod schema, which is a data-integrity bug, not a supported state.
 *
 * A section needs a `title` (it is the TOC label) and either a `body` or a
 * list; individual malformed entries are dropped rather than failing the page.
 */
export function parseStorySections(raw: unknown): CustomerStorySection[] {
  if (!Array.isArray(raw)) return [];

  const sections = raw.flatMap((entry, index): CustomerStorySection[] => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const { id, title, body, list } = entry as Record<string, unknown>;
    if (!isNonEmptyString(title)) return [];

    const parsedList = parseList(list);
    const parsedBody = isNonEmptyString(body) ? body : '';
    if (!parsedBody && !parsedList) return [];

    return [
      {
        id: isNonEmptyString(id) ? id : `section-${index}`,
        title,
        body: parsedBody,
        list: parsedList,
      },
    ];
  });

  return sections;
}
