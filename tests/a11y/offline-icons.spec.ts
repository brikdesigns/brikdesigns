import { test, expect } from '@playwright/test';
import { gotoRendered, expectMeasured } from './lib/goto-rendered';

/**
 * Offline-icon gate — brikdesigns.com (#1372, protecting #626).
 *
 * Invariant: rendering a plan page makes ZERO requests to
 * `api.iconify.design`. Every `ph:*` glyph resolves from the bundled subset
 * `src/lib/icons.generated.json`, registered by `addCollection` in
 * `src/lib/icon.ts`.
 *
 * ── Why a network assertion and not just `gen:icons:check` ────────────────
 *
 * `npm run gen:icons:check` is a SOURCE-scan gate. It reads only `.ts`/`.tsx`
 * files (`gen-icon-collection.mjs:41,44`), so it can prove the generated set
 * matches the literals in source and nothing more. The moment a glyph name
 * arrives from somewhere the scanner cannot see — a Supabase column, a CMS
 * payload, a runtime concatenation — the check stays green while the glyph is
 * missing from the bundle, Iconify falls through to its CDN, and the icon
 * either pops in late or renders as nothing when the CDN is blocked.
 *
 * That is exactly the failure `plan-coverage-icons.ts` was written to make
 * impossible: the CMS stores a semantic `icon_key`, and the `ph:*` literal
 * lives in source where the scanner sees it. This spec is the gate that
 * notices if that discipline is ever bypassed, because it measures the ONE
 * observable the source scan cannot reach — the actual request.
 *
 * ── Why the render precondition matters more here than elsewhere ──────────
 *
 * "Zero CDN requests" is trivially true of a page that rendered nothing. A 500,
 * a blank shell, or a route that lost its icons entirely all produce an empty
 * request list and would pass. So the assertion is two-sided: no CDN request
 * AND at least one Iconify-rendered glyph actually on the page. `expectMeasured`
 * fails loudly when the second half is empty, which is #1021's rule applied to
 * a network sweep rather than a DOM sweep.
 *
 * ── Why the pattern is a host match, not an exact URL ─────────────────────
 *
 * Iconify's fallback composes its own URL (`/ph.json?icons=…`), and the SDK has
 * more than one API entry point. Matching the host catches every shape,
 * including a future `api2.iconify.design` mirror, without this spec having to
 * track the SDK's URL construction.
 */

/** Any Iconify CDN host — see the header note on why this is not an exact URL. */
const ICONIFY_CDN = /iconify\.design/;

/**
 * Plan surfaces. Both, because they carry different icon call sites: the index
 * renders the engagement-mode chips (`plans/page.tsx`), and the detail route is
 * where #1371's coverage-row chips will render from `icon_key`.
 */
const SURFACES = [
  { path: '/plans', name: 'Plans index' },
  { path: '/plans/back-office-support', name: 'Plan detail — back-office' },
] as const;

test.describe('Offline icons — no Iconify CDN request', () => {
  for (const surface of SURFACES) {
    test(`${surface.name} (${surface.path})`, async ({ page }) => {
      const cdnRequests: string[] = [];
      page.on('request', (req) => {
        if (ICONIFY_CDN.test(req.url())) cdnRequests.push(req.url());
      });

      await gotoRendered(page, surface.path);
      await page.waitForLoadState('networkidle');

      // Iconify renders each glyph as an <svg> carrying the icon name in
      // `aria-label`/`class`; the stable marker across versions is the
      // `iconify` class it always applies. Counting these is the proof the
      // sweep had something to observe — see the header note.
      const measured = await page.locator('svg.iconify').count();
      expectMeasured(
        measured,
        `${surface.name} — Iconify glyphs`,
        'no Iconify-rendered glyph found, so "zero CDN requests" proves nothing'
      );

      expect(
        cdnRequests,
        `${surface.name} fetched ${cdnRequests.length} icon(s) from the Iconify CDN. ` +
          `A glyph is missing from src/lib/icons.generated.json — run ` +
          `\`npm run gen:icons\`, and if the name came from the CMS, map it ` +
          `through a source-side vocabulary (see src/lib/plan-coverage-icons.ts).`
      ).toEqual([]);
    });
  }
});
