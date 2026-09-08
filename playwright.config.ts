import { readFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config — accessibility audit.
 *
 * Pattern adapted from birdwell-mutlak (the canonical Brik a11y CI shape
 * for Astro client sites). Brikdesigns is Next.js, so the local-server
 * branch boots `next dev` instead of `astro dev`. Everything else is the
 * same: WCAG 2.1 AA via axe-core, deploy-preview as the truth-source in CI,
 * reduced-motion to prevent first-paint contrast false-positives.
 *
 * Two modes:
 * 1. **Local dev** (no PLAYWRIGHT_BASE_URL set): reuses — or boots — the dev
 *    server on THIS worktree's port, resolved via `.dev-port` (see below).
 *
 * 2. **CI** (PLAYWRIGHT_BASE_URL set, typically the Netlify deploy-preview):
 *    no webServer — Playwright hits the live URL Netlify already built with
 *    all production secrets in place. Avoids exposing service-role keys to
 *    GitHub Actions for what should be a low-risk a11y gate.
 *
 * Single project — desktop Chromium. Add mobile/tablet variants once the
 * baseline is stable; serious/critical findings axe surfaces are largely
 * layout-agnostic.
 */

/**
 * The dev server's port, in precedence order (#1290).
 *
 * This used to be a hardcoded `localhost:3000`, which is wrong in every task
 * worktree: `dev-restart.sh` assigns a stable per-worktree port from
 * `basename | cksum | % 100`, starting at 3001, so that it never kills a
 * sibling worktree's server. The suite therefore aimed at a port holding either
 * nothing or ANOTHER BRANCH's server, and every route failed with "answered
 * HTTP 200 but rendered no <main> within timeout" — an error that names an
 * infra cold-start and reads like someone else's problem, not a misconfigured
 * port. 66 tests, 66 failures, no hint of the real cause.
 *
 * That mattered beyond the lost time: a fully-red run in a worktree invites
 * skipping the suite, and these are the measured card-treatment /
 * grid-column-fit / band-animation gates that exist precisely because manual
 * per-route audits kept producing false all-clears.
 *
 * `.dev-port` is written by `dev-restart.sh` before it boots. Reading the file
 * rather than reimplementing the cksum hash here keeps one source of truth —
 * a TypeScript port of that derivation could drift from the shell silently,
 * which is the same class of bug in a new place.
 *
 * Resolved from `process.cwd()`, NOT `import.meta.url`: Playwright loads this
 * config through its CJS transform, where `import.meta` is unavailable and the
 * file dies at load with "exports is not defined in ES module scope" before a
 * single test runs. `tsc --noEmit` accepts it — only the real `playwright test`
 * invocation catches it, which is why this was verified by running the suite
 * rather than by typechecking.
 */
function resolveDevPort(): string {
  try {
    const port = readFileSync(path.resolve(process.cwd(), '.dev-port'), 'utf8').trim();
    if (/^\d+$/.test(port)) return port;
  } catch {
    // No .dev-port — dev-restart.sh has not run in this worktree yet. Fall
    // through to 3000, which is correct for the primary checkout.
  }
  return '3000';
}

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${resolveDevPort()}`;
const USE_LOCAL_SERVER = !process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: './tests/a11y',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium-desktop',
      // Bypass scroll-reveal / animation classes during axe scan. The site uses
      // GSAP/Lenis-style opacity:0-then-reveal patterns that get false-flagged
      // for color-contrast at first paint. `prefers-reduced-motion: reduce`
      // kicks them to their visible state so axe scans real fg/bg pairs.
      // Bonus: exercises the user-facing OS reduced-motion preference.
      use: {
        ...devices['Desktop Chrome'],
        contextOptions: { reducedMotion: 'reduce' },
      },
    },
    {
      // Dark-theme pass. The site's themes are light/dark; the suite only ever
      // rendered light, so dark-only contrast regressions were invisible to CI
      // (e.g. the #366 dark-mode service-button failure shipped unseen). The
      // anti-FOUC script in layout.tsx falls back to prefers-color-scheme when
      // no theme is saved, so colorScheme:'dark' drives data-theme=dark before
      // hydration — no per-test toggling needed. The spec keys its baseline on
      // the project name (`*-dark` → routesDark), so pre-existing dark debt is
      // baselined separately from light. brikdesigns #359 follow-up.
      name: 'chromium-desktop-dark',
      use: {
        ...devices['Desktop Chrome'],
        colorScheme: 'dark',
        contextOptions: { reducedMotion: 'reduce' },
      },
    },
  ],
  ...(USE_LOCAL_SERVER
    ? {
        webServer: {
          // `dev-restart.sh`, not a bare `npm run dev` (#1290). CLAUDE.md
          // mandates this script for dev and forbids the bare command, for a
          // reason this config was quietly hitting: `npm run dev` starts
          // WITHOUT the `op run --env-file=.env.op` secret injection, so every
          // CMS route 500s on page-data collection. The suite's own error text
          // ("rendered no <main>") describes that failure without naming it.
          //
          // --foreground so Playwright owns the process lifetime and tears it
          // down; the default backgrounds via nohup and would outlive the run.
          // --port pins it to the same value BASE_URL resolved, so the two
          // cannot disagree even if `.dev-port` is stale.
          command: `./scripts/dev-restart.sh --foreground --port ${resolveDevPort()}`,
          url: BASE_URL,
          // Reuse the server dev-restart.sh already has running — the normal
          // local case, and what makes the common path zero-cost.
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }
    : {}),
});
