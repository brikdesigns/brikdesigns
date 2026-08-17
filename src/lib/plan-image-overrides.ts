/**
 * Per-plan illustration overrides — keyed by `service_plans.slug`.
 *
 * A plan's card/hero image normally resolves from its display_line
 * `card_image_url` (the single CMS source, #467). This map lets a plan opt out
 * of that line illustration where marketing wants a bespoke image the CMS
 * line-image can't supply. Applied everywhere the plan surfaces (nav card,
 * /plans grid, plan hero, related-plans cards) so the image can't disagree
 * across surfaces — take `PLAN_IMAGE_OVERRIDES[slug] ?? <resolved image>`.
 */
export const PLAN_IMAGE_OVERRIDES: Record<string, string> = {
  // Full Stack Support uses the "Meet Brik" brand illustration rather than the
  // Marketing line's green card image — it's the whole-company retainer, not a
  // single line, so the brand image reads truer than any one line's glyph.
  'full-stack-support': '/images/brik_designs_4x.webp',
};
