/**
 * Customer-story author identity — the type ⇄ wire contract for
 * `customer_stories.author_social_links` (brik-client-portal#3799).
 *
 * The column is a nullable `jsonb` added by portal migration 00376; the portal
 * validates on write with a Zod schema closed to BDS's `SOCIAL_ICON_PLATFORMS`.
 * This module is the read side, mirroring `customer-story-sections.ts`: it
 * narrows the untyped payload at the render boundary.
 *
 * Narrowing is not belt-and-braces — brikdesigns' Supabase client is not
 * generic-typed (`getCustomerStoryBySlug` returns raw `data` from `.select('*')`,
 * src/lib/supabase/queries.ts:461-476), so nothing upstream has checked the
 * shape. A platform outside the bundled set renders no mark at all, so it is
 * dropped here rather than handed to `<SocialIcon>`.
 */

import type { SocialIconPlatform } from '@brikdesigns/bds';

/**
 * The platforms `<SocialIcon>` can resolve, as a lookup.
 *
 * `Record<SocialIconPlatform, true>` makes exhaustiveness a COMPILE error: a
 * platform BDS adds fails to typecheck here until it is listed, and one BDS
 * removes fails as an excess property. That is a stronger guarantee than
 * reading `SOCIAL_ICON_PLATFORMS` at runtime, and it costs nothing — the type
 * import is erased, so this module pulls in no BDS runtime code and stays
 * loadable outside the Next bundler (scripts/test-customer-story-author.mjs).
 */
const RENDERABLE_PLATFORMS: Record<SocialIconPlatform, true> = {
  apple: true,
  bing: true,
  facebook: true,
  google: true,
  instagram: true,
  linkedin: true,
  tiktok: true,
  twitter: true,
  yelp: true,
  youtube: true,
};

/** Every platform the hero can render, in BDS's own order. */
export const RENDERABLE_PLATFORM_LIST = Object.keys(
  RENDERABLE_PLATFORMS
) as SocialIconPlatform[];

/** One social link on the hero's author row (Figma 25944:9430). */
export interface CustomerStorySocialLink {
  platform: SocialIconPlatform;
  url: string;
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function isPlatform(v: unknown): v is SocialIconPlatform {
  return typeof v === 'string' && Object.hasOwn(RENDERABLE_PLATFORMS, v);
}

/**
 * Narrow the raw `author_social_links` column to renderable links.
 *
 * Returns `[]` for a null/absent column, a non-array, or an array of malformed
 * entries — the author row then renders identity-only, which is the correct
 * degraded state, not an error. Author order is the array's order, which is the
 * order the CMS editor set.
 */
export function parseStorySocialLinks(raw: unknown): CustomerStorySocialLink[] {
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((entry): CustomerStorySocialLink[] => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const { platform, url } = entry as Record<string, unknown>;
    if (!isPlatform(platform) || !isNonEmptyString(url)) return [];
    return [{ platform, url: url.trim() }];
  });
}
