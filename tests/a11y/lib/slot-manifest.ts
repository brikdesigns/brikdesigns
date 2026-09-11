/**
 * Slot manifest — what each section's Figma node DESIGNED, per route (#1428).
 *
 * Sub-issue of #1393. Its other two probes — `glyph-overlap` and
 * `fill-distinctness` — are generic invariants computable from the rendered
 * page alone. This one cannot be: "a designed slot renders nothing" needs a
 * declaration of what was designed, and only the Figma node carries that. The
 * declaration below IS the deliverable, as much as the spec that reads it.
 *
 * ── The defect class ────────────────────────────────────────────────────────
 *
 * A slot whose optional data is absent degrades to ZERO elements. Every other
 * gate in the suite measures what the DOM *does* contain, so a slot that
 * renders nothing is invisible to all of them — there is no element to assert
 * on. #1287 shipped `/plans` cards with 2 of 6 designed slots and nobody
 * noticed until #1304.
 *
 * The `figma` visual-parity mode (#1392) is the closest existing gate and does
 * not cover it: it diffs a section's PIXELS against its node, so a missing 24px
 * indicator inside a 1000px section is well under the noise floor — and that
 * gate is advisory with thresholds off (`visual-parity.yml:92`).
 *
 * ── Why the counts are minimums, not equalities ─────────────────────────────
 *
 * The manifest asserts a FLOOR, never a total. A Figma frame draws a fixed
 * number of example rows (5 Foundation items, 2 tier cards); the page renders
 * whatever the CMS holds. Asserting equality would redden the gate every time
 * an operator authors a sixth row — a gate people learn to switch off. The
 * failure being caught is the drop to zero, so `min: 1` on a repeating slot is
 * the honest assertion and a per-row slot inherits the row count it hangs off.
 *
 * ── Waivers are RATCHETS, and they self-retire ──────────────────────────────
 *
 * A slot that is designed but renders nothing TODAY is recorded here rather
 * than deleted, with the issue that burns it down — the route-scoped-waiver
 * shape already ratified for `fill-distinctness.spec.ts`'s ACCEPTED map. The
 * difference is that a waiver here asserts the gap STILL EXISTS: the moment the
 * slot starts rendering, the waiver fails and must be removed. A waiver that
 * silently outlives its defect is how a gate rots into a rubber stamp.
 *
 * ── Re-deriving a declaration ───────────────────────────────────────────────
 *
 * Every section and every slot records the Figma node it was read from, so a
 * design change is re-derivable without guessing:
 *
 *   get_design_context({ fileKey: FILE_KEY, nodeId: '<node>' })
 *
 * Read the SECTION node, never the page frame, and never a `get_screenshot`
 * raster — a raster carries no slot names, which is exactly how #1287 lost four
 * of them. Authored 2026-09-11 from `get_design_context` on all six nodes.
 *
 * The node ids are the same ones `scripts/visual-parity.mjs:219-241` declares
 * for this route, so a route's design reference lives in one place.
 */

/** Brik-Website. Same file `scripts/visual-parity.mjs:224` declares. */
export const FILE_KEY = 'yhLkzLUnG71UFTgURDvgnv';

export interface SlotWaiver {
  /** Why it renders nothing today — the mechanism, not the symptom. */
  reason: string;
  /** The issue that burns it down. Required: a waiver with no ticket is a deletion. */
  issue: string;
}

export interface SlotDecl {
  /** Figma's own layer name, so the declaration is greppable against the node. */
  name: string;
  /** The node id this slot was read from. */
  node: string;
  /** CSS selector, resolved INSIDE the section's scope. */
  selector: string;
  /** Floor, never a total. See the header. */
  min: number;
  /** Present = designed but not rendering today. Asserted to still be missing. */
  waived?: SlotWaiver;
}

export interface SectionDecl {
  /** `data-section` key, or a stable name when the section is identified another way. */
  key: string;
  /** The Figma section node. */
  node: string;
  /**
   * How to find the section in the DOM.
   *
   * `[data-section="<key>"]` on every section of this route. A BDS blueprint
   * section (CardGrid et al.) identifies itself with `aria-labelledby`
   * instead, so one declared here would need its own selector — that was
   * `what-you-get`'s shape until #1371 reshaped it to a plain `<section>`.
   */
  selector: string;
  slots: SlotDecl[];
}

export interface RouteDecl {
  path: string;
  name: string;
  sections: SectionDecl[];
}

/**
 * `/plans/marketing-support` — the seeded plan (5 Foundation rows + both tiers
 * authored, #1371) and the route whose slots motivated #1428.
 *
 * Breadth is deliberately out of scope: one authored route proves the
 * mechanism, and the manifest only extends to routes that already declare
 * Figma nodes.
 */
export const SLOT_MANIFEST: RouteDecl[] = [
  {
    path: '/plans/marketing-support',
    name: 'Plan detail — marketing support',
    sections: [
      {
        key: 'hero',
        node: '26144:9053', // section-hero
        selector: '[data-section="hero"]',
        slots: [
          { name: 'title', node: 'I26144:9054;24717:2069', selector: '.hero-title', min: 1 },
          {
            name: 'description',
            node: 'I26144:9054;24717:2056',
            selector: '.hero-description',
            min: 1,
          },
        ],
      },
      {
        key: 'foundation',
        node: '26144:9055', // section-intro
        selector: '[data-section="foundation"]',
        slots: [
          {
            name: 'content-title-wrapper › title',
            node: '26144:9058',
            selector: '.bds-content-block__title',
            min: 1,
          },
          {
            name: 'content-title-wrapper › description',
            node: '26144:9059',
            selector: '.bds-content-block__description',
            min: 1,
          },
          {
            name: 'list-wrapper › heading',
            node: '26170:5792',
            selector: '.plan-coverage-list__title',
            min: 1,
          },
          {
            name: 'content-col › card-vertical',
            node: '26170:5761',
            selector: '.plan-coverage-row',
            min: 1,
          },
          {
            name: 'card-vertical › title-wrapper › title',
            node: '26170:5764',
            selector: '.plan-coverage-row__title',
            min: 1,
          },
          {
            // Figma's second line reads "5 hours per month" in every row — that
            // is un-swapped placeholder and is never rendered (PlanCoverageRow
            // .tsx:9-14). The SLOT is real and carries the em-dash clause
            // Notion authors; only the mockup's VALUE is placeholder, which is
            // a question for the operator and never licence to drop the slot.
            name: 'card-vertical › title-wrapper › second line',
            node: '26170:5765',
            selector: '.plan-coverage-row__description',
            min: 1,
          },
          {
            name: 'card-vertical › brik-tag-subscription',
            node: '26170:5762',
            selector: '.bds-tag',
            min: 1,
            waived: {
              reason:
                'The slot is implemented — PlanCoverageRow.tsx:55 renders a <Tag> when ' +
                'resolvePlanCoverageIcon(iconKey) resolves. All 5 service_plan_foundation_items ' +
                'rows for marketing-support hold icon_key = NULL, so it resolves to null on ' +
                'every row (plan-coverage-icons.ts:112-114) and the indicator renders on none ' +
                'of them. Data, not code: the marketing vocabulary itself shipped in #1372.',
              issue: 'brikdesigns#1436',
            },
          },
        ],
      },
      {
        key: 'what-you-get',
        node: '26144:9066', // section-details
        // The key is unchanged across #1371's delta-row-3 reshape so the Figma
        // baseline and this declaration keep their lineage, but the SELECTOR
        // moved: the band was a CardGrid blueprint section identified by
        // `aria-labelledby`, and is now a plain `<section>` on the convention
        // default (section-identification.md).
        selector: '[data-section="what-you-get"]',
        slots: [
          {
            name: 'content-wrapper › title',
            node: '26144:9069',
            selector: '.bds-content-block__title',
            min: 1,
          },
          {
            name: 'content-wrapper › description',
            node: '26144:9070',
            selector: '.bds-content-block__description',
            min: 1,
          },
          {
            name: 'content-wrapper › button-wrapper',
            node: '26144:9072',
            selector: '.bds-content-block__actions .bds-button',
            min: 1,
          },
          {
            name: 'content-col › card-vertical',
            node: '26144:9074',
            selector: '.plan-coverage-row',
            min: 1,
          },
          {
            name: 'card-vertical › title-wrapper › title',
            node: '26144:9077',
            selector: '.plan-coverage-row__title',
            min: 1,
          },
          {
            name: 'card-vertical › title-wrapper › second line',
            node: '26144:9078',
            selector: '.plan-coverage-row__description',
            min: 1,
            waived: {
              reason:
                'The slot is implemented — PlanCoverageRow.tsx:70 renders it whenever `clause` ' +
                'is non-null, the same code path that ships the em-dash clause on the ' +
                'Foundation rows above. It renders on none of these because Notion authors ' +
                "this list as BARE bullets (#1371 Q3) and Figma's own second line is the " +
                'un-swapped "5 hours per month" placeholder. Ratified content shape, not a ' +
                'dropped slot — and still declared, so authoring a clause reddens this waiver ' +
                'rather than passing silently.',
              issue: 'brikdesigns#1371',
            },
          },
          {
            name: 'card-vertical › brik-tag-subscription',
            node: '26144:9075',
            selector: '.bds-tag',
            min: 1,
            waived: {
              reason:
                'Identical mechanism to the Foundation row above: the slot is implemented ' +
                '(PlanCoverageRow.tsx:55) and resolves per `icon_key`, which is unauthored on ' +
                'every service_plan_coverage_items row. The marketing vocabulary itself ' +
                'shipped in #1372 and the DB CHECK (migration 00395 § 2) already constrains ' +
                'the column to it — only the values are missing.',
              issue: 'brikdesigns#1436',
            },
          },
        ],
      },
      {
        key: 'engagement-modes',
        node: '26144:9099', // section-type
        selector: '[data-section="engagement-modes"]',
        slots: [
          {
            name: 'content-wrapper › title',
            node: '26144:9102',
            selector: '.bds-content-block__title',
            min: 1,
          },
          {
            name: 'content-wrapper › description',
            node: '26144:9103',
            selector: '.bds-content-block__description',
            min: 1,
          },
          {
            name: 'content-wrapper › button-wrapper',
            node: '26144:9105',
            selector: '.pricing-header .bds-button',
            min: 1,
          },
          {
            name: 'content-col › card-vertical',
            node: '26144:9107',
            selector: '.plan-tier-card',
            min: 2,
          },
          {
            name: 'card-vertical › title-wrapper › title',
            node: 'I26144:9107;24727:6581',
            selector: '.plan-tier-card__title',
            min: 2,
          },
          {
            name: 'card-vertical › title-wrapper › price',
            node: 'I26144:9107;24727:6584',
            selector: '.plan-tier-card__price',
            min: 2,
          },
          {
            // Figma draws one line here reading "5 hours per month". The build
            // splits it: `__period` carries the billing suffix beside the price
            // (siblings, not nested — PlanTierSection.tsx:146-150 records why
            // axe forced that), and `__who` carries the Advisory/Managed read
            // that Figma folds into the card title. Both are declared, because
            // between them they are the designed line.
            name: 'card-vertical › title-wrapper › second line (period)',
            node: 'I26144:9107;24727:6586',
            selector: '.plan-tier-card__period',
            min: 2,
          },
          {
            name: 'card-vertical › title-wrapper › second line (who executes)',
            node: 'I26144:9107;24727:6586',
            selector: '.plan-tier-card__who',
            min: 2,
          },
          {
            name: 'card-vertical › content-wrapper › description',
            node: 'I26144:9107;24727:6591',
            selector: '.plan-tier-card__description',
            min: 2,
          },
          {
            name: 'card-vertical › button-wrapper',
            node: 'I26144:9107;24727:6593',
            selector: '.plan-tier-card .bds-button',
            min: 2,
          },
          {
            name: 'card-vertical › brik-tag-subscription',
            node: 'I26144:9107;24904:4606',
            selector: '.plan-tier-card .bds-tag',
            min: 2,
            waived: {
              reason:
                'Unlike the Foundation row, this one is not data-driven — PlanTierSection.tsx ' +
                'has no Tag import and no indicator slot at all, so no CMS value can make it ' +
                'appear. Figma draws one on both tier cards (a service-colored icon box).',
              issue: 'brikdesigns#1436',
            },
          },
        ],
      },
      {
        key: 'full-stack',
        node: '26144:9109', // section-full-stack
        selector: '[data-section="full-stack"]',
        slots: [
          { name: 'title', node: '26144:9113', selector: '.plan-full-stack__title', min: 1 },
          {
            name: 'description',
            node: '26144:9114',
            selector: '.plan-full-stack__description',
            min: 1,
          },
          {
            name: 'button-group',
            node: '26144:9116',
            selector: '.bds-button',
            min: 1,
          },
          {
            // The illustration's own slots. Decorative, but a dropped
            // illustration is exactly the silent regression this gate is for —
            // and unlike the indicators these are static JSX, so a zero here
            // means someone deleted markup rather than left data unauthored.
            name: 'product-design › brik-tag-service-product',
            node: '26144:9121',
            selector: '.bds-service-tag',
            min: 4,
          },
          {
            name: 'product-design › abbey + union portraits',
            node: '26144:9125',
            selector: '.plan-full-stack__portrait',
            min: 2,
          },
        ],
      },
      {
        key: 'cta',
        node: '26144:9140', // section-cta
        selector: '[data-section="cta"]',
        slots: [
          { name: 'title', node: '26144:9144', selector: '.bds-content-block__title', min: 1 },
          {
            // Figma sets two paragraphs (26144:9145, 26144:9146); the shared
            // `.cta-section-brand` the /plans index already ships renders one
            // `__description`. The CTA frame is reused verbatim per the delta
            // table (page.tsx:302-305), so the single slot is the ratified
            // shape and the floor is declared against it, not against the
            // paragraph count.
            name: 'content-wrapper › description',
            node: '26144:9145',
            selector: '.bds-content-block__description',
            min: 1,
          },
          {
            name: 'bds-brand-button',
            node: '26144:9147',
            selector: '.bds-content-block__actions .bds-button',
            min: 1,
          },
        ],
      },
    ],
  },
];

export interface SlotMeasurement {
  section: string;
  slot: string;
  node: string;
  selector: string;
  min: number;
  found: number;
  waived?: SlotWaiver;
}

export interface SlotViolation extends SlotMeasurement {
  kind: 'missing' | 'waiver-obsolete';
}

/**
 * The whole judgement, as a pure function of measurements — so the spec's
 * self-test can exercise it without a browser and the negative control can
 * prove it stays silent for the right reason.
 *
 *   `missing`         — a declared slot rendered under its floor.
 *   `waiver-obsolete` — a waived slot now renders. The gap closed; the waiver
 *                       has to go, or it silently covers the NEXT regression.
 */
export function findSlotViolations(measurements: SlotMeasurement[]): SlotViolation[] {
  const violations: SlotViolation[] = [];
  for (const m of measurements) {
    const meets = m.found >= m.min;
    if (m.waived) {
      if (meets) violations.push({ ...m, kind: 'waiver-obsolete' });
      continue;
    }
    if (!meets) violations.push({ ...m, kind: 'missing' });
  }
  return violations;
}

/** One violation, rendered for a failure message. */
export function formatViolation(v: SlotViolation): string {
  const where = `${v.section} › ${v.slot}`;
  if (v.kind === 'waiver-obsolete') {
    return (
      `${where}: WAIVER OBSOLETE — found ${v.found} (floor ${v.min}), but this slot is ` +
      `waived against ${v.waived?.issue}. The gap closed: delete the waiver so the slot is ` +
      `enforced from now on.`
    );
  }
  return (
    `${where}: found ${v.found}, designed floor ${v.min} — selector \`${v.selector}\`, ` +
    `Figma node ${v.node}. Either the slot stopped rendering, or the design moved and this ` +
    `declaration needs re-deriving with get_design_context on that node.`
  );
}
