#!/usr/bin/env bash
# test-sweep-worktree-classification.sh — pass-1 verdict contract for the worktree sweeper.
#
# sweep-merged-worktrees.sh decided "landed" partly from
# `git merge-base --is-ancestor "$tip" origin/main`. That test is REFLEXIVE, so a
# task branch fresh out of new-task.sh — nothing committed on it yet — reported as
# "merged into main" and was swept, taking the worktree and (with
# --delete-branches) the branch. It destroyed task/anti-slop-scanner-signal twice
# in one session on 2026-07-27 (brik-llm#1616).
#
# Two plausible fixes are both wrong, and the ff-merged + not-started cases below
# fail on either one:
#   - "commits ahead of origin/main" — after a non-squash merge a landed branch is
#     also 0 ahead, so it stops recognising the merges the ancestor check is for.
#   - "tip == origin/main" — once main advances past a fresh branch's base the
#     fresh branch stops matching, while a branch whose merge was the newest
#     commit starts matching. Both directions invert.
# The branch reflog is the signal that survives both, and these cases lock it in
# both directions so neither regresses.
#
# Dry-run only — the sweeper is never invoked with --apply here, so nothing is
# removed even if a fixture is wrong.
#
# Usage:
#   ./scripts/__tests__/test-sweep-worktree-classification.sh
#   ./scripts/__tests__/test-sweep-worktree-classification.sh -v  # show sweeper output

set -uo pipefail

# Hermetic against an inherited git environment (#1672): a git hook exports
# GIT_DIR, and GIT_DIR beats directory discovery — every `git -C "$FIXTURE"`
# call would then operate on the caller's real repository.
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_COMMON_DIR GIT_NAMESPACE \
      GIT_OBJECT_DIRECTORY GIT_ALTERNATE_OBJECT_DIRECTORIES

VERBOSE=false
[ "${1:-}" = "-v" ] && VERBOSE=true

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# SWEEPER_PATH lets a reviewer point these cases at another revision of the
# script — e.g. `SWEEPER_PATH=/tmp/old.sh` to confirm the suite actually fails on
# the pre-#1616 logic rather than passing for unrelated reasons.
SWEEPER="${SWEEPER_PATH:-$(cd "$SCRIPT_DIR/.." && pwd)/sweep-merged-worktrees.sh}"
[ -x "$SWEEPER" ] || { echo -e "${RED}sweeper not executable at $SWEEPER${NC}" >&2; exit 2; }
# shellcheck source=/dev/null
source "$(cd "$SCRIPT_DIR/.." && pwd)/lib/identity-guard.sh"

TMPROOT="$(mktemp -d "${TMPDIR:-/tmp}/guardtest-sweep.XXXXXX")"
# Invoked indirectly via the trap below. Two rule IDs because the ubuntu-latest
# apt shellcheck flags this as SC2317 while 0.11 flags it as SC2329 — CI installs
# the former, dev machines have the latter, so both are needed to stay clean.
# shellcheck disable=SC2329,SC2317
cleanup() { [ -n "${TMPROOT:-}" ] && [ -d "$TMPROOT" ] && rm -rf "$TMPROOT"; }
trap cleanup EXIT

# ── Safety wrapper ───────────────────────────────────────────────────────────
# brik-llm#1619 disclosed the failure this prevents: a fixture helper returned an
# empty path, every `git -C "$EMPTY" …` silently retargeted the LIVE repo, and the
# test created branches and moved a real worktree. Refuse any git call whose -C
# path is empty or outside $TMPROOT. Structural, not a promise.
g() {
  if [ "${1:-}" != "-C" ]; then
    echo -e "${RED}FATAL: g() requires -C <path> as the first argument${NC}" >&2; exit 3
  fi
  local path="${2:-}"
  case "$path" in
    "") echo -e "${RED}FATAL: g() called with an empty -C path${NC}" >&2; exit 3 ;;
    "$TMPROOT"|"$TMPROOT"/*) : ;;
    *) echo -e "${RED}FATAL: g() path outside TMPROOT: $path${NC}" >&2; exit 3 ;;
  esac
  git "$@"
}

PASS=0; FAIL=0
check() {  # $1=label  $2=expected substring  $3=actual haystack
  if grep -qF -- "$2" <<<"$3"; then
    echo -e "  ${GREEN}PASS${NC}  $1"; PASS=$((PASS+1))
  else
    echo -e "  ${RED}FAIL${NC}  $1"
    echo -e "        expected to find: $2"; FAIL=$((FAIL+1))
  fi
}

# ── Fixture: bare remote + primary + worktree root ───────────────────────────
REMOTE="$TMPROOT/remote.git"
PRIMARY="$TMPROOT/primary"
WT_ROOT="$TMPROOT/primary-worktrees"

git init -q --bare "$REMOTE"
git init -q -b main "$PRIMARY"
# g() below already refuses an empty or non-$TMPROOT path (#1619), but by LITERAL
# prefix. This checks the RESOLVED git-dir, so it also holds if a git env var
# survives the unset above and retargets a correct-looking path (#1841).
assert_throwaway_repo "$PRIMARY" "sweep fixture primary"
g -C "$PRIMARY" config user.email "guardtest@example.com"
g -C "$PRIMARY" config user.name "guardtest"
g -C "$PRIMARY" config commit.gpgsign false
echo "seed" > "$PRIMARY/README.md"
g -C "$PRIMARY" add README.md
g -C "$PRIMARY" commit -q -m "seed"
g -C "$PRIMARY" remote add origin "$REMOTE"
g -C "$PRIMARY" push -q -u origin main
mkdir -p "$WT_ROOT"

commit_on() {  # $1=worktree path  $2=filename
  echo "$2" > "$1/$2"
  g -C "$1" add "$2"
  g -C "$1" commit -q -m "add $2"
}

# 1. NOT STARTED — tip == origin/main, nothing committed. The #1616 case.
g -C "$PRIMARY" worktree add -q -b task/not-started "$WT_ROOT/not-started" main

# 2. NON-SQUASH MERGED — own commits, fast-forwarded into main, tip != base.
g -C "$PRIMARY" worktree add -q -b task/ff-merged "$WT_ROOT/ff-merged" main
commit_on "$WT_ROOT/ff-merged" "ff.txt"
g -C "$PRIMARY" push -q origin task/ff-merged:main       # advance main to the branch tip
g -C "$PRIMARY" fetch -q origin main

# 3. UNMERGED with commits, no PR.
g -C "$PRIMARY" worktree add -q -b task/unmerged "$WT_ROOT/unmerged" main
commit_on "$WT_ROOT/unmerged" "wip.txt"

# 4. DIRTY — uncommitted changes must always win.
g -C "$PRIMARY" worktree add -q -b task/dirty "$WT_ROOT/dirty" main
echo "scratch" > "$WT_ROOT/dirty/scratch.txt"

# 5/6. Squash-merged + open-PR need PR state, which comes from `gh`. Stub it.
g -C "$PRIMARY" worktree add -q -b task/squashed "$WT_ROOT/squashed" main
commit_on "$WT_ROOT/squashed" "squash.txt"
g -C "$PRIMARY" worktree add -q -b task/open-pr "$WT_ROOT/open-pr" main
commit_on "$WT_ROOT/open-pr" "openpr.txt"

STUB_BIN="$TMPROOT/bin"
mkdir -p "$STUB_BIN"
cat > "$STUB_BIN/gh" <<'STUB'
#!/usr/bin/env bash
# Minimal `gh pr list --json …` stub: only the fields the sweeper reads.
if [ "${1:-}" = "pr" ] && [ "${2:-}" = "list" ]; then
  cat <<'JSON'
[{"number":901,"headRefName":"task/squashed","state":"MERGED","mergedAt":"2026-07-27T00:00:00Z"},
 {"number":902,"headRefName":"task/open-pr","state":"OPEN","mergedAt":null},
 {"number":903,"headRefName":"task/wtless-merged","state":"MERGED","mergedAt":"2026-08-15T00:00:00Z"},
 {"number":904,"headRefName":"task/wtless-open","state":"OPEN","mergedAt":null},
 {"number":905,"headRefName":"task/pushed-merged","state":"MERGED","mergedAt":"2026-08-16T00:00:00Z"},
 {"number":906,"headRefName":"task/pushed-open","state":"OPEN","mergedAt":null}]
JSON
  exit 0
fi
exit 1
STUB
chmod +x "$STUB_BIN/gh"

# 7/8/9. WORKTREE-LESS branches — pass 3 (#2240). Both earlier passes start from a
# worktree, so once one is removed (which this very script does) its branch goes
# invisible and survives forever: 25 had piled up in brik-llm by 2026-08-16 while
# --delete-branches reported a clean sweep. Built the way the real ones arise —
# create the worktree, then remove it, leaving the branch behind.
#   wtless-merged  → remote gone + PR MERGED  → the only deletable shape
#   wtless-open    → PR still OPEN            → KEEP
#   wtless-nopr    → no PR at all             → KEEP (could be unpushed work)
for slug in wtless-merged wtless-open wtless-nopr; do
  g -C "$PRIMARY" worktree add -q -b "task/$slug" "$WT_ROOT/$slug" main
  commit_on "$WT_ROOT/$slug" "$slug.txt"
  g -C "$PRIMARY" worktree remove --force "$WT_ROOT/$slug"
done
# None was ever pushed, so all three are already absent from the remote — the
# condition pass 3 requires. Asserted rather than assumed: if a future fixture
# change pushes one, the DELETE verdict below would flip for a reason unrelated
# to the logic under test.
for slug in wtless-merged wtless-open wtless-nopr; do
  if g -C "$PRIMARY" ls-remote --exit-code --heads origin "task/$slug" >/dev/null 2>&1; then
    echo -e "  ${RED}FAIL${NC}  fixture: task/$slug unexpectedly exists on the remote"; FAIL=$((FAIL+1))
  fi
done

# ── Run the sweeper (dry-run) against the fixture ────────────────────────────
echo -e "${YELLOW}▸ sweeper dry-run over 6 fixture worktrees${NC}"
OUT="$(cd "$PRIMARY" && PATH="$STUB_BIN:$PATH" BRIK_WORKTREE_ROOT="$WT_ROOT" "$SWEEPER" 2>&1)"
$VERBOSE && { echo "$OUT"; echo; }

line_for() { grep -E "^task/$1[[:space:]]" <<<"$OUT"; }

echo -e "${YELLOW}▸ verdicts${NC}"
check "not-started → REVIEW, never REMOVE (#1616)" "REVIEW — no commits yet" "$(line_for not-started)"
if grep -qE "^task/not-started[[:space:]].*REMOVE" <<<"$OUT"; then
  echo -e "  ${RED}FAIL${NC}  not-started must never read REMOVE"; FAIL=$((FAIL+1))
else
  echo -e "  ${GREEN}PASS${NC}  not-started must never read REMOVE"; PASS=$((PASS+1))
fi

check "non-squash merged → REMOVE"          "REMOVE — merged into main" "$(line_for ff-merged)"
check "squash-merged PR → REMOVE"           "REMOVE — PR #901 merged"    "$(line_for squashed)"
check "open PR → KEEP"                      "KEEP — PR #902 open"        "$(line_for open-pr)"
check "dirty → KEEP"                        "KEEP — 1 uncommitted"      "$(line_for dirty)"
check "unmerged w/ commits → REVIEW"        "REVIEW — clean, unlanded"  "$(line_for unmerged)"

echo -e "${YELLOW}▸ summary line${NC}"
# Only ff-merged + squashed. If the fresh worktree ever leaks back in this reads 3.
check "removable count is 2 (ff-merged + squashed only)" "2 worktree(s) removable" "$OUT"

# ── Pass 3: worktree-less branches (#2240) ───────────────────────────────────
# Against the pre-#2240 sweeper these three lines do not exist at all, so every
# check below fails — which is the point: the bug was silence, not a wrong verdict.
echo
echo -e "${YELLOW}▸ worktree-less branch verdicts${NC}"
check "merged PR + remote gone → DELETE"  "DELETE — PR #903 merged" "$(line_for wtless-merged)"
check "open PR → KEEP"                    "KEEP — PR #904 open"     "$(line_for wtless-open)"
check "no PR at all → KEEP"               "KEEP — no merged PR"     "$(line_for wtless-nopr)"
for slug in wtless-open wtless-nopr; do
  if grep -qE "^task/${slug}[[:space:]].*DELETE" <<<"$OUT"; then
    echo -e "  ${RED}FAIL${NC}  task/$slug must never read DELETE"; FAIL=$((FAIL+1))
  else
    echo -e "  ${GREEN}PASS${NC}  task/$slug must never read DELETE"; PASS=$((PASS+1))
  fi
done
check "deletable count is 1"              "1 worktree-less branch(es) deletable" "$OUT"

# ── --keep (#1634, adopted from brik-bds/portal) ─────────────────────────────
# One --keep must spare the worktree, its directory AND its branch. Sparing only
# one of the three lets a later pass reap what an earlier pass was told to leave —
# the whole point of the flag is that the operator named work they still want.
echo
echo -e "${YELLOW}▸ --keep${NC}"
KEEP_OUT="$(cd "$PRIMARY" && PATH="$STUB_BIN:$PATH" BRIK_WORKTREE_ROOT="$WT_ROOT" \
  "$SWEEPER" --keep squashed --keep wtless-merged 2>&1)"
$VERBOSE && { echo "$KEEP_OUT"; echo; }
check "a kept worktree is spared"            "KEEP — --keep" "$(grep -E '^task/squashed[[:space:]]' <<<"$KEEP_OUT")"
# An ABSENCE, asserted explicitly: `check` greps for a substring, and an empty
# needle matches everything — a vacuous green tick is worse than no case at all.
if grep -qE '^task/wtless-merged[[:space:]].*DELETE' <<<"$KEEP_OUT"; then
  echo -e "  ${RED}FAIL${NC}  a kept worktree-less branch still read DELETE"; FAIL=$((FAIL+1))
else
  echo -e "  ${GREEN}PASS${NC}  a kept worktree-less branch is spared"; PASS=$((PASS+1))
fi
check "sparing drops the removable count"    "1 worktree(s) removable"              "$KEEP_OUT"
check "sparing drops the deletable count"    "0 worktree-less branch(es) deletable" "$KEEP_OUT"

# ── Pass 4: orphan remote refs (#1634) ───────────────────────────────────────
# origin/task/* that no local worktree holds. task/pushed-merged is pushed to the
# remote and has a MERGED PR in the stub; task/pushed-open has an OPEN one.
echo
echo -e "${YELLOW}▸ orphan remote refs${NC}"
for slug in pushed-merged pushed-open; do
  g -C "$PRIMARY" worktree add -q -b "task/$slug" "$WT_ROOT/$slug" main
  commit_on "$WT_ROOT/$slug" "$slug.txt"
  g -C "$PRIMARY" push -q origin "task/$slug"
  g -C "$PRIMARY" worktree remove --force "$WT_ROOT/$slug"
  g -C "$PRIMARY" branch -D "task/$slug" >/dev/null 2>&1   # local side gone; only the remote ref remains
done
g -C "$PRIMARY" fetch -q origin

# Opt-in, so the DEFAULT run must not even mention them. Three of the four repos
# adopting this script have never deleted a remote ref, and acquiring that silently
# on adoption is the regression this asserts against.
DEFAULT_OUT="$(cd "$PRIMARY" && PATH="$STUB_BIN:$PATH" BRIK_WORKTREE_ROOT="$WT_ROOT" "$SWEEPER" 2>&1)"
if grep -q 'ORPHAN REMOTE REF' <<<"$DEFAULT_OUT"; then
  echo -e "  ${RED}FAIL${NC}  remote-ref pass ran without --sweep-remote-refs"; FAIL=$((FAIL+1))
else
  echo -e "  ${GREEN}PASS${NC}  remote-ref pass is opt-in"; PASS=$((PASS+1))
fi

REF_OUT="$(cd "$PRIMARY" && PATH="$STUB_BIN:$PATH" BRIK_WORKTREE_ROOT="$WT_ROOT" \
  "$SWEEPER" --sweep-remote-refs 2>&1)"
$VERBOSE && { echo "$REF_OUT"; echo; }
check "merged remote ref → DELETE" "DELETE — PR #905 merged" "$(grep -E '^origin/task/pushed-merged[[:space:]]' <<<"$REF_OUT")"
check "open-PR remote ref → KEEP"  "KEEP — PR #906 open"     "$(grep -E '^origin/task/pushed-open[[:space:]]' <<<"$REF_OUT")"
check "remote deletable count is 1" "1 remote ref(s) deletable" "$REF_OUT"

# A ref whose worktree is still checked out belongs to pass 1, which has the dirty
# and not-started guards this pass does not; deleting its remote from under it would
# strand a live session.
if grep -qE '^origin/task/open-pr[[:space:]]' <<<"$REF_OUT"; then
  echo -e "  ${RED}FAIL${NC}  pass 4 classified a branch a worktree still holds"; FAIL=$((FAIL+1))
else
  echo -e "  ${GREEN}PASS${NC}  pass 4 skips branches held by a worktree"; PASS=$((PASS+1))
fi

REF_KEEP_OUT="$(cd "$PRIMARY" && PATH="$STUB_BIN:$PATH" BRIK_WORKTREE_ROOT="$WT_ROOT" \
  "$SWEEPER" --sweep-remote-refs --keep pushed-merged 2>&1)"
check "--keep spares a remote ref too" "0 remote ref(s) deletable" "$REF_KEEP_OUT"
# A dry-run WITHOUT --delete-branches still classifies, but must say the branches
# are advisory — otherwise DELETE lines imply --apply alone would act on them.
check "dry-run names the flag it needs"   "need --delete-branches too"           "$OUT"

# ── --apply over a worktree containing a populated submodule ─────────────────
# `git worktree remove` refuses outright on a worktree containing submodules, so
# in this repo (foundations/brik-bds) EVERY worktree whose submodule got checked
# out was unreapable and the sweeper silently no-op'd on it — 3 of 7 on
# 2026-07-29, reported as "locked or untracked junk?" which sent the operator
# looking for junk that did not exist. This is the only case that needs --apply:
# the classification is unaffected, the removal is what failed.
echo
echo -e "${YELLOW}▸ --apply over a submodule-bearing worktree${NC}"

# Case 2 above pushed task/ff-merged straight to remote main, so PRIMARY's local
# main still sits at the seed commit. Anything committed on top of it would be a
# non-descendant of remote main and the push below would be rejected — which
# would leave the fixture half-built and the assertions passing vacuously.
g -C "$PRIMARY" reset -q --hard origin/main

SUBREMOTE="$TMPROOT/submodule.git"
# -b main is required, not cosmetic: a bare repo's HEAD follows the local
# init.defaultBranch, which is `master` on the CI runner and `main` here. With a
# mismatched HEAD, `submodule add` clones successfully and then dies with
# "fatal: You are on a branch yet to be born" — so this passed locally and
# failed on CI (git 2.54.0) until the default was pinned.
git init -q --bare -b main "$SUBREMOTE"
SUBSEED="$TMPROOT/subseed"
git init -q -b main "$SUBSEED"
assert_throwaway_repo "$SUBSEED" "sweep fixture submodule seed"
g -C "$SUBSEED" config user.email "guardtest@example.com"
g -C "$SUBSEED" config user.name "guardtest"
g -C "$SUBSEED" config commit.gpgsign false
echo "sub" > "$SUBSEED/sub.txt"
g -C "$SUBSEED" add sub.txt
g -C "$SUBSEED" commit -q -m "sub seed"
g -C "$SUBSEED" push -q "$SUBREMOTE" main

# protocol.file.allow: git ≥2.38 refuses file:// submodules by default
# (CVE-2022-39253). Errors are CAPTURED, not discarded — the first version of
# this fixture hid them, and when it failed to populate on CI's git the report
# said only "case under test is not reproduced" with no reason to act on.
SUB_ADD_ERR="$(g -C "$PRIMARY" -c protocol.file.allow=always \
  submodule add "$SUBREMOTE" foundations/sub 2>&1)" || true
g -C "$PRIMARY" commit -q -m "add submodule" >/dev/null 2>&1 || true
g -C "$PRIMARY" push -q origin main

# A landed worktree whose submodule is checked out — the unreapable shape.
g -C "$PRIMARY" worktree add -q -b task/submod "$WT_ROOT/submod" main
SUB_UPD_ERR="$(g -C "$WT_ROOT/submod" -c protocol.file.allow=always \
  submodule update --init --recursive 2>&1)" || true
commit_on "$WT_ROOT/submod" "submod.txt"
g -C "$PRIMARY" push -q origin task/submod:main
g -C "$PRIMARY" fetch -q origin main

# find, not `ls | wc -l`: this workflow runs shellcheck at default severity, so
# SC2012 (info) is a hard failure here even though -S warning hides it locally.
SUBMOD_ENTRIES="$(find "$WT_ROOT/submod/foundations/sub" -mindepth 1 -maxdepth 1 2>/dev/null | wc -l | tr -d ' ')"
if [ "$SUBMOD_ENTRIES" -gt 0 ]; then
  echo -e "  ${GREEN}PASS${NC}  fixture: submodule is populated (precondition)"; PASS=$((PASS+1))
else
  echo -e "  ${RED}FAIL${NC}  fixture: submodule never populated — the case under test is not reproduced"
  echo -e "        git $(git --version | awk '{print $3}')"
  echo -e "        submodule add: ${SUB_ADD_ERR:-<no output>}" | sed 's/$//'
  echo -e "        submodule update: ${SUB_UPD_ERR:-<no output>}"
  FAIL=$((FAIL+1))
fi

# Confirm plain `git worktree remove` really does refuse, so this test fails
# loudly if a future git drops the restriction and the fallback becomes dead code.
RAW_ERR="$(g -C "$PRIMARY" worktree remove "$WT_ROOT/submod" 2>&1 || true)"
if printf '%s' "$RAW_ERR" | grep -q 'containing submodules'; then
  echo -e "  ${GREEN}PASS${NC}  git still refuses to remove a submodule-bearing worktree"; PASS=$((PASS+1))
else
  echo -e "  ${RED}FAIL${NC}  git no longer refuses — revisit the fallback, it may be dead code"
  echo -e "        got: ${RAW_ERR:-<empty, removal succeeded>}"; FAIL=$((FAIL+1))
fi

APPLY_OUT="$(cd "$PRIMARY" && PATH="$STUB_BIN:$PATH" BRIK_WORKTREE_ROOT="$WT_ROOT" "$SWEEPER" --apply 2>&1)"
$VERBOSE && { echo "$APPLY_OUT"; echo; }
$VERBOSE && { echo "$APPLY_OUT"; echo; }

if [ -d "$WT_ROOT/submod" ]; then
  echo -e "  ${RED}FAIL${NC}  submodule-bearing worktree still on disk after --apply"; FAIL=$((FAIL+1))
else
  echo -e "  ${GREEN}PASS${NC}  submodule-bearing worktree removed by --apply"; PASS=$((PASS+1))
fi

check "fallback is reported, not silent" "submodule fallback" "$APPLY_OUT"

# The misleading guess must be gone: a real failure now prints git's own words.
if printf '%s' "$APPLY_OUT" | grep -q 'locked or untracked junk'; then
  echo -e "  ${RED}FAIL${NC}  the guessed 'locked or untracked junk?' message is still emitted"; FAIL=$((FAIL+1))
else
  echo -e "  ${GREEN}PASS${NC}  no guessed 'locked or untracked junk?' message"; PASS=$((PASS+1))
fi

# git must agree the worktree is gone, not just the directory.
#
# Matched on the PHYSICAL path: `git worktree list` resolves symlinks, and on
# macOS $WT_ROOT is /var/… while git reports /private/var/…. Grepping the
# unresolved path never matched, so this assertion passed even against the
# pre-fix sweeper that removed nothing — a green tick proving nothing.
WT_ROOT_PHYS="$(cd "$WT_ROOT" 2>/dev/null && pwd -P || echo "$WT_ROOT")"
if g -C "$PRIMARY" worktree list --porcelain | grep -qF "$WT_ROOT_PHYS/submod"; then
  echo -e "  ${RED}FAIL${NC}  git still tracks the removed worktree (prune did not run)"; FAIL=$((FAIL+1))
else
  echo -e "  ${GREEN}PASS${NC}  git no longer tracks it (prune ran)"; PASS=$((PASS+1))
fi

# The branch must survive — removal is not a ref deletion.
if g -C "$PRIMARY" rev-parse --verify -q task/submod >/dev/null; then
  echo -e "  ${GREEN}PASS${NC}  branch survives the fallback removal"; PASS=$((PASS+1))
else
  echo -e "  ${RED}FAIL${NC}  branch was destroyed by the fallback"; FAIL=$((FAIL+1))
fi

# That run was --apply WITHOUT --delete-branches, so pass 3 must have touched
# nothing: --apply alone has never deleted a ref and must not start now.
if g -C "$PRIMARY" rev-parse --verify -q task/wtless-merged >/dev/null; then
  echo -e "  ${GREEN}PASS${NC}  --apply alone leaves worktree-less branches"; PASS=$((PASS+1))
else
  echo -e "  ${RED}FAIL${NC}  --apply alone deleted a branch without --delete-branches"; FAIL=$((FAIL+1))
fi

# ── --apply --delete-branches: pass 3 actually reaps ─────────────────────────
echo
echo -e "${YELLOW}▸ --apply --delete-branches over worktree-less branches${NC}"
DEL_OUT="$(cd "$PRIMARY" && PATH="$STUB_BIN:$PATH" BRIK_WORKTREE_ROOT="$WT_ROOT" \
  "$SWEEPER" --apply --delete-branches 2>&1)"
$VERBOSE && { echo "$DEL_OUT"; echo; }

# Per-branch outcomes, not counts: the first --apply removed the ff-merged and
# squashed WORKTREES, so those branches are worktree-less by now too and legitimately
# enter pass 3. Asserting a total here would encode fixture history, not behaviour.
if g -C "$PRIMARY" rev-parse --verify -q task/wtless-merged >/dev/null; then
  echo -e "  ${RED}FAIL${NC}  landed worktree-less branch survived --delete-branches"; FAIL=$((FAIL+1))
else
  echo -e "  ${GREEN}PASS${NC}  landed worktree-less branch deleted"; PASS=$((PASS+1))
fi
for slug in wtless-open wtless-nopr; do
  if g -C "$PRIMARY" rev-parse --verify -q "task/$slug" >/dev/null; then
    echo -e "  ${GREEN}PASS${NC}  task/$slug survives (not landed)"; PASS=$((PASS+1))
  else
    echo -e "  ${RED}FAIL${NC}  task/$slug was deleted — unlanded work destroyed"; FAIL=$((FAIL+1))
  fi
done

echo
if [ "$FAIL" -eq 0 ]; then
  echo -e "${GREEN}✓ ${PASS} passed${NC}"
  exit 0
fi
echo -e "${RED}✗ ${FAIL} failed, ${PASS} passed${NC}"
exit 1
