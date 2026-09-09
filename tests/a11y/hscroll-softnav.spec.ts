import { test, expect } from '@playwright/test';

/**
 * Soft-nav DOM-ownership regression — HorizontalScrollTrack GSAP pin.
 *
 * On the default desktop path (fine pointer, motion on, a real card overhang)
 * the pinned GSAP ScrollTrigger reparents home's React-owned
 * `<section class="section-service-lines">` into a GSAP-injected
 * `<div class="pin-spacer">`. On a soft-nav AWAY from home, React's
 * mutation-phase deletion calls `main.removeChild(section)`, but the section
 * now lives under `pin-spacer` — so the node is not a child of `main` and the
 * browser throws `NotFoundError: Failed to execute 'removeChild' on 'Node'`,
 * which the App Router surfaces as the generic "This page couldn't load"
 * boundary. Diagnosed in the bug chain (02-diagnose.md / 03-verify.md).
 *
 * The fix moves the component's GSAP teardown from the passive-effect phase
 * (`useEffect`, which runs AFTER `removeChild`) to the mutation phase
 * (`useLayoutEffect`, whose cleanup runs during React's deletion traversal,
 * BEFORE `removeChild(main, section)`), so GSAP has un-wrapped the pin-spacer
 * and restored the section under `main` by the time React removes it.
 *
 * ── Why this spec builds its own context ──────────────────────────────────
 *
 * Both a11y projects force `reducedMotion: 'reduce'` (playwright.config.ts) to
 * de-flake contrast scans. Under reduced motion `shouldScrub()` declines and
 * the pin NEVER engages — so this bug's precondition never forms and a plain
 * project-inherited run would pass vacuously (03-verify.md:20). This test
 * opens a fresh context with motion on and Desktop Chrome's fine pointer, the
 * exact path that reparents, and asserts the pin actually engaged before it
 * measures the soft-nav.
 */

test.describe('HorizontalScrollTrack soft-nav — no removeChild NotFoundError', () => {
  test('leaving home while the pin is engaged reparents no React node past removeChild', async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({
      reducedMotion: 'no-preference',
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();

    // Phase 2's discriminating probe (02-diagnose.md:7). Record every
    // removeChild whose target is not actually the caller's child — the exact
    // signature of a node reparented outside React's knowledge. Zero mismatches
    // is the real gate: "the route renders" passes vacuously (02-diagnose.md:36).
    await page.addInitScript(() => {
      const store: string[] = [];
      (window as unknown as Record<string, unknown>).__removeChildMismatches = store;
      const proto = Node.prototype as unknown as { removeChild: (child: Node) => Node };
      const orig = proto.removeChild;
      proto.removeChild = function (this: Node, child: Node): Node {
        if (child && child.parentNode !== this) {
          const cls = typeof (child as Element).className === 'string'
            ? (child as Element).className.trim()
            : '';
          const name = child.nodeName + (cls ? '.' + cls.split(/\s+/).join('.') : '');
          const actual = child.parentNode ? child.parentNode.nodeName : 'null';
          store.push(`${name} expected under ${this.nodeName}, actually under ${actual}`);
        }
        return orig.call(this, child);
      };
    });

    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));

    await page.goto((baseURL ?? '') + '/', { waitUntil: 'load' });

    // Precondition: the bug only forms once GSAP has pinned the section into a
    // .pin-spacer. If it never appears the pin didn't engage, so nothing below
    // proves anything — fail here loudly rather than green (03-verify.md:20).
    await expect(
      page.locator('.pin-spacer'),
      'GSAP pin never engaged — the section was not reparented, so this run cannot exercise the bug (check motion/pointer/overhang preconditions).',
    ).toHaveCount(1);
    await expect(
      page.locator('.pin-spacer section.section-service-lines'),
      'The pinned section is not inside the pin-spacer — the reparenting this bug hinges on did not happen.',
    ).toHaveCount(1);

    // Soft-navigate away via the in-site Next Link (client nav, no reload).
    // /how-we-work is the reporter's exact destination and one whose slot forces
    // React to delete the reparented section (01-reproduce.md).
    const link = page.locator('a[href="/how-we-work"]').first();
    await link.waitFor({ state: 'attached', timeout: 10_000 });
    await link.click({ force: true });
    await page.waitForTimeout(1500);

    const mismatches = await page.evaluate(
      () => (window as unknown as { __removeChildMismatches: string[] }).__removeChildMismatches,
    );
    const notFound = pageErrors.filter((m) => /removeChild|NotFoundError/i.test(m));
    const body = await page.locator('body').innerText().catch(() => '');
    const boundary = /couldn.t load|something went wrong/i.test(body);

    await context.close();

    expect(
      mismatches,
      `A React-owned node was reparented outside React at removeChild time:\n${mismatches.join('\n')}`,
    ).toEqual([]);
    expect(notFound, `NotFoundError thrown during soft-nav:\n${notFound.join('\n')}`).toEqual([]);
    expect(
      boundary,
      `App Router error boundary rendered after soft-nav to /how-we-work:\n${body.slice(0, 200)}`,
    ).toBe(false);
  });
});
