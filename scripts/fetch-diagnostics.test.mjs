#!/usr/bin/env node
// Self-test for the Supabase transport diagnostics (brikdesigns#1196).
//
// The thing under test is a diagnostic, so the only property worth pinning is
// that it fires with the codes and addresses on it — a wrapper that silently
// swallowed the cause would look identical in a green build, which is exactly
// how #1181 cost two sessions. The cases below cover the happy-eyeballs
// `AggregateError` shape (the one #1181 actually captured), the single-address
// shape, and the two pass-through cases where reshaping the error would be
// wrong.
//
// Every fetch is injected and rejects synthetically: no network, no Supabase.
//
// Plain node:assert, no framework. Run via `npm run test:fetch-diagnostics`,
// which goes through `tsx` — the repo's existing way to run a script that
// reaches into TypeScript (cf. `test:sanitize`, `test:ghl-webhook`). Bare
// `node` also works here, but warns MODULE_TYPELESS_PACKAGE_JSON on the .ts
// import.

import assert from 'node:assert/strict';
import {
  describeTransportFailure,
  withFetchDiagnostics,
} from '../src/lib/supabase/fetch-diagnostics.ts';

const tests = [];
const failures = [];
const test = (name, fn) => tests.push({ name, fn });

/** The shape Node raises for a single-address connect failure. */
const singleAddressFailure = () => {
  const cause = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:45999'), {
    code: 'ECONNREFUSED',
    address: '127.0.0.1',
    port: 45999,
  });
  return new TypeError('fetch failed', { cause });
};

/** The shape happy-eyeballs raises across two A records — #1181's capture. */
const multiAddressFailure = () => {
  const cause = new AggregateError(
    [
      Object.assign(new Error(''), { code: 'ETIMEDOUT', address: '172.64.149.246', port: 443 }),
      Object.assign(new Error(''), { code: 'ECONNREFUSED', address: '104.18.38.10', port: 443 }),
    ],
    ''
  );
  return new TypeError('fetch failed', { cause });
};

test('a single-address failure yields its code and address', () => {
  assert.deepEqual(describeTransportFailure(singleAddressFailure()), [
    'ECONNREFUSED@127.0.0.1:45999',
  ]);
});

test('happy-eyeballs yields one entry per address attempted', () => {
  assert.deepEqual(describeTransportFailure(multiAddressFailure()), [
    'ETIMEDOUT@172.64.149.246:443',
    'ECONNREFUSED@104.18.38.10:443',
  ]);
});

test('the per-address codes are kept distinct, not collapsed', () => {
  // The two addresses disagree — one timed out, one was refused. #1181 turned
  // on exactly that disagreement, so a wrapper reporting one code would lose it.
  const described = describeTransportFailure(multiAddressFailure());
  assert.equal(new Set(described.map((d) => d.split('@')[0])).size, 2);
});

test('a cause with a code but no address still describes', () => {
  const err = new TypeError('fetch failed', { cause: Object.assign(new Error(''), { code: 'ENOTFOUND' }) });
  assert.deepEqual(describeTransportFailure(err), ['ENOTFOUND']);
});

test('a cause with no transport detail describes as empty', () => {
  assert.deepEqual(describeTransportFailure(new TypeError('fetch failed', { cause: new Error('boom') })), []);
  assert.deepEqual(describeTransportFailure(new Error('no cause at all')), []);
  assert.deepEqual(describeTransportFailure(undefined), []);
});

test('the wrapper is pass-through on success', async () => {
  const sentinel = new Response('ok');
  const wrapped = withFetchDiagnostics(async () => sentinel);
  assert.equal(await wrapped('https://example.test/'), sentinel);
});

test('the wrapper rethrows with the code, the address, and the URL', async () => {
  const wrapped = withFetchDiagnostics(async () => {
    throw multiAddressFailure();
  });
  await assert.rejects(() => wrapped('https://db.supabase.co/rest/v1/services'), (err) => {
    assert.match(err.message, /transport layer, not in the page being rendered/);
    assert.match(err.message, /ETIMEDOUT@172\.64\.149\.246:443/);
    assert.match(err.message, /ECONNREFUSED@104\.18\.38\.10:443/);
    assert.match(err.message, /db\.supabase\.co\/rest\/v1\/services/);
    assert.match(err.message, /brikdesigns#1181/);
    return true;
  });
});

test('the original error is preserved as the cause', async () => {
  const original = singleAddressFailure();
  const wrapped = withFetchDiagnostics(async () => {
    throw original;
  });
  await assert.rejects(() => wrapped('https://db.supabase.co/'), (err) => {
    assert.equal(err.cause, original);
    return true;
  });
});

test('a non-transport rejection passes through untouched', async () => {
  // An abort is not a connection failure; reshaping it would be a lie.
  const abort = new DOMException('This operation was aborted', 'AbortError');
  const wrapped = withFetchDiagnostics(async () => {
    throw abort;
  });
  await assert.rejects(() => wrapped('https://db.supabase.co/'), (err) => {
    assert.equal(err, abort);
    return true;
  });
});

test('a thrown non-Error passes through untouched', async () => {
  const wrapped = withFetchDiagnostics(async () => {
    throw 'a string, somehow';
  });
  await assert.rejects(() => wrapped('https://db.supabase.co/'), (err) => {
    assert.equal(err, 'a string, somehow');
    return true;
  });
});

for (const { name, fn } of tests) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failures.push({ name, error });
    console.log(`  ✗ ${name}`);
    console.log(`    ${error.message.split('\n')[0]}`);
  }
}

console.log(`\n${tests.length - failures.length}/${tests.length} passed`);
process.exit(failures.length === 0 ? 0 : 1);
