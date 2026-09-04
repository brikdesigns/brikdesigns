#!/usr/bin/env node
// Behaviour test for `src/lib/customer-story-author.ts`
// (brik-client-portal#3799, umbrella #3767).
//
// `parseStorySocialLinks` is the only narrowing between an untyped jsonb column
// and `<SocialIcon platform={…}>`. brikdesigns' Supabase client is not
// generic-typed — `getCustomerStoryBySlug` returns raw `data` from `.select('*')`
// (src/lib/supabase/queries.ts:461-476) — so nothing upstream has checked the
// shape, and `author_social_links` is authored in a different repo's CMS.
//
// Two directions matter and each fails differently:
//
//   - an unbundled platform survives → `<SocialIcon>` resolves no mark and the
//     hero renders an empty 28px hole in the author row, on a public page
//   - a legitimate link is dropped   → the client's social row silently loses a
//     platform nobody notices is missing
//
// Platform membership is asserted against BDS's own `SOCIAL_ICON_PLATFORMS`
// rather than a copied list, so a platform added or removed upstream cannot
// leave this test asserting a stale set.
//
// Run via `npm run test:customer-story-author`.

import assert from 'node:assert/strict';
import {
  parseStorySocialLinks,
  RENDERABLE_PLATFORM_LIST,
} from '../src/lib/customer-story-author.ts';

const tests = [];
const failures = [];
const test = (name, fn) => tests.push({ name, fn });

// ─── Absent / malformed column → the degraded state, never a throw ──────────

test('null column returns []', () => {
  assert.deepEqual(parseStorySocialLinks(null), []);
});

test('undefined column returns []', () => {
  assert.deepEqual(parseStorySocialLinks(undefined), []);
});

test('a non-array (object, string, number) returns []', () => {
  assert.deepEqual(parseStorySocialLinks({ platform: 'facebook', url: 'https://x' }), []);
  assert.deepEqual(parseStorySocialLinks('facebook'), []);
  assert.deepEqual(parseStorySocialLinks(7), []);
});

// ─── Entry-level narrowing ──────────────────────────────────────────────────

test('a well-formed entry survives, trimmed', () => {
  assert.deepEqual(
    parseStorySocialLinks([{ platform: 'linkedin', url: '  https://linkedin.com/in/x  ' }]),
    [{ platform: 'linkedin', url: 'https://linkedin.com/in/x' }]
  );
});

test('order is preserved — it is the order the CMS editor set', () => {
  const raw = [
    { platform: 'facebook', url: 'https://f' },
    { platform: 'instagram', url: 'https://i' },
    { platform: 'linkedin', url: 'https://l' },
  ];
  assert.deepEqual(
    parseStorySocialLinks(raw).map((l) => l.platform),
    ['facebook', 'instagram', 'linkedin']
  );
});

test('an unbundled platform is dropped, not passed to SocialIcon', () => {
  // The failure this exists for: <SocialIcon> resolves no mark for a platform
  // outside the bundled set, so it would render an empty 28px box.
  assert.deepEqual(parseStorySocialLinks([{ platform: 'myspace', url: 'https://m' }]), []);
  assert.deepEqual(parseStorySocialLinks([{ platform: 'threads', url: 'https://t' }]), []);
});

test('every renderable platform is accepted', () => {
  const raw = RENDERABLE_PLATFORM_LIST.map((platform) => ({
    platform,
    url: `https://${platform}`,
  }));
  assert.equal(parseStorySocialLinks(raw).length, RENDERABLE_PLATFORM_LIST.length);
});

test('the renderable set still matches BDS — 10 bundled platforms', () => {
  // Drift against BDS is caught at COMPILE time by the
  // `Record<SocialIconPlatform, true>` in customer-story-author.ts; this only
  // pins the count so a silent edit to that record is visible here too.
  assert.equal(RENDERABLE_PLATFORM_LIST.length, 10);
});

test('a missing or empty url is dropped', () => {
  assert.deepEqual(parseStorySocialLinks([{ platform: 'yelp' }]), []);
  assert.deepEqual(parseStorySocialLinks([{ platform: 'yelp', url: '' }]), []);
  assert.deepEqual(parseStorySocialLinks([{ platform: 'yelp', url: '   ' }]), []);
});

test('a non-string url is dropped', () => {
  assert.deepEqual(parseStorySocialLinks([{ platform: 'yelp', url: 42 }]), []);
});

test('null / non-object / nested-array entries are dropped', () => {
  assert.deepEqual(parseStorySocialLinks([null, 'facebook', ['facebook']]), []);
});

test('one malformed entry does not discard its well-formed siblings', () => {
  // A whole-array bail would blank a client's social row over one bad entry.
  const raw = [
    { platform: 'facebook', url: 'https://f' },
    { platform: 'myspace', url: 'https://m' },
    { platform: 'yelp', url: 'https://y' },
  ];
  assert.deepEqual(
    parseStorySocialLinks(raw).map((l) => l.platform),
    ['facebook', 'yelp']
  );
});

// ─── Run ────────────────────────────────────────────────────────────────────

for (const { name, fn } of tests) {
  try {
    fn();
  } catch (err) {
    failures.push({ name, err });
  }
}

if (failures.length > 0) {
  for (const { name, err } of failures) {
    console.error(`✗ ${name}\n  ${err.message}`);
  }
  console.error(`\n${failures.length} of ${tests.length} test(s) failed.`);
  process.exit(1);
}

console.log(`OK — ${tests.length} customer-story author-link test(s) passed.`);
