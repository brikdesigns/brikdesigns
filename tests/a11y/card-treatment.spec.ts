import { test, expect } from '@playwright/test';

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
 *   • .bds-pricing-card--highlighted — the featured pricing tier keeps its
 *     brand-colored ring on a tint as intentional emphasis (shared-sections.css).
 *
 * LIGHT THEME ONLY. The standard is literally about "white backgrounds" — a
 * light-mode concept. In dark mode there are no white bands (some sections even
 * flip white→deep-tint by theme, e.g. plan-detail "What You Get"), and a subtle
 * border, not a shadow, is the correct card definition since box-shadow barely
 * reads on a dark surface. Dark-mode card chrome is a separate standard; this
 * gate does not adjudicate it. Skipped on the `-dark` project.
 */

// Mirror of src/app/sitemap.ts statics + one instance per dynamic [slug]
// family — kept in sync with public-routes.spec.ts PUBLIC_ROUTES.
const ROUTES: { path: string; name: string }[] = [
  { path: '/', name: 'Home' },
  { path: '/about', name: 'About' },
  { path: '/services', name: 'Services index' },
  { path: '/services/brand', name: 'Service line — brand' },
  { path: '/services/brand/logo-design', name: 'Service detail — logo design' },
  { path: '/services/back-office/crm-setup-and-data-cleanup', name: 'Service detail — back-office' },
  { path: '/plans', name: 'Plans' },
  { path: '/plans/back-office-support', name: 'Plan detail — back-office' },
  { path: '/customer-stories', name: 'Customer stories index' },
  { path: '/customers', name: 'Customers' },
  { path: '/customers/dental', name: 'Customer detail — dental' },
  { path: '/blog', name: 'Blog index' },
  { path: '/blog/overwhelmed-in-your-business-how-to-move-forward', name: 'Blog post' },
  { path: '/events/demo-spring-webinar', name: 'Event detail — stacked' },
  { path: '/events/grind-after-graduation', name: 'Event detail — showcase' },
  { path: '/contact', name: 'Contact' },
];

interface CardFinding {
  card: string;
  section: string;
  band: 'default' | 'tint';
  bandBg: string;
  hasBorder: boolean;
  hasShadow: boolean;
  expected: string;
}

test.describe('Card-treatment standard — border/shadow by band', () => {
  for (const route of ROUTES) {
    test(`${route.name} (${route.path}) cards follow the band standard`, async ({ page }, testInfo) => {
      test.skip(
        testInfo.project.name.endsWith('-dark'),
        'Card-treatment standard is a light-mode (white background) concept; dark-mode card definition follows a different rule.',
      );
      await page.goto(route.path, { waitUntil: 'load' });
      await expect(page.locator('main')).toHaveCount(1);

      const findings: CardFinding[] = await page.evaluate(() => {
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

        const cards = Array.from(
          document.querySelectorAll(
            '.bds-card:not(.bds-card--borderless):not(.bds-pricing-card--highlighted)',
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
          const band: 'default' | 'tint' =
            norm(bandBg) === norm(surfacePrimary) ? 'default' : 'tint';

          const ok =
            band === 'default'
              ? hasBorder && !hasShadow
              : !hasBorder && hasShadow;
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
              band === 'default'
                ? 'border + no shadow'
                : 'shadow + no border',
          });
        }
        return out;
      });

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
          `Cards violating the card-treatment standard on ${route.path}:\n${summary}\n\n` +
            `Standard: white/default band → border + no shadow; tinted band → shadow + no border.\n` +
            `Fix in CSS (band-derived), not a per-card variant. See .claude/references/card-treatment.md.`,
        ).toHaveLength(0);
      }
    });
  }
});
