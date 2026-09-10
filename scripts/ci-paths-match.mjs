#!/usr/bin/env node
// ci-paths-match.mjs — decide whether a PR's changed files touch a gate's paths,
// so the gate can be a REQUIRED status check (brikdesigns#1334).
//
// Why this exists, and why the obvious alternative does not work.
//
// Nothing was a required status check on `staging`, so PR #1320 merged with its
// own `mockup` gate red and stranded every PR in the repo for ~100 minutes. The
// fix is to require the gates — but four of them (`verify`, `axe`, `mockup`,
// `regression`) filtered themselves with a workflow-level `on.<event>.paths`,
// and GitHub is explicit about what that combination does:
//
//   "If a workflow is skipped due to path filtering, branch filtering or a
//    commit message, then checks associated with that workflow will remain in a
//    'Pending' state. A pull request that requires those checks to be
//    successful will be blocked from merging."
//   — https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax
//      #onpushpull_requestpull_request_targetpathspaths-ignore
//
// So requiring a path-filtered gate deadlocks every PR that does not touch its
// paths. The escape is that a JOB may be skipped where a WORKFLOW may not:
//
//   "Required status checks must have a `successful`, `skipped`, or `neutral`
//    status before collaborators can make changes to a protected branch."
//   — https://docs.github.com/en/repositories/configuring-branches-and-merges-in-
//      your-repository/managing-protected-branches/about-protected-branches
//
// Hence the shape: the workflow always runs, a cheap `changes` job asks this
// script whether the gate applies, and the gate job carries
// `if: needs.changes.outputs.run == 'true'`. A non-applicable gate reports
// `skipped` — grey and honest — instead of green-because-it-did-not-run. That
// distinction is the same one #1317 was filed for: a count that says "complete"
// about work it never did is worse than a count that says nothing.
//
// The path list stays in the workflow, beside the gate it belongs to, so this
// script owns only the matching.
//
// ── Supported pattern syntax (a deliberate subset) ───────────────────────────
//
//   `**`  any characters, including `/`
//   `*`   any characters except `/`
//   `?`   exactly one character except `/`
//   anything else is literal
//
// That is every construct the four gates' path lists actually use. GitHub's
// filter patterns also accept `!`, `+`, `[]` and `{}`; rather than approximate
// them, `compilePattern` REFUSES them. A silently-wrong match here means a gate
// skips a PR it should have gated — the exact failure this ticket exists to
// close — so an unsupported pattern is a loud error, not a best effort.

import assert from 'node:assert/strict';
import url from 'node:url';

// GitHub caps `GET /pulls/{n}/files` at 3000 files regardless of pagination, so
// a larger PR yields a TRUNCATED list. A truncated list cannot prove the absence
// of a match, so at or above the cap this script fails CLOSED and runs the gate.
export const FILE_LIST_CAP = 3000;

const UNSUPPORTED = /[!+[\]{}]/;

// Translate one filter pattern into an anchored RegExp. `**` is consumed before
// `*` so `src/**` does not degrade into "any chars except /".
export function compilePattern(pattern) {
  if (UNSUPPORTED.test(pattern)) {
    throw new Error(
      `ci-paths-match: unsupported metacharacter in pattern '${pattern}'. ` +
        'Supported: ** * ? and literals. Extend this script (and its self-test) ' +
        'before using !, +, [] or {} in a gate path list.',
    );
  }
  let out = '';
  for (let i = 0; i < pattern.length; i += 1) {
    const c = pattern[i];
    if (c === '*') {
      if (pattern[i + 1] === '*') {
        out += '.*';
        i += 1;
      } else {
        out += '[^/]*';
      }
    } else if (c === '?') {
      out += '[^/]';
    } else {
      out += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${out}$`);
}

export function matchesPattern(file, pattern) {
  return compilePattern(pattern).test(file);
}

// Every changed file that matches at least one pattern. Returned rather than a
// bare boolean so the `changes` job can print WHICH file pulled the gate in —
// "why did this run" is the question asked at 2am, and reconstructing it from a
// diff is the cost this avoids.
export function matchedFiles(files, patterns) {
  const compiled = patterns.map((p) => ({ pattern: p, re: compilePattern(p) }));
  const hits = [];
  for (const file of files) {
    const hit = compiled.find(({ re }) => re.test(file));
    if (hit) hits.push({ file, pattern: hit.pattern });
  }
  return hits;
}

// The whole decision, cap included. `truncated` is the caller's signal that the
// file list was capped; `reason` is what gets printed.
export function decide({ files, patterns, cap = FILE_LIST_CAP }) {
  if (files.length >= cap) {
    return {
      run: true,
      truncated: true,
      matches: [],
      reason: `file list hit the ${cap}-file API cap — cannot prove no match, running the gate`,
    };
  }
  const matches = matchedFiles(files, patterns);
  return {
    run: matches.length > 0,
    truncated: false,
    matches,
    reason: matches.length
      ? `${matches.length} of ${files.length} changed file(s) match`
      : `none of ${files.length} changed file(s) match`,
  };
}

export function parseArgs(argv) {
  const patterns = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--pattern') {
      const value = argv[i + 1];
      if (!value) throw new Error('ci-paths-match: --pattern needs a value');
      patterns.push(value);
      i += 1;
    } else {
      throw new Error(`ci-paths-match: unknown argument '${argv[i]}'`);
    }
  }
  if (!patterns.length) throw new Error('ci-paths-match: at least one --pattern is required');
  return { patterns };
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

// CLI: changed files on stdin (one per line), patterns as repeated --pattern.
// Emits `run=true|false` on stdout for >> "$GITHUB_OUTPUT"; everything human
// goes to stderr so the two never mix.
if (process.argv[1] && import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  const { patterns } = parseArgs(process.argv.slice(2));
  const files = (await readStdin())
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const result = decide({ files, patterns });

  process.stderr.write(`▸ ${result.reason}\n`);
  for (const { file, pattern } of result.matches.slice(0, 20)) {
    process.stderr.write(`    ${file}  ←  ${pattern}\n`);
  }
  if (result.matches.length > 20) {
    process.stderr.write(`    … and ${result.matches.length - 20} more\n`);
  }
  process.stderr.write(result.run ? '✓ gate applies — running\n' : '⊘ gate does not apply — skipping\n');

  assert.ok(typeof result.run === 'boolean');
  process.stdout.write(`run=${result.run}\n`);
}
