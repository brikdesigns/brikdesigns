#!/usr/bin/env bash
# Preflight-refusal contract for pr-task.sh — brik-llm#3031 (under #2943, #2930).
#
# pr-task.sh is an entrypoint, and entrypoints stay copied (ADR-028 §7): measured
# across the four gated copies it forks ~400 changed lines apart — base branch
# (main vs staging), the quality gate it runs (shellcheck / Storybook / typecheck),
# its post-merge suite, its accepted flags, and even whether it refreshes an open
# PR all differ. So the SCRIPT cannot be a byte-identical twin; this TEST is, the
# same resolution #2963 reached for new-task.sh (test-new-task-headless.sh).
#
# What every copy DOES share is a preflight-refusal contract — two guards that
# fire before any network or PR mutation and are byte-identical when DRIVEN:
#
#   1. An unknown flag is rejected: `Unknown flag: <flag>` + exit 1. Fires in
#      arg-parse before any git command, so it is hermetic — no repo state.
#      (brik-llm:83, brik-bds:91, brikdesigns:66, brik-client-portal:92)
#
#   2. A PR is never opened from the trunk: on a `main` checkout every copy exits
#      non-zero with `Cannot create PR from 'main'`. The two client-flow copies
#      interpolate `$BRANCH` where the two main-flow copies hardcode `'main'`, so
#      the SOURCE differs but the OBSERVABLE output on a main checkout is identical
#      — which is exactly why this is driven, not grepped.
#      (brik-llm:96-99, brik-bds:104-107, brikdesigns:79-82, brik-client-portal:105-108)
#
# The richer, incident-dense logic (the `Repro:` line, `Closes #N` reaching the
# body, the base-sync suite gate, label parity, the open-PR refresh) is NOT a twin
# candidate: each is either missing from at least one copy or only observable by
# actually opening a PR, and brik-llm's copy is already pinned against it by the
# per-repo suite in pr-task-contract.yml. This asserts the shared floor instead.
#
# No network: a throwaway repo, fake `gh` on PATH. Both guards exit before any gh
# call, so the fake is defensive only. The GIT_* unset is per brik-bds#1539 — a
# test invoked from a git hook inherits GIT_DIR, which is how a sibling test once
# rewrote refs in the live repo.
#
# Run: bash scripts/test/test-pr-task-preflight-contract.sh

set -u
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_COMMON_DIR GIT_NAMESPACE \
      GIT_OBJECT_DIRECTORY GIT_ALTERNATE_OBJECT_DIRECTORIES

SCRIPTS="$(cd "$(dirname "$0")/.." && pwd)"
[ -f "$SCRIPTS/pr-task.sh" ] || { echo "pr-task.sh not found under $SCRIPTS"; exit 1; }
# shellcheck source=/dev/null
source "$SCRIPTS/lib/identity-guard.sh"

PROBE_FLAG='--brik-preflight-contract-probe'   # a flag no copy defines

PASS=0; FAIL=0; FAILED_CASES=()
assert_refusal() {
  local label="$1" want="$2" out="$3" rc="$4"
  if [ "$rc" -ne 0 ] && printf '%s' "$out" | grep -qF "$want"; then
    PASS=$((PASS+1)); echo "  ✓ $label"
  else
    FAIL=$((FAIL+1)); FAILED_CASES+=("$label")
    echo "  ✗ $label"
    echo "      want: exit≠0 and output containing [$want]"
    echo "      got:  exit $rc, output:"
    printf '%s\n' "$out" | sed 's/^/        /'
  fi
}

TMPROOT="$(mktemp -d "${TMPDIR:-/tmp}/brik-pr-task-preflight-XXXXXXXX")"
trap 'rm -rf "$TMPROOT"' EXIT
case "$TMPROOT" in
  /*/brik-pr-task-preflight-*) : ;;
  *) echo "refusing to run: TMPROOT looks wrong ($TMPROOT)"; exit 1 ;;
esac

# ── Fake gh: never reached by either guard, present so a lib sourced at the top
# can never make a live call. Every guard under test exits before gh runs.
mkdir -p "$TMPROOT/bin"
printf '#!/usr/bin/env bash\nexit 0\n' > "$TMPROOT/bin/gh"
chmod +x "$TMPROOT/bin/gh"

# ── Fixture: a throwaway repo on `main`, the copy and every lib it sources copied
# in. One commit so HEAD resolves; no origin, because neither guard fetches. `main`
# is the branch every copy refuses regardless of its base (client copies block
# main AND staging; main-flow copies block main), so the fixture is base-agnostic.
build_fixture() {
  local root="$1" script="$2"
  local primary="$root/repo"
  rm -rf "$root"; mkdir -p "$root"
  git init -q -b main "$primary"
  assert_throwaway_repo "$primary" "pr-task-preflight fixture"
  (
    cd "$primary" || exit 1
    git config user.email t@example.com; git config user.name Test
    git config commit.gpgsign false
    mkdir -p scripts/lib
    cp "$script" scripts/pr-task.sh
    cp "$SCRIPTS"/lib/*.sh scripts/lib/ 2>/dev/null || true
    chmod +x scripts/pr-task.sh
    git add -A; git commit -qm init
  )
  echo "$primary"
}

# Drive the copy from the fixture. stdin closed = the agent-session condition.
drive() {
  local primary="$1"; shift
  ( cd "$primary" && PATH="$TMPROOT/bin:$PATH" ./scripts/pr-task.sh "$@" 2>&1 </dev/null )
}

echo "── the copy refuses an unknown flag, and refuses to PR from main ──"
PRIMARY="$(build_fixture "$TMPROOT/live" "$SCRIPTS/pr-task.sh")"

OUT="$(drive "$PRIMARY" "$PROBE_FLAG")"; RC=$?
assert_refusal "unknown flag rejected before any git command" "Unknown flag: $PROBE_FLAG" "$OUT" "$RC"

OUT="$(drive "$PRIMARY")"; RC=$?
assert_refusal "no PR is opened from a main checkout" "Cannot create PR from 'main'" "$OUT" "$RC"

echo "── negative control: the harness can SEE a script that does NOT refuse ──"
# A stub with neither guard. If assert_refusal passed this, it is matching on
# something other than the refusal and both cases above are worthless.
CTRL="$TMPROOT/ctrl.sh"
printf '#!/usr/bin/env bash\necho "opened a PR"\nexit 0\n' > "$CTRL"; chmod +x "$CTRL"
"$CTRL" "$PROBE_FLAG" >/dev/null 2>&1 </dev/null; CTRL_RC=$?
if [ "$CTRL_RC" -eq 0 ]; then
  PASS=$((PASS+1)); echo "  ✓ non-refusing stub is seen as non-refusing (rc 0)"
else
  FAIL=$((FAIL+1)); FAILED_CASES+=("negative control")
  echo "  ✗ non-refusing stub exited $CTRL_RC — the harness is blind"
fi

echo ""
echo "  $PASS passed, $FAIL failed"
if [ "$FAIL" -gt 0 ]; then
  printf '  failed: %s\n' "${FAILED_CASES[@]}"
  exit 1
fi
