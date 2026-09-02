#!/usr/bin/env bash
# issue-refs.sh — resolve which issues a commit range links, and how.
#
# Extracted from pr-task.sh for brik-client-portal#3557 so the resolution rule
# is testable in isolation (scripts/__tests__/test-issue-refs.sh). pr-task.sh
# sources this and consumes the two arrays; nothing else changed hands.
#
# Two polarities, because the two sources mean different things:
#   - a commit body's closing keyword on its OWN LINE is an explicit
#     "this completes #N"                                          → Closes
#   - a bare #N in a subject is only "this is the work for #N"     → Refs
#
# Promoting a subject ref to `Closes` would auto-close umbrellas and half-done
# issues as a side effect (the failure bump-pr-closing-keyword-guard.yml rules 3
# and 4 exist for).
#
# WHY THE LINE ANCHOR (#3557). The body scan used to match a keyword ANYWHERE in
# a line, which cannot tell a directive from a quotation. Two live failures, one
# session, 2026-08-24:
#
#   1. #3550's body said "This does **not** close #2942". GitHub parsed the
#      `close #2942`, ignored the negation, and closed the issue on merge.
#      (`staging` is this repo's default branch, so keywords are live here.)
#   2. #3556 — the PR that DOCUMENTED failure 1 — quoted that same phrase in its
#      commit body to explain it. This resolver emitted `Closes #2942` and
#      demoted the issue the PR actually completed to `Refs #3553`. Exactly
#      backwards, caught by hand before merge.
#
# Failure 2 is the structural one: any commit that writes ABOUT closing keywords
# — a postmortem, a doc fix, a guard-rail change — is misread by a substring
# scan. Anchoring to line start fixes both, because `Closes #N` canonically
# lives on its own line and prose never starts a line mid-sentence.
#
# DELIBERATELY NOT MATCHED, and the direction of that choice matters:
#   - `- Closes #N` (markdown bullet)   — a list marker is not a trailer
#   - `See also: closes #N` (mid-line)  — the failure class above
# Both under-close rather than over-close. Under-closing is a one-click fix on
# the issue; over-closing silently closed #2942 and nobody noticed for hours.
# If the bullet form turns out to be common in practice, widen it THEN, with the
# evidence — not pre-emptively.
#
# A reference may be CROSS-REPO (`owner/repo#N`). The prefix is CARRIED, never
# stripped: collapsing `brikdesigns/brik-llm#2253` to `#2253` would resolve
# against this repo and close a different issue entirely (the brik-llm#1240
# class that neutralize-closing-keywords.mjs exists for on the submodule track).
# Hit landing brikdesigns/brik-llm#2253.

# shellcheck disable=SC2034  # consumed by the sourcing script
ISSUE_REF_RE='([A-Za-z0-9._-]+/[A-Za-z0-9._-]+)?#[0-9]+'

# Closing keywords GitHub honors, per
# https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue
# (fetched 2026-08-24): close/closes/closed, fix/fixes/fixed,
# resolve/resolves/resolved.
ISSUE_CLOSING_KEYWORDS='close[sd]?|fix(e[sd])?|resolve[sd]?'

# resolve_issue_refs <git-range>
#
# Sets three globals, each a newline-separated list (possibly empty):
#   ISSUE_CLOSING_REFS  — refs a commit body closes via a line-leading keyword
#   ISSUE_MENTION_REFS  — refs seen only in a subject, or in prose
#   ISSUE_ALL_REFS      — the union, for label inheritance
#
# Globals rather than stdout because the caller needs all three and command
# substitution would cost three passes over the same log.
resolve_issue_refs() {
  local range="$1"
  local subject_refs body_refs

  subject_refs=$(git log --format='%s' "$range" | grep -oE "$ISSUE_REF_RE" || true)

  # `^[[:space:]]*` — a trailer may be indented (git log's %b preserves it) but
  # must still OPEN its line. This is the #3557 fix: the anchor is what makes a
  # quoted keyword inert.
  body_refs=$(git log --format='%b' "$range" \
    | grep -oiE "^[[:space:]]*($ISSUE_CLOSING_KEYWORDS):? +$ISSUE_REF_RE" \
    | grep -oE "$ISSUE_REF_RE" || true)

  ISSUE_ALL_REFS=$(printf '%s\n%s\n' "$subject_refs" "$body_refs" \
    | grep -E "^${ISSUE_REF_RE}\$" | sort -u || true)
  ISSUE_CLOSING_REFS=$(printf '%s\n' "$body_refs" \
    | grep -E "^${ISSUE_REF_RE}\$" | sort -u || true)
  ISSUE_MENTION_REFS=$(comm -23 \
    <(printf '%s\n' "$ISSUE_ALL_REFS" | grep -E "^${ISSUE_REF_RE}\$" | sort -u) \
    <(printf '%s\n' "$ISSUE_CLOSING_REFS" | grep -E "^${ISSUE_REF_RE}\$" | sort -u) || true)
}
