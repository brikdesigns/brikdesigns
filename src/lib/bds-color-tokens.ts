import fs from 'node:fs';
import path from 'node:path';

/**
 * BDS color token catalog, parsed from `brik-bds/tokens/figma-tokens.css` at
 * server-side module load. Only `--color-{family}-{tier}` tokens are
 * surfaced — these are the canonical palette swatches consumers should
 * reference. `--text-*`, `--surface-*`, `--background-*`, `--border-*` are
 * semantic roles, not picker options.
 *
 * Stays in sync with BDS automatically: when the submodule bumps, the next
 * server reload re-parses. No manual list to maintain.
 */
export interface BdsColorToken {
  /** CSS variable name e.g. `--color-poppy-light` */
  name: string;
  /** Resolved hex (or other CSS color value) e.g. `#e35335` */
  value: string;
  /** Family slug e.g. `poppy` */
  family: string;
  /** Tier slug e.g. `light` */
  tier: string;
  /** Optional comment from the CSS source — explains intended use */
  comment?: string;
}

let cached: BdsColorToken[] | null = null;

const TOKEN_LINE_RE =
  /--color-([a-z]+(?:-[a-z]+)*)-(lightest|lighter|light|base|dark|darker|darkest):\s*([^;]+);(?:\s*\/\*\*?\s*([^*]+)\s*\*\/)?/g;

function parseTokens(): BdsColorToken[] {
  const cssPath = path.join(
    process.cwd(),
    'brik-bds',
    'tokens',
    'figma-tokens.css',
  );
  const css = fs.readFileSync(cssPath, 'utf-8');

  const out: BdsColorToken[] = [];
  for (const match of css.matchAll(TOKEN_LINE_RE)) {
    const [, family, tier, rawValue, rawComment] = match;
    out.push({
      name: `--color-${family}-${tier}`,
      value: rawValue.trim(),
      family,
      tier,
      comment: rawComment?.trim(),
    });
  }
  return out;
}

export function getBdsColorTokens(): BdsColorToken[] {
  if (cached) return cached;
  cached = parseTokens();
  return cached;
}

const TIER_ORDER: Record<string, number> = {
  lightest: 0,
  lighter: 1,
  light: 2,
  base: 3,
  dark: 4,
  darker: 5,
  darkest: 6,
};

/**
 * Group tokens by family, with tiers sorted lightest → darkest within each.
 * Annotation/UI families (grayscale, annotation-*) are excluded — they're
 * not brand colors a picker should suggest.
 */
export function getGroupedBdsColorTokens(): {
  family: string;
  tokens: BdsColorToken[];
}[] {
  const tokens = getBdsColorTokens().filter(
    (t) => !t.family.startsWith('annotation') && t.family !== 'grayscale',
  );
  const byFamily = new Map<string, BdsColorToken[]>();
  for (const t of tokens) {
    const arr = byFamily.get(t.family) ?? [];
    arr.push(t);
    byFamily.set(t.family, arr);
  }
  for (const arr of byFamily.values()) {
    arr.sort((a, b) => (TIER_ORDER[a.tier] ?? 99) - (TIER_ORDER[b.tier] ?? 99));
  }
  return [...byFamily.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([family, tokens]) => ({ family, tokens }));
}
