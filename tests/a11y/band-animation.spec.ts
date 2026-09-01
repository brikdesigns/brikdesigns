import { test, expect } from '@playwright/test';
import { gotoRendered, expectMeasured } from './lib/goto-rendered';

/**
 * Band-animation gate — brikdesigns.com (#1170).
 *
 * THE enforcement for the band rule (canonical:
 * .claude/references/band-animation.md):
 *
 *   • A section painted in a colour other than the page ground is a BAND.
 *     A band's SURFACE never animates — it must not carry `.scroll-reveal`.
 *   • A band's CONTENT animates instead, so the section still has motion.
 *   • A section on the page ground keeps the whole-section reveal.
 *
 * Why this gate exists, specifically: the rule was already decided in #728 and
 * shipped as a four-class allowlist in ScrollReveal.tsx. It then silently
 * regressed on every band authored afterwards — by 2026-08-31 three bands on
 * /how-we-work alone (.hiw-process, .hiw-practice, .hiw-industries) and three
 * on the home page (problem-cta, industries, pricing) were animating as whole
 * rectangles, and the operator reported the original defect a second time
 * (#1168). A rule with no gate is a rule that regresses; an allowlist with no
 * gate is a rule that regresses silently.
 *
 * Why measured rather than a grep of ScrollReveal.tsx: the source could look
 * correct and still mis-tag, because "is this a band?" depends on CSS the
 * component never sees — a page stylesheet, a client-theme override, a token
 * that moves per theme. The only honest question is what class ended up on
 * what element, in a real browser, in each theme.
 *
 * Runs light + dark via the two Playwright projects. Both matter and they are
 * not the same test: `--surface-primary` tracks the page ground in BOTH themes
 * (so a `.page-section` is never a band), while the accent tints are
 * fixed-light in both (so they are always a band, including on a black ground).
 */

// This is the ONE spec in tests/a11y/ that must run with motion enabled.
// Both Playwright projects set `contextOptions: { reducedMotion: 'reduce' }`
// (playwright.config.ts) so axe scans real fg/bg pairs instead of opacity:0
// mid-reveal — and ScrollReveal honours that preference by bailing before it
// tags anything. Under the project default this spec measures zero targets on
// every route and every assertion passes vacuously, which is precisely the
// failure mode `expectMeasured` exists to catch. Opt back into motion here,
// and only here.
test.use({ contextOptions: { reducedMotion: 'no-preference' } });

const ROUTES: { path: string; name: string }[] = [
  { path: '/', name: 'Home' },
  { path: '/how-we-work', name: 'How We Work' },
  { path: '/about', name: 'About' },
  { path: '/services', name: 'Services index' },
  { path: '/customers', name: 'Customers' },
  { path: '/customer-stories', name: 'Customer stories index' },
  { path: '/contact', name: 'Contact' },
];
// /plans is deliberately absent: measured 2026-08-31, all three of its sections
// resolve to the page ground (its `.service-themed` band sets CSS vars, not a
// background), so it has no band for this gate to assert on. Listing it would
// fail the `measuredBands` precondition, which is the precondition working.

interface BandFinding {
  section: string;
  bg: string;
  problem: string;
}

test.describe('Band animation — surfaces stay put, content moves', () => {
  for (const route of ROUTES) {
    test(`${route.name} (${route.path}) animates band content, not band surfaces`, async ({
      page,
    }, testInfo) => {
      const isDark = testInfo.project.name.endsWith('-dark');
      await gotoRendered(page, route.path, { waitUntil: 'load' });

      // ScrollReveal tags behind a double rAF (it defers past the hydration
      // commit, #760). Wait for the tagging pass to have run rather than
      // sleeping a magic number: every route here has at least one revealable
      // target below the fold.
      await page
        .waitForFunction(() => document.querySelector('.scroll-reveal') !== null, null, {
          timeout: 10_000,
        })
        .catch(() => {
          /* asserted below via expectMeasured — a clearer failure than a raw timeout */
        });

      const { findings, measuredBands, taggedTotal } = await page.evaluate(() => {
        const ground = getComputedStyle(document.body).backgroundColor;

        const isTransparent = (color: string) => {
          if (!color || color === 'transparent') return true;
          const parts = color.match(/rgba?\(([^)]+)\)/)?.[1].split(',');
          return parts?.length === 4 && parseFloat(parts[3]) === 0;
        };

        const sections = Array.from(
          document.querySelectorAll<HTMLElement>('main section'),
        ).filter((el) => !el.parentElement?.closest('section'));

        const out: BandFinding[] = [];
        let bands = 0;

        for (const section of sections) {
          const bg = getComputedStyle(section).backgroundColor;
          if (isTransparent(bg) || bg === ground) continue; // on the ground — not this gate's business
          bands++;

          const label =
            section.getAttribute('data-section') ??
            section.getAttribute('aria-labelledby') ??
            section.className ??
            '(unnamed section)';

          // (1) The surface must never animate. This is the defect #728 fixed
          // and #1170 re-fixed; it is absolute and always assertable.
          if (section.classList.contains('scroll-reveal')) {
            out.push({
              section: label,
              bg,
              problem: 'band surface carries .scroll-reveal — the whole rectangle animates',
            });
            continue;
          }

          // (2) A band that WOULD have been tagged under the old rule (i.e. it
          // sits below the fold at load) must have handed its motion to its
          // content, not dropped it. The 0.85 factor mirrors ScrollReveal's own
          // above-the-fold filter, so this reproduces its decision exactly.
          const belowFold =
            section.getBoundingClientRect().top > window.innerHeight * 0.85;
          if (belowFold && section.querySelectorAll('.scroll-reveal').length === 0) {
            out.push({
              section: label,
              bg,
              problem:
                'band is below the fold but nothing inside it animates — motion was dropped, not moved',
            });
          }
        }

        return {
          findings: out,
          measuredBands: bands,
          taggedTotal: document.querySelectorAll('.scroll-reveal').length,
        };
      });

      // A clean sweep only means something if there was something to sweep
      // (#1036). Both counts matter: zero bands means the route table is wrong,
      // zero tagged elements means ScrollReveal never ran and every band would
      // pass assertion (1) vacuously.
      expectMeasured(measuredBands, route.path, 'tinted bands');
      expectMeasured(taggedTotal, route.path, 'scroll-reveal targets');

      if (findings.length > 0) {
        const summary = findings
          .map((f) => `  [${f.bg}] ${f.section}\n    ${f.problem}`)
          .join('\n');
        expect(
          findings,
          `Band-animation violations on ${route.path} (${isDark ? 'dark' : 'light'}):\n${summary}\n\n` +
            `A section painted in a colour other than the page ground is a band: its\n` +
            `surface must stay put and its content animates instead.\n` +
            `Fix in src/components/ui/ScrollReveal.tsx — and fix the DERIVATION, never\n` +
            `by adding this section's class to a list. The list IS the bug (#728 → #1170).\n` +
            `See .claude/references/band-animation.md.`,
        ).toHaveLength(0);
      }
    });
  }
});
