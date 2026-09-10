#!/usr/bin/env node
// Resolve the `regression` gate's reference to a COMMIT, not a branch alias
// (brikdesigns#1354).
//
// ── Why this exists ──────────────────────────────────────────────────────────
//
// visual-regression.yml used to hardcode:
//
//     REFERENCE_URL: https://staging--brikdesigns.netlify.app
//
// which is an alias that redeploys under any PR open for more than a few
// minutes — `staging` took 162 merges in the 14 days to 2026-09-10. So the gate
// was not a pure function of the diff: the same head SHA re-run an hour later
// was compared against a different baseline, no threshold could fix it, and the
// largest CI failure class in the repo (52 of 96 failed runs; 31 in the last 7
// days) was branches measuring changes that were not theirs.
//
// The fix is to compare against the deploy of the commit the PR actually
// branched from — its merge-base — which does not move while the head SHA is
// fixed.
//
// ── The URL form, which is NOT what #1354's body assumed ─────────────────────
//
// The issue body proposed `https://<sha>--brikdesigns.netlify.app`. That form
// does not exist; probed against five consecutive `staging` commits on
// 2026-09-10 it returned **404** on all five. Netlify's per-deploy permalink is
// keyed on the DEPLOY ID, and the commit → deploy mapping only exists in the
// API response:
//
//     GET /api/v1/sites/<site>/deploys?branch=staging
//       → [{ commit_ref: "3317f08d…", state: "ready",
//            links: { permalink: "https://6aa2cc9a…--brikdesigns.netlify.app",
//                     alias:     "https://staging--brikdesigns.netlify.app" } }]
//
// So this is a two-step resolve — commit_ref → deploy id → permalink — and a
// URL template would have shipped a 404 straight into the gate. `links.alias`
// is the moving reference this module exists to stop using; it is never read.
//
// ── Why a miss FAILS instead of falling back ─────────────────────────────────
//
// Falling back to the alias on a lookup miss would restore the exact defect
// #1354 closes, and would do it invisibly — the gate would keep reporting, and
// the moving-reference reds would come back looking like real diffs. So a miss
// exits non-zero with the SHA it looked for. That is #1354 AC 5.
//
// Measured before choosing to fail rather than walk back through history:
// every one of the last 60 first-parent `staging` commits has a `ready` deploy
// (60/60 on 2026-09-10), and `new-task.sh` cuts branches from `staging`'s tip,
// so a merge-base is always on that first-parent line. A walk-back to the
// nearest deployed ancestor would therefore be unexercised code guarding a case
// that does not occur; if it starts occurring, this is the module to add it to,
// and the error below names the SHA that would drive it.

const NETLIFY_API = 'https://api.netlify.com/api/v1';

// Netlify caps `per_page` at 100. Three pages is ~1 month of `staging` history
// at the current merge rate (162 / 14 days), comfortably past the age of any
// live PR — and past the 10 days of permalinks measured to still serve 200.
export const DEPLOYS_PER_PAGE = 100;
export const DEPLOYS_MAX_PAGES = 3;

/**
 * Pick the deploy that IS a given commit's `staging` build.
 *
 * Newest-first is the input order the API already returns, and it matters: a
 * retried or re-run deploy produces several rows for one `commit_ref`, and the
 * most recent `ready` one is the build the alias would have been serving.
 *
 * Pure — no network. `deploys` is the parsed API array.
 */
export function selectDeployForCommit(deploys, commitSha) {
  if (!Array.isArray(deploys)) return null;
  if (typeof commitSha !== 'string' || commitSha.length < 7) return null;

  const candidates = deploys.filter(
    (d) =>
      d &&
      d.state === 'ready' &&
      typeof d.commit_ref === 'string' &&
      // Compare on the shorter of the two so a short SHA from a caller still
      // matches the API's full one — but anchored at the start, never a
      // substring, so `abc1234` cannot match a commit that merely contains it.
      fullOrShortMatch(d.commit_ref, commitSha),
  );
  if (candidates.length === 0) return null;

  // Explicit sort rather than trusting input order: `created_at` is the field
  // that decides, and a caller assembling pages could concatenate them in any
  // order.
  return candidates.sort(
    (a, b) => Date.parse(b.created_at ?? 0) - Date.parse(a.created_at ?? 0),
  )[0];
}

function fullOrShortMatch(commitRef, sha) {
  const n = Math.min(commitRef.length, sha.length);
  return commitRef.slice(0, n).toLowerCase() === sha.slice(0, n).toLowerCase();
}

/**
 * The per-deploy permalink, which is the only URL on the payload that is
 * pinned to this build.
 *
 * `links.alias` is deliberately not a fallback: it is the moving
 * `staging--brikdesigns.netlify.app` reference, so returning it here would
 * silently undo #1354. A deploy without a permalink is a shape change in the
 * API and should fail loud.
 *
 * Pure — no network.
 */
export function permalinkOf(deploy) {
  const url = deploy?.links?.permalink;
  if (typeof url !== 'string' || !url.startsWith('https://')) {
    throw new Error(
      `Netlify deploy ${deploy?.id ?? '<unknown>'} carried no https links.permalink ` +
        `(got ${JSON.stringify(url)}). The deploys API shape changed — this is not a ` +
        `reference that can be pinned, and falling back to links.alias would restore ` +
        `the moving reference brikdesigns#1354 removed.`,
    );
  }
  return url;
}

/**
 * commit SHA + deploy list → the pinned reference URL.
 *
 * Throws with the SHA on a miss (#1354 AC 5) rather than returning the alias.
 * Pure — no network; the caller supplies `deploys`.
 */
export function resolveReferenceUrl(deploys, commitSha, { pagesRead } = {}) {
  const deploy = selectDeployForCommit(deploys, commitSha);
  if (!deploy) {
    const scanned = deploys?.length ?? 0;
    throw new Error(
      `No 'ready' staging deploy found for merge-base ${commitSha} ` +
        `(scanned ${scanned} deploy(s)${pagesRead ? ` across ${pagesRead} page(s)` : ''}).\n` +
        `\n` +
        `The regression gate will NOT fall back to https://staging--brikdesigns.netlify.app — ` +
        `that alias is the moving reference brikdesigns#1354 removed, and using it here ` +
        `would hide the failure instead of reporting it.\n` +
        `\n` +
        `Most likely: this branch forked from a commit older than the deploy history ` +
        `scanned above. Base-sync it —\n` +
        `    git merge origin/staging && git push\n` +
        `— which moves the merge-base onto a recently deployed commit.`,
    );
  }
  return permalinkOf(deploy);
}

/**
 * Fetch `staging` deploys, newest first, up to DEPLOYS_MAX_PAGES.
 *
 * Stops early on the first short page — there is no point paging past the end
 * of history, and each page is an authenticated round trip.
 */
export async function fetchStagingDeploys({ siteId, token, fetchImpl = fetch }) {
  if (!token) {
    throw new Error(
      'NETLIFY_AUTH_TOKEN is not set. The regression gate needs it to map the ' +
        'merge-base commit to its deploy permalink: `staging`-branch commits carry no ' +
        'GitHub commit statuses (verified 2026-09-10 — an empty statuses[] on both ' +
        '3317f08d and 968be2ad), so the token-free path used by ' +
        'wait-for-netlify-preview.sh does not reach this reference.',
    );
  }
  if (!siteId) throw new Error('NETLIFY_SITE_ID is not set.');

  const all = [];
  let pagesRead = 0;
  for (let page = 1; page <= DEPLOYS_MAX_PAGES; page += 1) {
    const url =
      `${NETLIFY_API}/sites/${encodeURIComponent(siteId)}/deploys` +
      `?branch=staging&per_page=${DEPLOYS_PER_PAGE}&page=${page}`;
    const res = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error(
        `Netlify deploys API returned ${res.status} ${res.statusText} for site ` +
          `${siteId} (page ${page}). A 401 means NETLIFY_AUTH_TOKEN is expired or ` +
          `wrong-scoped; a 404 means NETLIFY_SITE_ID does not name a site this token can read.`,
      );
    }
    const batch = await res.json();
    pagesRead = page;
    if (!Array.isArray(batch) || batch.length === 0) break;
    all.push(...batch);
    if (batch.length < DEPLOYS_PER_PAGE) break;
  }
  return { deploys: all, pagesRead };
}

// ── CLI ──────────────────────────────────────────────────────────────────────
// Prints the pinned reference URL on stdout and nothing else, so the workflow
// can do `REF=$(node scripts/lib/staging-reference.mjs --sha "$BASE")`.
// Diagnostics go to stderr.

const isMain =
  process.argv[1] && import.meta.url === `file://${process.argv[1]}`;

if (isMain) {
  const args = process.argv.slice(2);
  const get = (flag) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };

  const sha = get('--sha');
  if (!sha) {
    console.error(
      'Usage: staging-reference.mjs --sha <merge-base-sha> [--site <site-id>]\n' +
        '  --site defaults to $NETLIFY_SITE_ID; token comes from $NETLIFY_AUTH_TOKEN.',
    );
    process.exit(2);
  }

  const siteId = get('--site') ?? process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_AUTH_TOKEN;

  try {
    const { deploys, pagesRead } = await fetchStagingDeploys({ siteId, token });
    const url = resolveReferenceUrl(deploys, sha, { pagesRead });
    console.error(`▸ merge-base ${sha.slice(0, 8)} → ${url}`);
    console.log(url);
  } catch (err) {
    console.error(`✗ ${err.message}`);
    process.exit(1);
  }
}
