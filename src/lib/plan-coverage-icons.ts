/**
 * Plan-coverage icon vocabulary — the `icon_key` ⇄ glyph contract for the
 * support-plan coverage rows (#1372, consumed by #1371's `section-intro` and
 * `section-details`).
 *
 * The CMS stores a SEMANTIC key, never a `ph:*` string. That is not a style
 * preference — a free-text glyph column silently breaks the offline icon
 * guarantee (#626). `scripts/gen-icon-collection.mjs` builds the bundled subset
 * by scanning source files only:
 *
 *   const SOURCE_EXT = /\.(ts|tsx)$/;   // gen-icon-collection.mjs:41
 *   const PH_REF = /ph:[a-z0-9-]+/g;    // gen-icon-collection.mjs:44
 *
 * A value living in Supabase is invisible to that scan, so `gen:icons:check`
 * (verify.yml, .husky/pre-commit) stays green while the glyph is absent from
 * `icons.generated.json` — and the icon then falls through to a runtime
 * `api.iconify.design` fetch, the exact regression #626 removed. Keeping every
 * `ph:*` literal in THIS file is what keeps the generator and the CMS in sync.
 *
 * Keys are ROLES, not glyph names — `messaging`, not `chat-circle-text`. A
 * re-skin is then one edit here and zero CMS writes.
 *
 * Glyphs are bare names, so `<Icon>`'s `outline-bold` default supplies the
 * weight (brik-bds#2404). `-fill` is reserved for interaction and status.
 * `lead-nurture` in particular stays outline by the linear-glyph carve-out:
 * `ph:arrows-clockwise` and its `-fill` twin are 2→2 subpaths with identical
 * 8px geometry, so the fill variant is a visual no-op.
 *
 * Brand and platform marks route to `<SocialIcon>`, never `ph:*-logo` — BDS
 * ships a real brand Google mark, brand-colored from `--color-system-google`.
 *
 * Scope: the MARKETING coverage lane. Notion's Back Office list has 7 bullets
 * whose roles are unauthored; per #1372 AC5 this ships marketing-only, and the
 * back-office keys need the operator's read before they are added.
 */

import type { SocialIconPlatform } from '@brikdesigns/bds';

/**
 * The coverage roles the CMS may store in `icon_key`.
 *
 * A union, not a string — an unknown value is a typecheck error at every call
 * site rather than a blank chip at runtime. The portal's DB column constrains
 * to this same set (brikdesigns/brik-client-portal#3959).
 */
export type PlanCoverageIconKey =
  | 'messaging'
  | 'content-calendar'
  | 'campaigns'
  | 'listings'
  | 'lead-nurture'
  | 'reputation';

/**
 * How a coverage row's chip renders.
 *
 * Two shapes because two components own them: Phosphor glyphs go through the
 * site's offline `<Icon>` (`@/lib/icon`), platform marks through BDS's
 * `<SocialIcon>`. Discriminating here — rather than storing a component in the
 * map — keeps this module free of JSX and of BDS runtime code, so the type
 * import is erased and the vocabulary stays readable from a plain node script.
 */
export type PlanCoverageIcon =
  | { readonly kind: 'phosphor'; readonly icon: string }
  | { readonly kind: 'social'; readonly platform: SocialIconPlatform };

/**
 * Role → glyph. Figma binds Font Awesome (node `26144:9066`); code is Phosphor,
 * and translating the two is expected, not a defect (CLAUDE.md § Icons).
 *
 * | key               | Figma FA   | renders                          |
 * |-------------------|------------|----------------------------------|
 * | `messaging`       | `message`  | `ph:chat-circle-text`            |
 * | `content-calendar`| `calendar` | `ph:calendar`                    |
 * | `campaigns`       | `sms`      | `ph:chat-teardrop-text`          |
 * | `listings`        | `google`   | `<SocialIcon platform="google">` |
 * | `lead-nurture`    | `rotate`   | `ph:arrows-clockwise`            |
 * | `reputation`      | *(Notion)* | `ph:star`                        |
 *
 * `Record<PlanCoverageIconKey, …>` makes exhaustiveness a COMPILE error: a key
 * added to the union fails to typecheck until it is mapped here, and a stray
 * key fails as an excess property.
 */
export const PLAN_COVERAGE_ICON: Record<PlanCoverageIconKey, PlanCoverageIcon> =
  {
    messaging: { kind: 'phosphor', icon: 'ph:chat-circle-text' },
    'content-calendar': { kind: 'phosphor', icon: 'ph:calendar' },
    campaigns: { kind: 'phosphor', icon: 'ph:chat-teardrop-text' },
    listings: { kind: 'social', platform: 'google' },
    'lead-nurture': { kind: 'phosphor', icon: 'ph:arrows-clockwise' },
    reputation: { kind: 'phosphor', icon: 'ph:star' },
  };

/** Every coverage role, in the order the map declares them. */
export const PLAN_COVERAGE_ICON_KEYS = Object.keys(
  PLAN_COVERAGE_ICON
) as PlanCoverageIconKey[];

/**
 * Narrow an untyped `icon_key` from the CMS.
 *
 * brikdesigns' Supabase client is not generic-typed (`queries.ts` selects `*`
 * and returns raw `data`), so nothing upstream has checked the column. A key
 * outside the vocabulary resolves to no glyph at all, so callers drop it and
 * render the row text-only — the correct degraded state, not an error.
 */
export function isPlanCoverageIconKey(v: unknown): v is PlanCoverageIconKey {
  return typeof v === 'string' && Object.hasOwn(PLAN_COVERAGE_ICON, v);
}

/** Glyph for a coverage row, or `null` when the key is absent or unknown. */
export function resolvePlanCoverageIcon(v: unknown): PlanCoverageIcon | null {
  return isPlanCoverageIconKey(v) ? PLAN_COVERAGE_ICON[v] : null;
}
