#!/usr/bin/env npx tsx
// Self-test for the app-error boundary's record + Sentry exemption (#1403).
//
// The three boundary renders on record produced a screenshot each and nothing
// else — no name, no message, no route, no Sentry event. Two mechanisms have to
// hold for the next one to produce a record instead, and each fails silently:
//
//   - the record line keeps every field a triage needs (name/message/route/
//     digest), so a CI screenshot identifies the error rather than only proving
//     one happened
//   - a boundary-tagged event survives beforeSendClient's drop list, which is
//     what swallowed all three (ChunkLoadError is dropped there, and a cold
//     deployment is exactly when a stale document requests missing chunks)
//
// The third check is the regression this file exists to stop: the boundary must
// not render a <main>. tests/a11y/lib/goto-rendered.ts:51-53 measured it —
// card-treatment.spec.ts passed 16/16 against an error page that carried one.
//
// Plain node:assert, no framework. Run via `npm run test:app-error-record`.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BOUNDARY_TAG, formatRecord, isBoundaryEvent } from './app-error-record';

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

// ── AC 1: the record carries what a triage needs ────────────────────────────

check('a client-side error records name, message, route and event id', () => {
  const line = formatRecord(
    { name: 'ChunkLoadError', message: 'Loading chunk 4821 failed.' },
    '/industries/dental',
    'abc123',
    '2026-09-11T14:03:25.000Z',
  );
  assert.match(line, /^app-error · /);
  assert.match(line, /name=ChunkLoadError/);
  assert.match(line, /message=Loading chunk 4821 failed\./);
  assert.match(line, /route=\/industries\/dental/);
  assert.match(line, /sentry=abc123/);
  assert.match(line, /at=2026-09-11T14:03:25\.000Z/);
});

check('a server error records the digest, the only key that joins to the server log', () => {
  // React redacts the message in production builds, so `digest` is all the
  // browser gets — and all that can be matched against what onRequestError
  // captured server-side (instrumentation.ts:48).
  const line = formatRecord(
    {
      name: 'Error',
      message:
        'An error occurred in the Server Components render. The specific message is omitted in production builds to avoid leaking sensitive details.',
      digest: '2983745982',
    },
    '/results/birdwell-mutlak-dentistry-website',
    undefined,
    '2026-09-06T15:34:27.770Z',
  );
  assert.match(line, /digest=2983745982/);
  assert.match(line, /sentry=\(not sent\)/);
});

check('missing fields degrade to explicit placeholders, never to empty keys', () => {
  // A record that reads `route=` is indistinguishable from a truncated line.
  const line = formatRecord({}, '', undefined, '2026-09-11T00:00:00.000Z');
  assert.match(line, /name=Error/);
  assert.match(line, /message=\(none\)/);
  assert.match(line, /route=\(unknown\)/);
  assert.match(line, /digest=\(none\)/);
  assert.doesNotMatch(line, /=(·|$)/);
});

check('every field is key=value on one line, so a grep works on any of the three sinks', () => {
  const line = formatRecord({ name: 'TypeError', message: 'x is not a function' }, '/plans', 'e1', 'now');
  assert.doesNotMatch(line, /\n/);
  const fields = line.split(' · ').slice(1);
  assert.equal(fields.length, 6);
  for (const field of fields) assert.match(field, /^[a-z]+=/);
});

// ── AC 2: the exemption that makes the next occurrence reportable ───────────

check('a boundary-tagged event bypasses the drop list', () => {
  assert.equal(isBoundaryEvent({ boundary: BOUNDARY_TAG }), true);
});

check('an untagged event is still subject to the drop list', () => {
  // The filters stay in force for background noise — this exemption widens the
  // gate for boundary renders only, not for every ChunkLoadError on the site.
  assert.equal(isBoundaryEvent(undefined), false);
  assert.equal(isBoundaryEvent({}), false);
  assert.equal(isBoundaryEvent({ boundary: 'something-else' }), false);
});

check('instrumentation-client.ts actually consults the exemption before dropping', () => {
  // The lib being right is worth nothing if the filter stopped calling it.
  const src = fs.readFileSync(
    path.resolve(process.cwd(), 'instrumentation-client.ts'),
    'utf8',
  );
  const exemption = src.indexOf('boundary');
  const firstDrop = src.indexOf('return null');
  assert.ok(exemption !== -1, 'beforeSendClient no longer exempts the app-error boundary');
  assert.ok(
    exemption < firstDrop,
    'the boundary exemption must precede the drop list, or a ChunkLoadError boundary is still discarded',
  );
});

// ── The regression this file exists to stop ─────────────────────────────────

check('the error boundary renders no <main> (goto-rendered.ts:51-53)', () => {
  const src = fs.readFileSync(path.resolve(process.cwd(), 'src/app/error.tsx'), 'utf8');
  // Comments stripped first — the file's own header explains WHY there is no
  // <main>, and matching that prose would fail the check it documents.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(
    code,
    /<main[\s>]/,
    'A <main> in the error boundary satisfies every a11y spec’s render guard, so the suite would measure the error page as if it were the route — card-treatment.spec.ts passed 16/16 against exactly that.',
  );
});

check('the error boundary keeps the hooks a spec and a screenshot key on', () => {
  const src = fs.readFileSync(path.resolve(process.cwd(), 'src/app/error.tsx'), 'utf8');
  assert.match(src, /role="alert"/);
  assert.match(src, /data-app-error/);
  assert.match(src, /data-app-error-record/);
});

console.log(`\n${passed} checks passed.`);
