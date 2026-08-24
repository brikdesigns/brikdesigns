import { expect, type Page, type Response } from '@playwright/test';

/**
 * Render preconditions for the a11y suite — brikdesigns.com (#1030).
 *
 * Every spec in `tests/a11y/` measures something and asserts the result set is
 * clean. That shape has a failure mode #1021 named: an empty result set is
 * indistinguishable from a clean one. A page that did not render has no cards
 * to check, no grids to measure, and no axe violations — so the spec reports a
 * pass on exactly the build most likely to be broken.
 *
 * Two preconditions close it, and they catch DIFFERENT things. Both are needed;
 * neither is sufficient.
 *
 *   1. `gotoRendered()` — the page answered, and it answered with the app.
 *   2. `expectMeasured()` — the spec actually swept something.
 *
 * ── Why the status check is retried, not single-shot ──────────────────────
 *
 * `nav-service-tint.spec.ts` refused a status assertion outright (#341), and
 * the reasoning was sound: a deploy preview legitimately returns transient
 * 4xx/5xx under the suite's concurrent load — /plans came back 403 on a run
 * where every other route was fine. A CDN throttle is not a route defect, and a
 * gate that reddens on one is a gate people learn to re-run.
 *
 * The answer is not to drop the check but to retry it. A genuinely broken page
 * returns non-2xx on every attempt; a throttle clears. That is what #1022
 * landed for `grid-column-fit.spec.ts` and what this generalises, so #341's
 * objection is answered rather than overruled — there is no single-shot status
 * assertion anywhere in the suite.
 *
 * ── Why the status check is NOT enough on its own ─────────────────────────
 *
 * Measured 2026-08-24 while building this:
 *
 *   • A 500 that renders a bare shell is already caught by the `<main>` guard
 *     every spec carries — all seven fail against one. The status assertion
 *     alone would have added nothing there.
 *   • A 500 that renders `<main>` (a framework error boundary inside a layout)
 *     slips the `<main>` guard: `card-treatment.spec.ts` passed 16/16 against
 *     one. THIS is what the status assertion catches.
 *   • A missing CMS slug on this app renders an empty `<main>` with HTTP 200
 *     (#1036). Status cannot see it at all — only `expectMeasured()` can.
 *
 * So neither precondition subsumes the other, which is why callers use both.
 */

/** Attempts before a non-2xx is treated as a real defect rather than CDN flap. */
const ATTEMPTS = 4;

/** Linear backoff base — attempt N waits N × this, so 2s, 4s, 6s. */
const BACKOFF_MS = 2000;

export interface GotoRenderedOptions {
  /**
   * `waitUntil` for the underlying `page.goto`. Defaults to `'load'` — CSS and
   * images are in, which is what axe needs for contrast and alt-text rules.
   * `'networkidle'` is deliberately not the default: it is fragile on a site
   * with continuous background activity (lazy images, analytics).
   */
  waitUntil?: 'load' | 'domcontentloaded' | 'commit' | 'networkidle';

  /**
   * The selector that proves the document is the app's page rather than an
   * infra error shell. Defaults to `'main'` — every public route on this site
   * renders exactly one, from `(marketing)/layout.tsx`.
   *
   * `toHaveCount` auto-retries, so this also absorbs a hydration flush or a
   * cold start instead of failing on timing.
   */
  renders?: string;
}

/**
 * Navigate to `path` and assert the page both answered and rendered.
 *
 * Fails with the route and the status when the response is non-2xx on every
 * attempt; fails naming the missing selector when the document came back but is
 * not the app's page. The two messages are distinct so a failure says which
 * precondition broke without opening a trace.
 *
 * Returns the final `Response` for callers that want to assert on it further.
 */
export async function gotoRendered(
  page: Page,
  path: string,
  options: GotoRenderedOptions = {},
): Promise<Response> {
  const { waitUntil = 'load', renders = 'main' } = options;

  let response: Response | null = null;
  let status = 0;

  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    response = await page.goto(path, { waitUntil });
    expect(response, `${path} returned no response at all (navigation failed)`).toBeTruthy();
    status = response!.status();
    if (status < 400) break;
    if (attempt < ATTEMPTS) await page.waitForTimeout(BACKOFF_MS * attempt);
  }

  expect(
    status,
    `${path} returned HTTP ${status} on all ${ATTEMPTS} attempts — the page did not render, so anything this spec measures on it proves nothing. A one-off 4xx/5xx from CDN flap would have cleared within the retries (#341/#1022).`,
  ).toBeLessThan(400);

  await expect(
    page.locator(renders),
    `${path} answered HTTP ${status} but rendered no <${renders}> within timeout — the document is not the app's page (infra cold-start or error shell), not real debt. See #341.`,
  ).toHaveCount(1);

  return response!;
}

/**
 * Assert the spec actually swept something on a route that guarantees a set.
 *
 * The second half of the #1021 fix, and the only precondition that catches the
 * live 200-with-empty-`<main>` case (#1036). Use it wherever the route list is
 * curated such that an empty sweep means the page is wrong, not that the route
 * legitimately has nothing — and opt a route out explicitly rather than
 * loosening this to `>= 0`, so the opt-out is visible in the route table.
 *
 *   measured  how many elements the spec actually measured
 *   label     the route or surface name, for the failure message
 *   what      plural noun for what was swept, e.g. 'cards', 'multi-column grids'
 */
export function expectMeasured(measured: number, label: string, what: string): void {
  expect(
    measured,
    `${label}: swept 0 ${what} — this route is listed because it has at least one, so the page did not render as expected. If the route genuinely has none, opt it out in the route table rather than relaxing this assertion.`,
  ).toBeGreaterThan(0);
}
