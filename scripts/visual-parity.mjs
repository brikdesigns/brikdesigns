#!/usr/bin/env node
import { chromium } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import {
  parseDeclaration,
  evaluateDeclaration,
  classifyBlockingSpread,
  buildDeclarationLine,
  blockingSignature,
  formatSignature,
  decideEffectiveBlocking,
  isStalePayloadRerun,
  isPartialCapture,
  classifyCaptureHeights,
  countUsableCaptures,
  summarizeNoiseByRoute,
} from './lib/visual-change-declaration.mjs';
import {
  FIGMA_FRAME_WIDTH,
  figmaSections,
  figmaBaselinePath,
  exportFigmaNodes,
  downloadTo,
} from './lib/figma-baseline.mjs';
import {
  EXIT_DID_NOT_FINISH,
  deadlineReport,
  isExpired,
  planUnits,
  resolveDeadlineMs,
} from './lib/sweep-deadline.mjs';

// Four modes share this script:
//   webflow (default) — migration parity: compare the build against the live
//     Webflow site, using each route's `webflow` path.
//   self              — regression: compare the build against staging on the
//     SAME path, so a dependency bump (e.g. a BDS minor) that shifts our own
//     rendering is caught. See .github/workflows/visual-regression.yml.
//   mockup            — wrongness gate (#825): compare routes that declare a
//     `mockup` entry against a checked-in baseline PNG at
//     tests/visual-parity/baselines/<name>-<viewport>-<theme>.png instead of a
//     live reference URL. Unlike webflow mode, a missing baseline or a failed
//     capture exits non-zero — a silently-skipped route is exactly the failure
//     this mode exists to close (#822 survived because no gate had a reference
//     for the landing surface). Baselines are authored with UPDATE_BASELINES=1
//     against a known-good deploy, then verified against the Paper mockup by a
//     human before being committed. See .github/workflows/visual-mockup.yml.
//   figma             — fidelity gate (#1392): compare each declared SECTION of
//     a rebuilt route against a PNG exported from that section's Figma node.
//     The other three all compare a rendering against another rendering, so
//     none of them can see a page that renders consistently and wrongly — which
//     is what every defect on the Figma rebuilds was (#1287 shipped 2 of 6
//     designed card slots; #1371's price overlapped its title). Per section, not
//     per page: a plan-detail page is ~6000px of mostly CMS copy, and copy drift
//     would drown a layout regression in the aggregate.
const REFERENCE_MODE = process.env.REFERENCE_MODE ?? 'webflow';
const SELF_MODE = REFERENCE_MODE === 'self';
const MOCKUP_MODE = REFERENCE_MODE === 'mockup';
const FIGMA_MODE = REFERENCE_MODE === 'figma';
const WEBFLOW_MODE = !SELF_MODE && !MOCKUP_MODE && !FIGMA_MODE;
const REFERENCE_LABEL = FIGMA_MODE ? 'Figma' : MOCKUP_MODE ? 'Baseline' : SELF_MODE ? 'Staging' : 'Webflow';
const BASELINE_DIR = path.resolve('tests/visual-parity/baselines');
const FIGMA_BASELINE_DIR = path.resolve('tests/visual-parity/figma');
const UPDATE_BASELINES = process.env.UPDATE_BASELINES === '1';
const UPDATE_FIGMA_BASELINES = process.env.UPDATE_FIGMA_BASELINES === '1';

const WEBFLOW_URL = process.env.WEBFLOW_URL ?? 'https://www.brikdesigns.com';

// Self mode has NO default reference, deliberately (#1354). It used to default
// to `https://staging--brikdesigns.netlify.app`, which is a moving alias —
// `staging` took 162 merges in the 14 days to 2026-09-10, so the reference
// redeployed under any PR open for more than a few minutes and the gate stopped
// being a function of the diff.
//
// The caller now resolves a per-commit permalink (scripts/lib/staging-reference.mjs)
// and passes it in. Keeping a default here would mean that if that step were
// ever removed or errored past, the gate would silently fall back to the moving
// alias and go on reporting — green tooling, restored defect, no signal. So an
// absent REFERENCE_URL in self mode is a hard stop instead.
if (SELF_MODE && !process.env.REFERENCE_URL) {
  console.error(
    '✗ REFERENCE_MODE=self requires an explicit REFERENCE_URL.\n' +
      '\n' +
      '  There is no default on purpose: the old one was the moving\n' +
      '  https://staging--brikdesigns.netlify.app alias that brikdesigns#1354 removed.\n' +
      '\n' +
      '  In CI, visual-regression.yml resolves the merge-base deploy permalink.\n' +
      '  Locally, pin one yourself:\n' +
      '\n' +
      '    export NETLIFY_AUTH_TOKEN=...   # 1P: netlify-mgmt\n' +
      '    export NETLIFY_SITE_ID=7664720a-83a6-45e8-b348-b49d07de8ef7\n' +
      '    BASE=$(git merge-base origin/staging HEAD)\n' +
      '    export REFERENCE_URL=$(node scripts/lib/staging-reference.mjs --sha "$BASE")\n',
  );
  process.exit(1);
}
const REFERENCE_URL = process.env.REFERENCE_URL ?? WEBFLOW_URL;
const NETLIFY_URL = process.env.NETLIFY_URL ?? process.argv[2];
// Figma mode writes to its own directory. The first thing this script does is
// `rmSync(OUT)`, so sharing one would mean the second mode to run in a job
// deletes the first one's report — and both run in the same job in
// visual-mockup.yml, where the uploaded artifact is the whole point.
const OUT = path.resolve(
  FIGMA_MODE ? 'tests/visual-parity/screenshots-figma' : 'tests/visual-parity/screenshots',
);

// Ceiling for the image wait on the FINAL capture attempt; attempt 1 gets half
// (see capture()). Sized for a COLD Netlify image transform on a fresh
// deploy-preview, not a warm one: on PR #838 a `w=3840` source on
// /services/marketing exceeded 60s on both attempts and failed the gate, and
// once the edge has the transform the same image resolves in ~30ms.
//
// The `w=3840` asset-weight cause is FIXED — #835 landed, and a scripted
// measurement of /services/marketing against staging on 2026-08-13 found all 16
// images requesting at most 1.6x their rendered width (the three cards it named
// now render 400x267 and request w=640) and settling in 0.3s at desktop, tablet
// and mobile. So this budget is no longer covering for oversized sources; it is
// covering for a cold edge, which is a property of the runner, not the page.
const IMAGE_WAIT_MS = parseInt(process.env.IMAGE_WAIT_MS ?? '120000', 10);

// Routes with diff % above this value are flagged. Set to 0 to disable hard failure.
// Mockup mode always gates: the baseline is a blessed capture of the same
// pipeline, so the pass-case noise floor is ~0% while the #822 dark-canvas
// defect measures 14.85% against it — 5% clears flake with wide margin.
//
// Figma mode starts with the threshold OFF (#1392 § Out of scope: "start
// permissive and ratchet"). Its two sides are not the same pipeline — one is
// Chromium rendering the app, the other is Figma rendering a frame — so the
// pass-case floor is a real number that has to be MEASURED per section before
// it can gate, and a gate whose floor nobody measured is a gate that gets
// turned off. What already blocks in this mode is a missing baseline or a
// failed capture; the percentages report until the floor is known.
const DIFF_THRESHOLD = parseFloat(
  process.env.DIFF_THRESHOLD ?? (MOCKUP_MODE ? '5' : '0'),
);

// Intended-visual-change declaration (#856). Self mode only — it exists so a
// deliberate redesign can pass this gate without turning the gate off, and
// neither webflow mode (never blocks) nor mockup mode (the baseline IS the
// declaration) has that problem. Both halves come from the workflow:
// VISUAL_CHANGE_LABEL is set only when the PR carries the `visual-change`
// label, VISUAL_CHANGE_BODY is the PR body. A body line without the label
// declares nothing, and says so rather than failing silently.
const VISUAL_CHANGE_LABEL = process.env.VISUAL_CHANGE_LABEL === '1';
const declaredInBody = parseDeclaration(process.env.VISUAL_CHANGE_BODY);
const DECLARED_ROUTES = SELF_MODE && VISUAL_CHANGE_LABEL ? declaredInBody : [];

// VISUAL_CHANGE_LABEL is the label as it stood in the pull_request payload, so a
// `gh run rerun` replays it frozen at the original event. The workflow resolves
// the label as it stands NOW (VISUAL_CHANGE_LABEL_LIVE) via the API, so this
// script can tell a genuinely undeclared PR apart from a stale-payload re-run of
// one that has since been labeled (#1106). Absent in local runs → not live.
const VISUAL_CHANGE_LABEL_LIVE = process.env.VISUAL_CHANGE_LABEL_LIVE === 'true';

if (!NETLIFY_URL) {
  console.error(
    'Usage: NETLIFY_URL=https://deploy-preview-N--brikdesigns.netlify.app npm run visual-parity\n' +
    '   or: npm run visual-parity -- https://deploy-preview-N--brikdesigns.netlify.app'
  );
  process.exit(2);
}

// Stale-payload re-run guard (#1106). Before capturing anything, bail out of a
// `gh run rerun` that replays a pre-label payload: VISUAL_CHANGE_LABEL reads 0
// while the live PR now carries the label, so every route the label was meant to
// waive would red again on a non-bug. Adding the label already triggered a fresh
// run with the correct payload — that one is authoritative; this replay is
// redundant. Exit 0 so the check stays green rather than training a re-run reflex.
if (SELF_MODE && isStalePayloadRerun({
  payloadLabel: VISUAL_CHANGE_LABEL,
  liveLabel: VISUAL_CHANGE_LABEL_LIVE,
})) {
  const note =
    'Visual-regression skipped: this run replays a payload from before the ' +
    '`visual-change` label was added. Adding the label already triggered a fresh ' +
    'run with the correct payload — trust that one, not this replay.';
  console.log(`\n⏭ ${note}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `⏭ **${note}**\n`);
  }
  process.exit(0);
}

const ROUTES = [
  { netlify: '/', webflow: '/', name: 'home' },
  { netlify: '/about', webflow: '/about', name: 'about' },
  { netlify: '/services', webflow: '/services', name: 'services' },
  { netlify: '/services/marketing', webflow: '/service-lines/marketing-design', name: 'services-category-marketing' },
  // The other four service lines (#863). Marketing was the only line with pixel
  // coverage, and it is the line that already worked: PR #861 retinted the
  // sticky nav on seven routes and this gate reported 0.00% on every capture,
  // because none of the seven was captured. `lint:nav-service-tint` (#860) and
  // `tests/a11y/nav-service-tint.spec.ts` guard the mapping and the rendered
  // class; neither looks at pixels, so a tint on the wrong element or at the
  // wrong z-index passes both.
  //
  // back-office is the highest-value row: its route segment is the one that has
  // ever diverged from its DB slug (`src/lib/service-line-routes.ts:21-22`,
  // still carrying the `service` → `back-office` cushion until migration 00199
  // reaches prod), which is the axis most likely to break silently.
  //
  // `webflow: null` on all four — this ticket is about the regression gate, and
  // claiming a Webflow counterpart would assert a page on a platform this
  // change has no reason to touch. Parity coverage for these lines is a
  // separate decision, not a side effect of closing #863.
  { netlify: '/services/brand', webflow: null, name: 'services-category-brand' },
  { netlify: '/services/information', webflow: null, name: 'services-category-information' },
  { netlify: '/services/product', webflow: null, name: 'services-category-product' },
  { netlify: '/services/back-office', webflow: null, name: 'services-category-back-office' },
  { netlify: '/services/marketing/website-experience-mapping', webflow: '/service/website-experience-mapping', name: 'services-detail-website-experience-mapping' },
  { netlify: '/plans', webflow: '/plans', name: 'plans' },
  { netlify: '/results', webflow: '/customer-stories', name: 'results' },
  { netlify: '/industries', webflow: '/customers', name: 'industries' },
  { netlify: '/industries/dental', webflow: '/customers/dental', name: 'industry-dental', self: false },
  { netlify: '/blog', webflow: '/blog', name: 'blog' },
  { netlify: '/contact', webflow: '/contact', name: 'contact' },
  { netlify: '/free-marketing-analysis', webflow: '/brikdown-analysis', name: 'fma', self: false },
  { netlify: '/value', webflow: '/value', name: 'value' },
  // CMS landing route — no Webflow ancestor (webflow: null skips it in webflow
  // mode). `mockup` declares which viewport/theme combos have a checked-in
  // baseline; mockup mode gates exactly those and refuses to run without them.
  {
    netlify: '/events/grind-after-graduation',
    webflow: null,
    name: 'events-grind-after-graduation',
    mockup: { viewports: ['desktop'], themes: ['light'] },
  },
  // ── Figma-baselined rebuilds (#1392) ──────────────────────────────────────
  // `figma.sections` maps a code selector to the Figma node that IS its design.
  // Node ids are transcribed from the section comments the rebuild itself left
  // in the page (`plans/[slug]/page.tsx:232,262,...`), so the two cannot drift
  // apart without someone editing both.
  //
  // Only `light` is declared: the Figma frames are authored light-only, so a
  // dark capture has no reference to diff against and declaring one would
  // manufacture a ~100% diff on every run.
  {
    netlify: '/plans/marketing-support',
    webflow: null,
    name: 'plan-detail-marketing-support',
    figma: {
      fileKey: 'yhLkzLUnG71UFTgURDvgnv', // Brik-Website
      themes: ['light'],
      sections: {
        hero: '26144:9053',        // section-hero
        foundation: '26144:9055',  // section-intro
        // The "What You Get" band is a BDS blueprint section: CardGrid
        // identifies it with `aria-labelledby`, not `data-section`, so the
        // default convention selector would match nothing. Verified against
        // the live markup 2026-09-11.
        'what-you-get': {
          node: '26144:9066',      // section-details
          selector: '[aria-labelledby="what-you-get-title"]',
        },
        'engagement-modes': '26144:9099', // section-type
        'full-stack': '26144:9109',       // section-full-stack
        cta: '26144:9140',                // section-cta
      },
    },
  },
  {
    netlify: '/offers/brikdown',
    webflow: null,
    name: 'brikdown',
    figma: {
      fileKey: 'YSzWcpSLMQxxllZr9lEW48', // Marketing Campaigns
      themes: ['light'],
      // A CMS landing route renders ONE `<section class="lp-blocks">` with its
      // regions as divs inside it (LandingBlocks.tsx), so each region needs an
      // explicit selector rather than the `[data-section="<key>"]` default —
      // the same split as `what-you-get` above, where the key names the Figma
      // frame's ROLE and the selector names where that role lives in the DOM.
      //
      // Those selectors are `data-section` now, not `.lp-*` (#1420). The
      // classnames were presentational: a CSS rename re-pointed the gate at
      // nothing, and the failure mode was a section that stopped being compared
      // rather than one that failed. `lint-section-id` scans the block tree as
      // of the same ticket, so these attributes cannot be dropped silently.
      sections: {
        // section-hero — the two-column region (content + form aside).
        hero: { node: '27111:869', selector: '[data-section="split"]' },
        // section-details — the full-width trailer below both columns.
        details: { node: '27111:1216', selector: '[data-section="split-trailer"]' },
      },
    },
  },
];

// `wide` exists because every site container caps at `--site-content-width:
// 1440px` (#1110), and at 1280 the cap is never the binding constraint — the
// container is viewport-bound, so no capture could see a change to it. PR #1110
// repointed 15 declarations across 8 files onto that cap and this gate reported
// 0.00% on every non-home route at all three viewports (run 33197218323); the
// change was real and was verified by hand at 1600 instead. 1600 is the
// narrowest round width past the cap, which keeps `desktop` at 1280 doing the
// at-cap job rather than swapping one blind spot for another (#1124).
const VIEWPORTS = [
  { name: 'wide',    width: 1600, height: 900 },
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'tablet',  width: 768,  height: 1024 },
  { name: 'mobile',  width: 375,  height: 812 },
];

// Figma mode renders at the width the frames are authored at, so the two sides
// are the same number of pixels wide before anything is compared. The
// alternative — capturing at 1280 and rescaling one side — makes every diff a
// measurement of the resampler as much as of the design, and needs an image
// dependency this repo does not carry.
const FIGMA_VIEWPORT = { name: 'figma', width: FIGMA_FRAME_WIDTH, height: 900 };

const THEMES = (process.env.THEMES ?? 'light,dark').split(',').map((t) => t.trim());

console.log(`▸ mode:       ${REFERENCE_MODE}`);
console.log(`▸ reference:  ${FIGMA_MODE ? path.relative('', FIGMA_BASELINE_DIR) : MOCKUP_MODE ? path.relative('', BASELINE_DIR) : REFERENCE_URL} (${REFERENCE_LABEL})`);
console.log(`▸ netlify:    ${NETLIFY_URL}`);
console.log(`▸ themes:     ${FIGMA_MODE ? 'per-route (Figma frames are authored light-only)' : THEMES.join(', ')}`);
console.log(`▸ threshold:  ${DIFF_THRESHOLD > 0 ? `${DIFF_THRESHOLD}%` : 'off (set DIFF_THRESHOLD to enable)'}`);
console.log(`▸ output:     ${OUT}`);

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

async function captureOnce(baseUrl, route, viewport, theme, outPath, timeoutMs, imageWaitMs, selector) {
  const colorScheme = theme === 'dark' ? 'dark' : 'light';
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    reducedMotion: 'reduce',
    colorScheme,
  });
  const page = await context.newPage();
  // Hide dev-tool chrome. NEXT_PUBLIC_ENABLE_DEV_TOOLS is "false" on the
  // deploy-preview context but enabled on staging (netlify.toml), so the
  // DevBar/feedback/inspect widgets render on the reference side only and
  // stamp a widget-shaped diff onto every route — largest on short pages,
  // where the fixed-size overlay is the biggest share of the capture. These
  // are the widget class prefixes the inspector itself ignores.
  const DEV_CHROME_CSS = ['bdb-', 'bfb-', 'bi-', 'bps-']
    .map((p) => `[class^="${p}"], [class*=" ${p}"]`)
    .join(', ') + ' { display: none !important; }';
  // An init script, not addStyleTag — the latter targets the current document
  // and is discarded by the navigation below.
  await page.addInitScript((css) => {
    document.addEventListener('DOMContentLoaded', () => {
      const el = document.createElement('style');
      el.textContent = css;
      document.head.appendChild(el);
    });
  }, DEV_CHROME_CSS);
  // Force every image to load eagerly. Lazy loading is scheduled by the
  // browser, not by us: after a full scroll pass an image below the fold can
  // still be sitting unfetched, and Chromium occasionally never gets round to
  // it at all — observed on /services/marketing at tablet/dark, where two
  // images (including a 256px footer logo that serves in 0.24s) were still
  // incomplete after 20s, while the same route on the same host was clean
  // minutes later. That scheduler is the nondeterminism #830 chased: a wait
  // cannot fix a fetch that never starts, only make its absence louder.
  // Flipping loading to eager starts the fetch immediately, so the image wait
  // in captureOnce becomes a question of network time rather than of when the
  // browser felt like asking. The MutationObserver covers images React mounts
  // after hydration.
  // Shared image descriptor for both failure messages. Name the offenders: a
  // bare count ("1 image(s) still loading") says nothing about WHICH asset
  // stalled, so every occurrence started from zero — #904 needed a separate
  // scripted repro just to learn the page was fine. The URL, the rendered box
  // and the requested width make the next failure diagnosable from the CI log
  // alone. One definition, so the still-loading and failed-to-decode messages
  // cannot drift apart (#1162).
  await page.addInitScript(() => {
    window.__describeImage = (img) => {
      const r = img.getBoundingClientRect();
      const url = img.currentSrc || img.src || '(no src)';
      let reqW = null;
      try {
        reqW = new URL(url, location.href).searchParams.get('w');
      } catch (parseErr) {
        reqW = `unparseable (${parseErr.message})`;
      }
      return {
        url,
        box: `${Math.round(r.width)}x${Math.round(r.height)}`,
        reqW,
        lazy: img.loading === 'lazy',
      };
    };
  });
  await page.addInitScript(() => {
    const eager = (img) => { if (img.loading === 'lazy') img.loading = 'eager'; };
    const sweep = (root) => {
      if (root.tagName === 'IMG') eager(root);
      root.querySelectorAll?.('img[loading="lazy"]').forEach(eager);
    };
    document.addEventListener('DOMContentLoaded', () => sweep(document));
    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType === 1) sweep(node);
        }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  });
  await page.addInitScript((t) => {
    // localStorage can throw when storage is partitioned or blocked. The theme
    // is also emulated via colorScheme on the context, so a failure here is
    // recoverable — warn into the page console rather than failing the capture.
    try { localStorage.setItem('theme', t); } catch (e) { console.warn('theme seed failed:', e.message); }
  }, theme);
  try {
    await page.goto(baseUrl + route, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    // Wait for paint, scroll through to trigger lazy images / scroll-reveals,
    // then back to top. `domcontentloaded` + a scroll pass is more robust than
    // `load`, which Netlify deploy previews can take >60s to fire.
    await page.evaluate(async () => {
      await new Promise((r) => requestAnimationFrame(r));
      // Re-read scrollHeight every step. It was sampled ONCE before the loop,
      // which stops the sweep at the pre-scroll height — so on a page that
      // grows as content reveals, everything past that point is never scrolled
      // into view and any `loading="lazy"` image down there stays
      // `complete === false` forever. That is an unbounded wait no cache
      // warmth can fix, and it moves between viewports because the document
      // height does. Bounded by MAX_SCROLL_STEPS so a page that grows on every
      // scroll (infinite feed) can't spin here.
      const MAX_SCROLL_STEPS = 200;
      let y = 0;
      for (let step = 0; step < MAX_SCROLL_STEPS; step += 1) {
        if (y >= document.body.scrollHeight) break;
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 100));
        y += 600;
      }
      window.scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 400));
    });
    // Full-page height must settle before the screenshot. Webfonts swapping in
    // and lazy images resolving reflow the document by a few px, which shifts
    // everything below the change and makes a pixel diff of two captures of the
    // SAME url read as 3-8% (measured). Wait for fonts, then for scrollHeight to
    // stop moving, so the diff reflects rendering rather than capture timing.
    await page.evaluate(() => document.fonts?.ready)
      .catch((e) => console.warn(`  · fonts.ready unavailable (${e.message.split('\n')[0]})`));
    try {
      await page.waitForLoadState('networkidle', { timeout: 15000 });
    } catch (e) {
      // Analytics/beacon polling can keep the network busy indefinitely; the
      // scrollHeight settle below is the real guard, so carry on.
    }
    // Images must finish loading AND decoding before the screenshot. The height
    // settle below cannot see them: illustration slots are fixed-size, so
    // scrollHeight is already final while the images are still in flight, and
    // the guard passes on empty slots. On a cold cache the capture paints the
    // slots empty and a warm one paints the images, which reads as ~2.5% on
    // image-dense pages — the #830 flake, reproduced at 2.55% on
    // /services/marketing at 375px. The slow ones are the on-demand Netlify
    // image transforms (`w=3840`); once the edge has them they resolve in
    // ~30ms, so the retry in capture() is a warm second pass.
    //
    // A timeout here FAILS the capture rather than screenshotting a
    // half-loaded page: a silently-skipped route reads as a pass, which is the
    // failure mode this gate exists to close. `complete` is true for an image
    // that failed to load, so a genuinely broken asset can't hang this.
    //
    // NOTE the `undefined` third-arg dance: waitForFunction is
    // (fn, arg, options) — passing options second makes Playwright treat them
    // as the page-function argument and silently apply its 30s defaults. The
    // height settle below had that bug, which is why its 15s never applied.
    //
    // Skipped in webflow mode: half of that comparison is the live Webflow
    // site, where images routinely never settle — 9 of the first 10 routes hit
    // the wait, at ~128s each, and the job blew its 20-minute budget after 10
    // of 78 comparisons. That mode is a non-blocking eyeball artifact whose
    // reference we do not control, so it keeps its pre-#830 behaviour.
    if (!WEBFLOW_MODE) {
      // imageWaitMs, not the module constant: capture() escalates the budget on
      // its retry, and before this the escalation never reached here — the 60s
      // -> 90s it passes was consumed by page.goto alone while this wait stayed
      // pinned at IMAGE_WAIT_MS on BOTH attempts. A cold transform therefore
      // got the same budget twice and the retry could only ever burn another
      // full timeout: the #904 job spent 2 x 120s per side on one route and was
      // cancelled at 25 minutes.
      try {
        await page.waitForFunction(
          () => Array.from(document.images).every((img) => img.complete),
          undefined,
          { timeout: imageWaitMs, polling: 250 },
        );
      } catch (e) {
        // Name the offenders via the shared __describeImage (see its definition
        // above for why a bare count is not enough).
        const stuck = await page.evaluate(() =>
          Array.from(document.images)
            .filter((img) => !img.complete)
            .map((img) => window.__describeImage(img)));
        const detail = stuck
          .map((s) => `\n    · ${s.box} req_w=${s.reqW}${s.lazy ? ' lazy' : ''} ${s.url}`)
          .join('');
        throw new Error(
          `${stuck.length} image(s) still loading after ${imageWaitMs / 1000}s — `
          + `capture would be non-deterministic${detail}`,
        );
      }
      // A rejected decode() is the SAME hazard as an incomplete load, so it gets
      // the same disposition: throw, and let capture() re-shoot on the escalated
      // budget (:334). Previously this only warned and fell through to the
      // screenshot below, so an image that was `complete` but undecodable was
      // captured blank or partial — a real pixel diff on a route nobody touched,
      // passing on a plain re-run. That is the flake signature #1106 documents
      // (one image, one route, one viewport, while the same route's other
      // viewports measure 0.00%), and the reason it never reproduces locally: a
      // decode failure is a runner-side resource condition, not a property of the
      // page. Measured 2026-08-31 — pages and both deployments are deterministic
      // (17 captures same-host and cross-deployment, all 0.0000%).
      const undecodable = await page.evaluate(async () => {
        const images = Array.from(document.images);
        const results = await Promise.allSettled(images.map((img) => img.decode?.()));
        return results
          .map((r, i) => (r.status === 'rejected' ? window.__describeImage(images[i]) : null))
          .filter(Boolean);
      });
      if (undecodable.length) {
        const detail = undecodable
          .map((s) => `\n    · ${s.box} req_w=${s.reqW}${s.lazy ? ' lazy' : ''} ${s.url}`)
          .join('');
        throw new Error(
          `${undecodable.length} image(s) failed to decode — `
          + `capture would be non-deterministic${detail}`,
        );
      }
    }
    await page.waitForFunction(
      () => {
        const h = document.body.scrollHeight;
        if (window.__lastH === h) return true;
        window.__lastH = h;
        return false;
      },
      undefined,
      { timeout: 15000, polling: 250 },
    ).catch((e) => console.warn(`  · height did not settle (${e.message.split('\n')[0]})`));
    // Read the height the browser itself reports, immediately before the shot
    // (#1358). Nothing here used to compare the screenshot against the DOM that
    // produced it, so a `fullPage` image shorter than the page was indetectable
    // at capture time and only surfaced later as a height mismatch between the
    // two SIDES of the comparison — which cannot tell a short capture of a tall
    // page from a faithful capture of a short page. `documentElement`, not
    // `body`: it is the scrolling element here, and it is what `fullPage` sizes
    // itself from.
    // An element capture measures ITSELF, not the document (#1392). Comparing a
    // section's PNG against `documentElement.scrollHeight` would call every
    // section on a 6000px page "partial", so the height contract is the
    // element's own box — and a section that resolves to zero height is a
    // genuine failure, because a collapsed element screenshots as nothing and a
    // capture of nothing diffs as a pass.
    if (selector) {
      const locator = page.locator(selector).first();
      await locator.waitFor({ state: 'visible', timeout: 15000 });
      const box = await locator.boundingBox();
      if (!box || box.height < 1) {
        throw new Error(`selector ${selector} resolved to a zero-height element — nothing to capture`);
      }
      await locator.screenshot({ path: outPath, animations: 'disabled' });
      const pngHeight = PNG.sync.read(fs.readFileSync(outPath)).height;
      return { ok: true, domHeight: Math.round(box.height), pngHeight };
    }
    const domHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.screenshot({ path: outPath, fullPage: true, animations: 'disabled' });
    const pngHeight = PNG.sync.read(fs.readFileSync(outPath)).height;
    // A genuinely partial capture is machine-detectable right here, so it is
    // thrown rather than reported — capture()'s existing retry re-shoots it
    // within the run. That retry could never fire on this class before, because
    // page.screenshot() resolving successfully made result.ok true no matter
    // what it wrote.
    if (isPartialCapture(pngHeight, domHeight)) {
      throw new Error(
        `capture is partial — wrote ${pngHeight}px for a ${domHeight}px document; `
        + 'the screenshot did not cover the page the browser rendered',
      );
    }
    return { ok: true, domHeight, pngHeight };
  } catch (err) {
    return { ok: false, err };
  } finally {
    await page.close();
    await context.close();
  }
}

async function capture(baseUrl, route, viewport, theme, outPath, selector) {
  // First attempt with normal headroom; one retry on failure with extra time.
  //
  // The retry exists because attempt 1 warms the edge for any on-demand image
  // transform, so attempt 2 is usually the fast path. Both budgets are passed
  // explicitly: the nav timeout AND the image wait escalate together. Passing
  // only the nav timeout (the pre-#904 shape) meant the image wait — the thing
  // that actually times out — was identical on both attempts, so a retry cost a
  // second full IMAGE_WAIT_MS without ever granting more headroom.
  //
  // Attempt 1 is deliberately shorter than IMAGE_WAIT_MS so a stuck route fails
  // fast into the warming retry rather than spending the whole budget up front.
  let result = await captureOnce(
    baseUrl, route, viewport, theme, outPath, 60000, Math.round(IMAGE_WAIT_MS / 2), selector);
  if (!result.ok) {
    await new Promise((r) => setTimeout(r, 1500));
    result = await captureOnce(
      baseUrl, route, viewport, theme, outPath, 90000, IMAGE_WAIT_MS, selector);
  }
  if (!result.ok) {
    const where = selector ? ` ${selector}` : '';
    console.warn(`  ✗ ${baseUrl}${route}${where} [${viewport.name}/${theme}]: ${result.err.message.split('\n')[0]}`);
    fs.writeFileSync(outPath.replace(/\.png$/, '.error.txt'), String(result.err));
  }
}

// Returns { diffPct, diffImg } where diffImg is the relative path to the diff PNG,
// or null if one/both screenshots are missing.
//
// Returns { truncated: true, ... } or { appError: true, ... } instead when the
// two heights differ so much that one side cannot be a rendering of the same
// page (#1314) — padding that into a diff percentage reports it as a pixel
// change on a route nobody touched.
//
// The two classes are distinguished by `viewport` (#1358): a short side that
// measures ~one raw viewport, having been captured faithfully, is the app's
// error boundary, not a capture that stopped early. Calling that "truncated"
// sent every reader to a re-run — which usually goes green and hides a real
// error on the reference deployment.
function diffScreenshots(wfPath, nlPath, diffPath, viewport, { classifyHeights = true } = {}) {
  if (!fs.existsSync(wfPath) || !fs.existsSync(nlPath)) return null;

  const wf = PNG.sync.read(fs.readFileSync(wfPath));
  const nl = PNG.sync.read(fs.readFileSync(nlPath));

  // Height classification is OFF in figma mode (#1392). It assumes both sides
  // are renderings of the same page, so a side under half the other's height
  // must be a broken capture. Against a Figma node that assumption is inverted:
  // a section built at half its designed height is the DEFECT this mode exists
  // to report, and classifying it as "truncated" would replace the finding with
  // a re-run instruction.
  const heightFailure = classifyHeights
    ? classifyCaptureHeights({
      referenceHeight: wf.height,
      buildHeight: nl.height,
      viewportHeight: viewport?.height,
    })
    : null;
  if (heightFailure) {
    return {
      [heightFailure.kind === 'app-error' ? 'appError' : 'truncated']: true,
      side: heightFailure.side,
      wfHeight: wf.height,
      nlHeight: nl.height,
    };
  }

  // Pad the shorter image at the bottom so dimensions match for pixelmatch.
  const w = Math.max(wf.width, nl.width);
  const h = Math.max(wf.height, nl.height);

  function pad(src) {
    if (src.width === w && src.height === h) return src;
    const out = new PNG({ width: w, height: h, filterType: -1 });
    // Fill with white
    out.data.fill(255);
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        const si = (y * src.width + x) * 4;
        const di = (y * w + x) * 4;
        out.data[di]     = src.data[si];
        out.data[di + 1] = src.data[si + 1];
        out.data[di + 2] = src.data[si + 2];
        out.data[di + 3] = src.data[si + 3];
      }
    }
    return out;
  }

  const a = pad(wf);
  const b = pad(nl);
  const diff = new PNG({ width: w, height: h });

  const mismatch = pixelmatch(a.data, b.data, diff.data, w, h, { threshold: 0.1 });
  fs.writeFileSync(diffPath, PNG.sync.write(diff));

  const diffPct = (mismatch / (w * h)) * 100;
  // Heights ride along on the success path too (#1392). They were only set on a
  // height FAILURE, which is the one case figma mode deliberately does not
  // classify — leaving the mode that needs them most as the only one without
  // them. Harmless elsewhere: every other mode already reports them as null.
  return { diffPct, diffImg: path.relative(OUT, diffPath), wfHeight: wf.height, nlHeight: nl.height };
}

const results = [];
const missingBaselines = [];

// ── figma mode ──────────────────────────────────────────────────────────────
// Its own loop, because its axes are different: route x SECTION, at one fixed
// width and one theme, rather than route x viewport x theme over whole pages.
// Folding it into the loop below would have meant a `viewport` that is not a
// viewport and a `theme` that is always 'light' threaded through every branch
// of the other three modes.
if (FIGMA_MODE) {
  const figmaRoutes = ROUTES.filter((r) => figmaSections(r).length);
  const viewport = FIGMA_VIEWPORT;
  const token = process.env.FIGMA_ACCESS_TOKEN ?? process.env.FIGMA_PAT;

  if (UPDATE_FIGMA_BASELINES && !token) {
    console.error(
      '✗ UPDATE_FIGMA_BASELINES=1 needs a Figma token.\n\n'
      + '    set -a; source ~/.secrets/figma.env; set +a\n'
      + '    UPDATE_FIGMA_BASELINES=1 npm run visual-figma -- <deploy-url>\n',
    );
    process.exit(2);
  }

  for (const route of figmaRoutes) {
    const theme = route.figma.themes?.[0] ?? 'light';
    const sections = figmaSections(route);
    const dir = path.join(OUT, theme, viewport.name);
    fs.mkdirSync(dir, { recursive: true });

    // Re-export every declared node in ONE request per route. `/v1/images`
    // renders on demand and a per-section call would re-render the same file
    // once per section.
    let exported = {};
    if (UPDATE_FIGMA_BASELINES) {
      console.log(`▸ exporting ${sections.length} node(s) from Figma file ${route.figma.fileKey}`);
      exported = await exportFigmaNodes(
        route.figma.fileKey,
        sections.map((s) => s.nodeId),
        { token },
      );
    }

    for (const section of sections) {
      const baselinePath = figmaBaselinePath(FIGMA_BASELINE_DIR, route.name, section.key);
      const label = `${route.name}-${section.key}`;
      const wfPath = path.join(dir, `${label}-reference.png`);
      const nlPath = path.join(dir, `${label}-netlify.png`);
      const diffPath = path.join(dir, `${label}-diff.png`);
      console.log(`▸ ${route.name} § ${section.key}  (${section.selector} ↔ ${section.nodeId})`);

      if (UPDATE_FIGMA_BASELINES) {
        const url = exported[section.nodeId];
        if (!url) {
          // `/v1/images` answers an unknown id with `err: null` and no entry,
          // so this is where a wrong node id becomes visible. Name the id.
          console.error(`  ✗ Figma returned no image for node ${section.nodeId} — check the id`);
          missingBaselines.push(baselinePath);
          continue;
        }
        const bytes = await downloadTo(url, baselinePath);
        console.log(`  ✎ baseline written: ${path.relative('', baselinePath)} (${Math.round(bytes / 1024)} KB)`);
      }

      await capture(NETLIFY_URL, route.netlify, viewport, theme, nlPath, section.selector);

      if (!fs.existsSync(baselinePath)) {
        missingBaselines.push(baselinePath);
        console.error(`  ✗ baseline missing: ${path.relative('', baselinePath)}`);
      } else {
        fs.copyFileSync(baselinePath, wfPath); // reference pane in the report
      }

      const diff = diffScreenshots(wfPath, nlPath, diffPath, viewport, { classifyHeights: false });
      if (diff) {
        const flag = diff.diffPct > 5 ? '🔴' : diff.diffPct > 2 ? '🟡' : '🟢';
        // Print the heights beside the percentage. The shorter side is padded
        // white to compare, so a section built at half its designed height
        // spends half the canvas on padding and reads ~50% before a single
        // rendered pixel disagrees. Without the pair, that number is
        // indistinguishable from a section whose content is genuinely wrong —
        // and they need opposite fixes.
        const heights = diff.wfHeight && diff.nlHeight
          ? `  (figma ${diff.wfHeight}px vs build ${diff.nlHeight}px)`
          : '';
        console.log(`  ${flag} diff: ${diff.diffPct.toFixed(2)}%${heights}`);
      }
      results.push({
        theme,
        viewport: viewport.name,
        route: label,
        webflowPath: path.relative('', baselinePath),
        netlifyPath: `${route.netlify}  ${section.selector}`,
        wfImg: path.relative(OUT, wfPath),
        nlImg: path.relative(OUT, nlPath),
        diffImg: diff?.diffImg ?? null,
        diffPct: diff?.diffPct ?? null,
        truncated: false,
        appError: false,
        shortSide: null,
        viewportHeight: viewport.height,
        wfHeight: diff?.wfHeight ?? null,
        nlHeight: diff?.nlHeight ?? null,
        wfOk: fs.existsSync(wfPath),
        nlOk: fs.existsSync(nlPath),
      });
    }
  }
}

// ── Sweep deadline (#887 AC 2) ──────────────────────────────────────────────
//
// `timeout-minutes: 25` on the regression job CANCELS the job when it fires,
// and a cancelled job produces no verdict at all — no failing check, no log
// naming what was left unmeasured. On #1417 (2026-09-11) that also refused the
// merge with `Required status check "regression" is expected` while a
// successful run sat on the same head SHA.
//
// So the sweep watches its own clock and stops itself first, red and explicit,
// while there is still runway to print what it did not reach. Opt-in: unset
// locally, set by the workflow to a value below the job cap.
const SWEEP_DEADLINE_MS = resolveDeadlineMs(process.env.SWEEP_DEADLINE_MS);
const SWEEP_STARTED_AT = Date.now();
// `self: false` marks a row that earns its place in webflow mode and costs
// captures in regression mode for nothing (#863). Both current rows are 308
// SOURCES on our own site — `/industries/dental` → `/customers/dental`,
// `/free-marketing-analysis` → `/offers/free-marketing-analysis`
// (`next.config.mjs:121`, both verified live 2026-09-11). They are Webflow's
// URLs, which is exactly right for parity and meaningless for regression: this
// mode compares our rendering against our own merge-base deploy and has no
// Webflow constraint, so the two rows re-render content the destination routes
// already cover.
//
// Filtered once, here, so the deadline report's plan and the loop below cannot
// disagree — a plan that names units the sweep never intended to capture is the
// #887 failure one layer over. Non-self modes see the list unchanged.
const SWEPT_ROUTES = ROUTES.filter((r) => !(SELF_MODE && r.self === false));

const SWEEP_PLAN = FIGMA_MODE
  ? []
  : planUnits(THEMES, VIEWPORTS.map((v) => v.name), SWEPT_ROUTES.map((r) => r.name));
let sweepMeasured = 0;

for (const theme of FIGMA_MODE ? [] : THEMES) {
  for (const viewport of VIEWPORTS) {
    const dir = path.join(OUT, theme, viewport.name);
    fs.mkdirSync(dir, { recursive: true });
    for (const route of SWEPT_ROUTES) {
      // Checked BEFORE the capture, because the capture is what overruns: a
      // route can spend two full IMAGE_WAIT_MS budgets, so deciding after one
      // has already started concedes the headroom this guard exists to keep.
      if (isExpired({ deadlineMs: SWEEP_DEADLINE_MS, startedAt: SWEEP_STARTED_AT, now: Date.now() })) {
        console.error(
          deadlineReport({
            deadlineMs: SWEEP_DEADLINE_MS,
            elapsedMs: Date.now() - SWEEP_STARTED_AT,
            measured: sweepMeasured,
            plan: SWEEP_PLAN,
          }),
        );
        await browser.close();
        process.exit(EXIT_DID_NOT_FINISH);
      }
      sweepMeasured += 1;
      if (MOCKUP_MODE) {
        if (!route.mockup) continue;
        if (!route.mockup.viewports.includes(viewport.name)) continue;
        if (!route.mockup.themes.includes(theme)) continue;
      } else if (!SELF_MODE && route.webflow == null) {
        continue; // no legacy Webflow URL to compare against
      }
      // In self mode both sides render the same path — the reference is
      // staging, not Webflow, so there is no legacy URL to map to. In mockup
      // mode the reference is a checked-in file, not a URL at all.
      const baselinePath = path.join(BASELINE_DIR, `${route.name}-${viewport.name}-${theme}.png`);
      const refRoute = MOCKUP_MODE
        ? path.relative('', baselinePath)
        : SELF_MODE ? route.netlify : route.webflow;
      const wfPath  = path.join(dir, `${route.name}-reference.png`);
      const nlPath  = path.join(dir, `${route.name}-netlify.png`);
      const diffPath = path.join(dir, `${route.name}-diff.png`);
      console.log(`▸ ${theme}/${viewport.name}: ${route.name}`);
      if (MOCKUP_MODE) {
        await capture(NETLIFY_URL, route.netlify, viewport, theme, nlPath);
        if (UPDATE_BASELINES) {
          if (fs.existsSync(nlPath)) {
            fs.mkdirSync(BASELINE_DIR, { recursive: true });
            fs.copyFileSync(nlPath, baselinePath);
            console.log(`  ✎ baseline written: ${refRoute}`);
          }
        } else if (!fs.existsSync(baselinePath)) {
          missingBaselines.push(baselinePath);
          console.error(`  ✗ baseline missing: ${baselinePath}`);
        } else {
          fs.copyFileSync(baselinePath, wfPath); // reference pane in the report
        }
      } else {
        await capture(REFERENCE_URL, refRoute, viewport, theme, wfPath);
        await capture(NETLIFY_URL, route.netlify, viewport, theme, nlPath);
      }
      const diff = diffScreenshots(wfPath, nlPath, diffPath, viewport);
      if (diff?.appError) {
        // NOT a re-run instruction (#1358). The short side is a faithful
        // capture of a page that rendered one viewport tall — the app's error
        // boundary. Re-running usually goes green and hides a real error on
        // whichever deployment produced it, so name the side and stop.
        const sideLabel = diff.side === 'reference'
          ? `the ${REFERENCE_LABEL.toLowerCase()} deployment`
          : 'this build';
        console.error(
          `  ✗ page rendered one viewport tall on ${sideLabel} — ` +
            `${REFERENCE_LABEL.toLowerCase()} ${diff.wfHeight}px vs capture ${diff.nlHeight}px ` +
            `(viewport ${viewport.height}px). The capture is complete; the PAGE is short, ` +
            'which is the app error boundary. Do not re-run — open the capture in the report.',
        );
      } else if (diff?.truncated) {
        // Name both heights here: the run summary is where the next occurrence
        // gets diagnosed, and without them a truncation is indistinguishable
        // from a real diff without downloading the report artifact.
        console.error(
          `  ✗ capture truncated — ${REFERENCE_LABEL.toLowerCase()} ${diff.wfHeight}px vs ` +
            `capture ${diff.nlHeight}px; the shorter one did not finish capturing, ` +
            'so no diff is reported',
        );
      } else if (diff) {
        const flag = diff.diffPct > 5 ? '🔴' : diff.diffPct > 2 ? '🟡' : '🟢';
        console.log(`  ${flag} diff: ${diff.diffPct.toFixed(2)}%`);
      }
      results.push({
        theme,
        viewport: viewport.name,
        route: route.name,
        webflowPath: refRoute,
        netlifyPath: route.netlify,
        wfImg: path.relative(OUT, wfPath),
        nlImg: path.relative(OUT, nlPath),
        diffImg: diff?.diffImg ?? null,
        diffPct: diff?.diffPct ?? null,
        truncated: diff?.truncated === true,
        appError: diff?.appError === true,
        shortSide: diff?.side ?? null,
        viewportHeight: viewport.height,
        wfHeight: diff?.wfHeight ?? null,
        nlHeight: diff?.nlHeight ?? null,
        wfOk: fs.existsSync(wfPath),
        nlOk: fs.existsSync(nlPath),
      });
    }
  }
}

await browser.close();

// Console diff summary, sorted worst-first
const diffed = results.filter((r) => r.diffPct !== null);
if (diffed.length) {
  console.log('\n── Diff summary (worst first) ──────────────────');
  [...diffed]
    .sort((a, b) => b.diffPct - a.diffPct)
    .forEach((r) => {
      const flag = r.diffPct > 5 ? '🔴' : r.diffPct > 2 ? '🟡' : '🟢';
      console.log(`  ${flag} ${r.diffPct.toFixed(2).padStart(6)}%  ${r.route} [${r.theme}/${r.viewport}]`);
    });
  console.log('────────────────────────────────────────────────');
}

// HTML report
function diffColor(pct) {
  if (pct === null) return '#888';
  if (pct > 5)  return '#b00';
  if (pct > 2)  return '#b6800a';
  return '#1a7f37';
}

function diffLabel(pct) {
  if (pct === null) return '—';
  const flag = pct > 5 ? '🔴' : pct > 2 ? '🟡' : '🟢';
  return `${flag} ${pct.toFixed(2)}%`;
}

// Name the mode in the report. `figma` reports SECTIONS against a design, not a
// page against a deployment, and a reader who takes it for "visual parity" will
// read a 12% section diff as a migration gap rather than a fidelity one.
const REPORT_TITLE = FIGMA_MODE
  ? 'Figma fidelity (per section)'
  : SELF_MODE ? 'Visual regression' : 'Visual parity';
const REPORT_REFERENCE = FIGMA_MODE
  ? path.relative('', FIGMA_BASELINE_DIR)
  : MOCKUP_MODE ? path.relative('', BASELINE_DIR) : REFERENCE_URL;

const reportPath = path.join(OUT, 'index.html');
const html = `<!doctype html>
<meta charset="utf-8">
<title>${REPORT_TITLE} — ${REFERENCE_LABEL} vs Netlify</title>
<style>
  body { margin: 0; font: 14px/1.5 -apple-system, system-ui, sans-serif; background: #f6f6f6; color: #111; }
  header { padding: 16px 20px; background: #111; color: #fff; position: sticky; top: 0; z-index: 10; }
  header h1 { margin: 0 0 6px; font-size: 18px; }
  header .meta { font-size: 12px; opacity: .7; }
  nav { padding: 12px 20px; background: #fff; border-bottom: 1px solid #ddd; position: sticky; top: 60px; z-index: 9; }
  nav a { margin-right: 12px; color: #0366d6; text-decoration: none; font-size: 13px; }
  nav a:hover { text-decoration: underline; }
  section { padding: 24px 20px; border-bottom: 1px solid #ddd; }
  section h2 { margin: 0 0 4px; font-size: 16px; display: flex; align-items: center; gap: 12px; }
  section .paths { margin: 0 0 14px; font-size: 12px; color: #666; }
  .trio { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
  .pane { background: #fff; border: 1px solid #ddd; border-radius: 4px; overflow: hidden; }
  .pane h3 { margin: 0; padding: 8px 12px; font-size: 12px; background: #fafafa; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
  .pane img { display: block; width: 100%; height: auto; }
  .pane.error { padding: 24px; color: #b00; text-align: center; }
  .diff-badge { font-weight: 700; }
  .filter-bar { padding: 12px 20px; background: #fff; border-bottom: 1px solid #ddd; }
  .filter-bar label { margin-right: 16px; font-size: 13px; }
  .summary-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .summary-table th { text-align: left; padding: 6px 10px; background: #f0f0f0; border-bottom: 2px solid #ddd; }
  .summary-table td { padding: 5px 10px; border-bottom: 1px solid #eee; }
  .summary-table tr:hover td { background: #fafafa; }
</style>
<header>
  <h1>${REPORT_TITLE} — ${REFERENCE_LABEL} vs Netlify</h1>
  <div class="meta">${REFERENCE_LABEL.toLowerCase()}: ${REPORT_REFERENCE} · netlify: ${NETLIFY_URL} · captured ${new Date().toISOString()}</div>
</header>
<div class="filter-bar">
  <label>Theme: <select id="theme-filter"><option value="all">all</option>${THEMES.map((t) => `<option value="${t}">${t}</option>`).join('')}</select></label>
  <label>Viewport: <select id="viewport-filter"><option value="all">all</option>${VIEWPORTS.map((v) => `<option value="${v.name}">${v.name}</option>`).join('')}</select></label>
  <label>Show: <select id="diff-filter"><option value="all">all</option><option value="red">🔴 &gt;5%</option><option value="yellow">🟡 2–5%</option><option value="green">🟢 &lt;2%</option></select></label>
</div>
<nav>${results
  .filter((r, i, a) => a.findIndex((x) => x.route === r.route) === i)
  .map((r) => `<a href="#${r.route}">${r.route}</a>`)
  .join(' ')}</nav>

<section style="background:#fff;border-bottom:2px solid #ddd;">
  <h2>Diff summary</h2>
  <table class="summary-table">
    <thead><tr><th>Route</th><th>Theme</th><th>Viewport</th><th>Diff %</th></tr></thead>
    <tbody>
      ${[...results]
        .filter((r) => r.diffPct !== null)
        .sort((a, b) => b.diffPct - a.diffPct)
        .map((r) => `<tr>
          <td><a href="#${r.route}-${r.theme}-${r.viewport}">${r.route}</a></td>
          <td>${r.theme}</td>
          <td>${r.viewport}</td>
          <td style="color:${diffColor(r.diffPct)};font-weight:700">${diffLabel(r.diffPct)}</td>
        </tr>`).join('')}
    </tbody>
  </table>
</section>

${results
  .map(
    (r) => `
<section data-theme="${r.theme}" data-viewport="${r.viewport}" data-diff="${r.diffPct !== null ? (r.diffPct > 5 ? 'red' : r.diffPct > 2 ? 'yellow' : 'green') : 'none'}" id="${r.route}-${r.theme}-${r.viewport}">
  <h2>${r.route} — ${r.theme} / ${r.viewport} <span class="diff-badge" style="color:${diffColor(r.diffPct)}">${diffLabel(r.diffPct)}</span></h2>
  <p class="paths">${REFERENCE_LABEL.toLowerCase()}: <code>${r.webflowPath}</code> · netlify: <code>${r.netlifyPath}</code></p>
  <div class="trio">
    <div class="pane${r.wfOk ? '' : ' error'}">
      <h3>${REFERENCE_LABEL} (reference)</h3>
      ${r.wfOk ? `<img loading="lazy" src="${r.wfImg}">` : 'Capture failed'}
    </div>
    <div class="pane${r.nlOk ? '' : ' error'}">
      <h3>Netlify (build)</h3>
      ${r.nlOk ? `<img loading="lazy" src="${r.nlImg}">` : 'Capture failed'}
    </div>
    <div class="pane${r.diffImg ? '' : ' error'}">
      <h3>Diff <span class="diff-badge" style="color:${diffColor(r.diffPct)}">${diffLabel(r.diffPct)}</span></h3>
      ${r.diffImg ? `<img loading="lazy" src="${r.diffImg}">` : 'Diff unavailable'}
    </div>
  </div>
</section>`
  )
  .join('')}
<script>
  const themeF = document.getElementById('theme-filter');
  const vpF = document.getElementById('viewport-filter');
  const diffF = document.getElementById('diff-filter');
  function apply() {
    const t = themeF.value, v = vpF.value, d = diffF.value;
    document.querySelectorAll('section[data-theme]').forEach((s) => {
      const ok = (t === 'all' || s.dataset.theme === t)
               && (v === 'all' || s.dataset.viewport === v)
               && (d === 'all' || s.dataset.diff === d);
      s.style.display = ok ? '' : 'none';
    });
  }
  themeF.onchange = vpF.onchange = diffF.onchange = apply;
</script>
`;
fs.writeFileSync(reportPath, html);

// "Complete" means a usable comparison, not a written file (#1317) — a
// truncated capture writes its file and then fails the run, so counting files
// printed `84/84` two lines under `✗ 1 capture(s) failed`.
const okCount = countUsableCaptures(results, {
  updateBaselines: UPDATE_BASELINES || UPDATE_FIGMA_BASELINES,
});
const avgDiff = diffed.length
  ? (diffed.reduce((s, r) => s + r.diffPct, 0) / diffed.length).toFixed(2)
  : '—';
const worstDiff = diffed.length
  ? Math.max(...diffed.map((r) => r.diffPct)).toFixed(2)
  : '—';

console.log(`\n✓ ${okCount}/${results.length} captures complete`);
console.log(`▸ avg diff: ${avgDiff}%  |  worst: ${worstDiff}%`);
console.log(`▸ open ${reportPath}`);

// Per-route noise floor (#1106). On-demand only (NOISE_FLOOR=1): the caller
// captures one deployment against itself, so every measured diff is pure
// capture noise. Publishing the per-route worst validates whether the gate's
// global DIFF_THRESHOLD (1%) is genuinely clear of flake, per route rather than
// on the aggregate the workflow header asserts. Never gates — a measurement,
// not a check.
if (process.env.NOISE_FLOOR === '1') {
  const rows = summarizeNoiseByRoute(diffed);
  const globalWorst = diffed.length ? Math.max(...diffed.map((r) => r.diffPct)) : 0;
  // Compare against the GATE's threshold (visual-regression.yml:124 → 1%), not
  // this run's (measurement runs leave DIFF_THRESHOLD off). That 1% is the bar
  // the noise floor has to clear to be free of flake.
  const threshold = 1;
  console.log('\n── Per-route noise floor (worst first) ─────────');
  rows.forEach((r) =>
    console.log(`  ${r.worst.toFixed(2).padStart(6)}%  ${r.route}  (avg ${r.avg.toFixed(2)}%, n=${r.count})`),
  );
  console.log('────────────────────────────────────────────────');
  if (process.env.GITHUB_STEP_SUMMARY) {
    const lines = [
      `## Per-route noise floor — ${REFERENCE_LABEL} vs itself`,
      '',
      `Same deployment captured twice, so every row is pure capture noise. ` +
        `Global worst **${globalWorst.toFixed(2)}%** across ${diffed.length} capture(s); ` +
        `the gate's \`DIFF_THRESHOLD\` is **${threshold}%**.`,
      '',
      globalWorst >= threshold
        ? `⚠ At least one route's noise reaches the ${threshold}% gate threshold — the floor is NOT clear of flake.`
        : `✓ Every route's noise sits under the ${threshold}% gate threshold.`,
      '',
      '| Route | Worst | Avg | Captures |',
      '| --- | --- | --- | --- |',
      ...rows.map((r) => `| \`${r.route}\` | ${r.worst.toFixed(2)}% | ${r.avg.toFixed(2)}% | ${r.count} |`),
    ];
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);
  }
}

// Why a height failure reads as "failed" and not "diffed" (#1314): the capture
// file exists, so `nlOk`/`wfOk` are both true and the pre-#1314 gates saw
// nothing wrong. Only the height pair shows it, so the gates below test both
// height classes alongside the existence checks.
//
// The two classes print differently on purpose (#1358). "truncated" is a
// capture bug and a re-run is the right reflex; an error-boundary render is the
// PAGE, and the same wording would train the same re-run — which goes green and
// buries the error. The summary line is where the next occurrence gets
// diagnosed, so it has to say which one it saw.
const captureFailureDetail = (r) => {
  if (r.appError) {
    return ` — page rendered one viewport tall (${r.viewportHeight}px) on the ${r.shortSide} side: `
      + `${r.wfHeight}px vs ${r.nlHeight}px; the capture is complete, the page is short`;
  }
  return r.truncated ? ` — truncated: ${r.wfHeight}px vs ${r.nlHeight}px` : '';
};

// Mockup mode never passes silently: a missing baseline or a failed capture is
// a hard failure, not a skipped comparison. (webflow mode tolerates capture
// failure by design — that tolerance must not carry over; it is how #822 hid.)
if (MOCKUP_MODE || FIGMA_MODE) {
  const modeLabel = FIGMA_MODE ? 'figma' : 'mockup';
  if (missingBaselines.length) {
    console.error(`\n✗ ${missingBaselines.length} baseline(s) missing — ${modeLabel} mode refuses to skip:`);
    missingBaselines.forEach((p) => console.error(`  ${p}`));
    if (FIGMA_MODE) {
      console.error('  Re-export from the Figma nodes the route declares, then eyeball each PNG before committing:');
      console.error('  set -a; source ~/.secrets/figma.env; set +a');
      console.error('  UPDATE_FIGMA_BASELINES=1 npm run visual-figma -- <deploy-url>');
    } else {
      console.error('  Author against a known-good deploy, then eyeball vs the Paper mockup before committing:');
      console.error('  UPDATE_BASELINES=1 npm run visual-mockup -- <known-good-url>');
    }
    process.exit(2);
  }
  const failedCaptures = results.filter((r) => !r.nlOk || r.truncated || r.appError);
  if (failedCaptures.length) {
    console.error(`\n✗ ${failedCaptures.length} capture(s) failed — ${modeLabel} mode treats this as a gate failure:`);
    failedCaptures.forEach((r) => console.error(`  ${r.route} [${r.theme}/${r.viewport}]${captureFailureDetail(r)} (${NETLIFY_URL}${r.netlifyPath})`));
    process.exit(1);
  }
}

// Self mode blocks, so a capture that never produced both sides must fail the
// run rather than drop out of `diffed` unnoticed. Since #830 the image guard
// fails a capture instead of screenshotting a half-loaded page, and without
// this a route that loses that race twice would read as a pass.
if (SELF_MODE) {
  const failedCaptures = results.filter((r) => !r.wfOk || !r.nlOk || r.truncated || r.appError);
  if (failedCaptures.length) {
    console.error(`\n✗ ${failedCaptures.length} capture(s) failed — a skipped route is not a pass:`);
    failedCaptures.forEach((r) => console.error(`  ${r.route} [${r.theme}/${r.viewport}]${captureFailureDetail(r)}`));
    process.exit(1);
  }
}

// Hard failure gate — only active when DIFF_THRESHOLD is set.
//
// A `visual-change` declaration (#856) moves routes it names out of `blocking`
// and into `waived`; everything undeclared still gates at the threshold. The
// declaration is not a free pass in either direction: a name that matches no
// route, or a declared route that did not move, fails the run.
if (DIFF_THRESHOLD > 0 && !UPDATE_BASELINES && !UPDATE_FIGMA_BASELINES) {
  const { waived, blocking, unmoved, unknown, underThreshold } = evaluateDeclaration({
    declared: DECLARED_ROUTES,
    knownRoutes: ROUTES.map((r) => r.name),
    results,
    threshold: DIFF_THRESHOLD,
  });

  const summary = [];

  // The set that actually gates. It equals `blocking` on a first attempt, and is
  // narrowed to the captures that reproduced across attempts when a cross-attempt
  // comparison confirms the rest were capture-side (#1350). The final exit reads
  // this, not `blocking`.
  let effectiveBlocking = blocking;

  if (SELF_MODE && !VISUAL_CHANGE_LABEL && declaredInBody.length) {
    const note =
      `⚠ ${declaredInBody.length} route(s) declared in the body, but the PR has no ` +
      '`visual-change` label — the declaration was ignored. Both halves are required.';
    console.error(`\n${note}`);
    summary.push(note);
  }

  if (waived.length) {
    console.log(`\n▸ ${waived.length} capture(s) waived by the visual-change declaration:`);
    waived.forEach((r) =>
      console.log(`  ${r.diffPct.toFixed(2).padStart(6)}%  ${r.route} [${r.theme}/${r.viewport}]`),
    );
    summary.push(
      `**Waived by \`visual-change\` declaration** — ${waived.length} capture(s) across ` +
        `${new Set(waived.map((r) => r.route)).size} declared route(s):`,
      '',
      '| Route | Theme/Viewport | Diff |',
      '| --- | --- | --- |',
      ...waived.map((r) => `| \`${r.route}\` | ${r.theme}/${r.viewport} | ${r.diffPct.toFixed(2)}% |`),
    );
  }

  if (underThreshold.length) {
    console.log(
      `\n▸ ${underThreshold.length} declared route(s) moved but stayed under ${DIFF_THRESHOLD}% — ` +
        'nothing needed waiving:',
    );
    underThreshold.forEach((name) => console.log(`  ${name}`));
    summary.push(
      `**Declared and under threshold** — ${underThreshold.map((n) => `\`${n}\``).join(', ')} ` +
        `moved, but no capture exceeded ${DIFF_THRESHOLD}%.`,
    );
  }

  if (unknown.length) {
    console.error(`\n✗ ${unknown.length} declared route(s) match no entry in ROUTES:`);
    unknown.forEach((name) => console.error(`  ${name}`));
    console.error(`  Valid names: ${ROUTES.map((r) => r.name).join(', ')}`);
    summary.push(`❌ **Unknown declared route(s):** ${unknown.map((n) => `\`${n}\``).join(', ')}`);
  }

  if (unmoved.length) {
    console.error(`\n✗ ${unmoved.length} declared route(s) did not move at all:`);
    unmoved.forEach((name) => console.error(`  ${name}`));
    console.error('  A stale declaration is a defect — drop it from the PR body.');
    summary.push(
      `❌ **Stale declaration** — ${unmoved.map((n) => `\`${n}\``).join(', ')} ` +
        'declared but measured 0.00% on every capture.',
    );
  }

  if (blocking.length) {
    console.error(`\n✗ ${blocking.length} route(s) exceed DIFF_THRESHOLD of ${DIFF_THRESHOLD}%:`);
    blocking.forEach((r) =>
      console.error(`  ${r.diffPct.toFixed(2)}%  ${r.route} [${r.theme}/${r.viewport}]`),
    );

    // ── Cross-attempt signature: settle flake vs. real with evidence (#1350) ──
    //
    // classifyBlockingSpread below can only GUESS from one run's shape, and on a
    // capture flake its guess and its advice ("re-run; a flake does not
    // reproduce") form a loop with no exit — the flake DOES reproduce, just with
    // a different set each time (the #1330 repro). The fix is a second data
    // point: emit this attempt's blocking set as a marker the next attempt reads
    // back, and on attempt ≥ 2 rule on whether the set reproduced rather than
    // repeating the re-run reflex.
    const RUN_ATTEMPT = Number(process.env.GITHUB_RUN_ATTEMPT || '1');
    const {
      currentSignature,
      crossAttempt,
      cleared,
      effectiveBlocking: decidedBlocking,
    } = decideEffectiveBlocking({
      blocking,
      results,
      runAttempt: RUN_ATTEMPT,
      priorSignatureRaw: process.env.PRIOR_ATTEMPT_BLOCKING,
    });
    // Hand the decision to the hoisted gate set — one source of truth for what
    // exits the process (#1350).
    effectiveBlocking = decidedBlocking;
    // Always emitted so the NEXT attempt has this one to compare against. A plain
    // greppable prefix, not a `::workflow command::` — the reader is a `gh api …
    // logs | grep` step, and a workflow command would be swallowed by the runner.
    console.log(`\nREGRESSION_BLOCKING_SIGNATURE: ${formatSignature(currentSignature)}`);

    // A cross-attempt verdict is authoritative: it replaces the single-attempt
    // guess below with a ruling backed by a second data point on the same SHA.
    if (SELF_MODE && crossAttempt) {
      const prev = RUN_ATTEMPT - 1;
      console.error(`\n  Attempt ${RUN_ATTEMPT} vs attempt ${prev}, same head SHA:`);
      if (cleared.length)
        console.error(
          `  Cleared as capture flake — blocked in only one attempt AND isolated to one theme ` +
            `(its sibling read 0.00%): ${blockingSignature(cleared).join(', ')}.`,
        );
      if (effectiveBlocking.length) {
        console.error(
          `  Still blocking — reproduced across attempts or moved on BOTH themes, so real: ` +
            `${blockingSignature(effectiveBlocking).join(', ')}.`,
        );
        console.error(
          '  These are case 1 (INTENDED — label + `Visual-change:` line) or case 3 (STALE base — ' +
            'rebase); the cleared captures are not, so do not label to waive them. Re-running the ' +
            'real set will not clear it.',
        );
        summary.push(
          cleared.length
            ? `❌ **Undeclared regression** — ${effectiveBlocking.length} capture(s) survived the ` +
                `cross-attempt check (attempts ${prev} and ${RUN_ATTEMPT}, same head SHA); ` +
                `${cleared.length} other(s) were capture-side and cleared. Declare the surviving ` +
                'set (case 1) or rebase (case 3).'
            : `❌ **Undeclared regression** — ${effectiveBlocking.length} capture(s) held across ` +
                `attempts ${prev} and ${RUN_ATTEMPT} on the same head SHA. Real, not a flake: ` +
                'declare it (case 1) or rebase (case 3).',
        );
      } else {
        console.error(
          '  NOTHING survived as real → the entire failure is capture-side. Passing: there is no ' +
            'real change here, and further re-runs will not converge.',
        );
        console.error(
          '  Do NOT add a `visual-change` label — it would waive routes this PR never touched.',
        );
        summary.push(
          `✅ **Confirmed capture flake** — the ${blocking.length} blocking capture(s) did not ` +
            `survive the cross-attempt check across attempts ${prev} and ${RUN_ATTEMPT} on the same ` +
            'head SHA (each blocked in one attempt only and was isolated to one theme). No real ' +
            'change; passing without a label or waiver. Re-runs will not converge — do not label.',
        );
      }
    }

    // Single-attempt advice (attempt 1, or no prior signature to compare). The
    // three failures land in `blocking` and look identical here, but their
    // remedies are opposite (#1106) — guess from capture spread. The re-run
    // advice is the diagnostic that GENERATES the second attempt the cross-
    // attempt check above rules on.
    const { isolated, broad, viewportScoped } = classifyBlockingSpread({ blocking, results });

    if (SELF_MODE && !DECLARED_ROUTES.length && !crossAttempt) {
      console.error('\n  Three failures look alike here — pick the remedy by signature:');
      console.error(
        '  1. INTENDED change → add the `visual-change` label AND a\n' +
          '     `Visual-change: <route-name>, <route-name>` line to the PR body, then\n' +
          '     let the label event re-run the gate. Do NOT `gh run rerun` — it replays\n' +
          '     the pre-label payload (VISUAL_CHANGE_LABEL=0) and fails again on a non-bug.',
      );
      console.error(
        "  2. CAPTURE flake → a route/viewport moved while the same route's other\n" +
          '     captures read 0.00%. Re-run the failed job ONCE; a flake does not reproduce\n' +
          '     with the same SIGNATURE, and this gate compares the next attempt’s blocking\n' +
          '     set against this one and rules on it. Never label it — that would waive a\n' +
          '     real regression on the same route.',
      );
      console.error(
        '  3. STALE base → the moved routes changed on `staging` after this branch\n' +
          '     forked. Rebase onto current staging and re-push; do not label.',
      );
      if (broad.length)
        console.error(
          `\n  Signature: ${broad.map((n) => `\`${n}\``).join(', ')} moved on every captured ` +
            'viewport → INTENDED (case 1) or STALE base (case 3), not a flake.',
        );
      if (viewportScoped.length)
        console.error(
          `  Signature: ${viewportScoped.map((n) => `\`${n}\``).join(', ')} moved on some ` +
            'viewports but on BOTH themes of each → a breakpoint-scoped real change: ' +
            'INTENDED (case 1) or STALE base (case 3), not a flake.',
        );
      if (isolated.length)
        console.error(
          `  Signature: ${isolated.map((n) => `\`${n}\``).join(', ')} moved on one theme of a ` +
            "viewport while the same viewport's other theme read 0.00% → likely a capture " +
            'FLAKE (case 2); re-run once and this gate rules on whether it reproduced.',
        );
    }

    // The ready-to-paste declaration (#1256), built from the set that actually
    // gates — after any capture-side captures were cleared above, so a confirmed
    // flake never gets a paste-ready line that would waive it. Route names live
    // in ROUTES[].name and nowhere the author is looking.
    const declarationLine = buildDeclarationLine(effectiveBlocking);
    if (SELF_MODE && declarationLine) {
      console.error(
        `\n  Case 1 only — the line to paste into the PR body, verbatim:\n\n    ${declarationLine}\n`,
      );
      if (DECLARED_ROUTES.length)
        console.error(
          '  The body already declares other routes; merge these names into that line ' +
            'rather than adding a second one.',
        );
    }

    // Undeclared-regression summary + the case table are the single-attempt
    // framing; when a cross-attempt verdict already spoke (its own summary rows
    // above), it is authoritative and this is suppressed.
    if (!crossAttempt) {
      summary.push(
        `❌ **Undeclared regression** — ${blocking.length} capture(s) over ${DIFF_THRESHOLD}%.`,
      );
      if (SELF_MODE && declarationLine) {
        summary.push(
          '',
          DECLARED_ROUTES.length
            ? 'If these are intended too, merge these names into the `Visual-change:` line ' +
              'already in the PR body:'
            : 'If this is an intended change (case 1 below), paste this into the PR body verbatim ' +
              'and add the `visual-change` label:',
          '',
          '```',
          declarationLine,
          '```',
        );
        if (isolated.length)
          summary.push(
            '',
            `⚠ Drop ${isolated.map((n) => `\`${n}\``).join(', ')} from that line first if you ` +
              'concluded case 2 — declaring a flake waives a real regression on that route. ' +
              'Re-run once instead; this gate then rules on whether the set reproduced.',
          );
      }
      if (SELF_MODE && !DECLARED_ROUTES.length) {
        summary.push(
          '',
          'These three look identical but have opposite remedies (#1106) — pick by signature, ' +
            'or re-run once and let the cross-attempt check settle it:',
          '',
          '| If it is… | Signature | Remedy |',
          '| --- | --- | --- |',
          '| An intended change | moved on **every** viewport of the route — or on a subset of viewports but on **both themes** of each (a breakpoint-scoped change) | add `visual-change` label + `Visual-change:` line, then let the label event re-run — **do not `gh run rerun`** |',
          "| A capture flake | moved on **one theme** of a viewport while that same viewport's other theme read 0.00% | re-run the failed job **once**; a flake does not reproduce with the same signature, and this gate rules on the next attempt — **do not** label |",
          '| A stale base | the moved routes changed on `staging` after this branch forked | rebase onto staging and re-push; **do not** label |',
        );
      }
    }
  }

  if (process.env.GITHUB_STEP_SUMMARY && summary.length) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary.join('\n')}\n`);
  }

  // effectiveBlocking, not blocking: a cross-attempt comparison may have cleared
  // captures proven capture-side (#1350). A confirmed pure flake leaves it empty
  // and the run passes — without a label, without a waiver.
  if (unknown.length || unmoved.length || effectiveBlocking.length) process.exit(1);
}
