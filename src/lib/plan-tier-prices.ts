/**
 * Tier prices for a plan card, read off the `service_plan_tiers` embed that
 * `getSupportPlans()` carries.
 *
 * One helper rather than the same `.find()` pair repeated on each surface: the
 * Monthly Subscription band is "one card, one join, four surfaces" by ratified
 * constraint (`.claude/references/surfaces/{home,contact,blog,results}.md`), and
 * the nav dropdown is a fifth reader of the same shape.
 *
 * The plan-level `monthly_price_*` block this replaces is retired — one price
 * concept per level, recurring on the tier (portal#3959 decision A, #1385).
 * Nothing here falls back to it; a plan with no Advisory tier renders 'Contact',
 * which is what the plan-level read did for a null price anyway.
 */

/** The shape `getSupportPlans()` returns for its tier embed. */
export interface PlanTierPriceRow {
  name: string;
  monthly_price_display: string | null;
}

export interface PlanTierPrices {
  /** Advisory monthly — the card's headline figure. */
  advisory: string | null;
  /** Managed monthly — named beside the headline, never as the headline. */
  managed: string | null;
}

/**
 * Pick the Advisory and Managed monthly prices off a plan row.
 *
 * Tolerates a row whose embed is absent or empty (a plan with no public tiers,
 * or a caller whose query predates the embed) by returning nulls rather than
 * throwing — the card then reads 'Contact', the same as an unpriced plan.
 */
export function planTierPrices(plan: unknown): PlanTierPrices {
  const tiers = (plan as { service_plan_tiers?: PlanTierPriceRow[] } | null)?.service_plan_tiers;
  if (!Array.isArray(tiers)) return { advisory: null, managed: null };
  const find = (name: string) =>
    tiers.find((t) => t?.name === name)?.monthly_price_display ?? null;
  return { advisory: find('Advisory'), managed: find('Managed') };
}
