#!/usr/bin/env tsx
/**
 * audit-plan-routes.ts
 *
 * Crawls /plans + /plans/[slug] pages on a deploy URL, extracts every same-origin
 * asset / link / script src, and HEAD-checks each. Reports any 4xx/5xx.
 *
 * Usage:
 *   npx tsx scripts/audit-plan-routes.ts <base-url>
 *   # default: https://deploy-preview-143--brikdesigns.netlify.app
 *
 * Covers static asset 404s and broken in-app links. Does NOT catch
 *  - Next.js prefetch payloads (/_next/data/...) — those need the browser
 *  - XHR / fetch() failures triggered by client code
 *  - Failures behind authentication
 *
 * If the page itself 404s, we report that and skip extraction.
 */

const DEFAULT_BASE = 'https://deploy-preview-143--brikdesigns.netlify.app';
const PLAN_PATHS = [
  '/plans',
  '/plans/marketing-support',
  '/plans/back-office-support',
  '/plans/product-support',
];

interface AuditResult {
  url: string;
  status: number;
  sourcePages: string[];
}

async function fetchHtml(url: string): Promise<{ status: number; html: string }> {
  const resp = await fetch(url, { redirect: 'manual' });
  const html = resp.status === 200 ? await resp.text() : '';
  return { status: resp.status, html };
}

function extractUrls(html: string, baseUrl: string): Set<string> {
  const urls = new Set<string>();
  const pattern = /\b(?:src|href)=["']([^"'#?]+)(?:[?#][^"']*)?["']/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const raw = match[1];
    if (!raw || raw.startsWith('data:') || raw.startsWith('javascript:') || raw.startsWith('mailto:') || raw.startsWith('tel:')) {
      continue;
    }
    try {
      const abs = new URL(raw, baseUrl).toString();
      const baseHost = new URL(baseUrl).host;
      const absHost = new URL(abs).host;
      if (absHost === baseHost) urls.add(abs);
    } catch {
      // malformed URL, skip
    }
  }
  return urls;
}

async function headCheck(url: string): Promise<number> {
  try {
    // Netlify sometimes serves HEAD differently — fall back to GET on 405.
    let resp = await fetch(url, { method: 'HEAD', redirect: 'manual' });
    if (resp.status === 405 || resp.status === 501) {
      resp = await fetch(url, { method: 'GET', redirect: 'manual' });
    }
    return resp.status;
  } catch (err) {
    return 0; // network error
  }
}

async function main() {
  const baseUrl = (process.argv[2] || DEFAULT_BASE).replace(/\/+$/, '');
  console.log(`Auditing: ${baseUrl}\n`);

  // urlToSourcePages: which plan pages referenced this URL
  const urlToSourcePages = new Map<string, Set<string>>();
  const pageStatuses: Array<{ path: string; status: number }> = [];

  for (const path of PLAN_PATHS) {
    const pageUrl = baseUrl + path;
    process.stdout.write(`  [page] ${path} ... `);
    const { status, html } = await fetchHtml(pageUrl);
    pageStatuses.push({ path, status });
    console.log(`HTTP ${status}`);
    if (status !== 200) continue;

    const urls = extractUrls(html, baseUrl);
    for (const u of urls) {
      if (!urlToSourcePages.has(u)) urlToSourcePages.set(u, new Set());
      urlToSourcePages.get(u)!.add(path);
    }
  }

  console.log(`\nHEAD-checking ${urlToSourcePages.size} unique same-origin URLs...\n`);

  const broken: AuditResult[] = [];
  const checks = Array.from(urlToSourcePages.entries());
  // Throttle: 10 concurrent
  const concurrency = 10;
  for (let i = 0; i < checks.length; i += concurrency) {
    const batch = checks.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map(async ([url, sources]) => {
        const status = await headCheck(url);
        return { url, status, sourcePages: Array.from(sources) };
      }),
    );
    for (const r of results) {
      if (r.status >= 400 || r.status === 0) {
        broken.push(r);
      }
    }
  }

  console.log('═══ Page-level results ═══');
  for (const p of pageStatuses) {
    const flag = p.status === 200 ? '✓' : '✗';
    console.log(`  ${flag} ${p.status}  ${p.path}`);
  }

  console.log('\n═══ Broken same-origin URLs ═══');
  if (broken.length === 0) {
    console.log('  (none)');
  } else {
    // Sort: 404s first, then 5xx, then network errors
    broken.sort((a, b) => a.status - b.status);
    for (const b of broken) {
      const label = b.status === 0 ? 'NET-ERR' : `HTTP ${b.status}`;
      console.log(`  [${label}] ${b.url}`);
      console.log(`            referenced from: ${b.sourcePages.join(', ')}`);
    }
  }

  console.log(`\nTotal broken: ${broken.length} / ${urlToSourcePages.size}`);
  process.exit(broken.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
