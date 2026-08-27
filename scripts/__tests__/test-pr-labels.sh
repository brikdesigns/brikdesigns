#!/usr/bin/env bash
# Contract gate for the PR label resolver (lib/pr-labels.sh).
#
# brikdesigns#1012. The failure this reproduces is the one that let 7 of the
# last 12 merged PRs ship with zero labels: pr-task.sh opened each PR label-less,
# so the work fell off the project board until someone ran `gh pr edit` by hand.
#
# The load-bearing assertions are the ones that fail SILENTLY and cost more than
# the label they were about:
#
#   1. Every label must be existence-checked before it reaches `gh pr edit`.
#      One unknown name aborts the WHOLE call, so an unchecked `bug` (which
#      brikdesigns does not have) would also drop the inherited area:* the
#      pr-label-gate requires — turning a cosmetic miss into a red PR.
#   2. `priority:*` and `meta:*` must NOT be inherited. A PR has no priority of
#      its own, and `meta:agent-discovered` describes how the ISSUE was found.
#      Inheriting them looks harmless and quietly corrupts board filters.
#   3. Refs are extracted with one anchored pattern over a single source (here,
#      the commit range — brikdesigns has no rendered issue-link block, unlike
#      brik-bds/portal). One pattern, one source, so labels and linkage agree.
#
# No network, no git, no `gh` — every case drives the pure helpers directly.
# The unset below is per brik-bds#1539: a test invoked from a git hook inherits
# GIT_DIR, which is how a sibling test once rewrote refs in the live repo.
#
# Run: bash scripts/__tests__/test-pr-labels.sh

set -u
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_COMMON_DIR GIT_NAMESPACE \
      GIT_OBJECT_DIRECTORY GIT_ALTERNATE_OBJECT_DIRECTORIES

SCRIPTS_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LIB="${SCRIPTS_DIR}/lib/pr-labels.sh"
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

# The label set brikdesigns actually has, as of #1012. Deliberately EXCLUDES
# `enhancement` and `bug` — that absence is what assertion 1 above turns on.
BD_LABELS=$'priority:p0-now\npriority:p1-week\npriority:p2-month\npriority:p3-someday\narea:a11y\narea:cms\narea:content\narea:design\narea:infra\narea:security\nsize:xs\nsize:s\nsize:m\nsize:l\ntheme:accessibility\ntheme:agent-ops\ntheme:design-system\ntheme:documentation\ntheme:observability\ntheme:performance\ntheme:security-hardening\ntheme:tech-debt\ntheme:ui-cleanup\nmeta:project\nmeta:agent-discovered'

echo "── type_label_for_title"
assert_eq "feat maps to enhancement" "enhancement" "$(type_label_for_title 'feat(home): add x')"
assert_eq "fix maps to bug"          "bug"         "$(type_label_for_title 'fix(infra): y')"
assert_eq "feat! (breaking) still maps" "enhancement" "$(type_label_for_title 'feat!: z')"
assert_eq "docs maps to nothing"     ""            "$(type_label_for_title 'docs(build-standards): w')"
assert_eq "chore maps to nothing"    ""            "$(type_label_for_title 'chore(deps): bump')"
assert_eq "refactor maps to nothing" ""            "$(type_label_for_title 'refactor(services): v')"
assert_eq "empty title maps to nothing" ""         "$(type_label_for_title '')"

echo ""
echo "── label_known — the existence check that keeps one bad name from"
echo "   dropping every good one (assertion 1)"
assert_true  "area:infra is real in brikdesigns"   label_known "area:infra"  "$BD_LABELS"
assert_false "bug is NOT real in brikdesigns"       label_known "bug"         "$BD_LABELS"
assert_false "enhancement is NOT real in brikdesigns" label_known "enhancement" "$BD_LABELS"
assert_false "a typo'd area is not real"           label_known "area:infr"   "$BD_LABELS"
assert_false "a prefix is not a whole label"       label_known "area:"       "$BD_LABELS"
assert_false "a substring is not a whole label"    label_known "infra"       "$BD_LABELS"

echo ""
echo "── inheritable_labels — the axis policy (assertion 2)"
ISSUE_1012=$'priority:p2-month\narea:infra\nsize:s\nmeta:agent-discovered'
assert_eq "inherits area and size only (no theme on this issue)" \
  $'area:infra\nsize:s' \
  "$(inheritable_labels "$ISSUE_1012")"
assert_eq "inherits area, size AND theme when present" \
  $'area:infra\nsize:s\ntheme:agent-ops' \
  "$(inheritable_labels $'priority:p2-month\narea:infra\nsize:s\ntheme:agent-ops\nmeta:agent-discovered')"
assert_eq "drops priority:*" "" "$(inheritable_labels 'priority:p1-week')"
assert_eq "drops meta:*"     "" "$(inheritable_labels 'meta:agent-discovered')"
assert_eq "drops an unaxed label" "" "$(inheritable_labels 'dependencies')"
assert_eq "empty in, empty out"   "" "$(inheritable_labels '')"
# Anchored, so a label merely CONTAINING an axis name is not inherited.
assert_eq "does not match an axis name mid-string" "" "$(inheritable_labels 'not-area:infra')"

echo ""
echo "── refs_from_commit_range — one anchored pattern over the commit text"
echo "   (assertion 3)"
assert_eq "one ref in a commit subject" "1012" \
  "$(refs_from_commit_range $'fix(infra): apply label parity (#1012)\n')"
assert_eq "refs across subject+body, sorted, deduped" \
  $'42\n1012' \
  "$(refs_from_commit_range $'fix(infra): x (#1012)\nRefs #42\nRefs #1012\n')"
assert_eq "no ref in plain prose yields nothing" "" \
  "$(refs_from_commit_range $'chore: tidy up the readme\n')"
assert_eq "empty text yields nothing" "" "$(refs_from_commit_range '')"

echo ""
echo "── has_area_label — the gate pr-label-gate.yml enforces"
assert_true  "a set with area:* passes"       has_area_label $'bug\narea:infra\nsize:s'
assert_false "a set with no area:* fails"     has_area_label $'size:s\ntheme:agent-ops'
assert_false "an empty set fails"             has_area_label ''
assert_false "a mid-string area does not pass" has_area_label 'not-area:infra'

echo ""
echo "── dedupe_labels — the shape gh pr edit wants"
assert_eq "sorts, dedupes and drops blanks" \
  $'area:infra\nsize:s' \
  "$(dedupe_labels $'size:s\narea:infra\n\nsize:s\n')"
assert_eq "empty in, empty out" "" "$(dedupe_labels '')"

echo ""
echo "── end-to-end: what #1012's own PR should resolve to"
# The full pipeline the pr-task.sh block runs, with the network calls replaced
# by fixtures. `bug` must be filtered out by label_known — if it survives,
# `gh pr edit` aborts and the PR lands with NO labels at all.
resolved=()
tl=$(type_label_for_title 'fix(infra): apply label parity in pr-task.sh (#1012)')
if [ -n "$tl" ] && label_known "$tl" "$BD_LABELS"; then resolved+=("$tl"); fi
for ref in $(refs_from_commit_range $'fix(infra): apply label parity in pr-task.sh (#1012)\n'); do
  [ "$ref" = "1012" ] || continue
  for l in $(inheritable_labels "$ISSUE_1012"); do
    if label_known "$l" "$BD_LABELS"; then resolved+=("$l"); fi
  done
done
assert_eq "resolves area+size and drops the absent Type label" \
  $'area:infra\nsize:s' \
  "$(dedupe_labels "$(printf '%s\n' "${resolved[@]+"${resolved[@]}"}")")"
assert_true "the resolved set satisfies the area gate" \
  has_area_label "$(printf '%s\n' "${resolved[@]+"${resolved[@]}"}")"

echo ""
echo "── contract: pr-task.sh and the gate agree"
PR_TASK="${SCRIPTS_DIR}/pr-task.sh"
GATE="$(cd "$(dirname "$0")/../.." && pwd)/.github/workflows/pr-label-gate.yml"
assert_true "pr-task.sh sources this lib" \
  grep -q 'lib/pr-labels.sh' "$PR_TASK"
assert_true "pr-task.sh gates on has_area_label before pushing" \
  grep -q 'has_area_label' "$PR_TASK"
assert_true "the gate workflow exists" test -f "$GATE"
# Both halves must key on the same prefix. If one ever moved to `area/` or
# `scope:`, the script would open PRs the gate immediately fails.
assert_true "the gate requires the same '^area:' prefix the script resolves" \
  grep -q "grep -q '\^area:'" "$GATE"
# The dependabot stamp must be a label this repo actually has, or the auto-label
# step is a silent no-op and every dependency PR stalls the gate.
DEPENDABOT_LABEL=$(grep -oE '\-\-add-label area:[a-z-]+' "$GATE" | head -1 | awk '{print $2}')
assert_true "the gate's dependabot stamp ('${DEPENDABOT_LABEL}') is a real brikdesigns label" \
  label_known "$DEPENDABOT_LABEL" "$BD_LABELS"

echo ""
if [ "$FAIL" -gt 0 ]; then
  echo "── pr-labels: $PASS passed, $FAIL failed"
  for c in "${FAILED_CASES[@]}"; do echo "    ✗ $c"; done
  exit 1
fi
echo "── pr-labels: $PASS passed, 0 failed"
