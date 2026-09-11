import { test, expect } from '@playwright/test';
import { gotoRendered, expectMeasured } from './lib/goto-rendered';

/**
 * Figma band geometry — brikdesigns.com (#1371).
 *
 * Pins the two band measurements the `figma` visual-parity mode measured as
 * wrong on the plan-detail rebuild, so they cannot drift back silently.
 *
 * Why a spec and not just the figma gate: `visual-parity` in `figma` mode is
 * ADVISORY by design (`continue-on-error`, thresholds off until its noise floor
 * is measured — #1392 § Out of scope), and it only runs on the two routes that
 * declare Figma node ids. A percentage also cannot say WHICH dimension moved:
 * the report pads the shorter capture with white, so a height delta and a pixel
 * delta produce the same number and need opposite fixes. These two assertions
 * name the dimension.
 *
 * Both values come from `get_design_context` on the section node, not from a
 * screenshot — a raster carries no padding.
 *
 * ── 1. The plan-detail hero floor ─────────────────────────────────────────
 *
 * Figma `section-hero` 26144:9053 is a 704px frame: `py-[48px]` around a
 * `flex-[1_0_0]` band. `.section-hero` already carries that floor at ≥992px
 * (homepage.css:32-36) — the plan-detail route had it cancelled by a
 * `min-height: 0` written to suppress the BASE rule's `calc(100svh - nav)`,
 * which is already scoped out above 992px. So the override only ever removed
 * the one value that IS the design, and the section measured 341px.
 *
 * Asserted as a floor, not an equality: the band grows if a plan authors a
 * longer name or description, and a taller hero is content doing its job. The
 * defect was the floor going missing.
 *
 * ── 2. The brand CTA panel is ONE geometry, everywhere ────────────────────
 *
 * Figma `section-cta` 26144:9140: section `py-[64px]`, band `py-[104px]`.
 * `marketing-section-reuse.md:20` names `.cta-section-brand` + `.cta-card-brand`
 * the shared implementation of this frame, so every route below renders the
 * same design — and the sweep asserts they agree with each other as well as
 * with Figma. The uniformity half is the half no gate had: a page-local
 * override that re-padded one route's panel would have been invisible, because
 * only `/plans/marketing-support` declares a Figma node to be measured against.
 *
 * Computed style rather than a CSS-source grep, for the reason
 * `card-treatment.spec.ts` gives: what renders is the product of the shared
 * rule and every override that fights it.
 *
 * Geometry is theme-invariant, so the dark project re-runs this as a cheap
 * cross-check rather than a second case.
 */

/** Figma 26144:9053 — the `section-hero` frame height. */
const HERO_FRAME_HEIGHT = 704;

/** Figma 26144:9140 — `section-cta` section `py`, then `container-large` `py`. */
const CTA_SECTION_PADDING_BLOCK = 64;
const CTA_BAND_PADDING_BLOCK = 104;

/**
 * Every route rendering `.cta-section-brand` that has a stable, non-CMS URL.
 * `results/[slug]` and `blog/[slug]` also render it but need a live slug, and
 * they take the same shared rule — the uniformity claim is already covered.
 */
const CTA_ROUTES = [
  { name: 'Home', path: '/' },
  { name: 'About', path: '/about' },
  { name: 'How we work', path: '/how-we-work' },
  { name: 'Plans index', path: '/plans' },
  { name: 'Plan detail — marketing support', path: '/plans/marketing-support' },
  { name: 'Results index', path: '/results' },
  { name: 'Industry detail — dental', path: '/industries/dental' },
  { name: 'Blog index', path: '/blog' },
];

test.describe('Figma band geometry', () => {
  test(`Plan-detail hero holds its ${HERO_FRAME_HEIGHT}px Figma floor`, async ({ page }) => {
    await gotoRendered(page, '/plans/marketing-support');

    const hero = page.locator('section[data-section="hero"]');
    await expect(hero).toHaveCount(1);

    const box = await hero.boundingBox();
    expect(box, 'the hero section has no box — it did not render').not.toBeNull();

    expect(
      Math.round(box!.height),
      `Plan-detail hero is ${Math.round(box!.height)}px against Figma 26144:9053's ` +
        `${HERO_FRAME_HEIGHT}px frame. The band takes its floor from .section-hero ` +
        `(homepage.css:32-36) at ≥992px; check that nothing in plans.css cancels it.`,
    ).toBeGreaterThanOrEqual(HERO_FRAME_HEIGHT);
  });

  test('Brand CTA panel renders one geometry on every route that uses it', async ({ page }) => {
    const offenders: string[] = [];
    let measured = 0;

    for (const route of CTA_ROUTES) {
      await gotoRendered(page, route.path);

      const panels = await page.evaluate(() => {
        const px = (value: string) => Math.round(parseFloat(value) || 0);

        return Array.from(document.querySelectorAll('.cta-section-brand')).map((section) => {
          const band = section.querySelector('.cta-card-brand');
          const sectionStyle = getComputedStyle(section);
          const bandStyle = band ? getComputedStyle(band) : null;

          return {
            hasBand: Boolean(band),
            sectionTop: px(sectionStyle.paddingTop),
            sectionBottom: px(sectionStyle.paddingBottom),
            bandTop: bandStyle ? px(bandStyle.paddingTop) : -1,
            bandBottom: bandStyle ? px(bandStyle.paddingBottom) : -1,
          };
        });
      });

      for (const panel of panels) {
        measured += 1;

        if (!panel.hasBand) {
          offenders.push(`${route.name} — .cta-section-brand with no .cta-card-brand inside it`);
          continue;
        }

        const wrong: string[] = [];
        if (panel.sectionTop !== CTA_SECTION_PADDING_BLOCK || panel.sectionBottom !== CTA_SECTION_PADDING_BLOCK) {
          wrong.push(
            `section padding-block ${panel.sectionTop}/${panel.sectionBottom}px ` +
              `(Figma ${CTA_SECTION_PADDING_BLOCK}px)`,
          );
        }
        if (panel.bandTop !== CTA_BAND_PADDING_BLOCK || panel.bandBottom !== CTA_BAND_PADDING_BLOCK) {
          wrong.push(
            `band padding-block ${panel.bandTop}/${panel.bandBottom}px ` +
              `(Figma ${CTA_BAND_PADDING_BLOCK}px)`,
          );
        }

        if (wrong.length) offenders.push(`${route.name} — ${wrong.join(', ')}`);
      }
    }

    // Every route above is listed because it renders the panel; sweeping none
    // means the pages did not render, not that they are clean (#1021/#1030).
    expectMeasured(measured, 'Brand CTA panel', 'brand CTA panels');

    expect(
      offenders,
      offenders.length
        ? `Brand CTA panel geometry disagrees with Figma 26144:9140:\n` +
            offenders.map((o) => `  ${o}`).join('\n')
        : undefined,
    ).toEqual([]);
  });
});
