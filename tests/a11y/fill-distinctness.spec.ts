import { test, expect } from '@playwright/test';
import { gotoRendered, expectMeasured } from './lib/goto-rendered';

/**
 * Fill-distinctness probe — brikdesigns.com (#1393).
 *
 * THE enforcement for "a thing that exists on the page can be seen".
 *
 * #1393's AC3 asked for byte-identity across "any two adjacent fills within a
 * section". Building it that way measured 7 findings PER ROUTE, every one of
 * them legitimate — a band repainting the page ground, a media well behind an
 * `<img>`, a section tinted one step off white. A gate at that noise level is a
 * gate someone switches off, so the population is split into the two questions
 * that actually have answers, each with the predicate that fits it:
 *
 *   A. DECORATIVE SHAPES — an element with no children, no text, no border,
 *      no shadow and no background image has nothing but its fill to make it
 *      visible. If that fill equals its backdrop it renders NOTHING. Byte
 *      identity is the right predicate here and the threshold is not a
 *      judgement call: 1.0:1 is invisible, 1.3:1 is a design decision.
 *
 *   B. CONTROLS — WCAG 1.4.11 sets 3:1 for the visual boundary of a UI
 *      component. Identity is the degenerate case of that floor, which is what
 *      #1404 established: a pale-green CTA on a pale-yellow band measured
 *      1.07:1, a DIFFERENT colour, and was exactly as unfindable as one at 1.0.
 *
 * Measured populations on 12 routes × both themes while this was written:
 * A holds 35 elements and reports 0; B holds 2–15 per route.
 *
 * ── The trap this spec fell into first, recorded because it is the one #1393
 *    predicted ────────────────────────────────────────────────────────────────
 *
 * The first cut applied A's "no border, no shadow" precondition to B as well.
 * That is superficially reasonable — and it filtered every BDS button out
 * before it was counted, so population B was **0 on all 12 routes**. The gate
 * was green, over nothing. It is the `.bds-pricing-card` shape from #1326
 * exactly: a selector that looks like it measures buttons and reaches none.
 *
 * The only reason it surfaced is that this file asserts the SIZE of what it
 * swept, not just the count of what it found. `expectMeasured` on both
 * populations is therefore load-bearing, not boilerplate.
 *
 * ── Why B checks the border too ────────────────────────────────────────────
 *
 * 1.4.11 is satisfied by ANY boundary reaching 3:1, not specifically the fill.
 * `.bds-text-input-field` paints white-on-white and is perfectly visible
 * because its border does the work; flagging it would be reporting a defect
 * that is not there. So B takes the BEST of fill-vs-backdrop and
 * border-vs-backdrop.
 */

/**
 * Routes swept. `shapes: true` marks the routes that render population A, so
 * the sweep can assert it measured something there without demanding leaf
 * shapes from pages that legitimately have none.
 */
const ROUTES: { path: string; name: string; shapes?: true }[] = [
  { path: '/', name: 'Home' },
  { path: '/plans', name: 'Plans index' },
  { path: '/plans/marketing-support', name: 'Plan detail — marketing support', shapes: true },
  { path: '/plans/back-office-support', name: 'Plan detail — back office', shapes: true },
  { path: '/services', name: 'Services index' },
  { path: '/services/brand/logo-design', name: 'Service detail — logo design' },
  { path: '/about', name: 'About', shapes: true },
  { path: '/results', name: 'Customer stories index' },
  { path: '/contact', name: 'Contact' },
  { path: '/industries/dental', name: 'Industry detail — dental' },
  { path: '/blog', name: 'Blog index' },
  { path: '/how-we-work', name: 'How we work' },
];

/** WCAG 1.4.11 — non-text contrast for a UI component boundary. */
const CONTROL_MIN_RATIO = 3;

/**
 * Accepted pre-existing 1.4.11 debt, keyed on route + theme + the colour pair.
 *
 * ROUTE-scoped, not site-wide, following the reasoning already ratified for
 * `baseline.json` in `lib/baseline-match.ts`: a per-route list is what stops a
 * waiver rotting into a rubber stamp for every page added later. A new route
 * that renders the same pair still fails and needs a deliberate entry.
 *
 * Keyed on the COLOUR PAIR rather than a CSS selector for the same reason
 * #1361 re-keyed the axe baseline: a selector-keyed waiver stops matching the
 * moment the DOM is re-rooted, and then re-reports already-accepted debt as
 * new. The pair survives that.
 *
 * Every entry here is a SHARED BDS component, not page CSS — re-measured
 * 2026-09-11 against `@brikdesigns/bds@0.189.1` over the 12 routes above, both
 * themes. Burn-down is tracked on brikdesigns#1427; this list shrinks as that
 * lands and is never added to without one.
 *
 * ── Why the tint half of this list moved at 0.189.0 (#1442) ────────────────
 *
 * A key here is a COLOUR PAIR, and a pair survives a DOM re-root (the #1361
 * reasoning above) but NOT a token being re-pointed underneath it. brik-bds
 * `05f3d748` ("sync BDS tokens to the re-authored numeric Brand Kit", #2359,
 * 2026-09-10) moved the whole `--surface-accent-{hue}` family off the
 * `--color-system-{hue}-light` primitives and onto the numeric Brand Kit ramp
 * (`tokens/figma-tokens.css:585-589`). The poppy fill never changed; the band
 * under it did, so five keys stopped matching and the gate reported
 * already-accepted debt as new:
 *
 *   --surface-accent-purple  #e9d8fc → #dad0f2   poppy 2.83:1 → 2.57:1  (worse)
 *   --surface-accent-blue    #bfe2fe → #b2e3f5   poppy 2.79:1 → 2.74:1  (worse)
 *   --surface-accent-blue    (dark)   → #d6f0fa  cleared 3:1 — entry REMOVED
 *
 * That last line is why `no stale waiver key` below is an assertion and not a
 * comment: a re-point can push a pair over the floor as easily as under it, and
 * the entry it leaves behind waives a defect that no longer exists.
 */
const ACCEPTED: Record<'light' | 'dark', Record<string, string[]>> = {
  light: {
    // `bds-button--primary` poppy on the pale-purple / pale-blue service tints
    // (2.57:1, 2.74:1) — the same brand-vs-pale-tint family already baselined
    // for TEXT contrast in baseline.json (#1263 / brik-bds#479).
    '/': [
      'rgb(227, 83, 53) on rgb(218, 208, 242)',
      // `bds-button--on-color` white on `--background-muted` — 1.14:1.
      'rgb(255, 255, 255) on rgb(241, 240, 236)',
      // The SELECTED `bds-segmented-control-item` — white on rgb(242,242,242),
      // 1.12:1. Its selected state is carried by the fill alone, so the control
      // that tells you which tab you are on is the one that cannot be seen.
      'rgb(255, 255, 255) on rgb(242, 242, 242)',
    ],
    '/plans': ['rgb(227, 83, 53) on rgb(178, 227, 245)'],
    '/plans/marketing-support': ['rgb(255, 255, 255) on rgb(242, 242, 242)'],
    // `bds-icon-button--secondary` / `bds-button--secondary` — 1.12:1 both.
    '/about': ['rgb(242, 242, 242) on rgb(255, 255, 255)'],
    '/results': ['rgb(255, 255, 255) on rgb(242, 242, 242)'],
    '/contact': ['rgb(242, 242, 242) on rgb(255, 255, 255)'],
    '/blog': ['rgb(255, 255, 255) on rgb(242, 242, 242)'],
    '/how-we-work': [
      'rgb(227, 83, 53) on rgb(218, 208, 242)',
      'rgb(255, 255, 255) on rgb(242, 242, 242)',
    ],
  },
  dark: {
    '/': ['rgb(227, 83, 53) on rgb(218, 208, 242)'],
    // The service `-on-dark` steps are mode-invariant pale tones, so the poppy
    // primary lands on them in the dark theme too — 2.1:1 on the orange step.
    //
    // The hero's blue step used to be here at 2.79:1. 0.189.0 re-pointed the
    // dark `--surface-accent-blue` to `--color-blue-200` (#d6f0fa), which is
    // pale enough to clear 3:1, so the entry is gone rather than re-keyed.
    '/plans': ['rgb(227, 83, 53) on rgb(255, 173, 146)'],
    '/about': ['rgb(51, 51, 51) on rgb(0, 0, 0)'],
    '/contact': ['rgb(51, 51, 51) on rgb(0, 0, 0)'],
    '/how-we-work': ['rgb(227, 83, 53) on rgb(218, 208, 242)'],
  },
};

interface ShapeFinding {
  sel: string;
  section: string;
  fill: string;
  paintedBy: string;
  w: number;
  h: number;
}

interface ControlFinding {
  sel: string;
  section: string;
  label: string;
  fill: string;
  backdrop: string;
  /** The best boundary contrast available — fill or border, whichever reads. */
  ratio: number;
  via: string;
  /** `<fill> on <backdrop>` — the baseline key. */
  fingerprint: string;
}

/**
 * Hoisted to module scope so the self-tests run the IDENTICAL function against
 * injected defects (#1326's lesson: a measurement nobody can re-run is a claim,
 * not a fact).
 */
const AUDIT = (minRatio: number) => {
  const rgb = (c: string): [number, number, number] | null => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(',').map((v) => parseFloat(v));
    // Fully transparent paints nothing — it is not a fill.
    if (p.length > 3 && p[3] === 0) return null;
    return [p[0], p[1], p[2]];
  };
  const lum = ([r, g, b]: [number, number, number]) => {
    const f = (v: number) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a: string, b: string): number | null => {
    const ca = rgb(a);
    const cb = rgb(b);
    if (!ca || !cb) return null;
    const la = lum(ca);
    const lb = lum(cb);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  };
  const norm = (c: string) => c.replace(/\s+/g, '').toLowerCase();
  const round = (n: number) => Math.round(n * 100) / 100;

  const CONTROL = 'button, [role="button"], a.bds-button, input, select, textarea, summary';

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

  const shapes: ShapeFinding[] = [];
  const controls: ControlFinding[] = [];
  let shapePop = 0;
  let controlPop = 0;

  const root = document.querySelector('main');
  if (!root) return { shapes, controls, shapePop, controlPop };

  for (const el of Array.from(root.querySelectorAll('*'))) {
    const cs = getComputedStyle(el);
    const fill = cs.backgroundColor;
    if (!rgb(fill)) continue;
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (parseFloat(cs.opacity) === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;

    const hasBorder = (parseFloat(cs.borderTopWidth) || 0) > 0 && cs.borderTopStyle !== 'none';
    const hasOutline = (parseFloat(cs.outlineWidth) || 0) > 0 && cs.outlineStyle !== 'none';
    const hasShadow = cs.boxShadow !== 'none' && cs.boxShadow !== '';
    const hasImage = cs.backgroundImage !== 'none' && cs.backgroundImage !== '';

    // The nearest PAINTED ancestor — a transparent one backs nothing, so it is
    // not what the eye compares against (the rule #1404 established).
    let backdrop: string | null = null;
    let paintedBy = '';
    for (let n = el.parentElement; n; n = n.parentElement) {
      const abg = getComputedStyle(n).backgroundColor;
      if (rgb(abg)) {
        backdrop = abg;
        paintedBy = label(n).slice(0, 56);
        break;
      }
    }
    if (backdrop === null) continue;

    // ── A. decorative leaf shapes ──
    const fillOnly = !hasBorder && !hasOutline && !hasShadow && !hasImage;
    const isLeaf = el.children.length === 0 && (el.textContent ?? '').trim() === '';
    if (fillOnly && isLeaf) {
      shapePop += 1;
      if (norm(fill) === norm(backdrop)) {
        shapes.push({
          sel: label(el).slice(0, 64),
          section: sectionOf(el),
          fill,
          paintedBy,
          w: Math.round(r.width),
          h: Math.round(r.height),
        });
      }
    }

    // ── B. controls ──
    // Deliberately NOT gated on `fillOnly`. Gating it there is what made this
    // population empty on every route in the first cut — see the header.
    if (el.matches(CONTROL)) {
      controlPop += 1;
      const fillRatio = ratio(fill, backdrop);
      const borderRatio =
        hasBorder && rgb(cs.borderTopColor) ? ratio(cs.borderTopColor, backdrop) : null;
      const best = Math.max(fillRatio ?? 0, borderRatio ?? 0);
      if (best < minRatio) {
        controls.push({
          sel: label(el).slice(0, 64),
          section: sectionOf(el),
          label: (el.textContent ?? '').trim().slice(0, 32),
          fill,
          backdrop,
          ratio: round(best),
          via:
            borderRatio !== null
              ? `fill ${round(fillRatio ?? 0)}:1, border ${round(borderRatio)}:1`
              : `fill only, ${round(fillRatio ?? 0)}:1`,
          fingerprint: `${fill} on ${backdrop}`,
        });
      }
    }
  }

  return { shapes, controls, shapePop, controlPop };
};

/**
 * Waiver keys that no control on the route measures any more (#1442).
 *
 * Hoisted for the same reason `AUDIT` is: the self-test below runs this exact
 * function against an injected stale key, so the assertion is demonstrated
 * rather than asserted. Pure — it takes the measured fingerprints, so it needs
 * no browser and costs the suite nothing.
 */
const staleKeys = (accepted: string[], measured: Set<string>) =>
  accepted.filter((k) => !measured.has(k));

const shapeReport = (findings: ShapeFinding[], where: string) =>
  `Shapes that render nothing — fill is identical to their backdrop on ${where}:\n` +
  findings
    .map(
      (f) =>
        `  → ${f.sel}  (${f.w}×${f.h})\n` +
        `    fill: ${f.fill}   painted by: ${f.paintedBy}\n` +
        `    section: ${f.section}`,
    )
    .join('\n') +
  `\n\nThese elements have no children, no text, no border and no shadow, so the\n` +
  `fill is the only thing that could make them visible — and it is the colour\n` +
  `already behind them. This is the #1371 illustration-brick class:\n` +
  `\`--surface-secondary\` resolved byte-identical to the card's \`--surface-accent\`\n` +
  `and every neutral brick disappeared. \`lint:tokens\` cannot see it — it checks\n` +
  `that a token name is canonical, never that it reads against its backdrop.`;

const controlReport = (findings: ControlFinding[], where: string) =>
  `Controls with no visible boundary on ${where} (WCAG 1.4.11 wants ≥ ${CONTROL_MIN_RATIO}:1):\n` +
  findings
    .map(
      (f) =>
        `  → ${f.sel}${f.label ? `  ("${f.label}")` : ''}\n` +
        `    ${f.ratio}:1  —  ${f.via}\n` +
        `    fill: ${f.fill}   backdrop: ${f.backdrop}\n` +
        `    section: ${f.section}\n` +
        `    baseline key: "${f.fingerprint}"`,
    )
    .join('\n') +
  `\n\nA control whose fill AND border both fail 3:1 against what is behind it has\n` +
  `no shape — only its label survives, which is #1404 (a service CTA at 1.07:1).\n` +
  `\n` +
  `FIX the colour. Only add a key to ACCEPTED in this file when the debt is\n` +
  `pre-existing AND filed — every current entry cites brikdesigns#1427.`;

test.describe('Fill distinctness — shapes and controls are visible against their backdrop', () => {
  for (const route of ROUTES) {
    test(`${route.name} (${route.path})`, async ({ page }, testInfo) => {
      const theme = testInfo.project.name.endsWith('-dark') ? 'dark' : 'light';
      await gotoRendered(page, route.path, { waitUntil: 'load' });

      const { shapes, controls, shapePop, controlPop } = await page.evaluate(
        AUDIT,
        CONTROL_MIN_RATIO,
      );

      // Both populations assert their SIZE, not only their findings. This is
      // the check that caught population B being empty on every route while
      // the gate reported green (see the header).
      expectMeasured(controlPop, route.path, 'controls');
      if (route.shapes) expectMeasured(shapePop, route.path, 'decorative leaf shapes');

      expect(shapes, shapeReport(shapes, route.path)).toHaveLength(0);

      // `FILL_IGNORE_BASELINE=1` re-measures with the waivers off. That is the
      // repro for the accepted debt (brikdesigns#1427) and the way to check what
      // is left as it burns down — a baseline you cannot re-measure on demand is
      // how a waiver list rots into a permanent one.
      const accepted = process.env.FILL_IGNORE_BASELINE
        ? new Set<string>()
        : new Set(ACCEPTED[theme][route.path] ?? []);
      const fresh = controls.filter((c) => !accepted.has(c.fingerprint));
      expect(fresh, controlReport(fresh, `${route.path} (${theme})`)).toHaveLength(0);

      // ── The waiver list must not outlive the debt it waives (#1442) ──
      //
      // Asserted, not reviewed, because the rot is silent in BOTH directions: a
      // re-pointed token can push a waived pair OVER 3:1 (the dark `/plans`
      // blue did exactly that at 0.189.0) and the stale key then waives a defect
      // that no longer exists, or it can move the pair to a new value and the
      // gate re-reports accepted debt as fresh. Six of these list's keys went
      // stale in one BDS bump; nothing would have said so.
      //
      // Budget: no new trigger, no new job, no added runtime — it reads the
      // `controls` array this test already computed, in a test already running.
      const measured = new Set(controls.map((c) => c.fingerprint));
      const stale = staleKeys(ACCEPTED[theme][route.path] ?? [], measured);
      expect(
        stale,
        `Stale waiver key(s) in ACCEPTED for ${route.path} (${theme}) — nothing on the\n` +
          `route measures this pair any more:\n` +
          stale.map((k) => `  → "${k}"`).join('\n') +
          `\n\nOne of three things happened, and they need different answers:\n` +
          `  1. A token under the pair was RE-POINTED and the colour moved. Re-key the\n` +
          `     entry to the value now reported above, and name the BDS commit.\n` +
          `  2. The pair cleared 3:1. DELETE the entry — the debt is paid.\n` +
          `  3. The control stopped rendering on this route. Delete the entry; if the\n` +
          `     control should still be there, that is the defect, not this key.\n\n` +
          `Re-measure with FILL_IGNORE_BASELINE=1 to see the full sub-3:1 population.`,
      ).toHaveLength(0);
    });
  }
});

/**
 * Self-tests — each half must BITE on the defect it was written for.
 *
 * Neither defect class has a live instance any more: the bricks were fixed in
 * `9508b4f` and the 1.07:1 CTA in PR #1414. A gate whose defect class is absent
 * from live data passes vacuously forever — measured in #1326, where all 66
 * offerings had `is_featured = false` so the carve-out under test could not
 * occur. So both are injected.
 */
test.describe('Fill-distinctness probe — self-test', () => {
  test('AUDIT reports an illustration brick painted its own backdrop', async ({ page }) => {
    await gotoRendered(page, '/plans/marketing-support', { waitUntil: 'load' });

    const clean = await page.evaluate(AUDIT, CONTROL_MIN_RATIO);
    expect(
      clean.shapes,
      `The route must be clean BEFORE injection or this proves nothing:\n` +
        JSON.stringify(clean.shapes, null, 2),
    ).toHaveLength(0);
    expect(
      clean.shapePop,
      'No leaf shapes measured — population A reaches nothing on this route, so the ' +
        'injection below cannot be seen.',
    ).toBeGreaterThan(0);

    // #1371 defect 2 verbatim: repaint a brick with the fill of the card behind
    // it. Nothing else changes, so a finding is the identity check firing.
    const injected = await page.evaluate(() => {
      const brick = document.querySelector('.plan-full-stack__brick') as HTMLElement | null;
      if (!brick) return { found: false, applied: false, want: '', got: '' };
      let backdrop: string | null = null;
      for (let n = brick.parentElement; n; n = n.parentElement) {
        const bg = getComputedStyle(n).backgroundColor;
        const m = bg.match(/rgba?\(([^)]+)\)/);
        const parts = m ? m[1].split(',').map((v) => parseFloat(v)) : null;
        if (parts && !(parts.length > 3 && parts[3] === 0)) {
          backdrop = bg;
          break;
        }
      }
      if (!backdrop) return { found: true, applied: false, want: '', got: '(no painted ancestor)' };
      // `transition: none` FIRST, and it is load-bearing, not hygiene.
      // `globals.css:384` transitions `background-color` for the theme flip, and
      // the TRANSITIONS origin sits ABOVE inline `!important` in the CSS cascade
      // (CSS Cascade 5 § 6.2). Without it the injected colour loses to the
      // transition's STARTING value, `getComputedStyle` keeps reporting the
      // original fill, and this self-test fails claiming the probe is blind when
      // in fact the injection never landed. Measured here: `reducedMotion:
      // 'reduce'` sets the duration to 1e-05s, so it presents as a frame race
      // that passes or fails depending on scheduling, not as a clean error.
      brick.style.transition = 'none';
      brick.style.backgroundColor = backdrop;
      const got = getComputedStyle(brick).backgroundColor;
      return { found: true, applied: got === backdrop, want: backdrop, got };
    });

    expect(
      injected.found,
      'No .plan-full-stack__brick on /plans/marketing-support — the full-stack panel ' +
        'did not render, so this self-test measured nothing.',
    ).toBe(true);
    expect(
      injected.applied,
      `The injection did not take effect: wanted ${injected.want}, computed ${injected.got}. ` +
        `The probe was never given a defect to find, so a pass below would prove nothing. ` +
        `See the transition/cascade note above.`,
    ).toBe(true);

    const after = await page.evaluate(AUDIT, CONTROL_MIN_RATIO);
    expect(
      after.shapes.find((s) => s.sel.includes('plan-full-stack__brick')),
      `AUDIT did not report the invisible brick. Population A is not reaching the\n` +
        `illustration — check the leaf/fill-only predicate (#1393). Shapes:\n` +
        `${JSON.stringify(after.shapes, null, 2)}`,
    ).toBeDefined();
  });

  test('AUDIT reports a control whose fill and border both fail 3:1', async ({ page }) => {
    await gotoRendered(page, '/plans/marketing-support', { waitUntil: 'load' });

    const before = await page.evaluate(AUDIT, CONTROL_MIN_RATIO);
    expect(
      before.controlPop,
      'No controls measured — population B reaches nothing, which is the exact ' +
        'inert-selector failure this spec documents. The injection cannot be seen.',
    ).toBeGreaterThan(0);

    // A colour pair deliberately OUTSIDE the ACCEPTED list, so the assertion
    // proves the probe fires rather than proving the baseline missed an entry.
    const injected = await page.evaluate(() => {
      const btn = document.querySelector('main a.bds-button, main button.bds-button') as
        | HTMLElement
        | null;
      if (!btn) return null;
      let backdrop = 'rgb(255, 255, 255)';
      for (let n = btn.parentElement; n; n = n.parentElement) {
        const bg = getComputedStyle(n).backgroundColor;
        const m = bg.match(/rgba?\(([^)]+)\)/);
        const parts = m ? m[1].split(',').map((v) => parseFloat(v)) : null;
        if (parts && !(parts.length > 3 && parts[3] === 0)) {
          backdrop = bg;
          break;
        }
      }
      // Nudge the fill a hair off the backdrop: a DIFFERENT colour, far under
      // 3:1. Byte-identity would not see this, which is the whole #1404 point.
      // `transition: none` first, for the cascade reason documented on the brick
      // injection above — a transitioned property beats inline `!important`.
      const [r, g, b] = backdrop.match(/\d+/g)!.map(Number);
      const want = `rgb(${Math.max(0, r - 4)}, ${Math.max(0, g - 4)}, ${Math.max(0, b - 4)})`;
      btn.style.transition = 'none';
      btn.style.backgroundColor = want;
      btn.style.border = 'none';
      btn.style.boxShadow = 'none';
      const got = getComputedStyle(btn).backgroundColor;
      return { cls: btn.className, applied: got === want, want, got };
    });
    expect(
      injected,
      'No .bds-button on /plans/marketing-support to inject into.',
    ).not.toBeNull();
    expect(
      injected!.applied,
      `The injection did not take effect: wanted ${injected!.want}, computed ${injected!.got}. ` +
        `The probe was never given a defect to find.`,
    ).toBe(true);

    const after = await page.evaluate(AUDIT, CONTROL_MIN_RATIO);
    const hit = after.controls.find((c) => c.ratio < CONTROL_MIN_RATIO && c.ratio > 1);
    expect(
      hit,
      `AUDIT did not report the injected low-contrast control. The probe is either\n` +
        `not reaching buttons or is testing identity instead of a contrast floor —\n` +
        `both are #1393 failure modes. Controls:\n${JSON.stringify(after.controls, null, 2)}`,
    ).toBeDefined();

    // Negative control for the predicate itself: the injected fill is NOT
    // byte-identical to its backdrop, so AC3-as-filed would have missed it.
    // If this ever fails, the injection collapsed to identity and this test no
    // longer proves the floor is what is being measured.
    expect(
      hit!.fill,
      'The injected fill equals its backdrop, so byte-identity would have caught ' +
        'it too — this no longer proves the probe measures a contrast FLOOR.',
    ).not.toBe(hit!.backdrop);
  });

  test('staleKeys reports a waiver whose colour pair moved out from under it', () => {
    // #1442 verbatim: the pair the route actually measures after brik-bds
    // `05f3d748` re-pointed `--surface-accent-purple`, against the key that was
    // correct before it.
    const measured = new Set(['rgb(227, 83, 53) on rgb(218, 208, 242)']);

    expect(
      staleKeys([...measured], measured),
      'A key that still matches was called stale — the predicate is inverted, and ' +
        'the gate would demand re-keying entries that are doing their job.',
    ).toHaveLength(0);

    expect(
      staleKeys(['rgb(227, 83, 53) on rgb(233, 216, 252)'], measured),
      'staleKeys did not report the pre-0.189.0 purple key against the post-0.189.0 ' +
        'measurement. The list can rot silently again, which is #1442.',
    ).toEqual(['rgb(227, 83, 53) on rgb(233, 216, 252)']);
  });
});
