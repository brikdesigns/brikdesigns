import { test, expect } from '@playwright/test';
import { gotoRendered, expectMeasured } from './lib/goto-rendered';
import {
  SLOT_MANIFEST,
  findSlotViolations,
  formatViolation,
  type SlotMeasurement,
} from './lib/slot-manifest';

/**
 * Slot-manifest probe — brikdesigns.com (#1428, AC1 of #1393).
 *
 * THE enforcement for "a slot that was designed still renders something".
 *
 * The declaration lives in `lib/slot-manifest.ts` — what each Figma section
 * node contains, per route, with the node id each slot was read from. This file
 * is only the reader: it measures the declaration against the live DOM and
 * fails when a slot drops under its floor.
 *
 * Why the pair is split that way: the manifest is authored from
 * `get_design_context` and changes when the DESIGN changes; the spec changes
 * when the measuring changes. Keeping them in one file makes a design update
 * look like a test edit in review.
 *
 * ── What this catches that nothing else does ────────────────────────────────
 *
 * Every other gate in the suite asserts something about elements that EXIST.
 * A slot rendering zero elements has nothing to assert on, so it is invisible
 * to all of them — `card-treatment`, `glyph-overlap`, `fill-distinctness` and
 * axe all stay green over a card that lost half its contents. #1287 shipped
 * `/plans` cards with 2 of 6 designed slots and it took until #1304 to notice.
 *
 * ── The gate bites on a LIVE instance, not a hypothetical ───────────────────
 *
 * #1326's lesson is that a gate whose defect class has no live instance passes
 * vacuously and nobody learns it is broken. This one found three real gaps on
 * the seeded route while it was being written — the Foundation rows' indicator
 * (icon_key NULL on all 5), the tier cards' indicator (no slot in the component
 * at all), and section-details' CTA (pending the #3970 reshape). They are
 * recorded as waivers rather than deleted, and a waiver here asserts the gap
 * STILL EXISTS, so the moment one is fixed this spec fails until the waiver is
 * removed.
 *
 * ── Why the self-test has a negative control ────────────────────────────────
 *
 * `#1393`'s convention: the self-test proves the gate bites, the negative
 * control proves it bites for the STATED reason. Removing a slot's elements
 * must fail — but the checker also has to stay silent when the elements are
 * present, or "it failed" would be evidence of nothing. Both run headlessly
 * against the pure `findSlotViolations`, so neither needs a browser and
 * neither can touch a real page.
 */

for (const route of SLOT_MANIFEST) {
  test(`slot manifest — ${route.name}`, async ({ page }) => {
    await gotoRendered(page, route.path);

    const measurements: SlotMeasurement[] = [];

    for (const section of route.sections) {
      const scope = page.locator(section.selector);

      // A section selector that reaches nothing is the #1326 shape: every slot
      // under it would measure 0 and the failure would read as "the page
      // dropped 7 slots" rather than "this one selector is wrong". Fail on the
      // section first, with the node id, so the real cause is the message.
      await expect(
        scope,
        `${route.path}: section \`${section.key}\` not found via \`${section.selector}\` ` +
          `(Figma node ${section.node}). The section was renamed, re-rooted, or removed — ` +
          `fix the declaration rather than the slot floors below it.`,
      ).toHaveCount(1);

      for (const slot of section.slots) {
        measurements.push({
          section: section.key,
          slot: slot.name,
          node: slot.node,
          selector: slot.selector,
          min: slot.min,
          found: await scope.locator(slot.selector).count(),
          waived: slot.waived,
        });
      }
    }

    // The population assertion `fill-distinctness` made load-bearing: a spec
    // that swept nothing reports the same clean result as one that swept
    // everything and found no fault.
    expectMeasured(measurements.length, route.name, 'declared slots');

    const violations = findSlotViolations(measurements);
    expect(
      violations.map(formatViolation),
      `${route.path}: ${violations.length} designed slot(s) off their floor`,
    ).toEqual([]);
  });
}

// ── Self-test: the gate bites ───────────────────────────────────────────────

test('self-test — a slot that drops to zero is reported', () => {
  const violations = findSlotViolations([
    {
      section: 'foundation',
      slot: 'card-vertical › title',
      node: '26170:5764',
      selector: '.plan-coverage-row__title',
      min: 1,
      found: 0,
    },
  ]);
  expect(violations).toHaveLength(1);
  expect(violations[0].kind).toBe('missing');
  expect(formatViolation(violations[0])).toContain('26170:5764');
});

test('self-test — a repeating slot under its floor is reported', () => {
  // The tier grid renders 2 cards. One card silently disappearing is the
  // regression a `min: 1` floor would wave through, which is why repeating
  // slots carry the real count rather than 1.
  const violations = findSlotViolations([
    {
      section: 'engagement-modes',
      slot: 'content-col › card-vertical',
      node: '26144:9107',
      selector: '.plan-tier-card',
      min: 2,
      found: 1,
    },
  ]);
  expect(violations).toHaveLength(1);
  expect(violations[0].kind).toBe('missing');
});

// ── Negative control: it bites for the STATED reason ────────────────────────

test('negative control — a slot at or above its floor is silent', () => {
  // Without this, the self-test above is equally consistent with a checker that
  // reports EVERY slot. Both directions are needed for either to mean anything.
  expect(
    findSlotViolations([
      {
        section: 'foundation',
        slot: 'card-vertical › title',
        node: '26170:5764',
        selector: '.plan-coverage-row__title',
        min: 1,
        found: 5,
      },
      {
        section: 'engagement-modes',
        slot: 'content-col › card-vertical',
        node: '26144:9107',
        selector: '.plan-tier-card',
        min: 2,
        found: 2,
      },
    ]),
  ).toEqual([]);
});

// ── The waiver ratchet ──────────────────────────────────────────────────────

test('a waived slot that is still missing does not fail the gate', () => {
  expect(
    findSlotViolations([
      {
        section: 'foundation',
        slot: 'card-vertical › brik-tag-subscription',
        node: '26170:5762',
        selector: '.bds-tag',
        min: 1,
        found: 0,
        waived: { reason: 'icon_key NULL on every row', issue: 'brikdesigns#1436' },
      },
    ]),
  ).toEqual([]);
});

test('a waived slot that STARTS rendering fails until the waiver is removed', () => {
  // The half that stops a waiver rotting into a rubber stamp. Once the
  // indicators are authored, this gate goes red and the only way to clear it is
  // to delete the waiver — which enforces the slot from then on.
  const violations = findSlotViolations([
    {
      section: 'foundation',
      slot: 'card-vertical › brik-tag-subscription',
      node: '26170:5762',
      selector: '.bds-tag',
      min: 1,
      found: 5,
      waived: { reason: 'icon_key NULL on every row', issue: 'brikdesigns#1436' },
    },
  ]);
  expect(violations).toHaveLength(1);
  expect(violations[0].kind).toBe('waiver-obsolete');
  expect(formatViolation(violations[0])).toContain('brikdesigns#1436');
});

test('every waiver names the issue that burns it down', () => {
  // A waiver with no ticket is a deletion with extra steps — the gap stops
  // being tracked anywhere and the declaration quietly becomes the new design.
  for (const route of SLOT_MANIFEST) {
    for (const section of route.sections) {
      for (const slot of section.slots) {
        if (!slot.waived) continue;
        expect(slot.waived.issue, `${section.key} › ${slot.name}`).toMatch(/#\d+$/);
        expect(slot.waived.reason.length, `${section.key} › ${slot.name}`).toBeGreaterThan(40);
      }
    }
  }
});
