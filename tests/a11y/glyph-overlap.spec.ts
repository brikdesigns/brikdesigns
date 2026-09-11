import { test, expect } from '@playwright/test';
import { gotoRendered, expectMeasured } from './lib/goto-rendered';

/**
 * Glyph-overlap probe — brikdesigns.com (#1393).
 *
 * THE enforcement for "rendered text does not collide with other rendered text".
 *
 * Why a glyph probe and not a bounding-box probe: #1391 shipped a 72px tier
 * price whose glyphs sat on top of the tier name above it, and EVERY
 * box-intersection check returns `false` on it. `--font-line-height-none`
 * resolves to `0` in `dist/tokens.css`, so the price's line box had zero height
 * — its `getBoundingClientRect()` was a 0px-tall sliver that intersected
 * nothing, while the glyphs it painted overflowed ~50px upward into the title.
 * The element's box and the ink it paints are different rectangles, and only
 * the second one is what a visitor sees.
 *
 * So this measures the INK:
 *
 *   1. A `Range` over each text node yields one rect per LINE BOX — correctly
 *      positioned even when its height is 0, which is the case that matters.
 *   2. Canvas `measureText` on the element's computed font gives the font's
 *      ascent/descent (where the baseline sits inside the line box, per CSS
 *      half-leading) and the string's own actual ink extents above and below
 *      that baseline.
 *   3. Ink rect = [baseline − actualAscent, baseline + actualDescent]. Two ink
 *      rects that intersect are two pieces of text drawn on top of each other.
 *
 * Half-leading is the whole mechanism, so it is worth stating: CSS centres the
 * font's content area (ascent + descent) inside the line box. When line-height
 * is SMALLER than that content area the half-leading goes negative and the
 * glyphs paint outside the box, in both directions. That is not an edge case
 * bolted on — it is the same formula, and it is why a 0-height line box still
 * has a well-defined baseline to measure from.
 *
 * Scope, stated rather than implied:
 *
 *   • Single-line and multi-line text are both handled — every line box of a
 *     text node is measured, because a collapsed line-height collides on each
 *     of them.
 *   • Positioned elements (`absolute` / `fixed` / `sticky`) are EXCLUDED on
 *     both sides of a pair. Deliberate overlap is what those exist for — a
 *     caption over an image, a badge on a card corner — and a gate that
 *     reddens on them is a gate that gets switched off.
 *   • Invisible text is excluded: `display:none`, `visibility:hidden`,
 *     zero opacity, and the offscreen clip used for screen-reader-only labels.
 *
 * Runs in both theme projects. Geometry is theme-invariant, so the dark run is
 * a cheap cross-check rather than a second case — the same shape
 * `figma-band-geometry.spec.ts` uses.
 */

/**
 * Routes that render display-scale type next to body type — the adjacency the
 * defect class lives in. `/plans/marketing-support` carries the #1391 shape
 * itself (tier name directly above a `--display-sm` figure) and is the route
 * the self-test injects into.
 */
const ROUTES: { path: string; name: string }[] = [
  { path: '/', name: 'Home' },
  { path: '/plans', name: 'Plans index' },
  { path: '/plans/marketing-support', name: 'Plan detail — marketing support' },
  { path: '/plans/back-office-support', name: 'Plan detail — back office' },
  { path: '/services', name: 'Services index' },
  { path: '/services/brand/logo-design', name: 'Service detail — logo design' },
  { path: '/about', name: 'About' },
  { path: '/results', name: 'Customer stories index' },
  { path: '/contact', name: 'Contact' },
];

interface OverlapFinding {
  /** The two colliding texts, trimmed for the failure message. */
  a: string;
  b: string;
  aSel: string;
  bSel: string;
  section: string;
  /** How many px the two ink rects share vertically and horizontally. */
  overlapY: number;
  overlapX: number;
  /** The collapsed-line-box tell, when present: box height vs ink height. */
  aBoxVsInk: string;
  bBoxVsInk: string;
}

/**
 * Ink rects for every visible text node under `main`, then every intersecting
 * pair. Hoisted to module scope so the self-test below can run the identical
 * function against an injected defect — `card-treatment.spec.ts` learned that a
 * measurement living inline is a measurement nobody can prove still reaches its
 * target (#1326).
 *
 * `minOverlap` is the px both axes must exceed before a pair is reported.
 * Antialiasing and subpixel rounding put neighbouring lines within a fraction
 * of a px of each other constantly; 1px is the floor that separates "touching"
 * from "drawn on top of".
 */
const AUDIT = (minOverlap: number) => {
  interface Ink {
    top: number;
    bottom: number;
    left: number;
    right: number;
    text: string;
    sel: string;
    section: string;
    boxHeight: number;
    el: Element;
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  /** A short, greppable label for an element: tag + its own classes. */
  const label = (el: Element) => {
    const cls = (el.getAttribute('class') ?? '').trim().split(/\s+/).filter(Boolean);
    return el.tagName.toLowerCase() + (cls.length ? '.' + cls.join('.') : '');
  };

  const sectionOf = (el: Element) => {
    const s = el.closest('section');
    return (
      s?.getAttribute('data-section') ??
      s?.getAttribute('aria-labelledby') ??
      s?.className ??
      '(no section)'
    );
  };

  /**
   * Visible, in normal flow, and not a screen-reader-only label.
   *
   * The positioned exclusion walks ANCESTORS, not just the element: an absolute
   * wrapper makes its whole subtree deliberately overlappable, and checking
   * only the text node's own parent would let every one of those through.
   */
  const isMeasurable = (el: Element): boolean => {
    for (let n: Element | null = el; n && n !== document.body; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      if (parseFloat(cs.opacity) === 0) return false;
      if (cs.position === 'absolute' || cs.position === 'fixed' || cs.position === 'sticky') {
        return false;
      }
      // The BDS/Tailwind-style visually-hidden idiom: a 1px clipped box.
      const r = n.getBoundingClientRect();
      if (r.width <= 1 && r.height <= 1) return false;
    }
    return true;
  };

  const inks: Ink[] = [];
  const root = document.querySelector('main');
  if (!root) return { findings: [] as OverlapFinding[], measured: 0 };

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = (node.nodeValue ?? '').trim();
    if (!text) continue;
    const el = node.parentElement;
    if (!el) continue;
    // SVG text has its own layout model — no CSS line boxes to reason about.
    if (el.closest('svg')) continue;
    if (!isMeasurable(el)) continue;

    const cs = getComputedStyle(el);
    ctx.font = cs.font && cs.font !== '' ? cs.font : `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const m = ctx.measureText(text);
    // Where the baseline sits inside a line box: CSS centres the font's content
    // area (ascent + descent) in it, so the offset from the line box's centre to
    // the baseline is (ascent − descent) / 2. This is the step that survives a
    // zero-height line box, because it never divides by the box height.
    const fontAscent = m.fontBoundingBoxAscent;
    const fontDescent = m.fontBoundingBoxDescent;
    if (!isFinite(fontAscent) || !isFinite(fontDescent)) continue;
    const baselineFromCentre = (fontAscent - fontDescent) / 2;
    // The string's own ink, measured from the baseline. Tighter than the font
    // box — a line of lowercase text does not reach the cap height — so the
    // probe reports real collisions rather than near-misses between em boxes.
    const inkAscent = isFinite(m.actualBoundingBoxAscent) ? m.actualBoundingBoxAscent : fontAscent;
    const inkDescent = isFinite(m.actualBoundingBoxDescent)
      ? m.actualBoundingBoxDescent
      : fontDescent;

    const range = document.createRange();
    range.selectNodeContents(node);
    for (const r of Array.from(range.getClientRects())) {
      if (r.width <= 0) continue;
      const centre = r.top + r.height / 2;
      const baseline = centre + baselineFromCentre;
      inks.push({
        top: baseline - inkAscent,
        bottom: baseline + inkDescent,
        left: r.left,
        right: r.right,
        text: text.slice(0, 48),
        sel: label(el),
        section: sectionOf(el),
        boxHeight: r.height,
        el,
      });
    }
  }

  const findings: OverlapFinding[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < inks.length; i += 1) {
    for (let j = i + 1; j < inks.length; j += 1) {
      const a = inks[i];
      const b = inks[j];
      // Two line boxes of the SAME element are stacked lines of one paragraph;
      // they share a font and cannot collide with each other in a way that is
      // anyone's bug but the line-height's, which the cross-element pairs
      // already report.
      if (a.el === b.el) continue;
      // Nested inline text — a <strong> inside a <p> yields the parent's rect
      // and the child's over the same glyphs. That is one piece of text seen
      // twice, not two overlapping ones.
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;

      const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      if (overlapY <= minOverlap || overlapX <= minOverlap) continue;

      const key = `${a.sel}|${a.text}|${b.sel}|${b.text}`;
      if (seen.has(key)) continue;
      seen.add(key);

      findings.push({
        a: a.text,
        b: b.text,
        aSel: a.sel,
        bSel: b.sel,
        section: a.section,
        overlapY: Math.round(overlapY),
        overlapX: Math.round(overlapX),
        aBoxVsInk: `${Math.round(a.boxHeight)}px box / ${Math.round(a.bottom - a.top)}px ink`,
        bBoxVsInk: `${Math.round(b.boxHeight)}px box / ${Math.round(b.bottom - b.top)}px ink`,
      });
    }
  }

  return { findings, measured: inks.length };
};

/** px of shared extent on BOTH axes before a pair counts as a collision. */
const MIN_OVERLAP_PX = 1;

const report = (findings: OverlapFinding[], where: string) =>
  `Text drawn on top of other text on ${where}:\n` +
  findings
    .map(
      (f) =>
        `  → "${f.a}"  ✕  "${f.b}"\n` +
        `    ${f.overlapY}px vertical / ${f.overlapX}px horizontal shared ink\n` +
        `    ${f.aSel}   (${f.aBoxVsInk})\n` +
        `    ${f.bSel}   (${f.bBoxVsInk})\n` +
        `    section: ${f.section}`,
    )
    .join('\n') +
  `\n\nRead the "box / ink" figures: a box SHORTER than its ink is a collapsed\n` +
  `line box, and the glyphs are painting outside the element entirely. That is\n` +
  `#1391 — \`--font-line-height-none\` resolves to 0, so the line box has no\n` +
  `height while the glyphs keep their full size.\n` +
  `\n` +
  `FIX: give the element a real leading (\`--font-line-height-tight\` for a\n` +
  `display figure), never a zero. If the overlap is deliberate, position the\n` +
  `element — this probe skips absolute/fixed/sticky subtrees by design.`;

test.describe('Glyph overlap — no text is drawn on top of other text', () => {
  for (const route of ROUTES) {
    test(`${route.name} (${route.path})`, async ({ page }) => {
      await gotoRendered(page, route.path, { waitUntil: 'load' });

      const { findings, measured } = await page.evaluate(AUDIT, MIN_OVERLAP_PX);

      // Every route above renders prose. Sweeping zero text nodes means the
      // page did not render, which a 200 with an empty <main> hides (#1036).
      expectMeasured(measured, route.path, 'text runs');

      expect(findings, report(findings, route.path)).toHaveLength(0);
    });
  }
});

/**
 * Self-test — the probe must BITE on the #1391 shape.
 *
 * The whole claim of this file is that it sees a collision a box check cannot,
 * and live data contains no instance of it any more (PR #1398 fixed the price).
 * A gate whose defect class has no live example passes vacuously forever, which
 * is exactly how #1326's card sweep stayed green over a set it could not reach.
 * So the defect is injected and the probe is required to report it.
 *
 * The negative control is the second assertion: a box-intersection check over
 * the same two elements must still return false AFTER the injection. Without
 * it, this test would pass just as well against a naive bounding-box probe, and
 * the reason this file exists would be unproven.
 */
test.describe('Glyph-overlap probe — self-test', () => {
  test('AUDIT reports a zero-line-height price colliding with the tier name', async ({ page }) => {
    await gotoRendered(page, '/plans/marketing-support', { waitUntil: 'load' });

    const clean = await page.evaluate(AUDIT, MIN_OVERLAP_PX);
    expect(
      clean.findings,
      `The route must be clean BEFORE the defect is injected, or this proves\n` +
        `nothing about the injection:\n${JSON.stringify(clean.findings, null, 2)}`,
    ).toHaveLength(0);
    expect(
      clean.measured,
      'No text runs measured — the walker reaches nothing, so the injection cannot be seen.',
    ).toBeGreaterThan(0);

    // #1391 verbatim: the price keeps its 72px display size and loses its line
    // box. Nothing else changes, so any collision reported is the glyphs'.
    const injected = await page.evaluate(() => {
      const price = document.querySelector('.plan-tier-card__price') as HTMLElement | null;
      if (!price) return null;
      price.style.lineHeight = '0';
      const title = price.closest('.plan-tier-card')?.querySelector('.plan-tier-card__title');
      if (!title) return null;
      const a = price.getBoundingClientRect();
      const b = title.getBoundingClientRect();
      // The box check this probe exists to improve on, run on the SAME pair.
      const boxOverlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      const boxOverlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      return { boxesOverlap: boxOverlapY > 1 && boxOverlapX > 1, priceBoxHeight: a.height };
    });
    expect(
      injected,
      'No .plan-tier-card__price on /plans/marketing-support to inject into — the tier ' +
        'section did not render, so this self-test measured nothing.',
    ).not.toBeNull();

    expect(
      injected!.priceBoxHeight,
      'line-height:0 did not collapse the price box, so the injected defect is not the #1391 shape.',
    ).toBeLessThan(2);

    const after = await page.evaluate(AUDIT, MIN_OVERLAP_PX);
    const hit = after.findings.find(
      (f) => f.aSel.includes('plan-tier-card__price') || f.bSel.includes('plan-tier-card__price'),
    );
    expect(
      hit,
      `AUDIT did not report the injected zero-line-height price. The probe is not\n` +
        `measuring ink — check the half-leading maths in AUDIT (#1393). Findings:\n` +
        `${JSON.stringify(after.findings, null, 2)}`,
    ).toBeDefined();

    // Negative control: a bounding-box check is blind to the very defect the
    // probe just reported. If this ever goes true, the injection stopped being
    // the #1391 shape and the self-test above no longer proves anything.
    expect(
      injected!.boxesOverlap,
      'The price and title BOXES now overlap, so a plain bounding-box check would ' +
        'have caught this too — the injection is no longer the #1391 shape and this ' +
        'self-test proves nothing about ink measurement.',
    ).toBe(false);
  });
});
