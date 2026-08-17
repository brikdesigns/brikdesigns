#!/usr/bin/env bash
# sweep-merged-worktrees.sh — remove task worktrees whose work has landed.
#
# Why this exists: new-task.sh CREATES worktrees in ../brik-llm-worktrees/{slug}
# but nothing removes them once their PR merges, so they accumulate
# indefinitely (46 worktrees / ~930 MB found 2026-06-24). This is the missing
# teardown companion to new-task.sh. The primary stays on main (see
# worktree-guard.sh); task worktrees should disappear when their branch lands.
#
# Two teardown passes (brik-llm#1078):
#
# 1. TRACKED worktrees (still in `git worktree list`). REMOVABLE when clean AND
#    landed — PR MERGED, or tip is an ancestor of origin/main AND the branch has
#    something of its own committed (covers non-squash merges + direct-to-main).
#    Conservative:
#      - DIRTY worktrees are KEPT (uncommitted work — never auto-removed).
#      - OPEN-PR worktrees are KEPT (work in flight).
#      - NOT-STARTED worktrees (tip still == origin/main) are flagged for REVIEW,
#        never removed. `--is-ancestor` is reflexive, so without this a worktree
#        fresh out of new-task.sh read as "merged into main" and was swept
#        before its session's first commit (brik-llm#1616).
#      - Clean+unlanded+no-PR worktrees are flagged for REVIEW.
#
# 2. ORPHAN directories under the worktree root that git NO LONGER tracks
#    (absent from `git worktree list` — `git worktree prune` already stripped
#    the linkage once the branch was deleted, but the on-disk dir + its
#    node_modules were left behind: a 2026-06-19 sweep found 15 such dirs
#    totaling 17 GB). An orphan is REAPABLE only when its branch `task/<slug>`
#    has a MERGED PR AND is gone from both local and remote; otherwise it is
#    FLAG-ONLY (branch still exists or nothing proves it merged) and never
#    removed. A severed worktree can't be status-checked, so "merged PR + branch
#    gone from both sides" is the safe reapable signal — squash merges (which
#    leave the tip NOT an ancestor of main) are covered by the PR-MERGED check.
#
# 3. WORKTREE-LESS local `task/*` branches (brik-llm#2240). Passes 1 and 2 are
#    both keyed on a worktree — pass 1 iterates `git worktree list`, pass 2 walks
#    directories under the worktree root. Once BOTH are gone (which an earlier
#    run of this script does, in that order) the branch becomes invisible to the
#    sweeper and survives forever: 25 such branches had accumulated in brik-llm by
#    2026-08-16, while `--delete-branches` reported a clean sweep. DELETABLE only
#    when the remote branch is gone AND its PR is MERGED. An OPEN PR, or no PR at
#    all, is reported and KEPT — a branch with no PR is the one shape that could
#    still be unpushed work, and nothing here proves otherwise.
#
#    `git branch -d`/`--merged` cannot substitute for the PR check: squash-merge
#    leaves the tip NOT an ancestor of main, so `-d` refuses on exactly the
#    branches that have landed.
#
# 4. ORPHAN REMOTE REFS — `origin/task/*` with no local worktree (#1634, adopted
#    from brik-bds' reaper). Passes 1-3 are all local, so none of them can see a
#    ref pushed from another machine whose PR merged without auto-delete. OPT-IN
#    via --sweep-remote-refs: it is the only outward-facing mutation here, and
#    three of the four repos adopting this script have never done it.
#
# CANONICAL COPY — this file is byte-identical in brik-llm, brik-bds,
# brik-client-portal and brikdesigns (#1634). brik-llm holds the source of truth;
# scripts/audit/reaper-twin-drift.py fails CI when a copy diverges. Fix it HERE and
# re-sync; a local edit in a consumer repo will be reported as drift, not adopted.
# It needs no per-repo edits: the primary worktree, worktree root and repo slug are
# all derived at runtime from git and gh.
#
# Orphan accumulation across all roots is surfaced fleet-wide by
# claude-weekly-hygiene.sh.
#
# Usage:
#   ./scripts/sweep-merged-worktrees.sh                    # dry-run (default)
#   ./scripts/sweep-merged-worktrees.sh --apply            # remove landed worktrees + reap orphans
#   ./scripts/sweep-merged-worktrees.sh --reap             # alias for --apply
#   ./scripts/sweep-merged-worktrees.sh --delete-branches  # dry-run, incl. pass 3
#   ./scripts/sweep-merged-worktrees.sh --apply --delete-branches
#                                                          # also delete landed local branches,
#                                                          # worktree or not (pass 3)
#   ./scripts/sweep-merged-worktrees.sh --keep foo         # spare worktree/branch 'foo'
#   ./scripts/sweep-merged-worktrees.sh --apply --sweep-remote-refs
#                                                          # also delete landed origin/task/* refs
#   ./scripts/sweep-merged-worktrees.sh --json             # human table suppressed (audit)
#
# Env: BRIK_WORKTREE_ROOT overrides the swept root (default: <primary>-worktrees).
# Requires: gh (for PR state). Without gh, falls back to ancestor-of-main only
# for tracked worktrees; orphans need a MERGED PR so they stay flag-only.

set -uo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

APPLY=false
DELETE_BRANCHES=false
SWEEP_REMOTE_REFS=false
JSON=false
declare -a KEEP_LIST=()
# `--keep` takes a value, so the loop consumes two args — a bare `for arg in "$@"`
# cannot express that.
while [ $# -gt 0 ]; do
  case "$1" in
    --apply|--reap) APPLY=true ;;
    --delete-branches) DELETE_BRANCHES=true ;;
    --sweep-remote-refs) SWEEP_REMOTE_REFS=true ;;
    --keep)
      [ $# -ge 2 ] || { echo -e "${RED}--keep needs a worktree or slug name${NC}" >&2; exit 2; }
      KEEP_LIST+=("$2"); shift ;;
    --json) JSON=true ;;
    -h|--help) sed -n '2,80p' "$0"; exit 0 ;;   # header ends at the Requires: note
    *) echo -e "${RED}Unknown flag: $1${NC}" >&2; exit 2 ;;
  esac
  shift
done

# kept NAME — 0 when --keep spared it. Matched on the SLUG (a worktree's basename,
# a branch's `task/` suffix) so one `--keep foo` spares the worktree, its directory
# and its branch together; sparing only one of the three would let a later pass
# reap what an earlier pass was told to leave alone.
kept() {
  local name="$1" k
  [ ${#KEEP_LIST[@]} -eq 0 ] && return 1
  for k in "${KEEP_LIST[@]}"; do
    [ "$name" = "$k" ] && return 0
    [ "$name" = "task/$k" ] && return 0
  done
  return 1
}

# Primary = the first worktree git lists (the main working tree), NOT
# `git rev-parse --show-toplevel` — that returns the CURRENT worktree, which
# is wrong when this script runs from a task worktree. Mirrors new-task.sh.
PRIMARY="$(git worktree list --porcelain | awk '/^worktree /{print $2; exit}')"
SELF_WT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel 2>/dev/null || echo "")"

git fetch origin main --quiet 2>/dev/null || true

# PR map: headRefName -> best state (MERGED wins).
PR_JSON=""
if command -v gh >/dev/null 2>&1; then
  PR_JSON="$(gh pr list --state all --limit 800 --json number,headRefName,state,mergedAt 2>/dev/null || echo "")"
fi

pr_for_branch() {  # $1=branch -> "num|state"
  [ -z "$PR_JSON" ] && { echo "none|—"; return; }
  printf '%s' "$PR_JSON" | BRANCH="$1" python3 -c '
import json, os, sys
b = os.environ["BRANCH"]
prs = json.load(sys.stdin)
m = [p for p in prs if p.get("headRefName") == b]
if not m:
    print("none|-")
    sys.exit()
m.sort(key=lambda p: (p.get("state") == "MERGED", p.get("number")), reverse=True)
p = m[0]
print("#%s|%s" % (p["number"], p["state"]))'
}

# Worktree root swept for orphan directories (pass 2). Overridable for tests.
WORKTREE_ROOT="${BRIK_WORKTREE_ROOT:-$(dirname "$PRIMARY")/$(basename "$PRIMARY")-worktrees}"

# Remote branch heads, fetched once. REMOTE_OK distinguishes "fetched, branch
# absent" (safe to reap) from "couldn't reach origin" (unknown → never reap).
REMOTE_HEADS=""; REMOTE_OK=false
if command -v git >/dev/null 2>&1 && REMOTE_HEADS="$(git ls-remote --heads origin 2>/dev/null | sed 's#.*refs/heads/##')"; then
  REMOTE_OK=true
fi

branch_exists_local() { git show-ref --verify --quiet "refs/heads/$1"; }
# "remote-absent" is only trustworthy when the fetch succeeded; otherwise treat
# the branch as present so an unreachable origin can never trigger a reap.
branch_absent_remote() { $REMOTE_OK && ! grep -qxF "$1" <<<"$REMOTE_HEADS"; }

human_size() {  # $1=KB -> human string
  awk -v k="$1" 'BEGIN{ if(k>=1048576) printf "%.1f GB", k/1048576; else if(k>=1024) printf "%.0f MB", k/1024; else printf "%d KB", k }'
}

declare -a REMOVE_PATHS=() REMOVE_BRANCHES=() REMOVE_LABELS=()
KEPT=0 REVIEW=0

$JSON || { printf '%-50s %-9s %-9s %s\n' "BRANCH" "DIRTY" "PR" "VERDICT"; printf '%.0s─' {1..110}; echo; }

while IFS=$'\t' read -r path ref; do
  [ "$path" = "$PRIMARY" ] && continue
  [ "$path" = "$SELF_WT" ] && { $JSON || printf '%-50s %-9s %-9s %s\n' "$(basename "$path")" "-" "-" "SKIP — running from here"; KEPT=$((KEPT+1)); continue; }
  branch="${ref#refs/heads/}"
  if kept "$(basename "$path")" || kept "$branch"; then
    $JSON || printf '%-50s %-9s %-9s %s\n' "$branch" "-" "-" "KEEP — --keep"
    KEPT=$((KEPT+1)); continue
  fi
  dirty=$(git -C "$path" status --porcelain 2>/dev/null | wc -l | tr -d ' ')
  tip=$(git -C "$path" rev-parse "$branch" 2>/dev/null)
  anc="no"; git merge-base --is-ancestor "$tip" origin/main 2>/dev/null && anc="yes"
  pr=$(pr_for_branch "$branch"); prnum="${pr%%|*}"; prstate="${pr##*|}"

  # Has anything ever been committed on this branch? A branch fresh out of
  # new-task.sh points at the base it was created from, and `--is-ancestor` is
  # reflexive, so the ancestor test alone reports it as "merged into main" and
  # sweeps it — taking the worktree and (with --delete-branches) the branch, in
  # the window between new-task.sh and the session's first commit (#1616).
  #
  # The branch REFLOG answers this directly and is the only signal that does.
  # Two tempting alternatives are both wrong:
  #   - "commits ahead of origin/main" — after a non-squash merge a landed
  #     branch is also 0 ahead, so this stops recognising exactly the merges the
  #     ancestor check exists for.
  #   - "tip == origin/main" — once main advances past a fresh branch's base the
  #     fresh branch stops matching, while a branch whose merge was the newest
  #     commit starts matching. Both directions invert.
  # A fresh branch's reflog holds exactly one entry, "branch: Created from …";
  # anything committed, amended, rebased, or reset adds another.
  #
  # When the reflog is entirely absent (fresh clone, expired per gc.reflogExpire)
  # there is no information, so fall through to the pre-existing behaviour rather
  # than start keeping every landed worktree forever.
  reflog_all=$(git -C "$path" reflog show --format='%gs' "refs/heads/$branch" 2>/dev/null | wc -l | tr -d ' ')
  reflog_work=$(git -C "$path" reflog show --format='%gs' "refs/heads/$branch" 2>/dev/null \
    | grep -cvE '^branch: Created from ' || true)
  started="yes"
  if [ "${reflog_all:-0}" -gt 0 ] && [ "${reflog_work:-0}" -eq 0 ]; then
    started="no"
  fi

  landed=false
  if [ "$prstate" = "MERGED" ]; then
    landed=true                                   # squash or merge commit — PR is authoritative
  elif [ "$anc" = "yes" ] && [ "$started" = "yes" ]; then
    landed=true                                   # non-squash merge / direct-to-main
  fi

  if [ "$dirty" != "0" ]; then
    verdict="KEEP — ${dirty} uncommitted change(s)"; KEPT=$((KEPT+1))
  elif $landed; then
    reason=$([ "$prstate" = "MERGED" ] && echo "PR $prnum merged" || echo "merged into main")
    verdict="REMOVE — $reason"
    REMOVE_PATHS+=("$path"); REMOVE_BRANCHES+=("$branch"); REMOVE_LABELS+=("$reason")
  elif [ "$prstate" = "OPEN" ]; then
    verdict="KEEP — PR $prnum open"; KEPT=$((KEPT+1))
  elif [ "$started" = "no" ]; then
    verdict="REVIEW — no commits yet (session may be mid-setup)"; REVIEW=$((REVIEW+1))
  else
    verdict="REVIEW — clean, unlanded, no merged PR"; REVIEW=$((REVIEW+1))
  fi
  $JSON || printf '%-50s %-9s %-9s %s\n' "$branch" "$([ "$dirty" = 0 ] && echo clean || echo "DIRTY")" "$prnum" "$verdict"
done < <(git worktree list --porcelain | awk '/^worktree /{wt=$2} /^branch /{print wt"\t"$2}')

# ── Pass 2: orphan directories git no longer tracks ──
declare -a REAP_PATHS=() REAP_LABELS=() REAP_KB=()
ORPHAN_FLAG=0; ORPHAN_REAP_KB=0
tracked_paths="$(git worktree list --porcelain | awk '/^worktree /{print $2}')"

if [ -d "$WORKTREE_ROOT" ]; then
  $JSON || { echo; printf '%-50s %-11s %s\n' "ORPHAN DIR" "SIZE" "VERDICT"; printf '%.0s─' {1..110}; echo; }
  for dir in "$WORKTREE_ROOT"/*/; do
    [ -d "$dir" ] || continue
    abs="$(cd "$dir" && pwd)"
    grep -qxF "$abs" <<<"$tracked_paths" && continue   # still tracked → pass 1 handled it
    slug="$(basename "$abs")"; branch="task/$slug"
    if kept "$slug"; then
      $JSON || printf '%-50s %-11s %s\n' "$slug" "-" "FLAG — --keep"
      ORPHAN_FLAG=$((ORPHAN_FLAG+1)); continue
    fi
    kb=$(du -sk "$abs" 2>/dev/null | awk '{print $1}'); kb=${kb:-0}
    pr=$(pr_for_branch "$branch"); prnum="${pr%%|*}"; prstate="${pr##*|}"

    if branch_exists_local "$branch"; then
      verdict="FLAG — local branch $branch still exists"; ORPHAN_FLAG=$((ORPHAN_FLAG+1))
    elif ! branch_absent_remote "$branch"; then
      verdict="FLAG — $($REMOTE_OK && echo "remote branch still exists" || echo "origin unreachable, can't confirm")"; ORPHAN_FLAG=$((ORPHAN_FLAG+1))
    elif [ "$prstate" = "MERGED" ]; then
      verdict="REAP — PR $prnum merged, branch gone"
      REAP_PATHS+=("$abs"); REAP_LABELS+=("PR $prnum merged"); REAP_KB+=("$kb")
      ORPHAN_REAP_KB=$((ORPHAN_REAP_KB+kb))
    else
      verdict="FLAG — no merged PR for $branch"; ORPHAN_FLAG=$((ORPHAN_FLAG+1))
    fi
    $JSON || printf '%-50s %-11s %s\n' "$slug" "$(human_size "$kb")" "$verdict"
  done
fi
nr=${#REAP_PATHS[@]}

# ── Pass 3: worktree-less local task/* branches (#2240) ──
# Passes 1 and 2 both start from a worktree, so a branch outlives the sweeper the
# moment its worktree is gone. Deletable ONLY on remote-gone + PR MERGED.
declare -a DELETE_BRANCH_NAMES=() DELETE_BRANCH_LABELS=()
BRANCH_KEPT=0; BRANCH_HEADER_SHOWN=no
# refs/heads/, not `git branch` — the latter marks the current branch with "* ".
wt_branches="$(git worktree list --porcelain | awk '/^branch /{sub(/^refs\/heads\//,"",$2); print $2}')"

while IFS= read -r branch; do
  [ -n "$branch" ] || continue
  # A branch with a worktree belongs to pass 1, which applies the dirty/started
  # checks this pass has no worktree to run. Never classify it twice.
  grep -qxF "$branch" <<<"$wt_branches" && continue
  kept "$branch" && continue
  pr=$(pr_for_branch "$branch"); prnum="${pr%%|*}"; prstate="${pr##*|}"

  if ! branch_absent_remote "$branch"; then
    verdict="KEEP — $($REMOTE_OK && echo "remote branch still exists" || echo "origin unreachable, can't confirm")"
    BRANCH_KEPT=$((BRANCH_KEPT+1))
  elif [ "$prstate" = "MERGED" ]; then
    verdict="DELETE — PR $prnum merged, remote gone"
    DELETE_BRANCH_NAMES+=("$branch"); DELETE_BRANCH_LABELS+=("PR $prnum merged")
  elif [ "$prstate" = "OPEN" ]; then
    verdict="KEEP — PR $prnum open"; BRANCH_KEPT=$((BRANCH_KEPT+1))
  else
    # No PR at all is the one shape that may be unpushed work. Keep it.
    verdict="KEEP — no merged PR for $branch"; BRANCH_KEPT=$((BRANCH_KEPT+1))
  fi
  $JSON || { [ "$BRANCH_HEADER_SHOWN" = "no" ] && { echo; printf '%-50s %-9s %s\n' "WORKTREE-LESS BRANCH" "PR" "VERDICT"; printf '%.0s─' {1..110}; echo; BRANCH_HEADER_SHOWN=yes; }
             printf '%-50s %-9s %s\n' "$branch" "$prnum" "$verdict"; }
# A bare prefix, not a glob: for-each-ref matches "completely or from the
# beginning up to a slash", so this catches task/<slug> and task/<a>/<b> alike,
# where `refs/heads/task/*` would need one pattern per nesting depth.
done < <(git for-each-ref --format='%(refname:short)' refs/heads/task)

nb=${#DELETE_BRANCH_NAMES[@]}

# ── Pass 4: orphan REMOTE refs (#1634, from brik-bds' reaper) ──
# `origin/task/*` outlives the local side entirely: a session on another machine
# pushes a branch, its PR merges without auto-delete, and nothing local ever sees
# that ref again. Passes 1-3 are all local, so none of them can reach it.
#
# OPT-IN, unlike brik-bds' copy which runs this by default. Deleting a remote ref
# is the only outward-facing thing this script does — it touches state other
# machines and other people see — so three of the four repos adopting the canonical
# script must not silently acquire it. brik-bds keeps its current behaviour by
# passing the flag.
declare -a DELETE_REF_NAMES=() DELETE_REF_LABELS=()
REF_KEPT=0; REF_HEADER_SHOWN=no
if $SWEEP_REMOTE_REFS; then
  while IFS= read -r branch; do
    [ -n "$branch" ] || continue
    # A branch a worktree still holds belongs to pass 1, which has the dirty and
    # not-started checks; deleting its remote out from under it is not this pass's call.
    grep -qxF "$branch" <<<"$wt_branches" && continue
    kept "$branch" && continue
    pr=$(pr_for_branch "$branch"); prnum="${pr%%|*}"; prstate="${pr##*|}"

    case "$prstate" in
      MERGED) verdict="DELETE — PR $prnum merged"
              DELETE_REF_NAMES+=("$branch"); DELETE_REF_LABELS+=("PR $prnum merged") ;;
      # A CLOSED PR is a rejected branch: the ref is dead, and brik-bds has reaped
      # these since before this script existed. Not adopting it there would be the
      # regression this consolidation is meant to avoid.
      CLOSED) verdict="DELETE — PR $prnum closed (rejected)"
              DELETE_REF_NAMES+=("$branch"); DELETE_REF_LABELS+=("PR $prnum closed") ;;
      OPEN)   verdict="KEEP — PR $prnum open"; REF_KEPT=$((REF_KEPT+1)) ;;
      *)      verdict="KEEP — no PR for $branch"; REF_KEPT=$((REF_KEPT+1)) ;;
    esac
    $JSON || { [ "$REF_HEADER_SHOWN" = "no" ] && { echo; printf '%-50s %-9s %s\n' "ORPHAN REMOTE REF" "PR" "VERDICT"; printf '%.0s─' {1..110}; echo; REF_HEADER_SHOWN=yes; }
               printf '%-50s %-9s %s\n' "origin/$branch" "$prnum" "$verdict"; }
  done < <(git for-each-ref --format='%(refname:lstrip=3)' refs/remotes/origin/task)
fi
nrf=${#DELETE_REF_NAMES[@]}

n=${#REMOVE_PATHS[@]}
echo
echo -e "${CYAN}Summary:${NC} ${n} worktree(s) removable · ${KEPT} kept · ${REVIEW} need review · ${nr} orphan(s) reapable ($(human_size "$ORPHAN_REAP_KB")) · ${ORPHAN_FLAG} orphan(s) flagged · ${nb} worktree-less branch(es) deletable · ${BRANCH_KEPT} kept · ${nrf} remote ref(s) deletable · ${REF_KEPT} kept"

if [ "$n" -eq 0 ] && [ "$nr" -eq 0 ] && [ "$nb" -eq 0 ] && [ "$nrf" -eq 0 ]; then
  echo -e "${GREEN}Nothing to remove.${NC}"
  git worktree prune 2>/dev/null || true
  exit 0
fi

if ! $APPLY; then
  echo -e "${YELLOW}Dry-run. Re-run with --apply to remove ${n} worktree(s) + reap ${nr} orphan(s)${NC}$($DELETE_BRANCHES && echo " + delete ${nb} worktree-less branch(es) + landed branches")$($SWEEP_REMOTE_REFS && echo " + delete ${nrf} remote ref(s)")."
  # Without --delete-branches the pass-3 verdicts above are advisory only. Say so
  # here rather than let a dry-run listing DELETE lines imply --apply would act.
  $DELETE_BRANCHES || [ "$nb" -eq 0 ] || \
    echo -e "${YELLOW}  ${nb} worktree-less branch(es) need --delete-branches too; --apply alone leaves them.${NC}"
  exit 0
fi

# Remove tracked worktrees (pass 1).
removed=0
if [ "$n" -gt 0 ]; then
  echo -e "${YELLOW}▸ Removing ${n} worktree(s)...${NC}"
  for i in "${!REMOVE_PATHS[@]}"; do
    p="${REMOVE_PATHS[$i]}"; b="${REMOVE_BRANCHES[$i]}"
    # Capture the real error instead of discarding it: the old `2>/dev/null` plus
    # a guessed "(locked or untracked junk?)" message sent an operator hunting for
    # junk that was not there. git states the actual reason.
    if err="$(git worktree remove "$p" 2>&1)"; then
      echo -e "  ${GREEN}✓${NC} ${b} (${REMOVE_LABELS[$i]})"
      removed=$((removed+1))
      if $DELETE_BRANCHES; then
        git branch -D "$b" >/dev/null 2>&1 && echo -e "      ${GREEN}↳${NC} branch deleted"
      fi
    elif printf '%s' "$err" | grep -q 'containing submodules'; then
      # `git worktree remove` refuses outright on a populated submodule — this
      # repo has foundations/brik-bds, so ANY worktree whose submodule got
      # checked out was unreapable, and the sweeper silently no-op'd on it. That
      # defeats the accumulation this script exists to prevent (#1078: 46
      # worktrees / 930 MB). Fall back to the same rm + prune the orphan pass
      # already uses, under the same $WORKTREE_ROOT guard.
      #
      # Safe because the verdict for $p is already REMOVE, which requires clean
      # AND landed; a dirty or unlanded worktree never reaches this loop. The
      # branch also survives (worktree removal does not delete refs), so the
      # commits remain reachable even if this were wrong.
      # Compare PHYSICAL paths on both sides. $p comes from `git worktree list`,
      # which resolves symlinks; $WORKTREE_ROOT is built from `dirname` and does
      # not. On macOS every mktemp path is /var → /private/var, so a purely
      # lexical guard rejects a legitimate path — caught by the fixture in
      # test-sweep-worktree-classification.sh. The orphan pass is unaffected
      # because it builds its paths by walking $WORKTREE_ROOT itself.
      wt_root_phys="$(cd "$WORKTREE_ROOT" 2>/dev/null && pwd -P)"
      p_phys="$(cd "$p" 2>/dev/null && pwd -P)"
      case "${p_phys:-/nonexistent}" in
        "${wt_root_phys:-/nonexistent-root}"/?*)
          if rm -rf "$p_phys"; then
            echo -e "  ${GREEN}✓${NC} ${b} (${REMOVE_LABELS[$i]}; submodule fallback: rm + prune)"
            removed=$((removed+1))
            if $DELETE_BRANCHES; then
              git branch -D "$b" >/dev/null 2>&1 && echo -e "      ${GREEN}↳${NC} branch deleted"
            fi
          else
            echo -e "  ${RED}✗${NC} ${b} — submodule fallback rm failed; skipped"
          fi ;;
        *) echo -e "  ${RED}✗${NC} refusing to rm outside \$WORKTREE_ROOT: $p" >&2 ;;
      esac
    else
      echo -e "  ${RED}✗${NC} ${b} — 'git worktree remove' failed; skipped"
      printf '%s\n' "$err" | sed 's/^/        /' >&2
    fi
  done
fi

# Reap orphan dirs (pass 2) — plain rm, git no longer tracks them. The path is
# guarded to WORKTREE_ROOT/* so a mis-derived root can never rm outside it.
reaped=0
if [ "$nr" -gt 0 ]; then
  echo -e "${YELLOW}▸ Reaping ${nr} orphan dir(s)...${NC}"
  for i in "${!REAP_PATHS[@]}"; do
    p="${REAP_PATHS[$i]}"
    case "$p" in
      "$WORKTREE_ROOT"/?*)
        if rm -rf "$p"; then
          echo -e "  ${GREEN}✓${NC} $(basename "$p") ($(human_size "${REAP_KB[$i]}") — ${REAP_LABELS[$i]})"
          reaped=$((reaped+1))
        else
          echo -e "  ${RED}✗${NC} $(basename "$p") — rm failed; skipped"
        fi ;;
      *) echo -e "  ${RED}✗${NC} refusing to rm outside \$WORKTREE_ROOT: $p" >&2 ;;
    esac
  done
fi

# Delete worktree-less landed branches (pass 3). Gated on --delete-branches, the
# same flag that governs branch deletion in pass 1 — --apply alone never touches
# a ref. `-D`, not `-d`: squash-merge leaves the tip un-ancestored so `-d` refuses
# on exactly the landed branches this pass exists for. The remote-gone + PR-MERGED
# verdict is what makes that safe, and the commits stay on origin/main regardless.
deleted=0
if $DELETE_BRANCHES && [ "$nb" -gt 0 ]; then
  echo -e "${YELLOW}▸ Deleting ${nb} worktree-less branch(es)...${NC}"
  for i in "${!DELETE_BRANCH_NAMES[@]}"; do
    b="${DELETE_BRANCH_NAMES[$i]}"
    if err="$(git branch -D "$b" 2>&1)"; then
      echo -e "  ${GREEN}✓${NC} ${b} (${DELETE_BRANCH_LABELS[$i]})"
      deleted=$((deleted+1))
    else
      echo -e "  ${RED}✗${NC} ${b} — branch delete failed; skipped"
      printf '%s\n' "$err" | sed 's/^/        /' >&2
    fi
  done
elif [ "$nb" -gt 0 ]; then
  echo -e "${YELLOW}▸ ${nb} worktree-less branch(es) left in place — re-run with --delete-branches.${NC}"
fi

# Delete orphan remote refs (pass 4). The only outward-facing mutation here, so it
# needs BOTH --apply and the opt-in flag; `git push --delete` is batched into one
# invocation because each push is a network round trip and a shared-quota call.
ref_deleted=0
if $SWEEP_REMOTE_REFS && [ "$nrf" -gt 0 ]; then
  echo -e "${YELLOW}▸ Deleting ${nrf} orphan remote ref(s)...${NC}"
  if err="$(git push origin --delete "${DELETE_REF_NAMES[@]}" 2>&1)"; then
    for i in "${!DELETE_REF_NAMES[@]}"; do
      echo -e "  ${GREEN}✓${NC} origin/${DELETE_REF_NAMES[$i]} (${DELETE_REF_LABELS[$i]})"
    done
    ref_deleted=$nrf
    git fetch --prune origin --quiet 2>/dev/null || true
  else
    echo -e "  ${RED}✗${NC} remote ref delete failed; nothing removed" >&2
    printf '%s\n' "$err" | sed 's/^/        /' >&2
  fi
fi

git worktree prune 2>/dev/null || true
echo -e "${GREEN}Done — removed ${removed}/${n} worktree(s), reaped ${reaped}/${nr} orphan(s), deleted ${deleted}/${nb} branch(es), ${ref_deleted}/${nrf} remote ref(s).${NC}"
