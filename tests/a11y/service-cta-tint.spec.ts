import { test, expect } from '@playwright/test';

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
  { path: '/customer-stories', name: 'Customer stories — Our Services' },
  { path: '/plans', name: 'Plans index' },
  { path: '/plans/back-office-support', name: 'Plan detail — Other Support Plans' },
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

test.describe('Service-CTA tint — support-plan CTAs adopt their line color', () => {
  for (const route of ROUTES) {
    test(`${route.name} (${route.path})`, async ({ page }) => {
      await page.goto(route.path, { waitUntil: 'load' });
      await expect(page.locator('main')).toHaveCount(1);

      const findings = await page.evaluate(AUDIT, SERVICE_LINES);
      expect(findings, report(findings, route.path)).toHaveLength(0);
    });
  }

  test('Mega-nav Support Plans panel', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    // The panel is closed at rest — the plan cards only mount once the Plans
    // dropdown is open, so an unopened-nav sweep would report zero CTAs and
    // pass vacuously. Assert the cards exist before measuring.
    await page.getByRole('button', { name: /^Services/ }).click();
    const cards = page.locator('.mega-nav__plans-grid .mega-nav__about-card');
    await expect(cards.first()).toBeVisible();

    const findings = await page.evaluate(AUDIT, SERVICE_LINES);
    expect(findings, report(findings, 'the mega-nav Plans panel')).toHaveLength(0);
  });
});
