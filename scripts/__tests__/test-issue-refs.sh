#!/usr/bin/env bash
# Locks the closing-keyword resolution rule in lib/issue-refs.sh (#3557).
#
# The bug this pins: the body scan used to match a keyword ANYWHERE in a line,
# so it could not tell a directive from a quotation. #3550's body said "does not
# close #2942" and GitHub closed the issue; #3556 — the PR documenting that —
# quoted the phrase and the resolver emitted `Closes #2942` while demoting the
# issue the PR actually completed to `Refs`. The fix anchors the keyword to the
# start of its line.
#
# The negative controls are the point. A test that only asserts "the trailer
# closes #N" passes against the PRE-FIX script too, because the pre-fix regex
# also matched a line-leading keyword. The cases that discriminate are the ones
# asserting a mid-sentence keyword does NOT close.
#
# Hermetic: a throwaway git repo per case, no network, no `gh`. The unset is per
# brik-bds#1539 — a test invoked from a git hook inherits GIT_DIR, and that is
# how a sibling test once rewrote refs in the live repo.
#
# Run: bash scripts/__tests__/test-issue-refs.sh

set -u
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_COMMON_DIR GIT_NAMESPACE \
      GIT_OBJECT_DIRECTORY GIT_ALTERNATE_OBJECT_DIRECTORIES

SCRIPTS="$(cd "$(dirname "$0")/.." && pwd)"
[ -f "$SCRIPTS/lib/issue-refs.sh" ] || { echo "lib/issue-refs.sh not found under $SCRIPTS"; exit 1; }
# shellcheck source=/dev/null
source "$SCRIPTS/lib/issue-refs.sh"

PASS=0; FAIL=0; FAILED_CASES=()
assert_eq() {
  local label="$1" want="$2" got="$3"
  if [ "$want" = "$got" ]; then PASS=$((PASS+1)); echo "  ✓ $label";
  else FAIL=$((FAIL+1)); FAILED_CASES+=("$label"); echo "  ✗ $label"; echo "      want: [$want]"; echo "      got:  [$got]"; fi
}

# Build a repo with one commit carrying $1 as subject and $2 as body, resolve
# the range, and leave the three globals set. Each case gets a fresh repo so a
# leaked ref from a prior case can't make a later one pass.
resolve_from_commit() {
  local subject="$1" body="$2" tmp
  tmp="$(mktemp -d)"
  (
    cd "$tmp" || exit 1
    git init -q -b main .
    git config user.email t@example.com
    git config user.name Test
    git commit -q --allow-empty -m "base"
    git branch -q -f base HEAD
    git commit -q --allow-empty -m "$subject" -m "$body"
  ) || { echo "repo setup failed"; exit 1; }
  # Resolve in this shell (globals must survive) but against the temp repo.
  local prev="$PWD"
  cd "$tmp" || exit 1
  resolve_issue_refs "base..HEAD"
  cd "$prev" || exit 1
  rm -rf "$tmp"
}

norm() { printf '%s' "$1" | tr '\n' ' ' | sed 's/  */ /g; s/^ //; s/ $//'; }

echo "── The #3557 regressions: a quoted keyword is NOT a directive ──"

# The #3550 shape: negation. GitHub ignores "not"; so must the resolver, by
# never treating a mid-sentence keyword as a directive in the first place.
resolve_from_commit "docs(x): explain the trap (#3553)" \
  'This does **not** close #2942.'
assert_eq "negated mid-line keyword does not close" "" "$(norm "$ISSUE_CLOSING_REFS")"
assert_eq "  ...and the subject ref is still a mention" "#3553" "$(norm "$ISSUE_MENTION_REFS")"

# The #3556 shape: the keyword is quoted in order to be explained, and the real
# issue is in the subject. Pre-fix this returned Closes=#2942, Refs=#3553.
resolve_from_commit "docs(infra): correct the premise (#3553)" \
  'A body sentence reading "does not close #2942" was parsed as a directive.'
assert_eq "quoted keyword does not close" "" "$(norm "$ISSUE_CLOSING_REFS")"
assert_eq "  ...subject issue is not demoted away" "#3553" "$(norm "$ISSUE_MENTION_REFS")"

resolve_from_commit "fix(x): thing (#100)" 'See also: closes #200 for context.'
assert_eq "keyword after a prose lead-in does not close" "" "$(norm "$ISSUE_CLOSING_REFS")"

echo "── The behaviour that must NOT regress: real trailers still close ──"

resolve_from_commit "feat(x): thing (#100)" 'Closes #100'
assert_eq "line-leading trailer closes" "#100" "$(norm "$ISSUE_CLOSING_REFS")"
assert_eq "  ...and is not also a mention" "" "$(norm "$ISSUE_MENTION_REFS")"

resolve_from_commit "feat(x): thing (#100)" 'Fixes #101
Resolved #102'
assert_eq "every keyword variant on its own line closes" "#101 #102" "$(norm "$ISSUE_CLOSING_REFS")"

resolve_from_commit "feat(x): thing (#100)" '  Closes #103'
assert_eq "an indented trailer still closes" "#103" "$(norm "$ISSUE_CLOSING_REFS")"

resolve_from_commit "feat(x): thing (#100)" 'closes #104'
assert_eq "lowercase trailer closes (keyword match is case-insensitive)" "#104" "$(norm "$ISSUE_CLOSING_REFS")"

echo "── Cross-repo prefixes are carried, never collapsed ──"

# Collapsing the prefix would resolve against THIS repo and close a different
# issue — the brik-llm#1240 class.
resolve_from_commit "feat(x): thing (#100)" 'Closes brikdesigns/brik-llm#2253'
assert_eq "cross-repo trailer keeps its owner/repo prefix" \
  "brikdesigns/brik-llm#2253" "$(norm "$ISSUE_CLOSING_REFS")"

echo "── Subject refs stay mentions, never promoted ──"

resolve_from_commit "feat(x): thing (#100)" 'No trailer here.'
assert_eq "subject-only ref is a mention" "#100" "$(norm "$ISSUE_MENTION_REFS")"
assert_eq "  ...and closes nothing" "" "$(norm "$ISSUE_CLOSING_REFS")"

echo "── Documented non-matches (under-close on purpose, see lib header) ──"

resolve_from_commit "feat(x): thing (#100)" '- Closes #105'
assert_eq "markdown bullet does not close (list marker is not a trailer)" \
  "" "$(norm "$ISSUE_CLOSING_REFS")"

echo
echo "── brikdesigns: an issue cited as EVIDENCE donates nothing (#1201) ──"
# PR #1200's real shape, which is what made this port necessary here. Its
# commit body named #1194 and #1189 as the historical evidence for the fix;
# both are area:design, and the old whole-range scan inherited that onto a
# shell-script-only PR. ISSUE_ALL_REFS is what feeds label inheritance, so the
# assertion is on that, not just on the closing set.
resolve_from_commit \
  'fix(infra): anchor the PR-title range to origin, not a stale local ref (#1198)' \
  'PR #1197 was titled with #1194'"'"'s subject that way. That is worse than the
branch-slug antipattern #1189 replaced, because it reads as correct.'
assert_eq "prose-cited refs are not in the label-inheritance set" \
  "#1198" "$(norm "$ISSUE_ALL_REFS")"
assert_eq "prose-cited refs close nothing" \
  "" "$(norm "$ISSUE_CLOSING_REFS")"

echo
echo "  passed: $PASS   failed: $FAIL"
if [ "$FAIL" -gt 0 ]; then
  printf '  failed cases:\n'; printf '    - %s\n' "${FAILED_CASES[@]}"
  exit 1
fi
exit 0
