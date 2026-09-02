import { test, expect } from '@playwright/test';
import { gotoRendered, expectMeasured } from './lib/goto-rendered';

/**
 * Offering period-suffix gate — brikdesigns.com (#1203).
 *
 * A recurring offering's price must render with its billing period. A monthly
 * retainer displayed as a bare "$3,250" is indistinguishable from a one-time
 * fee, which is a pricing-accuracy defect, not a styling one.
 *
 * THE regression this pins: the service-detail page hand-annotates the offering
 * row inside its `.map()` callback rather than deriving the type from the DB
 * schema, and it asked for `billing_frequency` — a column that does not exist
 * (`offerings` has `frequency`). The query is `offerings(*)`, so the field
 * arrived `undefined`, `formatPeriod()` returned undefined at its `if (!key)`
 * guard, and `PricingCard` rendered no period span. TypeScript could not catch
 * it: the annotation was wrong, not unassignable.
 *
 * Why measured against the live page rather than a unit test on formatPeriod:
 * `formatPeriod` was correct the whole time. The defect lived in the field name
 * passed to it, so any test calling the function directly passes on the broken
 * build. Only rendering the real row through the real query catches a column
 * that isn't there.
 *
 * ── Why one named card, and not "every priced card" ───────────────────────
 *
 * The obvious assertion — every card with a "$" price has a period — is WRONG
 * here, and reddens on correct code. This route renders four cards; three are
 * `service_type=one_time` (Marketing Audit, and both Press Release tiers) and
 * PERIOD_SUFFIXES maps `one_time` to null BY DESIGN, so a bare amount is their
 * correct output. Only `fractional-cmo-strategic-marketing-oversight` is
 * `recurring`/`monthly`. The DOM exposes no frequency to discriminate on, so
 * the card is addressed by title.
 *
 * The assertion is on the SHAPE of the suffix, not the amount. Prices are
 * CMS-controlled and change without code; asserting "$3,250" would make this
 * spec a pricing tripwire that reddens on an ordinary catalog edit.
 */

/** Suffixes PERIOD_SUFFIXES can emit for a recurring offering. */
const PERIOD_PATTERN = /^\/(month|quarter|year|hour)$/;

const ROUTE = '/services/marketing/marketing-consulting';

/**
 * `offerings.name` of the one public recurring offering on this route (slug
 * `fractional-cmo-strategic-marketing-oversight`, `frequency=monthly`).
 *
 * If it is ever unpublished, renamed, or switched to one_time, the lookup below
 * finds nothing and `expectMeasured` fails LOUDLY rather than passing on an
 * empty sweep — so the route gets re-picked instead of the gate quietly rotting
 * into a no-op. Three other public recurring priced offerings exist
 * (`product-support`, `templated-website-design-development`,
 * `email-marketing-ongoing-management`) if a replacement is needed.
 */
const RECURRING_CARD_TITLE = 'Fractional CMO and Strategic Marketing Oversight';

/**
 * The three `one_time` offerings on this route. They are asserted to render NO
 * suffix, which pins the other half of #1203: PERIOD_SUFFIXES maps `one_time`
 * to a deliberate `null`, and a `??` fallback cannot distinguish that from an
 * unmapped key — it renders "/one time", the exact string the table exists to
 * prevent. That bug was latent while the frequency never arrived; fixing the
 * column name unmasked it. Without this half, a reintroduced `??` passes.
 */
const ONE_TIME_CARD_TITLES = [
  'Comprehensive Marketing Audit and Consultation',
  'Press Release + Distribution',
  'Press Release + Distribution + Media Pitching',
];

test.describe('Offering price period suffix', () => {
  test(`${ROUTE} renders a period beside its recurring price`, async ({ page }) => {
    await gotoRendered(page, ROUTE);

    const cards = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.bds-pricing-card')).map((card) => ({
        title: card.querySelector('.bds-pricing-card__title')?.textContent?.trim() ?? '',
        price: card.querySelector('.bds-pricing-card__price')?.textContent?.trim() ?? '',
        period: card.querySelector('.bds-pricing-card__period')?.textContent?.trim() ?? null,
      })),
    );

    expectMeasured(cards.length, ROUTE, 'pricing cards');

    const recurring = cards.filter((c) => c.title === RECURRING_CARD_TITLE);
    expectMeasured(
      recurring.length,
      ROUTE,
      `pricing cards titled "${RECURRING_CARD_TITLE}" (the recurring offering this gate measures)`,
    );

    for (const card of recurring) {
      expect(
        card.period,
        `${ROUTE}: "${card.title}" is a recurring offering but rendered ` +
          `${card.price} with no billing period. A monthly retainer with no ` +
          `"/month" reads as a one-time fee (#1203).`,
      ).not.toBeNull();

      expect(
        card.period,
        `${ROUTE}: "${card.title}" rendered an unrecognised period suffix ` +
          `${JSON.stringify(card.period)} — expected one of /month, /quarter, /year, /hour.`,
      ).toMatch(PERIOD_PATTERN);
    }

    const oneTime = cards.filter((c) => ONE_TIME_CARD_TITLES.includes(c.title));
    expectMeasured(oneTime.length, ROUTE, 'one_time pricing cards');

    const spurious = oneTime.filter((c) => c.period !== null);
    expect(
      spurious,
      `${ROUTE}: one_time offering(s) rendered a period suffix. PERIOD_SUFFIXES ` +
        `maps one_time to null so the price stands alone; a "/one time" suffix ` +
        `means the null was treated as unmapped (#1203). Got: ${JSON.stringify(spurious)}`,
    ).toEqual([]);
  });
});
