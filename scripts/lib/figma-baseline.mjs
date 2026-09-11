/**
 * Figma-baseline helpers for `REFERENCE_MODE=figma` (#1392).
 *
 * The existing three modes compare a whole page against another RENDERING of a
 * page — Webflow, staging, or a blessed capture of our own pipeline. None of
 * them can answer "does this match the design of record", which is the question
 * every fidelity defect on the Figma rebuilds turned out to be (#1287 shipped 2
 * of 6 designed card slots; #1371's price overlapped its title). This mode makes
 * the Figma node the reference.
 *
 * Per SECTION, not per page, deliberately: a plan-detail page is ~6000px of
 * mostly CMS copy, and copy drift would drown a layout regression in the
 * aggregate. A section is also the unit the design is authored in — the Figma
 * frames are literally named `section-hero`, `section-intro`, `section-cta`.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

/** Figma frames for brikdesigns.com are authored at this width. */
export const FIGMA_FRAME_WIDTH = 1440;

/**
 * Node ids appear in two spellings and only one of them is the API's.
 *
 * A Figma URL carries `node-id=26144-9047` (hyphen), while the REST and Plugin
 * APIs both want `26144:9047` (colon). Copying the id out of the address bar is
 * the normal way to get one, so the hyphen form is what lands in a ticket — and
 * `/v1/images` answers an unknown id with `err: null` and no entry for it rather
 * than an error, which reads as "the export produced nothing" instead of "the id
 * is in the wrong spelling".
 */
export function normalizeNodeId(nodeId) {
  return String(nodeId).trim().replace(/-/g, ':');
}

/**
 * The element to screenshot for a declared section.
 *
 * Defaults to the `data-section` convention (.claude/references/section-identification.md)
 * because that is what a marketing route carries. An explicit `selector` covers
 * the two shapes that convention does not reach:
 *
 *   - a BDS blueprint section, which identifies itself with `aria-labelledby`
 *     rather than `data-section` (`/plans/[slug]`'s "What You Get" CardGrid
 *     emits `aria-labelledby="what-you-get-title"`);
 *   - a CMS landing route, whose regions are `<div>`s inside ONE `<section>`
 *     (`/offers/brikdown` renders `.lp-split` + `.lp-split__trailer`).
 *
 * Declaring the selector keeps this gate additive. The alternative — making
 * every designed region a top-level `<section data-section>` — is a DOM change
 * to shared block rendering that `/events` and `/marketing` also render through,
 * which is a different ticket from "diff the build against the design".
 */
export function resolveSectionSelector(key, section) {
  if (section && typeof section === 'object' && section.selector) return section.selector;
  return `[data-section="${key}"]`;
}

/**
 * Normalize a route's `figma` declaration into a flat, ordered section list.
 *
 * Both spellings are accepted so a route that needs no selector override stays
 * a one-liner:
 *
 *   sections: { hero: '26144:9053' }
 *   sections: { hero: { node: '26144:9053', selector: '.lp-split' } }
 */
export function figmaSections(route) {
  const declared = route?.figma?.sections;
  if (!declared) return [];
  return Object.entries(declared).map(([key, section]) => ({
    key,
    nodeId: normalizeNodeId(typeof section === 'string' ? section : section.node),
    selector: resolveSectionSelector(key, section),
  }));
}

/** Baseline PNG for one section. Flat directory, one file per route+section. */
export function figmaBaselinePath(baselineDir, routeName, sectionKey) {
  return path.join(baselineDir, `${routeName}-${sectionKey}.png`);
}

/**
 * Ask Figma for a rendered PNG of each node.
 *
 * REST, not the Plugin API. The Pro-plan restriction the figma-workflow skill
 * documents is scoped to `file_variables:read/write` — image export is not
 * behind it, and `GET /v1/images/:key` answered 200 with a signed S3 URL for
 * node 26144:9047 on the Pro PAT (probed 2026-09-11). That matters because the
 * Plugin API transports cannot serve this at all: the relay binds localhost so
 * it is unavailable headless, and `use_figma` returns into a model context
 * rather than to a file.
 *
 * `err` is null on a request that resolved nothing, so a missing id shows up as
 * an absent map entry. The caller names the id it asked for.
 */
// `scale = 1` by default, and it is load-bearing rather than a preference: the
// browser captures a 1440 CSS-pixel-wide section as 1440 physical pixels, so a
// scale-2 export would be 2880 wide and every comparison would be padding one
// side to twice the other's width — a ~50% diff that says nothing about the
// design. Raise it only if the capture's deviceScaleFactor rises to match.
export async function exportFigmaNodes(fileKey, nodeIds, { token, scale = 1, format = 'png', fetchImpl = fetch } = {}) {
  if (!token) throw new Error('exportFigmaNodes: no Figma token — set FIGMA_ACCESS_TOKEN');
  if (!nodeIds.length) return {};
  const ids = nodeIds.map(normalizeNodeId).join(',');
  const url = `https://api.figma.com/v1/images/${fileKey}`
    + `?ids=${encodeURIComponent(ids)}&format=${format}&scale=${scale}`;
  const res = await fetchImpl(url, { headers: { 'X-Figma-Token': token } });
  if (!res.ok) {
    throw new Error(`Figma image export failed: ${res.status} ${res.statusText} (file ${fileKey})`);
  }
  const body = await res.json();
  if (body.err) throw new Error(`Figma image export failed: ${body.err} (file ${fileKey})`);
  return body.images ?? {};
}

/** Fetch a rendered PNG to disk. */
export async function downloadTo(url, outPath, { fetchImpl = fetch } = {}) {
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`baseline download failed: ${res.status} ${res.statusText}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, buf);
  return buf.length;
}

/**
 * Which declared sections have no checked-in baseline.
 *
 * Mirrors mockup mode's refusal (#822/#825): a section with no reference is a
 * comparison that silently does not happen, and a silently-skipped comparison
 * reads as a pass. That is the exact shape of the defect this gate exists to
 * catch, so it is a hard failure rather than a skip.
 */
export function missingFigmaBaselines(routes, baselineDir, { exists = fs.existsSync } = {}) {
  const missing = [];
  for (const route of routes) {
    for (const section of figmaSections(route)) {
      const p = figmaBaselinePath(baselineDir, route.name, section.key);
      if (!exists(p)) missing.push({ route: route.name, section: section.key, path: p });
    }
  }
  return missing;
}
