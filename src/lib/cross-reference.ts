/**
 * Pure helpers for the cross-reference block (#422), kept out of the React /
 * Supabase render path so the dangling-reference contract is unit-testable.
 */

/**
 * Select curated `items` (preserving their order) or the auto-pull top-N from
 * an already rank-ordered, `is_public`-filtered collection. A curated slug with
 * no matching row (unpublished / deleted) drops out — the cross-reference
 * dangling-reference contract: omit, never throw or 404.
 */
export function selectRows<T extends { slug: string }>(
  rows: T[],
  items: string[] | undefined,
  limit: number,
): T[] {
  if (items?.length) {
    const bySlug = new Map(rows.map((r) => [r.slug, r]));
    return items.map((slug) => bySlug.get(slug)).filter((r): r is T => !!r);
  }
  return rows.slice(0, limit);
}
