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
 * 1. **Local dev** (no PLAYWRIGHT_BASE_URL set): boots `next dev` on port
 *    3000 so contributors can iterate without a Netlify deploy. Requires
 *    NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY in
 *    `.env.local` — same constraint regular local dev has.
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
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
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
  ],
  ...(USE_LOCAL_SERVER
    ? {
        webServer: {
          command: 'npm run dev',
          url: BASE_URL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }
    : {}),
});
