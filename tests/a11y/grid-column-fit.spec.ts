import { test, expect } from '@playwright/test';

/**
 * Grid column-fit gate — brikdesigns.com.
 *
 * Invariant: a grid declaring a FIXED number of columns must render at least
 * that many children. Fewer children than columns leaves a permanently empty
 * trailing column — dead space no viewport width can fill.
 *
 * Why this exists: #1004 removed the SaaS card from the mega-nav industries
 * panel (3 cards left) while `.mega-nav__customers-grid` stayed
 * `repeat(4, 1fr)`. The panel rendered its cards across three quarters of its
 * width with a blank fourth column, and it shipped — because the change that
 * altered the ITEM COUNT (a data filter in MegaNavServer.tsx) was a different
 * file from the one that sets the COLUMN COUNT (MegaNav.css). Nothing tied the
 * two together. This spec is that tie.
 *
 * Why measured (computed style) rather than a CSS grep: the column count that
 * renders is the product of the base rule and every media-query and override
 * above it, and the child count is only knowable after the CMS data resolves.
 * Both are runtime facts.
 *
 * MORE children than columns is correct — that's wrapping. Only a short first
 * row is flagged.
 *
 * Scope note: `repeat(auto-fit, …)` / `auto-fill` grids are self-sizing and
 * resolve to however many columns the content needs, so they cannot violate
 * this. They're skipped by construction — getComputedStyle resolves them to
 * the count actually in use, which for a self-sizing grid always equals the
 * item count (or fewer, when wrapping).
 */

/** Routes whose grids are worth measuring, plus any UI to open first. */
const SURFACES: { path: string; name: string; open?: string }[] = [
  { path: '/', name: 'Mega-nav — industries panel', open: 'Industries' },
  { path: '/', name: 'Mega-nav — services panel', open: 'Services' },
  { path: '/', name: 'Mega-nav — about panel', open: 'About' },
  { path: '/', name: 'Home' },
  { path: '/customers', name: 'Customers' },
  { path: '/services', name: 'Services index' },
  { path: '/plans', name: 'Plans' },
  { path: '/customer-stories', name: 'Customer stories index' },
  { path: '/about', name: 'About' },
];

type Offender = {
  selector: string;
  columns: number;
  children: number;
};

test.describe('Grid column fit — no empty trailing column', () => {
  for (const surface of SURFACES) {
    test(`${surface.name} (${surface.path})`, async ({ page }) => {
      await page.goto(surface.path);
      await page.waitForLoadState('networkidle');

      if (surface.open) {
        // Panels are click-toggled; the grid does not exist in the DOM until
        // open. Wait for the panel to be laid out before measuring — a grid
        // with a zero-size rect is skipped below, so measuring too early makes
        // this spec pass for the wrong reason.
        await page.getByRole('button', { name: surface.open, exact: true }).click();
        const panel = page.locator('.mega-nav__panel');
        await expect(panel.first()).toBeVisible();
        await expect
          .poll(() => panel.first().evaluate((el) => el.getBoundingClientRect().height))
          .toBeGreaterThan(0);
      }

      const offenders: Offender[] = await page.evaluate(() => {
        /** A readable identity for a node: tag + its first few classes. */
        const describe = (el: Element) => {
          const cls = Array.from(el.classList).slice(0, 3).join('.');
          return cls ? `${el.tagName.toLowerCase()}.${cls}` : el.tagName.toLowerCase();
        };

        const found: Offender[] = [];

        for (const el of Array.from(document.querySelectorAll('*'))) {
          const style = getComputedStyle(el);
          if (style.display !== 'grid' && style.display !== 'inline-grid') continue;

          // Skip anything not actually laid out (closed panels, display:none
          // ancestors) — an unrendered grid has no columns to measure.
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;

          // getComputedStyle resolves grid-template-columns to used pixel
          // values, one per column: "240px 240px 240px".
          const tracks = style.gridTemplateColumns.trim();
          if (!tracks || tracks === 'none') continue;
          const columns = tracks.split(/\s+/).length;
          if (columns < 2) continue;

          // Count only children that occupy a grid cell. Absolutely positioned
          // children are out of flow and take no track.
          const children = Array.from(el.children).filter((child) => {
            const cs = getComputedStyle(child);
            return cs.display !== 'none' && cs.position !== 'absolute' && cs.position !== 'fixed';
          }).length;

          if (children > 0 && children < columns) {
            found.push({ selector: describe(el), columns, children });
          }
        }

        return found;
      });

      expect(
        offenders,
        offenders.length
          ? `Grid(s) render fewer children than declared columns, leaving an empty trailing column:\n` +
              offenders
                .map((o) => `  ${o.selector} — ${o.columns} columns, ${o.children} children`)
                .join('\n')
          : undefined
      ).toEqual([]);
    });
  }
});
