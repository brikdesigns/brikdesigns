import { test, expect } from '@playwright/test';
import { gotoRendered } from './lib/goto-rendered';

/**
 * Service-CTA tint gate — brikdesigns.com.
 *
 * THE enforcement for the conditional service-line CTA convention (canonical:
 * `serviceCtaVars()` in src/lib/tokens.ts + .claude/references/
 * service-token-decision-tree.md):
 *
 *   Every CTA that links to a support plan (`/plans/{slug}`) adopts THAT plan's
 *   service-line fill — `--background-service-{line}-on-light` in light mode,
 *   the pale `-on-dark` step in dark — and its element (or an ancestor) carries
 *   `.service-themed` so the dark-mode / hover / focus cascade in globals.css
 *   engages.
 *
 * Why measured (computed style) rather than a static grep for `serviceCtaVars`:
 * the convention was already implemented five times over — /plans, the plan
 * detail "Other Support Plans" grid, both service-detail bands — and still
 * silently absent on the four HomePlanCard surfaces (home, about, contact,
 * customer-stories) and the mega-nav Plans panel, because a call site simply
 * never passed the line through. A static check also can't see the two ways the
 * tint is delivered (inline on the button vs inherited from a `service-themed`
 * ancestor), so it would need an allowlist that rots. Measuring the rendered
 * fill catches both a missing helper call and a cascade that fails to reach the
 * button.
 *
 * Classification is by measured background against the resolved service token
 * set, NOT by class name: a CTA that falls through to the BDS brand poppy has a
 * background outside that set, which is exactly the regression.
 *
 * Runs light + dark via the two Playwright projects (see playwright.config.ts).
 * The allowed set is the union of both modes' service steps, so one comparison
 * serves both projects.
 */

const SERVICE_LINES = ['marketing', 'brand', 'information', 'product', 'back-office'] as const;

/** Routes that surface at least one `/plans/{slug}` CTA in page content. */
const ROUTES: { path: string; name: string }[] = [
  { path: '/', name: 'Home — Monthly Subscription' },
  { path: '/about', name: 'About — Support Plans' },
  { path: '/contact', name: 'Contact — Support Plans' },
  { path: '/results', name: 'Customer stories — Our Services' },
  { path: '/plans', name: 'Plans index' },
  { path: '/plans/back-office-support', name: 'Plan detail — Other Support Plans' },
  // A SECOND plan-detail slug, because one is not a sample. The Full Stack
  // cross-sell band is suppressed on its own plan page and renders on every
  // other, so a route list holding a single slug can miss a band entirely —
  // which is exactly how the 1.07:1 CTA on this route survived the first cut
  // of the collision gate (#1404).
  { path: '/plans/marketing-support', name: 'Plan detail — Full Stack cross-sell band' },
  { path: '/services/marketing', name: 'Service line — Monthly Support Services' },
  { path: '/services/back-office/crm-setup-and-data-cleanup', name: 'Service detail — bottom support CTA' },
];

interface CtaFinding {
  href: string;
  label: string;
  section: string;
  bg: string;
  serviceThemed: boolean;
}

/** A service CTA whose fill is the same color as the thing behind it (#1404). */
interface CollisionFinding {
  label: string;
  section: string;
  bg: string;
  /** Nearest painted ancestor's fill, and what paints it. */
  backdrop: string;
  backdropCls: string;
  /** Measured contrast between the two. WCAG 1.4.11 wants ≥ 3. */
  ratio: number;
}

/**
 * Collect every plan CTA on the current page whose rendered fill is NOT one of
 * the ten service steps, or which is missing the `.service-themed` pairing
 * contract. Runs in-page so it reads real computed styles.
 */
const AUDIT = (lines: readonly string[]): CtaFinding[] => {
  // Resolve each service token to an rgb string via a throwaway probe — the
  // same technique card-treatment.spec.ts uses to resolve --surface-primary,
  // with one critical difference: that spec resolves ONE token, this one resolves
  // ten. A probe element must be FRESH per token. Chromium caches the computed
  // background on an element across `var()` reassignments — even with an
  // intervening `style.backgroundColor = ''` — so a reused probe returns the
  // FIRST token's value for all ten. Measured: reuse+reset gave marketing's
  // rgb(42,85,66) for back-office and brand too, which flagged nine correct
  // pages as violations before the cause was found.
  const resolve = (token: string) => {
    const probe = document.createElement('div');
    document.body.appendChild(probe);
    probe.style.backgroundColor = `var(${token})`;
    const v = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return v;
  };
  const norm = (c: string) => c.replace(/\s+/g, '').toLowerCase();

  const allowed = new Set<string>();
  for (const line of lines) {
    for (const ctx of ['on-light', 'on-dark']) {
      const v = resolve(`--background-service-${line}-${ctx}`);
      if (v && v !== 'rgba(0, 0, 0, 0)') allowed.add(norm(v));
    }
  }

  const out: CtaFinding[] = [];
  // Plan CTAs only: an href with a slug segment under /plans. The bare /plans
  // index link (nav item, breadcrumb) is not a per-plan CTA and has no line.
  const ctas = Array.from(
    document.querySelectorAll('a[href^="/plans/"], a[href*="/plans/"]'),
  ) as HTMLElement[];

  for (const cta of ctas) {
    // EXEMPT: the R2 home pricing band (`data-section="pricing"`). Its design
    // (Figma node 25768:7667, brikdesigns#1060) specifies uniform brand-poppy
    // primary CTAs across all three cards — a deliberate brand band, NOT the
    // per-service-line tint this gate enforces on every other /plans/{slug}
    // primary CTA. Operator-ratified 2026-08-26. Both the `/` route case and
    // the mega-nav case load `/`, so this one skip covers both. Every OTHER
    // plan CTA on the page is still audited.
    if (cta.closest('section[data-section="pricing"]')) continue;
    // Only buttons — plain text/card links carry no fill to assert on.
    if (!cta.classList.contains('bds-button') && !cta.querySelector('.bds-button')) continue;
    const btn = (cta.classList.contains('bds-button')
      ? cta
      : cta.querySelector('.bds-button')) as HTMLElement;
    if (!btn.classList.contains('bds-button--primary')) continue;

    const bg = getComputedStyle(btn).backgroundColor;
    const serviceThemed = !!btn.closest('.service-themed');
    if (allowed.has(norm(bg)) && serviceThemed) continue;

    const section = cta.closest('section');
    out.push({
      href: cta.getAttribute('href') ?? '(none)',
      label: (btn.textContent ?? '').trim().slice(0, 40),
      section:
        section?.getAttribute('data-section') ??
        section?.getAttribute('aria-labelledby') ??
        section?.className ??
        '(no section)',
      bg,
      serviceThemed,
    });
  }
  return out;
};

const report = (findings: CtaFinding[], where: string) =>
  `Support-plan CTAs not adopting their service-line color on ${where}:\n` +
  findings
    .map(
      (f) =>
        `  → ${f.href} ("${f.label}")\n` +
        `    fill: ${f.bg}${f.serviceThemed ? '' : '   [missing .service-themed ancestor]'}\n` +
        `    section: ${f.section}`,
    )
    .join('\n') +
  `\n\nEvery /plans/{slug} CTA must carry serviceCtaVars(line) — inline or on an\n` +
  `ancestor — AND a .service-themed class, so the fill is the plan's own\n` +
  `--background-service-{line}-on-light (and the dark-mode flip engages).\n` +
  `See serviceCtaVars() in src/lib/tokens.ts.`;

/**
 * #1404 — a service CTA whose fill IS its container's fill has no shape at all;
 * only its label survives. The tint audit above cannot see this, because the
 * colliding value is a perfectly canonical service step: for all five lines the
 * `onDark` fill and the `surfaceLight` surface resolve to the SAME primitive in
 * both roots, so a CTA that flips to `onDark` on a mode-invariant pale card
 * lands exactly on it. Set membership answers "is this a service color", not
 * "is this distinct from what is behind it".
 *
 * Population is deliberately WIDER than the tint audit's. That one keys on
 * `a[href^="/plans/"]`, and #1409 turned the plan-tier CTA into a modal
 * `<button>` with no href — so the very control this defect was filed against
 * had already fallen out of the selector. Distinctness is a property of every
 * service-themed primary, not only the ones that navigate, so this walks them
 * all. Verified to fail first on `/plans/{slug}` dark before the fix.
 *
 * Nothing about this is theme-specific in the assertion — it runs in both
 * Playwright projects and the dark one is where it bites, exactly as
 * card-treatment.spec.ts does for chrome.
 */
const COLLISION_AUDIT = (): CollisionFinding[] => {
  const out: CollisionFinding[] = [];

  // WCAG 2.1 relative luminance + contrast ratio. Byte-identity was the first
  // cut of this gate and it was too narrow: on `/plans/[slug]` the Full Stack
  // band paired a pale-green `onDark` CTA with a pale-yellow fixed-light band
  // at 1.07:1 — a different hue, so identity saw nothing, and a button you
  // cannot find all the same. 1.4.11 sets 3:1 for a non-text UI boundary, so
  // that is the threshold rather than a hand-picked delta.
  const rgb = (c: string): [number, number, number] | null => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(',').map((v) => parseFloat(v));
    return [p[0], p[1], p[2]];
  };
  const lum = ([r, g, b]: [number, number, number]) => {
    const f = (v: number) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a: string, b: string) => {
    const ca = rgb(a);
    const cb = rgb(b);
    if (!ca || !cb) return null;
    const la = lum(ca);
    const lb = lum(cb);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  };

  const btns = Array.from(
    document.querySelectorAll('.service-themed .bds-button--primary'),
  ) as HTMLElement[];

  for (const btn of btns) {
    const bg = getComputedStyle(btn).backgroundColor;
    // The nearest PAINTED ancestor — a transparent one backs nothing, so it is
    // not what the eye compares the button against.
    let backdrop: string | null = null;
    let backdropCls = '';
    for (let n = btn.parentElement; n; n = n.parentElement) {
      const abg = getComputedStyle(n).backgroundColor;
      if (abg && abg !== 'rgba(0, 0, 0, 0)' && abg !== 'transparent') {
        backdrop = abg;
        backdropCls = (n.className || n.tagName).toString().slice(0, 60);
        break;
      }
    }
    if (backdrop === null) continue;
    const cr = ratio(bg, backdrop);
    if (cr === null || cr >= 3) continue;

    const section = btn.closest('section');
    out.push({
      label: (btn.textContent ?? '').trim().slice(0, 40),
      section:
        section?.getAttribute('data-section') ??
        section?.getAttribute('aria-labelledby') ??
        section?.className ??
        '(no section)',
      bg,
      backdrop,
      backdropCls,
      ratio: Math.round(cr * 100) / 100,
    });
  }
  return out;
};

const collisionReport = (findings: CollisionFinding[], where: string) =>
  `Service CTAs with no fill contrast against their own container on ${where}:\n` +
  findings
    .map(
      (f) =>
        `  → "${f.label}"  —  ${f.ratio}:1 (WCAG 1.4.11 wants ≥ 3:1)\n` +
        `    fill: ${f.bg}   backdrop: ${f.backdrop}\n` +
        `    painted by: ${f.backdropCls}\n` +
        `    section: ${f.section}`,
    )
    .join('\n') +
  `\n\nThe button has no shape — only its label is visible. The fill is a real\n` +
  `service step, just the same one its container paints: the dark-mode flip in\n` +
  `globals.css assumes the backdrop flipped too, which is false on a\n` +
  `mode-invariant surfaceLight tone.\n` +
  `\n` +
  `FIX: pass the backdrop at the call site — serviceCtaVars(line, 'fixed-light')\n` +
  `— never a per-card color override. See ServiceCtaBackdrop in src/lib/tokens.ts\n` +
  `and .claude/references/service-token-decision-tree.md.`;

test.describe('Service-CTA tint — support-plan CTAs adopt their line color', () => {
  for (const route of ROUTES) {
    test(`${route.name} (${route.path})`, async ({ page }) => {
      // #1030: 8 of these 9 passed against a 500 that rendered a <main>, so the
      // presence guard alone was not enough — the retried status half catches an
      // error page that keeps the layout.
      await gotoRendered(page, route.path, { waitUntil: 'load' });

      const findings = await page.evaluate(AUDIT, SERVICE_LINES);
      expect(findings, report(findings, route.path)).toHaveLength(0);

      const collisions = await page.evaluate(COLLISION_AUDIT);
      expect(collisions, collisionReport(collisions, route.path)).toHaveLength(0);
    });
  }

  test('Mega-nav Support Plans panel', async ({ page }) => {
    await gotoRendered(page, '/', { waitUntil: 'load' });
    // The panel is closed at rest — the plan cards only mount once the Plans
    // dropdown is open, so an unopened-nav sweep would report zero CTAs and
    // pass vacuously. Assert the cards exist before measuring.
    await page.getByRole('button', { name: /^Services/ }).click();
    const cards = page.locator('.mega-nav__plans-grid .mega-nav__about-card');
    await expect(cards.first()).toBeVisible();

    const findings = await page.evaluate(AUDIT, SERVICE_LINES);
    expect(findings, report(findings, 'the mega-nav Plans panel')).toHaveLength(0);

    const collisions = await page.evaluate(COLLISION_AUDIT);
    expect(collisions, collisionReport(collisions, 'the mega-nav Plans panel')).toHaveLength(0);
  });
});
