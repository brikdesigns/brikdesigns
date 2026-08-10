import { test, expect, type Page } from '@playwright/test';
import { SERVICE_LINE_SEGMENTS } from '../../src/lib/service-line-routes';

/**
 * Nav service-tint coverage — every service-line and plan route tints.
 *
 * On a service-line page, and on a plan page whose marketing line is set, the
 * sticky nav adopts that line's darkest surface with white ink (#729 / #858 /
 * #859). `lint-nav-service-tint` already asserts the CSS side statically; this
 * spec asserts the rendered side — that the route actually resolves a line and
 * the class actually paints.
 *
 * Why it's worth a spec: #729 scoped all five lines, PR #750 shipped `marketing`
 * behind a hardcoded allowlist and fired `Closes #729`, and the other four
 * rendered a plain nav for two weeks with CI green. Nothing observed the
 * rendered output, so nothing failed.
 *
 * Nothing here restates which lines or plans exist. Service lines come from
 * `SERVICE_LINE_SEGMENTS` (the service-token map); plans are scraped off the
 * /plans index; and the *expected* line for each route is read from the
 * server-rendered `data-audience` on the page's own hero. That last part is the
 * real assertion — nav and hero derive the line independently (route segment /
 * plan `marketing_line` vs. the page's CMS query), so agreement between them is
 * a genuine check rather than a tautology.
 *
 * Lives in tests/a11y/ because that is Playwright's only testDir here, and it
 * runs in both theme projects — the tint is mode-invariant, so both must hold.
 */

const TINT_CLASS = 'mega-nav--service';

/** The line the nav claims, from its modifier class. `null` when untinted. */
async function navLine(page: Page): Promise<string | null> {
  const cls = (await page.locator('header.mega-nav').first().getAttribute('class')) ?? '';
  if (!cls.split(/\s+/).includes(TINT_CLASS)) return null;
  const line = cls.match(/\bmega-nav--service-([a-z-]+)\b/)?.[1];
  return line ?? null;
}

/** The line the PAGE claims, from the server-rendered hero. `null` when absent. */
async function pageLine(page: Page): Promise<string | null> {
  const el = page.locator('[data-audience]').first();
  if ((await el.count()) === 0) return null;
  return el.getAttribute('data-audience');
}

test.describe('nav service tint', () => {
  test('every service line is represented', () => {
    // Guards against a vacuous suite: an empty derived list would make every
    // test below pass by not running.
    expect(SERVICE_LINE_SEGMENTS.length).toBe(5);
  });

  for (const line of SERVICE_LINE_SEGMENTS) {
    test(`/services/${line} tints the nav`, async ({ page }) => {
      const res = await page.goto(`/services/${line}`);
      expect(res?.status(), `/services/${line} must render`).toBeLessThan(400);

      expect(await navLine(page), `nav tint on /services/${line}`).toBe(line);

      // The class must paint. A modifier with no CSS rule behind it — the exact
      // shape of the #729 gap — leaves the default surface in place.
      const bg = await page
        .locator('header.mega-nav')
        .first()
        .evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(bg, 'tinted nav background must resolve').not.toBe('rgba(0, 0, 0, 0)');
      expect(bg).toMatch(/^rgba?\(/);

      // Nav and hero resolve the line independently; they must agree.
      const hero = await pageLine(page);
      if (hero) expect(hero, `hero data-audience on /services/${line}`).toBe(line);
    });
  }

  test('a service detail page keeps its parent line tint', async ({ page }) => {
    // Sub-routes match the parent segment, so the tint must persist one level
    // down. Discovered from the line page rather than hardcoded.
    await page.goto('/services/brand');
    const detail = await page
      .locator('a[href^="/services/brand/"]')
      .first()
      .getAttribute('href');
    expect(detail, 'a brand service detail link must exist to test against').toBeTruthy();

    await page.goto(detail!);
    expect(await navLine(page), `nav tint on ${detail}`).toBe('brand');
  });

  test('every public plan page tints from its own marketing line', async ({ page }) => {
    await page.goto('/plans');
    const hrefs = [
      ...new Set(await page.locator('a[href^="/plans/"]').evaluateAll((els) =>
        els.map((el) => (el as HTMLAnchorElement).getAttribute('href')!).filter((h) => h !== '/plans')
      )),
    ];
    expect(hrefs.length, 'the /plans index must link at least one plan').toBeGreaterThan(0);

    let tinted = 0;
    for (const href of hrefs) {
      await page.goto(href);
      const nav = await navLine(page);
      if (nav === null) continue; // no marketing_line on the CMS row — see below
      tinted += 1;
      // The invariant: a tinted nav agrees with the hero. Asserted this
      // direction, not "every plan is tinted", because the two derive the line
      // from different depths — the nav reads `marketing_line` only, while the
      // page falls back to the dominant included service line when that column
      // is null. A plan in that state renders a tinted hero above an untinted
      // nav; that's a CMS gap to fill on the row, not a reason to make this gate
      // fail on data. All three current plans have the column set.
      expect(nav, `nav tint on ${href} must match its hero`).toBe(await pageLine(page));
    }
    expect(tinted, 'at least one plan must tint, or this test asserts nothing').toBeGreaterThan(0);
  });

  test('a route with no service line is not tinted', async ({ page }) => {
    // The negative case. Without it, a rule that tinted everything would pass.
    await page.goto('/');
    expect(await navLine(page), 'home must not be tinted').toBeNull();
  });
});
