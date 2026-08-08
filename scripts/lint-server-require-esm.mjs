#!/usr/bin/env node
// Fails CI when a package Next EXTERNALIZES out of the server bundle cannot be
// CJS-`require()`d, because the Netlify function does exactly that for every
// external at request time.
//
// This is the guard for brikdesigns#809. `isomorphic-dompurify` pulled in
// jsdom >= 28, which CJS-`require()`s the ESM-only `@exodus/bytes` in eight of
// its own modules. jsdom is on Next's default externals list, so the function
// required it from disk and Node refused:
//
//   Failed to load external module jsdom-4cccfac9827ebcfe:
//   Error [ERR_REQUIRE_ESM]: require() of ES Module .../@exodus/bytes/encoding-lite.js
//
// Every page calling `sanitizeHtml` 500ed — but only on an ON-DEMAND render.
// Build-time prerenders never touch the externalized require, which is why a
// green build, a green `next start`, and a freshly-deployed site all looked
// fine; pages reverted to 500 an hour later when the ISR entry lapsed, or the
// moment the portal fired a revalidation on a CMS save.
//
// Why the check is scoped to externals and not to all production dependencies:
// a BUNDLED ESM dependency is fine — Turbopack compiles it in and no `require()`
// ever happens. `sanitize-html` (the #809 fix) CJS-requires the ESM-only
// `htmlparser2`, and works, because neither is externalized. An unscoped version
// of this gate failed on that working fix. Externalization is the whole
// difference, so it is the whole scope.
//
// Why probe by actually requiring, rather than reading `"type": "module"` out of
// each package.json: dual-build packages legitimately declare `type: module`
// while still exposing a CJS entry through `exports` conditions. Scanning for
// the field flags 221 edges in this tree, essentially all of them false — a gate
// nobody can act on. Spawning the require is the exact question the runtime
// asks, and it answers it with no false positives.
//
// Why `--no-experimental-require-module` is not optional: Node >= 22.12 permits
// `require()` of ESM, so on a modern local Node the broken tree loads clean and
// the gate would pass on the very bug it exists to catch (verified —
// `require('isomorphic-dompurify')` succeeds on Node 25 and throws
// ERR_REQUIRE_ESM with the flag). The flag pins the check to the stricter
// semantics, so the verdict does not depend on whoever's Node runs it.
//
// Coverage note: transitive breakage is caught because the externals list is
// matched against the INSTALLED tree, not against `dependencies`. jsdom arrived
// as a transitive dep of `isomorphic-dompurify` and is what gets flagged.
//
// Usage:
//   npm run lint:server-require-esm
// Self-test:
//   npm run test:lint:server-require-esm
// Full runtime proof (needs a build + env):
//   npm run repro:on-demand-render

import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

/** Node flag that removes `require(esm)` support, matching the function runtime. */
export const STRICT_CJS_FLAG = '--no-experimental-require-module';

/** Next's built-in externals list, shipped as JSONC — `//` comments AND a trailing comma. */
export function nextDefaultExternals(repoRoot) {
  const file = path.join(
    repoRoot,
    'node_modules/next/dist/lib/server-external-packages.jsonc'
  );
  if (!fs.existsSync(file)) return null;
  const jsonc = fs.readFileSync(file, 'utf8');
  return JSON.parse(
    jsonc
      .replace(/^\s*\/\/.*$/gm, '') // line comments
      .replace(/,(\s*[\]}])/g, '$1') // trailing comma before the closing bracket
  );
}

/**
 * `serverExternalPackages` as RESOLVED by next.config.mjs — not as written in it.
 * Plugins contribute entries (Sentry adds its instrumented packages), so reading
 * the source text would undercount.
 */
export async function configuredExternals(repoRoot) {
  const configPath = path.join(repoRoot, 'next.config.mjs');
  if (!fs.existsSync(configPath)) return [];
  const mod = await import(url.pathToFileURL(configPath).href);
  return mod.default?.serverExternalPackages ?? [];
}

/** Externals that are actually present in the installed tree. */
export function installedExternals(repoRoot, externalNames) {
  const require_ = createRequire(path.join(repoRoot, 'noop.js'));
  return externalNames.filter((name) => {
    try {
      require_.resolve(`${name}/package.json`);
      return true;
    } catch {
      // Some packages do not export ./package.json; fall back to the directory.
      return fs.existsSync(path.join(repoRoot, 'node_modules', name, 'package.json'));
    }
  });
}

/**
 * Attempts a strict CJS `require()` of `spec` in a child process.
 * Returns `null` when it loads, or the offending chain when Node refuses it as
 * ESM. Any other failure (no CJS entry, side-effectful module) is deliberately
 * NOT a finding — this gate answers one question.
 *
 * The `from` check is what separates the two ways ERR_REQUIRE_ESM shows up:
 *
 *   - the requirer is a file INSIDE node_modules → a CJS package requiring an
 *     ESM-only one. This is #809, and it breaks the function.
 *   - the requirer is this probe's own `[eval]` → the package is simply ESM-only
 *     and the app `import`s it, which is correct and works. `next-mdx-remote` is
 *     externalized, ESM-only, and fine; flagging it would be a false positive.
 */
export function probeRequire(spec, repoRoot) {
  try {
    execFileSync(process.execPath, [STRICT_CJS_FLAG, '-e', `require(${JSON.stringify(spec)})`], {
      cwd: repoRoot,
      stdio: 'pipe',
      timeout: 60_000,
    });
    return null;
  } catch (error) {
    const stderr = String(error.stderr ?? error.message ?? '');
    if (!stderr.includes('ERR_REQUIRE_ESM')) return null;

    const from = stderr.match(/from\s+(\S+)\s+not supported/)?.[1];
    if (!from || !from.includes('node_modules')) return null;

    return {
      spec,
      esmFile: stderr.match(/require\(\) of ES Module\s+(\S+)/)?.[1],
      from,
    };
  }
}

export function findRequireEsmFailures(repoRoot, externalNames) {
  return installedExternals(repoRoot, externalNames)
    .map((spec) => probeRequire(spec, repoRoot))
    .filter(Boolean);
}

async function main() {
  const repoRoot = process.cwd();

  const defaults = nextDefaultExternals(repoRoot);
  if (defaults === null) {
    console.error(
      "✗ Could not read Next's server-external-packages.jsonc.\n" +
        '  Next moved or renamed it, so this gate can no longer tell which packages are\n' +
        '  externalized. Failing rather than passing on an empty list.'
    );
    process.exit(1);
  }

  let configured;
  try {
    configured = await configuredExternals(repoRoot);
  } catch (error) {
    console.error(
      `✗ Could not load next.config.mjs to read serverExternalPackages: ${error.message}\n` +
        '  Failing rather than checking a partial externals list.'
    );
    process.exit(1);
  }

  const externalNames = [...new Set([...defaults, ...configured])];
  const installed = installedExternals(repoRoot, externalNames);

  // An empty candidate set would make every assertion below pass vacuously —
  // the failure mode that makes a gate worthless.
  if (externalNames.length === 0) {
    console.error('✗ Externals list resolved to zero packages — not the shape this expects.');
    process.exit(1);
  }

  const failures = installed.map((spec) => probeRequire(spec, repoRoot)).filter(Boolean);

  if (failures.length > 0) {
    console.error(
      `✗ ${failures.length} externalized package(s) cannot be require()d under the ` +
        'Netlify function runtime:\n'
    );
    for (const { spec, esmFile, from } of failures) {
      console.error(`  ${spec}`);
      if (esmFile) console.error(`    ESM module:  ${esmFile}`);
      if (from) console.error(`    required by: ${from}`);
    }
    console.error(
      '\nPages that render on demand will return 500 (brikdesigns#809) — the build and a\n' +
        'fresh deploy will both look fine. Either drop the dependency, or replace it with\n' +
        'one whose tree has no ESM-only CJS require.'
    );
    process.exit(1);
  }

  console.log(
    `✓ All ${installed.length} externalized package(s) require() cleanly under strict CJS ` +
      `(${externalNames.length} candidates checked against the installed tree).`
  );
}

if (process.argv[1] === url.fileURLToPath(import.meta.url)) await main();
