#!/usr/bin/env bash
# Contract gate for the design-source declaration helpers
# (lib/design-declaration.sh), brikdesigns#1351.
#
# The failure this reproduces: pr-task.sh emitted no `Design:` body line, no
# `Design-exempt:` line and no `design:none` label, so every PR labelled
# `area:design` or `class:ia` red the verify job's design-source gate on its
# first run — 7 of the 96 CI failures in the 14 days to 2026-09-10, and none
# older than the gate itself.
#
# The load-bearing assertions are the ones that fail SILENTLY:
#
#   1. design_gate_applies mirrors the WORKFLOW's `if:` exactly. If it drifts
#      narrow, pr-task.sh stops asking on PRs the gate still fires on and the
#      first-run red comes straight back. If it drifts wide (a substring match
#      on `area:design-system`), it demands a design source from work that has
#      none — which trains the reflexive --design-exempt this gate exists to
#      prevent.
#   2. The emitted lines match the gate's own regex, `^[[:space:]]*Design:`
#      / `^[[:space:]]*Design-exempt:`. A line that looks declared and does not
#      match waives nothing, and the author only finds out at CI.
#   3. An empty / whitespace-only source fails LOUD (rc 1) rather than emitting
#      a bare `Design:` with nothing after the colon — which the gate's `\S`
#      would reject after the PR was already open.
#
# Case 4 drives the real pr-task.sh, because both halves of the #1351 defect
# were invisible to a grep: the refusal has to be OBSERVED. Hermetic — throwaway
# repo, bare local remote, fake `gh` on PATH.
#
# Run: bash scripts/__tests__/test-design-declaration.sh

set -u
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_COMMON_DIR GIT_NAMESPACE \
      GIT_OBJECT_DIRECTORY GIT_ALTERNATE_OBJECT_DIRECTORIES

SCRIPTS_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "${SCRIPTS_DIR}/.." && pwd)"
LIB="${SCRIPTS_DIR}/lib/design-declaration.sh"
[ -f "$LIB" ] || { echo "lib not found at $LIB"; exit 1; }
# shellcheck source=/dev/null
source "$LIB"

PASS=0; FAIL=0; FAILED_CASES=()

assert_eq() {
  local desc="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then PASS=$((PASS+1)); else
    FAIL=$((FAIL+1)); FAILED_CASES+=("$desc"$'\n'"    expected: [$expected]"$'\n'"    actual:   [$actual]")
  fi
}
assert_rc() {
  local desc="$1" expected="$2" actual="$3"
  if [ "$expected" -eq "$actual" ]; then PASS=$((PASS+1)); else
    FAIL=$((FAIL+1)); FAILED_CASES+=("$desc — expected rc $expected, got $actual")
  fi
}
assert_true()  { if "$@" >/dev/null 2>&1; then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); FAILED_CASES+=("expected TRUE: $*"); fi; }
assert_false() { if "$@" >/dev/null 2>&1; then FAIL=$((FAIL+1)); FAILED_CASES+=("expected FALSE: $*"); else PASS=$((PASS+1)); fi; }

# ── 1. design_gate_applies mirrors the workflow's `if:` ──
assert_true  design_gate_applies "area:design"
assert_true  design_gate_applies "class:ia"
assert_true  design_gate_applies "$(printf 'area:infra\nsize:s\narea:design\n')"
assert_true  design_gate_applies "$(printf 'size:m\nclass:ia\n')"
assert_false design_gate_applies "area:infra"
assert_false design_gate_applies "$(printf 'area:infra\nsize:s\ntheme:tech-debt\n')"
assert_false design_gate_applies ""

# The `contains()` in the workflow is over the label ARRAY, so a longer label
# that merely starts with a trigger name must not fire. A substring
# implementation passes every other case here and fails only this one.
assert_false design_gate_applies "area:design-system"
assert_false design_gate_applies "class:ia-migration"
assert_false design_gate_applies "meta:area:design"

# The trigger names must be the literal strings in verify.yml's `if:`. If the
# workflow's condition is edited, this fails and forces the helper to follow.
WF="${REPO_ROOT}/.github/workflows/verify.yml"
if [ -f "$WF" ]; then
  for lbl in class:ia area:design; do
    if grep -qF "labels.*.name, '${lbl}'" "$WF"; then PASS=$((PASS+1)); else
      FAIL=$((FAIL+1)); FAILED_CASES+=("verify.yml no longer triggers on '${lbl}' — design_gate_applies has drifted")
    fi
  done
  # …and the gate still greps for the two lines these helpers emit.
  for rx in 'Design:' 'Design-exempt:'; do
    if grep -qF "$rx" "$WF"; then PASS=$((PASS+1)); else
      FAIL=$((FAIL+1)); FAILED_CASES+=("verify.yml no longer reads a '${rx}' line")
    fi
  done
fi

# ── 2. Emitted lines match the gate's regex ──
OUT="$(design_declaration_line 'Figma yhLkzLUnG71UFTgURDvgnv 26103:10991')"; RC=$?
assert_rc "design line rc" 0 "$RC"
assert_eq "design line format" "Design: Figma yhLkzLUnG71UFTgURDvgnv 26103:10991" "$OUT"
printf '%s' "$OUT" | grep -Eq '^[[:space:]]*Design:[[:space:]]*\S'
assert_rc "design line matches the gate's own regex" 0 $?

OUT="$(design_declaration_line '  https://brikdesigns.com/plans  ')"
assert_eq "design line trims surrounding whitespace" "Design: https://brikdesigns.com/plans" "$OUT"

OUT="$(design_exempt_line 'bug fix, no design source')"; RC=$?
assert_rc "exempt line rc" 0 "$RC"
assert_eq "exempt line format" "Design-exempt: bug fix, no design source" "$OUT"
printf '%s' "$OUT" | grep -Eq '^[[:space:]]*Design-exempt:[[:space:]]*\S'
assert_rc "exempt line matches the gate's own regex" 0 $?

# An exempt line must NOT satisfy the primary `Design:` grep — the gate requires
# the design:none label alongside it, and conflating the two would let a
# label-less exemption look declared.
printf '%s' "$(design_exempt_line 'x')" | grep -Eq '^[[:space:]]*Design:[[:space:]]*\S'
assert_rc "exempt line is not read as a Design: line" 1 $?

# ── 3. Empty / whitespace-only fails loud ──
design_declaration_line "" >/dev/null 2>&1;      assert_rc "empty design source rejected" 1 $?
design_declaration_line "   " >/dev/null 2>&1;   assert_rc "whitespace design source rejected" 1 $?
design_exempt_line "" >/dev/null 2>&1;           assert_rc "empty exempt reason rejected" 1 $?
design_exempt_line "  " >/dev/null 2>&1;         assert_rc "whitespace exempt reason rejected" 1 $?
OUT="$(design_declaration_line '' 2>/dev/null)"
assert_eq "rejected source emits nothing" "" "$OUT"

# ── 4. The refusal, DRIVEN ──
# pr-task.sh resolves labels from --area, so `--area area:design` puts the PR in
# the gate's scope without needing a linked issue. SKIP_UI_CHECK=1 and
# --visual-change none clear the two gates that sit ahead of this one, so what
# is being observed is the design declaration and nothing else.
drive_pr_task() {
  local t; t="$(mktemp -d)"
  mkdir -p "$t/fakebin"
  # The fake must answer `gh label list` — pr-task.sh resolves --area against
  # the repo's real label set (:432) and refuses an unknown one, so a
  # blanket `exit 0` stub stops the run before the design gate is reached.
  cat > "$t/fakebin/gh" <<'GH'
#!/bin/sh
case "$*" in
  *"label list"*) printf 'area:design\narea:infra\nclass:ia\ndesign:none\nsize:s\nvisual-change\n'; exit 0 ;;
  *) exit 0 ;;
esac
GH
  chmod +x "$t/fakebin/gh"
  git init --bare -q "$t/remote.git"
  git init -q "$t/repo"
  (
    cd "$t/repo" || exit 1
    git config user.email t@t.t; git config user.name T; git config commit.gpgsign false
    mkdir -p src/app scripts/lib
    cp "${SCRIPTS_DIR}/pr-task.sh" scripts/
    cp -R "${SCRIPTS_DIR}/lib/." scripts/lib/
    cp "${SCRIPTS_DIR}/visual-parity.mjs" scripts/
    echo x > README.md
    git add -A && git commit -qm init
    git remote add origin "$t/remote.git"
    git push -q origin HEAD:staging
    git switch -qc task/probe-design
    printf '.a{color:red}\n' > src/app/probe.css
    # Conventional-commit shaped: pr-task.sh derives the PR title from the first
    # subject and refuses without one, which would stop the run at THAT gate.
    git add -A && git commit -qm "fix(probe): restyle a section (#1)"
    unset VISUAL_PARITY_FILE DESIGN_SOURCE DESIGN_EXEMPT
    PATH="$t/fakebin:$PATH" SKIP_UI_CHECK=1 \
      bash scripts/pr-task.sh --area area:design --visual-change none "$@" < /dev/null 2>&1
  )
  local rc=$?
  rm -rf "$t"
  return $rc
}

# 4a. area:design + nothing declared → refuse, and say what to do.
DRIVEN="$(drive_pr_task)"; RC=$?
assert_rc "area:design with no declaration refuses" 1 "$RC"
for want in "no design-source declaration" "--design" "--design-exempt" "area:design"; do
  case "$DRIVEN" in
    *"$want"*) PASS=$((PASS+1));;
    *) FAIL=$((FAIL+1)); FAILED_CASES+=("refusal omits [$want] — got [$DRIVEN]");;
  esac
done
# A raster is explicitly not a source; the refusal has to say so, or the next
# agent declares a screenshot and the gate's purpose is lost (#1303).
case "$DRIVEN" in
  *get_screenshot*) PASS=$((PASS+1));;
  *) FAIL=$((FAIL+1)); FAILED_CASES+=("refusal does not warn that a raster is not a source");;
esac

# 4b. An explicit --design clears it.
DRIVEN="$(drive_pr_task --design 'Figma abc123 1:2')"
case "$DRIVEN" in
  *"no design-source declaration"*)
    FAIL=$((FAIL+1)); FAILED_CASES+=("--design still hit the refusal — got [$DRIVEN]");;
  *) PASS=$((PASS+1));;
esac

# 4c. So does --design-exempt. Without this the fix would block every
# label-inherited bug and infra PR the gate over-fires on.
DRIVEN="$(drive_pr_task --design-exempt 'infra only, no design source')"
case "$DRIVEN" in
  *"no design-source declaration"*)
    FAIL=$((FAIL+1)); FAILED_CASES+=("--design-exempt still hit the refusal — got [$DRIVEN]");;
  *) PASS=$((PASS+1));;
esac

# 4d. A PR OUTSIDE the gate's scope is never asked. A gate that fires on
# everything gets a reflexive answer, which is worse than no gate.
DRIVEN="$(
  t="$(mktemp -d)"; mkdir -p "$t/fakebin"
  # The fake must answer `gh label list` — pr-task.sh resolves --area against
  # the repo's real label set (:432) and refuses an unknown one, so a
  # blanket `exit 0` stub stops the run before the design gate is reached.
  cat > "$t/fakebin/gh" <<'GH'
#!/bin/sh
case "$*" in
  *"label list"*) printf 'area:design\narea:infra\nclass:ia\ndesign:none\nsize:s\nvisual-change\n'; exit 0 ;;
  *) exit 0 ;;
esac
GH
  chmod +x "$t/fakebin/gh"
  git init --bare -q "$t/remote.git"; git init -q "$t/repo"
  (
    cd "$t/repo" || exit 1
    git config user.email t@t.t; git config user.name T; git config commit.gpgsign false
    mkdir -p src/app scripts/lib
    cp "${SCRIPTS_DIR}/pr-task.sh" scripts/
    cp -R "${SCRIPTS_DIR}/lib/." scripts/lib/
    cp "${SCRIPTS_DIR}/visual-parity.mjs" scripts/
    echo x > README.md; git add -A && git commit -qm init
    git remote add origin "$t/remote.git"; git push -q origin HEAD:staging
    git switch -qc task/probe-infra
    printf '.a{color:red}\n' > src/app/probe.css
    git add -A && git commit -qm "fix(probe): restyle a section (#1)"
    unset VISUAL_PARITY_FILE DESIGN_SOURCE DESIGN_EXEMPT
    PATH="$t/fakebin:$PATH" SKIP_UI_CHECK=1 \
      bash scripts/pr-task.sh --area area:infra --visual-change none < /dev/null 2>&1
  )
  rm -rf "$t"
)"
case "$DRIVEN" in
  *"design-source gate applies"*)
    FAIL=$((FAIL+1)); FAILED_CASES+=("area:infra was asked for a design source — got [$DRIVEN]");;
  *) PASS=$((PASS+1));;
esac

echo ""
echo "  design-declaration: ${PASS} passed, ${FAIL} failed"
if [ "$FAIL" -gt 0 ]; then
  printf '\n  ✗ %s\n' "${FAILED_CASES[@]}"
  exit 1
fi
