#!/usr/bin/env bash
# Headless-safety contract for new-task.sh — brik-llm#2963 (from #2812).
#
# This is the ONE part of new-task.sh's behaviour that is identical across every
# repo that carries the file, so it is the only part that can be a byte-identical
# twin. The rest of the script is a legitimate per-repo fork — base branch, which
# gate libs it sources, which gates fire, and even its user-facing strings and
# whether it records the issue on the branch all differ (measured #2963). The
# whole-file / block / idiom convergence those differences would need is ruled
# out by ADR-028 §7: new-task.sh is an entrypoint, and entrypoints stay copied.
#
# What every copy DOES share: a prompt it must not block or abort on when stdin
# is closed or NEW_TASK_YES=1. `read` returns 1 on EOF, the script runs under
# `set -euo pipefail`, so a bare `read -r` there kills the script before the
# worktree exists — the #2812 defect that reached tncld and treehouse because
# nothing gated their copies (tncld#161, treehouse#133). brik-llm's own copy is
# guarded by test-new-task-confirm.sh, but that test asserts brik-llm's
# _io_confirm IDIOM (both call-sites, the sourced lib) and so cannot be a twin:
# brik-bds satisfies the same contract with its own confirm() and no _io_confirm
# at all. This test asserts the BEHAVIOUR instead — the copy is driven headless
# to a prompt and must proceed past it — so it holds whatever mechanism the copy
# uses.
#
# The universal prompt is the branch-name-reuse warning ("was used in previous
# PRs"): it is the single confirm site present in all four gated copies, it fires
# before any network gate, and a fake `gh` can make it fire deterministically.
#
# No network: a throwaway repo, fake `gh`/`npm`/`op` on PATH. The GIT_* unset is
# per brik-bds#1539 — a test invoked from a git hook inherits GIT_DIR, which is
# how a sibling test once rewrote refs in the live repo.
#
# Run: bash scripts/test/test-new-task-headless.sh

set -u
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_COMMON_DIR GIT_NAMESPACE \
      GIT_OBJECT_DIRECTORY GIT_ALTERNATE_OBJECT_DIRECTORIES

SCRIPTS="$(cd "$(dirname "$0")/.." && pwd)"
[ -f "$SCRIPTS/new-task.sh" ] || { echo "new-task.sh not found under $SCRIPTS"; exit 1; }
# shellcheck source=/dev/null
source "$SCRIPTS/lib/identity-guard.sh"

REUSE_WARNING='was used in previous PRs'   # the universal confirm site (#2963)

PASS=0; FAIL=0; FAILED_CASES=()
assert_eq() {
  local label="$1" want="$2" got="$3"
  if [ "$want" = "$got" ]; then PASS=$((PASS+1)); echo "  ✓ $label";
  else FAIL=$((FAIL+1)); FAILED_CASES+=("$label"); echo "  ✗ $label"; echo "      want: [$want]"; echo "      got:  [$got]"; fi
}

TMPROOT="$(mktemp -d "${TMPDIR:-/tmp}/brik-new-task-headless-XXXXXXXX")"
trap 'rm -rf "$TMPROOT"' EXIT
case "$TMPROOT" in
  /*/brik-new-task-headless-*) : ;;
  *) echo "refusing to run: TMPROOT looks wrong ($TMPROOT)"; exit 1 ;;
esac

# ── Stubs: no network ──
# `gh pr list --head <branch>` returns a prior PR, so the branch-reuse confirm
# fires. Every OTHER gh call returns a clean, non-blocking answer, so all gates
# PASS and the run reaches worktree creation past the prompt. Passing the gate
# (rather than failing it) is what makes this ordering-agnostic: brik-bds runs
# its ticket gate BEFORE the branch-reuse prompt (nt:252 vs :373), the reverse of
# the other three, so a failing gate would exit brik-bds before the prompt is
# ever exercised (measured #2963). The confirm mechanism itself differs per copy
# — _io_confirm vs brik-bds's own confirm() — which is exactly why this is driven
# behaviourally rather than asserted as an idiom.
mkdir -p "$TMPROOT/bin"
cat > "$TMPROOT/bin/gh" <<'FAKE'
#!/usr/bin/env bash
case "$*" in
  *"pr list"*"--head"*)  echo "#123 (MERGED)"; exit 0 ;;  # trigger branch-reuse confirm
  *"pr list"*)           exit 0 ;;                        # no live/merged branches
  *"issue list"*)        exit 0 ;;                        # no open issues to overlap
  *graphql*)             echo '{"data":{}}'; exit 0 ;;    # no timeline overlap
  *"search/issues"*)     echo '{"items":[]}'; exit 0 ;;   # no same-number issues
  *"/comments"*)         echo '[]'; exit 0 ;;             # no claim, no comments
  *"/pulls"*)            echo '[]'; exit 0 ;;             # no open PR head
  *issues/*)             echo '{"number":4242,"state":"open","title":"probe","labels":[]}'; exit 0 ;;
  *)                     exit 0 ;;
esac
FAKE
printf '#!/usr/bin/env bash\nexit 0\n' > "$TMPROOT/bin/npm"
printf '#!/usr/bin/env bash\nexit 0\n' > "$TMPROOT/bin/op"
chmod +x "$TMPROOT/bin"/*

# ── Fixture: a clean primary repo on `main` with an origin it can fetch ──
build_repo() {
  local root="$1" script="$2"
  local remote="$root/remote.git" primary="$root/repo"
  rm -rf "$root"; mkdir -p "$root"
  git init -q --bare "$remote"
  # Guard each fixture repo before the first write reaches it (#1841). `cd ""` is
  # a no-op, so an empty $primary would land the identity writes in the live repo.
  assert_throwaway_repo "$remote" "new-task-headless fixture origin"
  git -C "$remote" symbolic-ref HEAD refs/heads/main
  git init -q -b main "$primary"
  assert_throwaway_repo "$primary" "new-task-headless fixture primary"
  (
    cd "$primary" || exit 1
    git config user.email t@example.com; git config user.name Test
    git config commit.gpgsign false
    mkdir -p scripts/lib
    cp "$script" scripts/new-task.sh
    cp "$SCRIPTS"/lib/*.sh scripts/lib/ 2>/dev/null || true
    chmod +x scripts/new-task.sh
    git add -A; git commit -qm init
    git remote add origin "$remote"
    git push -q origin main
    git fetch -q origin
  )
  echo "$primary"
}

# `timeout` is defensive only: our stdin is always closed, so the #2812 bug
# manifests as an ABORT (read's EOF rc under `set -e`), which terminates on its
# own — a true infinite hang needs a real TTY, which no CI runner and no fixture
# here provides. Use it when present (GNU on Linux CI, gtimeout via coreutils on
# macOS) and run bare otherwise, so the test is portable to a dev laptop.
if command -v timeout >/dev/null 2>&1; then _TIMEOUT=(timeout 30)
elif command -v gtimeout >/dev/null 2>&1; then _TIMEOUT=(gtimeout 30)
else _TIMEOUT=(); fi

# Drive the copy headless through the branch-reuse prompt to worktree creation.
#   --issue owner/repo#N : the qualified form resolves against the fake gh rather
#                          than the fixture's local-path origin; a plain number
#                          cannot derive owner/repo from a file:// remote.
#   --base main          : brikdesigns defaults to staging, which the fixture has
#                          no branch for; every copy honours --base.
# The budget gate is disarmed by UNSETTING CLAUDE_CODE_SESSION_ID, not by passing
# `--over-budget`. With no ledger key the gate skips itself and returns 0
# (session-budget.sh:258), so the effect is the same — but the flag is not
# universal. It exists in brik-llm and the three originally-gated copies and in
# none of the client-site copies, every one of which exits 1 on an unknown flag.
# Passing it made tncld fail this case for a driver reason and be written up as a
# contract failure it does not have (brik-llm#3055). Keep the driver's flag set to
# what all seven copies honour; anything else measures the harness, not the copy.
# NEW_TASK_YES=1 AND closed stdin are both set because the #2812 defect is the
# interaction of read's EOF rc with `set -e`, and an agent session sets the var.
run_headless() {
  local primary="$1" env_prefix="$2" slug="$3"
  # shellcheck disable=SC2086  # env_prefix is space-separated VAR=val assignments — split is intended
  ( cd "$primary" && PATH="$TMPROOT/bin:$PATH" \
      env -u CLAUDE_CODE_SESSION_ID $env_prefix ${_TIMEOUT[@]+"${_TIMEOUT[@]}"} \
      ./scripts/new-task.sh "$slug" --issue brikdesigns/throwaway#4242 --base main 2>&1 </dev/null )
}

# The tell that the prompt was PASSED, not merely reached: the worktree the whole
# script exists to create, which is only reached AFTER every prompt. If a confirm
# blocked (rc 124 under timeout) or aborted on closed stdin (a bare `read` under
# `set -e`), the run dies before it and the dir is absent. `made` is checked with
# a `*-worktrees` glob because the base dir name is per-repo (brik-bds-worktrees,
# brikdesigns-worktrees, ...). String-agnostic on purpose — post-prompt wording
# and even prompt ORDER differ per copy (#2963).
proceeded_past_prompt() {
  local primary="$1" slug="$2" out
  out="$(run_headless "$primary" "NEW_TASK_YES=1" "$slug")"
  local reached=no; case "$out" in *"$REUSE_WARNING"*) reached=yes ;; esac
  local made=no; ls -d "$primary"/../*-worktrees/"$slug" >/dev/null 2>&1 && made=yes
  echo "reached=$reached made=$made"
}

echo "── the branch-reuse prompt is reached and passed headless ──"
PRIMARY="$(build_repo "$TMPROOT/live" "$SCRIPTS/new-task.sh")"
RESULT="$(proceeded_past_prompt "$PRIMARY" ops-headless-probe)"
assert_eq "confirm exercised + proceeded past it to worktree creation" "reached=yes made=yes" "$RESULT"

echo "── negative control: the harness can SEE a bare-read prompt die on closed stdin ──"
# Not a mutation of the copy (its confirm mechanism varies) — a minimal script
# with the #2812 shape, proving closed stdin + set -e is actually being exercised.
# If this ever prints SURVIVED, the test is blind and the case above is worthless.
CONTROL_OUT="$( set +e; env NEW_TASK_YES=1 bash -c '
  set -euo pipefail
  echo "'"$REUSE_WARNING"'"
  read -r          # the bug: no || true, no NEW_TASK_YES/TTY guard
  echo SURVIVED
' </dev/null 2>&1 )"
case "$CONTROL_OUT" in
  *SURVIVED*) assert_eq "bare-read control dies before SURVIVED" "died" "survived" ;;
  *)          assert_eq "bare-read control dies before SURVIVED" "died" "died" ;;
esac

echo ""
echo "  $PASS passed, $FAIL failed"
if [ "$FAIL" -gt 0 ]; then
  printf '  failed: %s\n' "${FAILED_CASES[@]}"
  exit 1
fi
