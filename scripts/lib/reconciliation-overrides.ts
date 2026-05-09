/**
 * Manual mapping overrides for slug reconciliation.
 *
 * Used by reconcile-slugs.ts (and downstream phase-3/phase-4 scripts) to
 * resolve cases the auto-matcher can't handle — typically a Webflow rename
 * that wasn't propagated to Supabase, or vice versa.
 *
 * Format: CSV slug → Supabase slug. The Supabase row keeps its slug; only
 * the marketing fields get repopulated from the CSV row.
 */

export const SERVICES_OVERRIDES: Record<string, string> = {
  // CSV "Letterhead Stationary" was manually renamed to "Business Stationery"
  // in Supabase. Same service. Keep SB slug; pull CSV content.
  stationary: 'business-stationery',
};

export const OFFERINGS_OVERRIDES: Record<string, string> = {
  // Empty for now — offerings reconciliation deferred to a separate ticket.
};
