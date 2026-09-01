#!/usr/bin/env bash
# Contract gate for the PR title deriver (lib/pr-title.sh).
#
# brikdesigns#1177. The failure this reproduces: pr-task.sh synthesized the PR
# title from the branch SLUG when no title arg was passed, producing the
# antipattern issue-style.md names — 27 of the last 40 merged PRs carried the
# `design: 1169 card media` shape (no type, no imperative, a bare number reading
# as a second issue ID). The deriver replaces that with the first commit
# subject, which is already conventional.
#
# The load-bearing assertions are the ones that would silently reintroduce the
# antipattern:
#
#   1. The branch-slug shape (`design: home content media`) must be rejected as
#      NON-conventional so the caller prompts — its leading token is the SCOPE,
#      not a type. This is the whole point; a structural-only check would accept
#      it (it looks like `token: words`).
#   2. A subject that already carries `(#N)` is passed through unchanged — never
#      double-stamped.
#   3. `(#N)` is sourced from the branch only when the subject lacks one, and
#      appended once, in `(#N)` form — never as a bare digit in the description.
#
# No network, no git, no `gh` — every case drives the pure helpers directly.
# The unset below mirrors test-pr-labels.sh (brik-bds#1539): a test invoked from
# a git hook inherits GIT_DIR, which is how a sibling test once rewrote refs in
# the live repo.
#
# Run: bash scripts/__tests__/test-pr-title.sh

set -u
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_COMMON_DIR GIT_NAMESPACE \
      GIT_OBJECT_DIRECTORY GIT_ALTERNATE_OBJECT_DIRECTORIES

SCRIPTS_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LIB="${SCRIPTS_DIR}/lib/pr-title.sh"
PR_TASK="${SCRIPTS_DIR}/pr-task.sh"
[ -f "$LIB" ] || { echo "lib not found at $LIB"; exit 1; }
# shellcheck source=/dev/null
source "$LIB"

PASS=0; FAIL=0; FAILED_CASES=()

assert_eq() {
  local label="$1" want="$2" got="$3"
  if [ "$want" = "$got" ]; then PASS=$((PASS+1)); echo "  ✓ $label";
  else FAIL=$((FAIL+1)); FAILED_CASES+=("$label"); echo "  ✗ $label"; echo "      want: [$want]"; echo "      got:  [$got]"; fi
}

assert_true() {
  local label="$1"; shift
  if "$@"; then PASS=$((PASS+1)); echo "  ✓ $label";
  else FAIL=$((FAIL+1)); FAILED_CASES+=("$label"); echo "  ✗ $label (expected true)"; fi
}

assert_false() {
  local label="$1"; shift
  if "$@"; then FAIL=$((FAIL+1)); FAILED_CASES+=("$label"); echo "  ✗ $label (expected false)";
  else PASS=$((PASS+1)); echo "  ✓ $label"; fi
}

echo "── is_conventional_subject — the discriminator (assertion 1)"
assert_true  "feat(scope) passes"          is_conventional_subject 'feat(home): add hero'
assert_true  "fix without scope passes"     is_conventional_subject 'fix: stop the overflow'
assert_true  "breaking ! passes"            is_conventional_subject 'feat!(auth): rotate tokens'
assert_true  "ops is a valid type here"     is_conventional_subject 'ops(infra): freeze the promote'
assert_true  "slash in scope passes"        is_conventional_subject 'feat(how-it-works): band match'
# The antipattern this whole issue exists to kill: leading token is a SCOPE.
assert_false "branch-slug shape is rejected" is_conventional_subject 'design: home content media'
assert_false "bare-number slug is rejected"  is_conventional_subject 'design: 1169 card media'
assert_false "unknown type is rejected"      is_conventional_subject 'wip: something'
assert_false "no colon is rejected"          is_conventional_subject 'feat add a thing'
assert_false "empty is rejected"             is_conventional_subject ''

echo ""
echo "── issue_number_from_branch"
assert_eq "numbered slug yields N" "1177" "$(issue_number_from_branch 'task/infra-1177-pr-title-from-commit')"
assert_eq "refs/heads prefix tolerated" "1171" "$(issue_number_from_branch 'refs/heads/task/design-1171-how-we-work')"
assert_eq "ticketless slug yields nothing" "" "$(issue_number_from_branch 'task/design-how-it-works')"
assert_eq "number must be its own segment" "" "$(issue_number_from_branch 'task/infra-fix2985now')"
assert_eq "non-task branch yields nothing"  "" "$(issue_number_from_branch 'staging')"

echo ""
echo "── pr_title_from_subject — the four required behaviours"
# (a) conventional subject with (#N) passes through unchanged (assertion 2)
assert_eq "subject with (#N) passes through" \
  'feat(marketing): rename How It Works → How We Work (#1171)' \
  "$(pr_title_from_subject 'feat(marketing): rename How It Works → How We Work (#1171)' 'task/design-1171-how-we-work')"
# (b) subject without (#N) gains it from the branch, once, in (#N) form (assertion 3)
assert_eq "subject without (#N) gains it from branch" \
  'fix(infra): derive the title from the commit (#1177)' \
  "$(pr_title_from_subject 'fix(infra): derive the title from the commit' 'task/infra-1177-pr-title-from-commit')"
# (c) subject without (#N) and no branch number is left as-is (not slug-mangled)
assert_eq "no branch number leaves subject as-is" \
  'chore(deps): bump next' \
  "$(pr_title_from_subject 'chore(deps): bump next' 'task/infra-bump-next')"
# (d) non-conventional subject fails so the caller prompts (assertion 1)
assert_false "non-conventional subject returns non-zero" \
  pr_title_from_subject 'design: home content media' 'task/design-1155-home-content-media'
assert_eq "non-conventional subject prints nothing" "" \
  "$(pr_title_from_subject 'design: home content media' 'task/design-1155-home' 2>/dev/null)"

echo ""
echo "── pr-task.sh wiring — the deriver is actually used (not the old slug)"
assert_true  "pr-task.sh sources the deriver" grep -q 'lib/pr-title.sh' "$PR_TASK"
assert_true  "pr-task.sh calls pr_title_from_subject" grep -q 'pr_title_from_subject' "$PR_TASK"
assert_false "the branch-slug SCOPE/DESC synthesis is gone" \
  grep -q 'PR_TITLE="\${SCOPE}: \${DESC}"' "$PR_TASK"

echo ""
if [ "$FAIL" -gt 0 ]; then
  echo "── pr-title: $PASS passed, $FAIL failed"
  for c in "${FAILED_CASES[@]}"; do echo "    ✗ $c"; done
  exit 1
fi
echo "── pr-title: $PASS passed, 0 failed"
