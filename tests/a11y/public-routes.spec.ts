import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Public-route WCAG 2.1 AA audit — brikdesigns.com.
 *
 * Pattern adapted from the canonical birdwell-mutlak a11y test (which was
 * itself ported from brik-client-portal). Adapted for Next.js App Router:
 *
 * - No auth seeding — the entire marketing surface is public. Admin routes
 *   under /admin are gated by Supabase auth and out of scope for this gate.
 * - Routes list mirrors src/app/sitemap.ts for static pages, plus one
 *   representative dynamic instance per [slug] route family.
 * - Tests run against `next dev` locally or the Netlify deploy-preview in
 *   CI (per playwright.config.ts).
 *
 * Compliance reference: @brikdesigns/bds/content-system/compliance/
 *   healthcare-ada.md §6b — fail on serious/critical, warn on
 *   moderate/minor. Baseline file allows pre-existing debt and is burned
 *   down on its own cadence (see tests/a11y/README.md).
 */

const PUBLIC_ROUTES: { path: string; name: string }[] = [
  { path: '/', name: 'Home' },
  { path: '/about', name: 'About' },
  { path: '/services', name: 'Services index' },
  { path: '/services/brand', name: 'Service line — brand' },
  { path: '/services/brand/logo-design', name: 'Service detail — logo design' },
  { path: '/plans', name: 'Plans' },
  // /industries/* legacy paths 308-redirect to /customers/* — testing them
  // exercises the redirect and lands axe on the same content, which inflates
  // the violation footprint with the muted .bds-breadcrumb__current text
  // exposed by the redirect. Test the canonical /customers/* paths directly.
  { path: '/customer-stories', name: 'Customer stories index' },
  { path: '/customers', name: 'Customers' },
  { path: '/customers/dental', name: 'Customer detail — dental' },
  { path: '/blog', name: 'Blog index' },
  { path: '/events/demo-spring-webinar', name: 'Event detail — demo webinar' },
  { path: '/contact', name: 'Contact' },
  { path: '/get-started', name: 'Get started' },
  { path: '/free-marketing-analysis', name: 'Free marketing analysis' },
  { path: '/value', name: 'Value' },
  { path: '/privacy-policy', name: 'Privacy policy' },
];

// WCAG 2.1 AA tags — locked to the standard. Don't silently bump the
// conformance level to 2.2 or AAA without a per-rule review.
// 'best-practice' is added (not a conformance-level bump) to enable axe's
// landmark rules — region, landmark-one-main, landmark-unique, heading-order —
// which carry no WCAG tag and otherwise never run. This is the
// build-standards/page-structure landmark gate (brik-bds #824); it mirrors
// brik-client-portal #961. All are moderate impact → advisory, never block.
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];

const BLOCKING_IMPACTS = new Set(['critical', 'serious']);

type RouteBaseline = Record<string, Record<string, string[]>>;

interface BaselineFile {
  // Light-theme baseline (the original, default project).
  routes: RouteBaseline;
  // Dark-theme baseline (`chromium-desktop-dark` project). The two themes
  // resolve different tokens, so a finding allowed in one is NOT automatically
  // allowed in the other — each theme keeps its own debt list. #359 follow-up.
  routesDark?: RouteBaseline;
}

type Theme = 'light' | 'dark';

const BASELINE_PATH = path.join(process.cwd(), 'tests/a11y/baseline.json');
const baseline: BaselineFile = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));

// Axe emits positional indices like `:nth-child(3)` to point at a specific
// node, but the underlying violation is usually identical across siblings
// (e.g., five service cards with the same low-contrast subtext style).
// Stripping these indices on both sides collapses repeats into one canonical
// baseline entry per underlying violation. See issue #40 thread.
function normalizeSelector(selector: string): string {
  return selector
    .replace(/:nth-child\(\d+\)/g, '')
    .replace(/:nth-of-type\(\d+\)/g, '');
}

function normalize(routeBaseline: RouteBaseline): Record<string, Record<string, Set<string>>> {
  const out: Record<string, Record<string, Set<string>>> = {};
  for (const [route, rules] of Object.entries(routeBaseline)) {
    out[route] = {};
    for (const [ruleId, selectors] of Object.entries(rules)) {
      out[route][ruleId] = new Set(selectors.map(normalizeSelector));
    }
  }
  return out;
}

const normalizedBaseline: Record<Theme, Record<string, Record<string, Set<string>>>> = {
  light: normalize(baseline.routes),
  dark: normalize(baseline.routesDark ?? {}),
};

function isBaselined(theme: Theme, routePath: string, ruleId: string, selector: string): boolean {
  return normalizedBaseline[theme][routePath]?.[ruleId]?.has(normalizeSelector(selector)) ?? false;
}

// The dark project (`chromium-desktop-dark`) sets colorScheme:'dark'; everything
// else runs light. Keying off the project name keeps the two baselines distinct.
function themeFor(projectName: string): Theme {
  return projectName.endsWith('-dark') ? 'dark' : 'light';
}

test.describe('Public routes — WCAG 2.1 AA audit', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route.name} (${route.path}) has no new serious or critical violations`, async ({ page }, testInfo) => {
      const theme = themeFor(testInfo.project.name);
      // 'load' rather than 'networkidle' — networkidle is fragile on modern
      // sites with continuous network activity (lazy images, analytics).
      // 'load' waits for CSS + images, which is what axe needs for first-
      // paint contrast / alt-text rules.
      await page.goto(route.path, { waitUntil: 'load' });

      // Render guard (#341). Every public route renders exactly one <main>.
      // If it's absent, the document is NOT the app's page — it's a transient
      // infra/blank state (e.g. a Netlify function cold-start/error page, which
      // has its own `.branding`/`.footer` chrome and no <main>). Running axe
      // against that emits confusing `landmark-one-main` / `region` findings
      // that look like real structure debt but aren't. The toHaveCount assertion
      // auto-retries until the page renders (covering a hydration-timing flush)
      // and otherwise fails loudly here — "route didn't render" — instead of
      // leaking landmark noise into the report. See brikdesigns #341.
      await expect(
        page.locator('main'),
        `${route.path} did not render a <main> within timeout — the page is in a transient/error state (infra cold-start or blank flash), not real a11y debt. See #341.`,
      ).toHaveCount(1);

      // Exclude Netlify deploy-preview admin overlays and the Brik Dev Bar
      // (`.bdb-bar`) — a dev/staging-only toolbar injected client-side when
      // NEXT_PUBLIC_ENABLE_DEV_TOOLS=true (see src/components/DevTools.tsx). It
      // is absent in production, so its findings (white-on-poppy logo
      // color-contrast, out-of-landmark `region`) are environment noise, not
      // real debt — and its post-load injection made them flaky. .bdb-logo is
      // inside .bdb-bar, so the single exclude covers the whole subtree.
      const results = await new AxeBuilder({ page })
        .withTags(AXE_TAGS)
        .exclude('iframe[title="Netlify Drawer"]')
        .exclude('.bdb-bar')
        .analyze();

      type FlatFinding = {
        ruleId: string;
        impact: string;
        help: string;
        selector: string;
        failureSummary: string;
      };
      const flatFindings: FlatFinding[] = results.violations.flatMap((v) =>
        v.nodes.map((n) => ({
          ruleId: v.id,
          impact: v.impact ?? 'unknown',
          help: v.help,
          selector: Array.isArray(n.target) ? n.target.join(' >> ') : String(n.target),
          failureSummary: n.failureSummary ?? '',
        })),
      );

      const blocking = flatFindings.filter(
        (f) => BLOCKING_IMPACTS.has(f.impact) && !isBaselined(theme, route.path, f.ruleId, f.selector),
      );
      const baselined = flatFindings.filter(
        (f) => BLOCKING_IMPACTS.has(f.impact) && isBaselined(theme, route.path, f.ruleId, f.selector),
      );
      const nonBlocking = flatFindings.filter((f) => !BLOCKING_IMPACTS.has(f.impact));

      // Write the report to the test output dir (test-results/**) so the CI
      // `playwright-report` artifact carries a greppable per-route JSON. An
      // inline testInfo.attach body is embedded in index.html only — fine for
      // a failing run you open by hand, but the landmark/region findings are
      // advisory (they pass) and need to be reviewable without clicking
      // through the HTML report. See brik-bds #824 / brik-client-portal #961.
      fs.writeFileSync(
        testInfo.outputPath('axe-report.json'),
        JSON.stringify(
          { route: route.path, theme, url: page.url(), blocking, baselined, nonBlocking, total: flatFindings.length },
          null,
          2,
        ),
      );

      if (blocking.length > 0) {
        const summary = blocking
          .map((f) => `  [${f.impact}] ${f.ruleId} → ${f.selector}\n    ${f.help}`)
          .join('\n');
        expect(blocking, `New serious/critical violations on ${route.path} (${theme} theme):\n${summary}`).toHaveLength(0);
      }
    });
  }
});
