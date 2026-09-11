/**
 * Customer-story key-metrics — the read side of `customer_stories.stats`
 * (portal migration 00395, brik-client-portal#3982).
 *
 * The column is a nullable `jsonb` holding an ordered array of value/label
 * pairs the Figma story template renders as the rail stats card (node
 * `25967:10172`, `col_stats`) — e.g. "24 · Hours Saved". Mirrors
 * `customer-story-sections.ts` / `-author.ts`: it narrows the untyped payload
 * at the render boundary, because brikdesigns' Supabase client is not
 * generic-typed (`getCustomerStoryBySlug` returns raw `data` from
 * `.select('*')`, src/lib/supabase/queries.ts).
 *
 * `value` is a string, not a number, so it can carry the units/symbols the
 * design shows ("24", "$12k", "3×"); the card renders it verbatim.
 */

/** One value/label pair in the rail stats card (Figma `col_stats`). */
export interface CustomerStoryStat {
  value: string;
  label: string;
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

/**
 * Narrow the raw `stats` column to renderable value/label pairs.
 *
 * Returns `[]` for a null/absent column, a non-array, or an array of malformed
 * entries — the rail then renders the TOC alone, which is the correct degraded
 * state, not an error. Order is the array's order (the order the CMS set).
 */
export function parseStoryStats(raw: unknown): CustomerStoryStat[] {
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((entry): CustomerStoryStat[] => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const { value, label } = entry as Record<string, unknown>;
    if (!isNonEmptyString(value) || !isNonEmptyString(label)) return [];
    return [{ value: value.trim(), label: label.trim() }];
  });
}
