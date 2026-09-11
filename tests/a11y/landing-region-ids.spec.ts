import { test, expect } from '@playwright/test';
import { gotoRendered, expectMeasured } from './lib/goto-rendered';

/**
 * Landing-region identifiers — brikdesigns.com (#1420).
 *
 * `lint-section-id` now scans `src/components/blocks`, but it can only see
 * `<section>` tags in source. The regions a landing route is actually addressed
 * by are `<div>`s — `split`, `split-content`, `split-aside`, `split-trailer`
 * (`LandingBlocks.tsx`) — so deleting one of those `data-section` attributes
 * passes every source lint in the repo.
 *
 * That deletion is not hypothetical damage: `visual-parity.mjs` selects
 * `/offers/brikdown`'s two Figma-diffed regions by `[data-section="split"]` and
 * `[data-section="split-trailer"]`. Those selectors were `.lp-split` and
 * `.lp-split__trailer` until #1420 — presentational classnames, where a CSS
 * rename re-pointed the gate at nothing. Moving them onto `data-section` only
 * helps if something asserts the attributes are still rendered, and
 * `visual-parity` cannot be that something: it is `continue-on-error` (#1392
 * § Out of scope) and does not run on every PR.
 *
 * Written against the component's contract rather than a fixed layout per
 * route: which layout a landing route renders is CMS data (`layout: 'split' |
 * 'showcase' | null`), so pinning `/offers/newsletter` to `stacked` would red
 * the suite on an authoring change that broke nothing. The invariant that holds
 * regardless is the one asserted — **every region `LandingBlocks` emits carries
 * an identifier**.
 *
 * `visual-parity.mjs` is deliberately not imported to read its ROUTES: it has no
 * main guard and `process.exit(2)`s at module scope without `NETLIFY_URL`, so an
 * import would kill the test runner. The two selectors it declares are asserted
 * by name below instead, with this note as the link between them.
 */

/**
 * Routes that render through `LandingBlocks`. `/events/demo-spring-webinar` and
 * `/marketing/demo-monthly-newsletter` are deliberately absent: both CMS rows
 * fall back to the legacy per-route templates (`.event-page`, `.marketing-page`
 * — the `00207` empty-blocks contract in `@/lib/blocks`) and emit no `.lp-blocks`
 * at all. Verified against the rendered markup 2026-09-11; the issue's premise
 * that all three routes exercise this component is true of the component's
 * design, not of today's data.
 */
const LANDING_ROUTES = [
  { name: 'Brikdown offer', path: '/offers/brikdown' },
  { name: 'Newsletter offer', path: '/offers/newsletter' },
  { name: 'Free marketing analysis', path: '/offers/free-marketing-analysis' },
  { name: 'Event — showcase layout', path: '/events/grind-after-graduation' },
];

/** The two regions `visual-parity.mjs` diffs against a Figma node. */
const FIGMA_DECLARED = ['[data-section="split"]', '[data-section="split-trailer"]'];

test.describe('Landing-region identifiers', () => {
  for (const route of LANDING_ROUTES) {
    test(`${route.name} — every LandingBlocks region is identified`, async ({ page }) => {
      await gotoRendered(page, route.path);

      const { measured, offenders } = await page.evaluate(() => {
        const root = document.querySelector('.lp-blocks');
        if (!root) return { measured: 0, offenders: ['no .lp-blocks root rendered'] };

        const describe = (el: Element) => `${el.tagName.toLowerCase()}.${el.className}`;
        const bad: string[] = [];
        let count = 0;

        // The section root, plus every region container the component emits.
        // Keyed on the component's own BEM classes — those ARE its region
        // vocabulary, and a region added without an identifier is exactly what
        // this catches.
        const regions = [root, ...root.querySelectorAll('.lp-blocks__container, .lp-split__content, .lp-split__aside')];

        for (const el of regions) {
          count += 1;
          if (!el.getAttribute('data-section')) bad.push(describe(el));
        }

        return { measured: count, offenders: bad };
      });

      expectMeasured(measured, route.name, 'LandingBlocks regions');

      expect(
        offenders,
        offenders.length
          ? `Region(s) render with no data-section — a CSS-only handle again (#1420):\n` +
              offenders.map((o) => `  ${o}`).join('\n')
          : undefined
      ).toEqual([]);
    });
  }

  test('the Figma-diffed selectors resolve on /offers/brikdown', async ({ page }) => {
    // Named explicitly because these two are load-bearing elsewhere: if either
    // stops resolving, `npm run visual-figma` stops comparing that section
    // instead of reporting it worse.
    await gotoRendered(page, '/offers/brikdown');

    for (const selector of FIGMA_DECLARED) {
      const locator = page.locator(selector);
      await expect(locator, `${selector} — declared in visual-parity.mjs ROUTES`).toHaveCount(1);

      const box = await locator.first().boundingBox();
      expect(box?.height ?? 0, `${selector} resolved but has zero height`).toBeGreaterThan(0);
    }
  });
});
