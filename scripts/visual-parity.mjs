#!/usr/bin/env node
import { chromium } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

// Three modes share this script:
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
const REFERENCE_MODE = process.env.REFERENCE_MODE ?? 'webflow';
const SELF_MODE = REFERENCE_MODE === 'self';
const MOCKUP_MODE = REFERENCE_MODE === 'mockup';
const REFERENCE_LABEL = MOCKUP_MODE ? 'Baseline' : SELF_MODE ? 'Staging' : 'Webflow';
const BASELINE_DIR = path.resolve('tests/visual-parity/baselines');
const UPDATE_BASELINES = process.env.UPDATE_BASELINES === '1';

const WEBFLOW_URL = process.env.WEBFLOW_URL ?? 'https://www.brikdesigns.com';
const REFERENCE_URL = process.env.REFERENCE_URL
  ?? (SELF_MODE ? 'https://staging--brikdesigns.netlify.app' : WEBFLOW_URL);
const NETLIFY_URL = process.env.NETLIFY_URL ?? process.argv[2];
const OUT = path.resolve('tests/visual-parity/screenshots');

// Routes with diff % above this value are flagged. Set to 0 to disable hard failure.
// Mockup mode always gates: the baseline is a blessed capture of the same
// pipeline, so the pass-case noise floor is ~0% while the #822 dark-canvas
// defect measures 14.85% against it — 5% clears flake with wide margin.
const DIFF_THRESHOLD = parseFloat(process.env.DIFF_THRESHOLD ?? (MOCKUP_MODE ? '5' : '0'));

if (!NETLIFY_URL) {
  console.error(
    'Usage: NETLIFY_URL=https://deploy-preview-N--brikdesigns.netlify.app npm run visual-parity\n' +
    '   or: npm run visual-parity -- https://deploy-preview-N--brikdesigns.netlify.app'
  );
  process.exit(2);
}

const ROUTES = [
  { netlify: '/', webflow: '/', name: 'home' },
  { netlify: '/about', webflow: '/about', name: 'about' },
  { netlify: '/services', webflow: '/services', name: 'services' },
  { netlify: '/services/marketing', webflow: '/service-lines/marketing-design', name: 'services-category-marketing' },
  { netlify: '/services/marketing/website-experience-mapping', webflow: '/service/website-experience-mapping', name: 'services-detail-website-experience-mapping' },
  { netlify: '/plans', webflow: '/plans', name: 'plans' },
  { netlify: '/customer-stories', webflow: '/customer-stories', name: 'customer-stories' },
  { netlify: '/customers', webflow: '/customers', name: 'customers' },
  { netlify: '/industries/dental', webflow: '/customers/dental', name: 'industry-dental' },
  { netlify: '/blog', webflow: '/blog', name: 'blog' },
  { netlify: '/contact', webflow: '/contact', name: 'contact' },
  { netlify: '/free-marketing-analysis', webflow: '/brikdown-analysis', name: 'fma' },
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
];

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'tablet',  width: 768,  height: 1024 },
  { name: 'mobile',  width: 375,  height: 812 },
];

const THEMES = (process.env.THEMES ?? 'light,dark').split(',').map((t) => t.trim());

console.log(`▸ mode:       ${REFERENCE_MODE}`);
console.log(`▸ reference:  ${MOCKUP_MODE ? path.relative('', BASELINE_DIR) : REFERENCE_URL} (${REFERENCE_LABEL})`);
console.log(`▸ netlify:    ${NETLIFY_URL}`);
console.log(`▸ themes:     ${THEMES.join(', ')}`);
console.log(`▸ threshold:  ${DIFF_THRESHOLD > 0 ? `${DIFF_THRESHOLD}%` : 'off (set DIFF_THRESHOLD to enable)'}`);
console.log(`▸ output:     ${OUT}`);

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

async function captureOnce(baseUrl, route, viewport, theme, outPath, timeoutMs) {
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
      const h = document.body.scrollHeight;
      for (let y = 0; y < h; y += 600) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 100));
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
    await page.waitForFunction(
      () => {
        const h = document.body.scrollHeight;
        if (window.__lastH === h) return true;
        window.__lastH = h;
        return false;
      },
      { timeout: 15000, polling: 250 },
    ).catch((e) => console.warn(`  · height did not settle (${e.message.split('\n')[0]})`));
    await page.screenshot({ path: outPath, fullPage: true, animations: 'disabled' });
    return { ok: true };
  } catch (err) {
    return { ok: false, err };
  } finally {
    await page.close();
    await context.close();
  }
}

async function capture(baseUrl, route, viewport, theme, outPath) {
  // First attempt with normal headroom; one retry on failure with extra time.
  let result = await captureOnce(baseUrl, route, viewport, theme, outPath, 60000);
  if (!result.ok) {
    await new Promise((r) => setTimeout(r, 1500));
    result = await captureOnce(baseUrl, route, viewport, theme, outPath, 90000);
  }
  if (!result.ok) {
    console.warn(`  ✗ ${baseUrl}${route} [${viewport.name}/${theme}]: ${result.err.message.split('\n')[0]}`);
    fs.writeFileSync(outPath.replace(/\.png$/, '.error.txt'), String(result.err));
  }
}

// Returns { diffPct, diffImg } where diffImg is the relative path to the diff PNG,
// or null if one/both screenshots are missing.
function diffScreenshots(wfPath, nlPath, diffPath) {
  if (!fs.existsSync(wfPath) || !fs.existsSync(nlPath)) return null;

  const wf = PNG.sync.read(fs.readFileSync(wfPath));
  const nl = PNG.sync.read(fs.readFileSync(nlPath));

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
  return { diffPct, diffImg: path.relative(OUT, diffPath) };
}

const results = [];
const missingBaselines = [];
for (const theme of THEMES) {
  for (const viewport of VIEWPORTS) {
    const dir = path.join(OUT, theme, viewport.name);
    fs.mkdirSync(dir, { recursive: true });
    for (const route of ROUTES) {
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
      const diff = diffScreenshots(wfPath, nlPath, diffPath);
      if (diff) {
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

const reportPath = path.join(OUT, 'index.html');
const html = `<!doctype html>
<meta charset="utf-8">
<title>${SELF_MODE ? 'Visual regression' : 'Visual parity'} — ${REFERENCE_LABEL} vs Netlify</title>
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
  <h1>${SELF_MODE ? 'Visual regression' : 'Visual parity'} — ${REFERENCE_LABEL} vs Netlify</h1>
  <div class="meta">${REFERENCE_LABEL.toLowerCase()}: ${REFERENCE_URL} · netlify: ${NETLIFY_URL} · captured ${new Date().toISOString()}</div>
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

const okCount = results.filter((r) => r.nlOk && (r.wfOk || UPDATE_BASELINES)).length;
const avgDiff = diffed.length
  ? (diffed.reduce((s, r) => s + r.diffPct, 0) / diffed.length).toFixed(2)
  : '—';
const worstDiff = diffed.length
  ? Math.max(...diffed.map((r) => r.diffPct)).toFixed(2)
  : '—';

console.log(`\n✓ ${okCount}/${results.length} captures complete`);
console.log(`▸ avg diff: ${avgDiff}%  |  worst: ${worstDiff}%`);
console.log(`▸ open ${reportPath}`);

// Mockup mode never passes silently: a missing baseline or a failed capture is
// a hard failure, not a skipped comparison. (webflow mode tolerates capture
// failure by design — that tolerance must not carry over; it is how #822 hid.)
if (MOCKUP_MODE) {
  if (missingBaselines.length) {
    console.error(`\n✗ ${missingBaselines.length} baseline(s) missing — mockup mode refuses to skip:`);
    missingBaselines.forEach((p) => console.error(`  ${p}`));
    console.error('  Author against a known-good deploy, then eyeball vs the Paper mockup before committing:');
    console.error('  UPDATE_BASELINES=1 npm run visual-mockup -- <known-good-url>');
    process.exit(2);
  }
  const failedCaptures = results.filter((r) => !r.nlOk);
  if (failedCaptures.length) {
    console.error(`\n✗ ${failedCaptures.length} capture(s) failed — mockup mode treats this as a gate failure:`);
    failedCaptures.forEach((r) => console.error(`  ${r.route} [${r.theme}/${r.viewport}] (${NETLIFY_URL}${r.netlifyPath})`));
    process.exit(1);
  }
}

// Hard failure gate — only active when DIFF_THRESHOLD is set
if (DIFF_THRESHOLD > 0 && !UPDATE_BASELINES) {
  const failing = diffed.filter((r) => r.diffPct > DIFF_THRESHOLD);
  if (failing.length) {
    console.error(`\n✗ ${failing.length} route(s) exceed DIFF_THRESHOLD of ${DIFF_THRESHOLD}%:`);
    failing.forEach((r) => console.error(`  ${r.diffPct.toFixed(2)}%  ${r.route} [${r.theme}/${r.viewport}]`));
    process.exit(1);
  }
}
