#!/usr/bin/env node
// Fails CI when a service line has no nav-tint background rule.
//
// The nav adopts a service line's darkest surface on that line's pages
// (brikdesigns#729). MegaNav.tsx derives which lines tint from
// SERVICE_LINE_SEGMENTS — i.e. from the service-token map in src/lib/tokens.ts —
// so a line present there but missing a `.mega-nav--service-{line}` rule in
// MegaNav.css emits a modifier class with no background. The nav renders in the
// default surface, nothing throws, no test fails, and the page looks finished.
//
// That is not hypothetical. #729 scoped all five lines; PR #750 shipped
// `marketing` behind a hardcoded `Set(['marketing'])`, fired `Closes #729`, and
// the other four lines stayed neutral for two weeks with CI green. The remainder
// lived in a PR body, never a ticket. Deriving the set removed the allowlist;
// this gate is what keeps the CSS honest about it (#860).
//
// Why parse CSS text rather than assert on a rendered page: the failure is a
// missing declaration, and a text check catches it at lint time on every PR
// without a browser, a build, or Supabase. The rendered-output half is covered
// by the a11y suite, which already visits /services/brand,
// /services/back-office/* and /plans/back-office-support.
//
// Two directions are checked, because a gate that only checks one drifts too:
//   - every line in the token map HAS a rule        (the #729 gap)
//   - every rule maps to a line in the token map    (a stale rule for a line
//                                                    that canon dropped or
//                                                    renamed — same drift, and
//                                                    dead CSS reads as coverage)
// Each rule must also use its OWN line's `-dark` token: a copy-paste that
// points brand at marketing's surface passes a presence-only check.
//
// Usage:
//   npm run lint:nav-service-tint
// Self-test:
//   npm run test:lint:nav-service-tint

import fs from 'node:fs';
import url from 'node:url';

export const CSS_PATH = 'src/components/layout/MegaNav.css';
export const TOKENS_PATH = 'src/lib/tokens.ts';

/** Service-line keys of the `color.service` map in tokens.ts — the same source
 *  SERVICE_LINE_SEGMENTS derives from, read as text so this stays a plain node
 *  script (tokens.ts is TS, and the gate must not need a transpile step).
 *
 *  Anchored on the `service: {` block and stopped at its closing brace so keys
 *  from the sibling `system:` / `text:` maps can't leak in. */
export function serviceLinesFromTokens(source) {
  const block = source.match(/\n {2}service: \{\n([\s\S]*?)\n {2}\},\n/);
  if (!block) return [];
  return [...block[1].matchAll(/^ {4}'?([a-z-]+)'?: \{$/gm)].map((m) => m[1]);
}

/** `.mega-nav--service-{line}` rules and the token each one's background-color
 *  resolves to. */
export function tintRulesFromCss(source) {
  const rules = new Map();
  for (const m of source.matchAll(
    /\.mega-nav--service-([a-z-]+)\s*\{([^}]*)\}/g
  )) {
    const token = m[2].match(/background-color:\s*var\((--[a-z0-9-]+)\)/)?.[1] ?? null;
    rules.set(m[1], token);
  }
  return rules;
}

function main() {
  for (const p of [CSS_PATH, TOKENS_PATH]) {
    if (!fs.existsSync(p)) {
      console.error(`lint-nav-service-tint: ${p} not found — the nav moved, so this check cannot assert anything.`);
      return 2;
    }
  }

  const lines = serviceLinesFromTokens(fs.readFileSync(TOKENS_PATH, 'utf8'));
  const rules = tintRulesFromCss(fs.readFileSync(CSS_PATH, 'utf8'));

  // A vacuous pass is the one outcome worse than a failure: if either side
  // parses to nothing, the shape changed and the loops below assert nothing.
  if (lines.length === 0) {
    console.error(
      `lint-nav-service-tint: parsed 0 service lines out of ${TOKENS_PATH} — ` +
        `the \`color.service\` map changed shape. Fix this parser before trusting the gate.`
    );
    return 2;
  }
  if (rules.size === 0) {
    console.error(
      `lint-nav-service-tint: parsed 0 \`.mega-nav--service-*\` rules out of ${CSS_PATH} — ` +
        `either the tint was removed (delete this gate too) or the selector was renamed.`
    );
    return 2;
  }

  const problems = [];

  for (const line of lines) {
    const expected = `--surface-service-${line}-dark`;
    if (!rules.has(line)) {
      problems.push(
        `${line}: no \`.mega-nav--service-${line}\` rule in ${CSS_PATH}. ` +
          `MegaNav.tsx will emit the class with no background. Add:\n` +
          `      .mega-nav--service-${line} { background-color: var(${expected}); }`
      );
    } else if (rules.get(line) !== expected) {
      problems.push(
        `${line}: \`.mega-nav--service-${line}\` sets \`${rules.get(line) ?? '(no background-color)'}\`, ` +
          `expected \`${expected}\` — a line must carry its own darkest surface.`
      );
    }
  }

  for (const line of rules.keys()) {
    if (!lines.includes(line)) {
      problems.push(
        `${line}: \`.mega-nav--service-${line}\` has no matching line in ${TOKENS_PATH}'s ` +
          `\`color.service\` map. Either canon dropped/renamed the line (delete the rule) ` +
          `or the selector has a typo (dead CSS reads as coverage).`
      );
    }
  }

  if (problems.length > 0) {
    console.error(`lint-nav-service-tint: ${problems.length} problem(s):`);
    for (const p of problems) console.error(`  ${p}`);
    console.error(
      '\n  The nav tint is derived from the service-token map, so every line ' +
        'needs one background rule using its own `--surface-service-{line}-dark` ' +
        'token. See brikdesigns#860.'
    );
    return 1;
  }

  console.log(
    `lint-nav-service-tint: clean — ${lines.length} service line(s), each with a ` +
      `matching tint rule (${lines.join(', ')})`
  );
  return 0;
}

// Importable for the self-test; only the direct invocation exits.
if (process.argv[1] && import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
