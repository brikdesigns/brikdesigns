import { test, expect } from '@playwright/test';
import { gotoRendered, expectMeasured } from './lib/goto-rendered';

/**
 * Card-treatment gate — brikdesigns.com.
 *
 * THE enforcement for the card-treatment standard (canonical:
 * .claude/references/card-treatment.md):
 *
 *   • Default (white / --surface-primary) band → border, NO shadow
 *   • Tinted band (--secondary / --accent / service tint) → shadow, NO border
 *
 * Why measured (computed style) rather than a static `variant=` grep: the
 * chrome that actually renders is the product of the BDS variant AND every CSS
 * override that fights it. The recurring #360→#558→#799→#970 regression cycle
 * kept "passing" because each audit was a manual computed-style check of ONE
 * route while identical cards on other pages stayed wrong — and #970 proved a
 * card can carry `variant="raised"` yet render bordered because CSS overrode it.
 * Only measuring the rendered border/shadow on EVERY card on EVERY route, in
 * BOTH themes, catches both failure modes. This spec is that sweep, automated.
 *
 * Classification is by measured background, NOT class name: a card's band is
 * the nearest ancestor with a non-transparent background; if that colour equals
 * the resolved --surface-primary it's the default (white) band, else a tint.
 * This is deliberate — tinted sections are painted under several bespoke class
 * names (.contact-plans, .section-plans, …), so a class allowlist would rot.
 *
 * Runs light + dark via the two Playwright projects (see playwright.config.ts),
 * against `next dev` locally or the Netlify deploy-preview in CI.
 *
 * Excluded (not violations):
 *   • .bds-card--borderless — transparent by design (quote/challenge cards);
 *     the border/shadow standard is for opaque cards only.
 *
 * NOT excluded any more: `.bds-pricing-card--highlighted` was skipped here until
 * #1326, on the reasoning that a featured tier keeps a brand-colored ring. That
 * exemption is the reason this spec stayed green while /plans shipped a ring the
 * design does not have (#1304) — the one card that was wrong was the one card
 * not measured. The prop is retired at every call site and the `:not()` carve-out
 * is gone from shared-sections.css, so a highlighted card can no longer render;
 * if one ever does, it is measured like any other rather than waved through.
 *
 * BOTH THEMES (#980), classified by measured band LUMINANCE, not by theme:
 *
 *   • Band is DARK  → border, no shadow. A shadow cannot define a card here:
 *     --box-shadow-md is rgba(0,0,0,0.08) and --surface-primary is rgb(0,0,0)
 *     in the dark root, so ~50 cards across these routes were rendering with
 *     no boundary at all. --border-secondary (rgb(176,176,176)) reads.
 *   • Band is WHITE (== --surface-primary) → border, no shadow. Unchanged.
 *   • Band is a LIGHT TINT → shadow, no border. Unchanged.
 *
 * Luminance, not `data-theme`, is the discriminator because the two are not the
 * same question. Some bands are PALE in dark mode — the service `-on-dark`
 * steps measure rgb(196,176,235) and rgb(255,173,146) — and a dark shadow reads
 * fine on those (those two figures are two such bands, not the whole set). A
 * first cut of this gate asserted "border everywhere in dark" and correctly
 * failed on five routes, across five distinct pale band values — the
 * information, product, marketing, back-office and brand `-on-dark` steps. The
 * rule is about whether a dark shadow has a light enough surface to read
 * against, which is a property of the band, in either theme.
 */

// Mirror of src/app/sitemap.ts statics + one instance per dynamic [slug]
// family — kept in sync with public-routes.spec.ts PUBLIC_ROUTES.
// `cards: false` opts a route out of the swept-something precondition below.
// Both event templates are prose/media layouts with no opaque cards — measured
// 0 on 2026-08-24 — so requiring one there would fail on a healthy page.
const ROUTES: { path: string; name: string; cards?: false }[] = [
  { path: '/', name: 'Home' },
  // /about opted out: the #1245 rebuild left no BDS <Card>s — the team cards are
  // hand-built <article>s and "What We Believe" is a BDS <Accordion>.
  { path: '/services', name: 'Services index' },
  { path: '/services/brand', name: 'Service line — brand' },
  { path: '/services/brand/logo-design', name: 'Service detail — logo design' },
  { path: '/services/back-office/crm-setup-and-data-cleanup', name: 'Service detail — back-office' },
  { path: '/plans', name: 'Plans' },
  { path: '/plans/back-office-support', name: 'Plan detail — back-office' },
  { path: '/results', name: 'Customer stories index' },
  // Story DETAIL was never covered, though #971 listed two violations on it
  // ("Other Customer Stories" outlined-on-accent, "Related Services" flat).
  // Both measured clean at pickup — this route pins that.
  { path: '/results/birdwell-mutlak-dentistry-website', name: 'Customer story detail' },
  { path: '/industries', name: 'Industries' },
  { path: '/industries/dental', name: 'Industry detail — dental' },
  { path: '/blog', name: 'Blog index' },
  { path: '/blog/overwhelmed-in-your-business-how-to-move-forward', name: 'Blog post' },
  { path: '/events/demo-spring-webinar', name: 'Event detail — stacked', cards: false },
  { path: '/events/grind-after-graduation', name: 'Event detail — showcase', cards: false },
  { path: '/contact', name: 'Contact' },
];

interface CardFinding {
  card: string;
  section: string;
  band: 'default' | 'tint' | 'dark';
  bandBg: string;
  hasBorder: boolean;
  hasShadow: boolean;
  expected: string;
}

/**
 * The in-page measurement, hoisted to module scope in #1326 so the self-test
 * below can run it against a deliberately-wrong card. While it was inline,
 * the only way to know the selector still reached a given card was to read it
 * — which is exactly how the pricing-card set went unmeasured for so long.
 */
const AUDIT = () => {
      // Resolve --surface-primary to an rgb string via a throwaway element.
      const probe = document.createElement('div');
      probe.style.backgroundColor = 'var(--surface-primary)';
      document.body.appendChild(probe);
      const surfacePrimary = getComputedStyle(probe).backgroundColor;
      probe.remove();

      const norm = (c: string) => c.replace(/\s+/g, '').toLowerCase();
      // Alpha 0 => not a visible border, regardless of width.
      const isOpaque = (c: string) => {
        const m = c.match(/rgba?\(([^)]+)\)/);
        if (!m) return c !== 'transparent';
        const parts = m[1].split(',').map((p) => p.trim());
        return parts.length < 4 || parseFloat(parts[3]) > 0;
      };

      // `.bds-pricing-card` is included as of #1326. It is a DISTINCT BDS
      // class — a pricing card carries `bds-pricing-card` and never
      // `bds-card` (measured: 0 of 3 on /services/back-office/…) — so the
      // old `.bds-card:not(.bds-pricing-card--highlighted)` selector was
      // doubly inert: it could not reach a pricing card at all, and the
      // `:not()` therefore excluded nothing. Pricing cards were the
      // unmeasured set this spec was believed to cover, which is how the
      // #1304 ring shipped green. `shared-sections.css` gives them the same
      // band treatment, so they answer to the same rule.
      const cards = Array.from(
        document.querySelectorAll(
          '.bds-card:not(.bds-card--borderless), .bds-pricing-card',
        ),
      ) as HTMLElement[];

      const out: CardFinding[] = [];
      for (const card of cards) {
        const cs = getComputedStyle(card);
        const hasBorder =
          (parseFloat(cs.borderTopWidth) || 0) > 0 &&
          cs.borderTopStyle !== 'none' &&
          isOpaque(cs.borderTopColor);
        const hasShadow = cs.boxShadow !== 'none' && cs.boxShadow !== '';

        let bandBg = surfacePrimary;
        let el: HTMLElement | null = card.parentElement;
        while (el) {
          const bg = getComputedStyle(el).backgroundColor;
          if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
            bandBg = bg;
            break;
          }
          el = el.parentElement;
        }
        // Relative luminance (WCAG 2.x formula) of the band, so "can a dark
        // shadow read against this?" is measured rather than inferred from
        // the theme. 0.18 sits well below the palest dark-mode tint measured
        // (rgb(196,176,235) ≈ 0.50) and well above the lightest dark neutral
        // (rgb(27,27,27) ≈ 0.01), so it is nowhere near either cluster.
        const lum = (c: string) => {
          const m = c.match(/rgba?\(([^)]+)\)/);
          if (!m) return 1;
          const [r, g, b] = m[1].split(',').map((p) => parseFloat(p.trim()) / 255);
          const f = (v: number) =>
            v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
          return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
        };
        const isDarkBand = lum(bandBg) < 0.18;
        const band: 'default' | 'tint' | 'dark' = isDarkBand
          ? 'dark'
          : norm(bandBg) === norm(surfacePrimary)
            ? 'default'
            : 'tint';

        // A shadow only defines a card on a light-enough surface. On a dark
        // band the border is the only thing that reads, whatever the theme.
        const ok =
          band === 'tint' ? !hasBorder && hasShadow : hasBorder && !hasShadow;
        if (ok) continue;

        // Best-effort human label: the card's own classes + nearest section id.
        const section = card.closest('section');
        const sectionId =
          section?.getAttribute('data-section') ??
          section?.getAttribute('aria-labelledby') ??
          section?.className ??
          '(no section)';
        out.push({
          card: card.className,
          section: sectionId,
          band,
          bandBg,
          hasBorder,
          hasShadow,
          expected:
            band === 'tint' ? 'shadow + no border' : 'border + no shadow',
        });
      }
      return { findings: out, measured: cards.length };
};

test.describe('Card-treatment standard — border/shadow by band', () => {
  for (const route of ROUTES) {
    test(`${route.name} (${route.path}) cards follow the band standard`, async ({ page }, testInfo) => {
      const isDark = testInfo.project.name.endsWith('-dark');
      // #1030: this spec passed 16/16 against a 500 that rendered a <main>, so
      // the presence guard alone was not enough — the retried status half is
      // what catches an error page that keeps the layout.
      await gotoRendered(page, route.path, { waitUntil: 'load' });

      const { findings, measured } = await page.evaluate(AUDIT);

      // A clean sweep only means something if there was something to sweep.
      // A missing CMS slug renders an empty <main> with HTTP 200 (#1036), which
      // the status half of gotoRendered cannot see.
      if (route.cards !== false) expectMeasured(measured, route.path, 'cards');

      if (findings.length > 0) {
        const summary = findings
          .map(
            (f) =>
              `  [${f.band} band, bg ${f.bandBg}] got ${f.hasBorder ? 'border' : 'no-border'}/${f.hasShadow ? 'shadow' : 'flat'}, expected ${f.expected}\n` +
              `    card: .${f.card.split(' ').join('.')}\n    section: ${f.section}`,
          )
          .join('\n');
        expect(
          findings,
          `Cards violating the card-treatment standard on ${route.path} (${isDark ? 'dark' : 'light'}):\n${summary}\n\n` +
            `Standard, by measured band luminance: dark band → border + no shadow (a dark\n` +
            `shadow is invisible there); white band → border + no shadow; light tint →\n` +
            `shadow + no border.\n` +
            `Fix in CSS (in the "Card chrome by band" block in shared-sections.css), not a\n` +
            `per-card variant. See .claude/references/card-treatment.md.`,
        ).toHaveLength(0);
      }
    });
  }
});

/**
 * Home `about` section — the team cards (#1274) are hand-built <article>s
 * (`.team-member`, a person's bio, not a BDS <Card>), so the `.bds-card` sweep
 * above cannot see them, exactly as it can't see /about's team cards (which is
 * why that route opts out). This block asserts the same standard on them
 * directly: the section is on --surface-primary (== the page ground, white in
 * light / black in dark, tracked in both themes), so the cards must be
 * border + no shadow in BOTH projects.
 */
test.describe('Card-treatment standard — home about team cards', () => {
  test('home /about-section team cards are border + no shadow', async ({ page }, testInfo) => {
    const isDark = testInfo.project.name.endsWith('-dark');
    await gotoRendered(page, '/', { waitUntil: 'load' });

    const { findings, measured } = await page.evaluate(() => {
      const isOpaque = (c: string) => {
        const m = c.match(/rgba?\(([^)]+)\)/);
        if (!m) return c !== 'transparent';
        const parts = m[1].split(',').map((p) => p.trim());
        return parts.length < 4 || parseFloat(parts[3]) > 0;
      };
      const cards = Array.from(
        document.querySelectorAll('[data-section="about"] .team-member'),
      ) as HTMLElement[];
      const out: { card: string; hasBorder: boolean; hasShadow: boolean }[] = [];
      for (const card of cards) {
        const cs = getComputedStyle(card);
        const hasBorder =
          (parseFloat(cs.borderTopWidth) || 0) > 0 &&
          cs.borderTopStyle !== 'none' &&
          isOpaque(cs.borderTopColor);
        const hasShadow = cs.boxShadow !== 'none' && cs.boxShadow !== '';
        if (hasBorder && !hasShadow) continue;
        out.push({ card: card.className, hasBorder, hasShadow });
      }
      return { findings: out, measured: cards.length };
    });

    expectMeasured(measured, '/', 'about team cards');

    if (findings.length > 0) {
      const summary = findings
        .map(
          (f) =>
            `  got ${f.hasBorder ? 'border' : 'no-border'}/${f.hasShadow ? 'shadow' : 'flat'}, expected border + no shadow\n` +
            `    card: .${f.card.split(' ').join('.')}`,
        )
        .join('\n');
      expect(
        findings,
        `Home about-section team cards violating the white-band standard (${isDark ? 'dark' : 'light'}):\n${summary}\n\n` +
          `The about section is --surface-primary (== page ground) in both themes, so its\n` +
          `cards must be border + no shadow. Fix in the .team-member block in\n` +
          `shared-sections.css. See .claude/references/card-treatment.md.`,
      ).toHaveLength(0);
    }
  });
});

/**
 * Self-test — the gate must BITE on the #1304 shape.
 *
 * #1326's finding was that this spec's coverage had quietly become a claim
 * rather than a fact: `.bds-pricing-card` carries a distinct BDS class and never
 * `.bds-card`, so the old selector reached none of them, while a
 * `:not(.bds-pricing-card--highlighted)` clause implied it did. A green run over
 * a set that excludes the interesting cards is indistinguishable from a green
 * run over a correct one — which is how the /plans poppy ring shipped.
 *
 * So this asserts the measurement itself, not the site: inject the exact defect
 * (`--highlighted` + a ring, no shadow, on a tint band) and require AUDIT to
 * report it. If someone narrows the selector again, this fails even when every
 * route is clean.
 */
test.describe('Card-treatment gate — self-test', () => {
  test('AUDIT reports a highlighted pricing card with a ring on a tint band', async ({
    page,
  }) => {
    await gotoRendered(page, '/services/back-office/crm-setup-and-data-cleanup', {
      waitUntil: 'load',
    });

    const clean = await page.evaluate(AUDIT);
    expect(
      clean.findings,
      `The route must be clean BEFORE the defect is injected, or this test proves\n` +
        `nothing about the injection. Findings:\n${JSON.stringify(clean.findings, null, 2)}`,
    ).toHaveLength(0);
    expect(
      clean.measured,
      'No cards measured — the selector reaches nothing, so the injection below cannot be seen.',
    ).toBeGreaterThan(0);

    const injected = await page.evaluate(() => {
      const victim = document.querySelector('.bds-pricing-card') as HTMLElement | null;
      if (!victim) return false;
      victim.classList.add('bds-pricing-card--highlighted');
      // The #1304 chrome: a brand-colored ring. On a tint band the standard is
      // shadow + NO border, so the ring alone is the violation — we do not also
      // clear the shadow, because an inline `box-shadow: none` does not reliably
      // win here and the shadow is not what decides it (`ok` on a tint band
      // requires `!hasBorder`, whatever the shadow does).
      victim.style.border = '3px solid rgb(227, 83, 53)';
      return true;
    });
    expect(injected, 'No .bds-pricing-card on this route to inject into.').toBe(true);

    const after = await page.evaluate(AUDIT);
    const hit = after.findings.find((f) =>
      f.card.includes('bds-pricing-card--highlighted'),
    );
    expect(
      hit,
      `AUDIT did not report the injected highlighted card. The gate is not measuring\n` +
        `pricing cards — check the selector in AUDIT (#1326). Findings:\n` +
        `${JSON.stringify(after.findings, null, 2)}`,
    ).toBeDefined();
    expect(hit?.band).toBe('tint');
    expect(hit?.hasBorder).toBe(true);
  });
});
