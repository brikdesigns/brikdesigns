#!/usr/bin/env node
// Self-test for the pinned-reference resolver (brikdesigns#1354).
//
// This module decides what a BLOCKING gate compares against, so the cases
// below are the ways it could stop pinning while still looking like it works —
// each one silently restores the moving reference #1354 removed:
//
//   - a lookup miss returns the alias instead of failing (the gate goes back to
//     comparing against a branch that redeploys underneath it)
//   - `links.alias` gets read as a permalink fallback (same outcome, one field over)
//   - a `building` / `error` deploy is accepted (compares against a half-built page)
//   - a short SHA matches the wrong commit by substring
//   - a retried commit resolves to the older of its two deploys
//
// The `<sha>--brikdesigns.netlify.app` form #1354's body assumed is asserted
// ABSENT (AC 6) — it 404s, and a template implementation would have shipped it.
//
// Plain node:assert, no framework, no network. Run via `npm run test:staging-reference`.

import assert from 'node:assert/strict';
import {
  selectDeployForCommit,
  permalinkOf,
  resolveReferenceUrl,
  fetchStagingDeploys,
  DEPLOYS_PER_PAGE,
  DEPLOYS_MAX_PAGES,
} from './staging-reference.mjs';

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}
async function checkAsync(name, fn) {
  await fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

// Shaped from a real response, captured 2026-09-10 against site
// 7664720a-83a6-45e8-b348-b49d07de8ef7.
const deploy = (over = {}) => ({
  id: '6aa2cc9ae3f7f8000855bf7f',
  state: 'ready',
  commit_ref: '3317f08d1f9a4b7c2e5d6a8b9c0d1e2f3a4b5c6d',
  created_at: '2026-09-10T15:28:26.103Z',
  links: {
    permalink: 'https://6aa2cc9ae3f7f8000855bf7f--brikdesigns.netlify.app',
    alias: 'https://staging--brikdesigns.netlify.app',
    branch: null,
  },
  ...over,
});

const FULL = '3317f08d1f9a4b7c2e5d6a8b9c0d1e2f3a4b5c6d';

console.log('\n▸ selectDeployForCommit');

check('matches a ready deploy on its full commit_ref', () => {
  const found = selectDeployForCommit([deploy()], FULL);
  assert.equal(found.id, '6aa2cc9ae3f7f8000855bf7f');
});

check('matches on a short SHA prefix', () => {
  const found = selectDeployForCommit([deploy()], '3317f08d');
  assert.equal(found.id, '6aa2cc9ae3f7f8000855bf7f');
});

check('a short SHA is anchored — never a substring match', () => {
  // '7f08d' appears INSIDE the commit_ref but is not a prefix of it. Accepting
  // it would let one branch's gate silently compare against another commit's
  // build, which reads as a real diff and is indistinguishable from a bug.
  assert.equal(selectDeployForCommit([deploy()], '7f08d1f9'), null);
});

check('rejects a deploy that is not ready', () => {
  for (const state of ['building', 'enqueued', 'error', 'new', 'processing']) {
    assert.equal(
      selectDeployForCommit([deploy({ state })], FULL),
      null,
      `state=${state} must not be used as a reference`,
    );
  }
});

check('picks the NEWEST ready deploy when a commit was retried', () => {
  // A re-run deploy produces a second row for one commit_ref. The newer build
  // is what the alias would have been serving, so it is the honest reference.
  const older = deploy({
    id: 'older000000000000000000',
    created_at: '2026-09-10T15:00:00.000Z',
    links: { permalink: 'https://older000000000000000000--brikdesigns.netlify.app' },
  });
  const newer = deploy({
    id: 'newer000000000000000000',
    created_at: '2026-09-10T15:28:26.103Z',
    links: { permalink: 'https://newer000000000000000000--brikdesigns.netlify.app' },
  });
  // Input order deliberately oldest-first, to prove the sort does the work.
  assert.equal(selectDeployForCommit([older, newer], FULL).id, 'newer000000000000000000');
});

check('an unknown commit returns null rather than the first deploy', () => {
  assert.equal(selectDeployForCommit([deploy()], 'deadbeefdeadbeef'), null);
});

check('tolerates junk input without throwing', () => {
  assert.equal(selectDeployForCommit(null, FULL), null);
  assert.equal(selectDeployForCommit(undefined, FULL), null);
  assert.equal(selectDeployForCommit([null, undefined, {}], FULL), null);
  assert.equal(selectDeployForCommit([deploy()], ''), null);
  assert.equal(selectDeployForCommit([deploy()], 'abc'), null); // too short to be a SHA
  assert.equal(selectDeployForCommit([deploy()], undefined), null);
});

console.log('\n▸ permalinkOf');

check('returns links.permalink', () => {
  assert.equal(
    permalinkOf(deploy()),
    'https://6aa2cc9ae3f7f8000855bf7f--brikdesigns.netlify.app',
  );
});

check('NEVER falls back to links.alias — the moving reference (#1354)', () => {
  const noPermalink = deploy({
    links: { alias: 'https://staging--brikdesigns.netlify.app', branch: null },
  });
  assert.throws(() => permalinkOf(noPermalink), /no https links\.permalink/);
  // And the thing it must not return, stated directly.
  assert.throws(() => permalinkOf(noPermalink), (err) => {
    assert.ok(
      !String(err.message).includes('https://staging--brikdesigns.netlify.app\n'),
      'the alias must not be offered as the resolved URL',
    );
    return true;
  });
});

check('rejects a non-https or missing permalink', () => {
  assert.throws(() => permalinkOf(deploy({ links: { permalink: null } })), /links\.permalink/);
  assert.throws(() => permalinkOf(deploy({ links: {} })), /links\.permalink/);
  assert.throws(() => permalinkOf(deploy({ links: null })), /links\.permalink/);
  assert.throws(
    () => permalinkOf(deploy({ links: { permalink: 'http://insecure--x.netlify.app' } })),
    /links\.permalink/,
  );
});

console.log('\n▸ resolveReferenceUrl');

check('resolves a hit to the permalink', () => {
  assert.equal(
    resolveReferenceUrl([deploy()], FULL),
    'https://6aa2cc9ae3f7f8000855bf7f--brikdesigns.netlify.app',
  );
});

check('a MISS throws, naming the SHA it looked for (AC 5)', () => {
  assert.throws(
    () => resolveReferenceUrl([deploy()], 'cafebabecafebabecafebabe'),
    /No 'ready' staging deploy found for merge-base cafebabecafebabecafebabe/,
  );
});

check('the miss error refuses the alias out loud, and says how to fix it', () => {
  try {
    resolveReferenceUrl([], 'cafebabecafebabecafebabe');
    assert.fail('expected a throw');
  } catch (err) {
    const m = err.message;
    assert.match(m, /will NOT fall back/, 'must say it is not falling back');
    assert.match(m, /git merge origin\/staging/, 'must name the remedy');
    assert.match(m, /scanned 0 deploy\(s\)/, 'must report how much history it saw');
  }
});

check('the resolved URL is a DEPLOY-ID permalink, not the <sha>-- form (AC 6)', () => {
  // #1354's body proposed https://<sha>--brikdesigns.netlify.app. Probed
  // 2026-09-10 against five consecutive staging commits: 404 on all five. If
  // this assertion ever fails, someone has reintroduced the template.
  const url = resolveReferenceUrl([deploy()], FULL);
  assert.ok(
    !url.includes(`${FULL.slice(0, 8)}--`),
    'reference must not be keyed on the commit SHA — that URL form 404s',
  );
  assert.match(url, /^https:\/\/[0-9a-f]{24}--brikdesigns\.netlify\.app$/);
});

console.log('\n▸ fetchStagingDeploys');

await checkAsync('refuses to run without a token, and says why (no fallback)', async () => {
  await assert.rejects(
    () => fetchStagingDeploys({ siteId: 'site', token: '' }),
    /NETLIFY_AUTH_TOKEN is not set/,
  );
});

await checkAsync('refuses to run without a site id', async () => {
  await assert.rejects(
    () => fetchStagingDeploys({ siteId: '', token: 'tok' }),
    /NETLIFY_SITE_ID is not set/,
  );
});

await checkAsync('surfaces an API error with its status', async () => {
  const fetchImpl = async () => ({ ok: false, status: 401, statusText: 'Unauthorized' });
  await assert.rejects(
    () => fetchStagingDeploys({ siteId: 'site', token: 'tok', fetchImpl }),
    /401 Unauthorized/,
  );
});

await checkAsync('stops paging on a short page', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return { ok: true, status: 200, json: async () => [deploy(), deploy()] };
  };
  const { deploys, pagesRead } = await fetchStagingDeploys({
    siteId: 'site',
    token: 'tok',
    fetchImpl,
  });
  assert.equal(calls, 1, 'a page shorter than per_page ends history — do not page again');
  assert.equal(pagesRead, 1);
  assert.equal(deploys.length, 2);
});

await checkAsync(`pages to the cap (${DEPLOYS_MAX_PAGES}) on full pages`, async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return {
      ok: true,
      status: 200,
      json: async () => Array.from({ length: DEPLOYS_PER_PAGE }, () => deploy()),
    };
  };
  const { deploys } = await fetchStagingDeploys({ siteId: 'site', token: 'tok', fetchImpl });
  assert.equal(calls, DEPLOYS_MAX_PAGES, 'must stop at the page cap, not loop forever');
  assert.equal(deploys.length, DEPLOYS_PER_PAGE * DEPLOYS_MAX_PAGES);
});

await checkAsync('requests the staging branch only', async () => {
  const seen = [];
  const fetchImpl = async (url) => {
    seen.push(url);
    return { ok: true, status: 200, json: async () => [] };
  };
  await fetchStagingDeploys({ siteId: 'my-site', token: 'tok', fetchImpl });
  assert.match(seen[0], /branch=staging/);
  assert.match(seen[0], /sites\/my-site\/deploys/);
});

console.log(`\n✓ ${passed} assertions passed — pinned reference resolver (#1354)\n`);
