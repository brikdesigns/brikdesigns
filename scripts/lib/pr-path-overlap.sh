#!/usr/bin/env bash
# pr-path-overlap.sh — warn when an open PR already touches a path in this diff.
#
# Two entry points, same predicate, different moment:
#   check_pr_path_overlap    — pr-task.sh, after the base-sync. Paths come from
#                              the diff, so they are exact but the work is done.
#   check_ticket_path_overlap — new-task.sh, before the worktree exists. Paths
#                              come from the TICKET, so they are approximate but
#                              nothing has been written yet (brik-llm#2313).
#
# Sourced by pr-task.sh after the base-sync, before the PR is created. Written
# first in brik-bds (brik-bds#1545, the same-path slice of brik-llm#1485), ported
# to brik-llm as canon per brik-llm#1697 and to brik-client-portal per
# brik-llm#2323.
#
# Every `#N` below is REPO-QUALIFIED, and that is load-bearing rather than
# pedantic: this file is a byte-identical twin across repos, so an unqualified
# number resolves against whatever repo is doing the reading, not against the one
# that wrote it. Brik numbering runs in the same range everywhere, so the wrong
# answer is usually a real ticket rather than a 404.
# The warning at check_pr_path_overlap's tail cited brik-llm#1533 unqualified,
# and in brik-client-portal that number is a merged CMS PR about content_pages —
# an unrelated ticket named to the operator as the reason for the warning
# (brik-llm#2916). Qualify every new one.
#
# Why this exists, and why the ticket-keyed gate cannot cover it: brik-llm#1533 keys
# on
# the ISSUE NUMBER. On 2026-07-29 two PRs from two sessions changed only
# `scripts/propagate.sh`, 54 minutes apart, under two different tickets —
# brik-bds#1528 (14:27:06Z) and brik-bds#1529 (15:21:41Z). No number-keyed predicate can see
# that; the overlap was in the paths. Same lines re-litigated three times.
#
# Why it warns rather than blocks: two sessions editing one file is often
# legitimate — the second pass on the 2026-07-20 hook consolidation caught two
# stale refs the first missed (brik-llm#1485, first comment). The cost this
# removes is discovering the collision at merge time instead of at open time.
#
# The pure decision logic lives at the top so a test can exercise it without a
# network or a repo. pr-task.sh guards on branch and tree state and refuses to
# run from a clean main, so anything inline there is untestable — the same
# reason lib/overlap-filters.sh and lib/issue-claim.sh exist.
#
# Usage (sourced):
#   source scripts/lib/pr-path-overlap.sh
#   check_pr_path_overlap main "$BRANCH"     # PR-create time, paths from the diff
#   check_ticket_path_overlap 2313           # task-start time, paths from the ticket
#
# This file is a WATCHED IDENTICAL TWIN: brik-llm holds canon and the consumer
# repos ship byte-identical copies, gated by `overlap-twin-drift`. Fix it in
# brik-llm and re-sync; a local edit in a consumer is read as drift, not as an
# improvement (brik-llm#2916).
#
# WHICH repos carry it is deliberately not written here. The `TWINS` registry in
# brik-llm's scripts/audit/overlap-twin-drift.py is the record, and a count in
# prose is how every twin header in this family went stale — this one claimed
# brik-client-portal did not carry the file for the 12 days after brik-llm#2323
# put it there (brik-llm#2272/#2447).
#
# Return codes: always 0. This is a warning, not a gate.

# shellcheck disable=SC2148  # sourced

_PPO_YELLOW='\033[1;33m'
_PPO_GREEN='\033[0;32m'
_PPO_NC='\033[0m'

# Set by check_ticket_path_overlap; read by the sibling-worktree gate in
# issue-overlap.sh (brik-llm#1932). Declared here so it is defined even when that
# function never runs — new-task.sh reads it unconditionally under `set -u`.
PTO_TICKET_PATHS="${PTO_TICKET_PATHS:-}"

# ── Pure helpers (no network, no git) ──────────────────────────────

# Exact-match intersection of two newline-separated path lists, order-preserving
# on the SECOND list and de-duplicated.
#
# Exact match only, deliberately: `components/ui/button.tsx` and
# `components/ui/button.css` are two different files, and a same-directory
# heuristic would report the whole of `components/ui/` as one overlap. That is
# how new-task.sh's keyword variant (a single word from the slug, :285-307)
# generates noise, and a gate that is usually wrong trains everyone to skip it —
# measured in brik-llm#1533, where 6 of 6 emittable warnings were false positives before
# filtering.
intersect_paths() {
  local mine="${1:-}" theirs="${2:-}"
  [ -n "$mine" ] && [ -n "$theirs" ] || return 0
  awk '
    NR == FNR { if ($0 != "") mine[$0] = 1; next }
    { if ($0 != "" && ($0 in mine) && !seen[$0]++) print }
  ' <(printf '%s\n' "$mine") <(printf '%s\n' "$theirs")
}

# Read open-PR records on stdin and echo only those sharing a path with MINE.
#
#   in:   number<TAB>headRefName<TAB>title<TAB>path,path,path
#   out:  number<TAB>title<TAB>shared,shared
#
# MY_BRANCH is excluded by HEAD REF, not by number: at pr-task.sh time this
# branch's PR does not exist yet, so there is no number to compare against, and
# a re-run after a push must not report the branch against itself.
#
# Paths arrive comma-joined (the shape new-task.sh already uses). A comma inside
# a filename would mis-split — no tracked path in this repo has one
# (`git ls-files | grep -c ,` → 0) and because the match is exact, a mis-split
# can only MISS a warning, never invent one.
overlapping_prs() {
  local mine="${1:-}" my_branch="${2:-}" num head title paths shared
  [ -n "$mine" ] || return 0
  while IFS=$'\t' read -r num head title paths; do
    [ -n "$num" ] || continue
    [ -n "$my_branch" ] && [ "$head" = "$my_branch" ] && continue
    shared="$(intersect_paths "$mine" "$(printf '%s' "$paths" | tr ',' '\n')")"
    [ -n "$shared" ] || continue
    printf '%s\t%s\t%s\n' "$num" "$title" "$(printf '%s\n' "$shared" | paste -sd, -)"
  done
}

# ── Network-touching orchestration ─────────────────────────────────

# ONE gh call for every open PR and its files, never one call per PR: the fleet
# shares a single hourly GitHub API bucket
# (rag:github-api-quota-is-shared-across-the-fleet) and this runs on every PR.
#
# `--json files` caps at 100 files per PR (GraphQL page size). A PR bigger than
# that can hide an overlap past file 100 — an under-report, which is the safe
# direction for a warning.
#
# GH_OPEN_PR_CMD is the test injection point; it defaults to the real gh.
_ppo_my_paths() {
  git diff --name-only "origin/${1}..HEAD"
}

_ppo_open_prs() {
  gh pr list --state open --limit 100 \
    --json number,headRefName,title,files \
    --jq '.[] | "\(.number)\t\(.headRefName)\t\(.title)\t\(.files | map(.path) | join(","))"' \
    2>/dev/null
}

# check_pr_path_overlap <base-branch> <my-branch>
check_pr_path_overlap() {
  local base="${1:?check_pr_path_overlap needs a base branch}" my_branch="${2:-}"

  if ! command -v gh >/dev/null 2>&1; then
    echo -e "${_PPO_YELLOW}⚠  gh not on PATH — skipping the same-path open-PR check.${_PPO_NC}" >&2
    return 0
  fi

  # Two-dot against the fetched remote base: pr-task.sh merges origin/$base
  # before this runs, so a three-dot diff would re-list everything that merge
  # brought in as if it were this branch's work (the brik-llm#1001 class).
  #
  # PPO_DIFF_CMD is the test injection point — without it, exercising this
  # function would mean running `git diff` against whatever repo the test happens
  # to be standing in, which is the brik-llm#1539 failure mode in read-only clothing.
  local mine
  mine="$(${PPO_DIFF_CMD:-_ppo_my_paths} "$base" 2>/dev/null || true)"
  if [ -z "$mine" ]; then
    return 0
  fi

  # Status and output captured from ONE invocation. Calling twice — once for the
  # data, once to test whether it failed — would double the quota cost of the
  # cheapest branch.
  local records rc=0
  records="$(${GH_OPEN_PR_CMD:-_ppo_open_prs})" || rc=$?
  if [ "$rc" -ne 0 ]; then
    # A failed call must say so out loud rather than read as an all-clear.
    echo -e "${_PPO_YELLOW}⚠  Could not list open PRs — same-path check skipped, not passed.${_PPO_NC}" >&2
    return 0
  fi
  [ -n "$records" ] || return 0

  local hits
  hits="$(printf '%s\n' "$records" | overlapping_prs "$mine" "$my_branch")"
  if [ -z "$hits" ]; then
    echo -e "  ${_PPO_GREEN}No open PR touches a path in this diff.${_PPO_NC}"
    return 0
  fi

  echo ""
  echo -e "${_PPO_YELLOW}⚠  Open PR(s) already touching a path in this diff:${_PPO_NC}"
  printf '%s\n' "$hits" | awk -F'\t' '{ printf "    PR #%s — %s\n        %s\n", $1, $2, $3 }'
  echo ""
  echo -e "${_PPO_YELLOW}   Different tickets, same file is invisible to the ticket-keyed gate${_PPO_NC}"
  echo -e "${_PPO_YELLOW}   (brik-llm#1533): brik-bds#1528 and brik-bds#1529 rewrote the same 15${_PPO_NC}"
  echo -e "${_PPO_YELLOW}   scripts/propagate.sh 54 minutes apart. brik-llm#1485.${_PPO_NC}"
  echo ""
  echo -e "${_PPO_YELLOW}   Read those PRs before merging this one.${_PPO_NC}"

  # Never block and never hang: a closed stdin in an agent session must not sit
  # on `read` (brik-llm#1099, and the same defect still live in issue-overlap.sh's
  # prompt — brik-bds#1549).
  if [ -t 0 ]; then
    echo -e "${_PPO_YELLOW}   Press Enter to continue, Ctrl+C to abort.${_PPO_NC}"
    read -r || true
  else
    echo -e "${_PPO_YELLOW}   → non-interactive: continuing.${_PPO_NC}"
  fi
  return 0
}

# ── Task-start variant (brik-llm#2313) ─────────────────────────────────────
#
# Same predicate, moved to where it is still actionable. Everything above runs
# at PR-create, which makes it a collision REPORT: on 2026-08-18 a session
# finished the whole handoff-lint R19 change and only then read
# "No open PR touches a path in this diff." Correct, and useless — the cost was
# already sunk.
#
# The hard part at task-start is that there is no diff to read. The paths have
# to come from the ticket, which means text, which means false positives — and
# brik-llm#2101 is the standing evidence that a gate which cries wolf gets switched off.
# The defence is that a candidate only counts if it is a file that actually
# exists in this repo. `brikdesigns/brik-llm`, `https://research.trychroma.com/
# context-rot` and `e.g.` all match a path-shaped regex; none of them survives
# `git ls-files`.

# Path-like tokens named in TEXT, narrowed to paths present in TRACKED.
#
#   in:   arg1 = free text (issue title + body), arg2 = newline-separated
#         tracked paths (git ls-files)
#   out:  repo-relative paths, text order, de-duplicated
#
# A bare basename with no directory is resolved only when it is UNAMBIGUOUS —
# exactly one tracked file carries it. Issue prose overwhelmingly writes
# `new-task.sh`, not `scripts/new-task.sh` (brik-llm#2313's own body does it five
# times), so dropping the bare form entirely would miss the file most tickets
# are about. The uniqueness test is what stops a duplicated basename resolving
# to an arbitrary one of its candidates.
#
# It costs real coverage, and the cost is worth naming: this repo has TWO
# tracked `new-task.sh` (`scripts/` and `scripts/shared/`, verified 2026-08-18
# with `git ls-files | grep 'new-task.sh$'`), so brik-llm#2313's own bare mentions
# resolve to nothing. Emitting both candidates instead would flag a PR touching
# `scripts/shared/new-task.sh` for a ticket that meant `scripts/` — a warning
# that is wrong, which is the brik-llm#2101 failure and worse than a warning that is
# missing. An under-report is the safe direction for a warning; a full path
# written anywhere in the body still matches exactly.
ticket_paths_from_text() {
  local text="${1:-}" tracked="${2:-}"
  [ -n "$text" ] && [ -n "$tracked" ] || return 0
  awk '
    NR == FNR {
      if ($0 == "") next
      full[$0] = 1
      n = split($0, seg, "/")
      basecount[seg[n]]++
      basepath[seg[n]] = $0
      next
    }
    {
      if ($0 == "") next
      if ($0 in full) { if (!seen[$0]++) print $0; next }
      # Require a dot so a bare directory-ish word ("main", "operations") cannot
      # resolve; require uniqueness so an ambiguous basename resolves to nothing.
      if (index($0, "/") == 0 && index($0, ".") > 0 && basecount[$0] == 1) {
        if (!seen[basepath[$0]]++) print basepath[$0]
      }
    }
  ' <(printf '%s\n' "$tracked") \
    <(printf '%s\n' "$text" \
        | grep -oE '[A-Za-z0-9_.@-]+(/[A-Za-z0-9_.@-]+)*' \
        | sed 's/[].,;:)]*$//')
}

# Split open-PR records by whether the TITLE references this ticket.
#
# A PR already open on this ticket is not a collision to report — issue-overlap.sh
# (brik-llm#1533) has just named it by number, and repeating it as a path hit is the
# duplicate-warning noise that trains the operator past both. Its changed paths
# are still the single best statement of what this ticket touches, so it moves
# from the hit list to the path list. Costs no extra `gh` call: the records are
# already in hand.
_pto_partition_records() {
  local num="$1" want="$2"   # want = mine | others
  awk -F'\t' -v n="$num" -v want="$want" '
    { hit = ($3 ~ "#" n "([^0-9]|$)") }
    (want == "mine") == (hit == 1) { print }
  '
}

# ONE REST call. `{owner}`/`{repo}` are expanded by gh from the current
# checkout, so a bare number needs no slug lookup and spends no GraphQL points.
_pto_issue_text() {
  local api_path="$1"
  gh api "$api_path" --jq '"\(.title)\n\(.body // "")"' 2>/dev/null
}

_pto_tracked_files() {
  git ls-files 2>/dev/null
}

# `2313`, `#2313` and `owner/repo#2313` — the three forms new-task.sh --issue
# already accepts (issue-overlap.sh:76-87). A cross-repo ticket still resolves
# against THIS repo's tracked files, which is correct: a path that does not
# exist here cannot collide with an open PR here.
_pto_issue_api_path() {
  local ref="${1:-}"
  if [[ "$ref" =~ ^([A-Za-z0-9._-]+)/([A-Za-z0-9._-]+)#?([0-9]+)$ ]]; then
    printf 'repos/%s/%s/issues/%s\n' "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}" "${BASH_REMATCH[3]}"
  elif [[ "$ref" =~ ^#?([0-9]+)$ ]]; then
    printf 'repos/{owner}/{repo}/issues/%s\n' "${BASH_REMATCH[1]}"
  else
    return 1
  fi
}

# check_ticket_path_overlap <issue-ref>
# Always returns 0 — this warns, it never blocks branch creation.
check_ticket_path_overlap() {
  local ref="${1:-}"
  # Cleared FIRST, before any early return. A stale value from a previous call
  # would hand the worktree gate (brik-llm#1932) the last ticket's paths and
  # report a collision against work this one never named.
  PTO_TICKET_PATHS=""
  [ -n "$ref" ] || return 0

  if ! command -v gh >/dev/null 2>&1; then
    echo -e "${_PPO_YELLOW}⚠  gh not on PATH — skipping the ticket path-overlap check.${_PPO_NC}" >&2
    return 0
  fi

  local api_path num
  api_path="$(_pto_issue_api_path "$ref")" || return 0
  num="${api_path##*/}"

  local records rc=0
  records="$(${GH_OPEN_PR_CMD:-_ppo_open_prs})" || rc=$?
  if [ "$rc" -ne 0 ]; then
    # Same rule as the PR-time path: a failed call says SKIPPED, never all-clear.
    echo -e "${_PPO_YELLOW}⚠  Could not list open PRs — ticket path-overlap skipped, not passed.${_PPO_NC}" >&2
    return 0
  fi

  local mine
  mine="$(ticket_paths_from_text \
            "$(${PTO_TEXT_CMD:-_pto_issue_text} "$api_path")" \
            "$(${PTO_TRACKED_CMD:-_pto_tracked_files})")"

  local own_paths
  own_paths="$(printf '%s\n' "$records" | _pto_partition_records "$num" mine \
               | cut -f4 | tr ',' '\n' | grep -v '^$' || true)"
  [ -n "$own_paths" ] && mine="$(printf '%s\n%s\n' "$mine" "$own_paths" | grep -v '^$' | awk '!seen[$0]++')"

  # Published for the sibling-worktree gate (brik-llm#1932), which asks the same
  # question of UNCOMMITTED local state and has no way to pay for this read
  # itself. A global rather than a return value because this function's stdout is
  # its human report, and because it is called directly from new-task.sh — not in
  # a command substitution — so the assignment survives.
  #
  # It carries the paths the TICKET names, which is the caller's file set at
  # task-start: new-task.sh:119-132 refuses to run when the primary worktree is
  # dirty, so "the files I have changed" is empty there by construction and only
  # "the files I am about to change" can collide with anything.
  PTO_TICKET_PATHS="$mine"

  if [ -z "$mine" ]; then
    # AC: degrade to a no-op WITH A NOTE. Silence here is indistinguishable from
    # an all-clear, and a gate that blocks branch creation on missing data gets
    # switched off.
    echo -e "  ${_PPO_YELLOW}No repo paths named in #${num} — same-path check skipped, not passed.${_PPO_NC}"
    return 0
  fi

  local hits
  hits="$(printf '%s\n' "$records" | _pto_partition_records "$num" others \
          | overlapping_prs "$mine" '')"
  if [ -z "$hits" ]; then
    echo -e "  ${_PPO_GREEN}No open PR touches a path named in #${num}.${_PPO_NC}"
    return 0
  fi

  echo ""
  echo -e "${_PPO_YELLOW}⚠  Open PR(s) already touching a path this ticket names:${_PPO_NC}"
  printf '%s\n' "$hits" | awk -F'\t' '{ printf "    PR #%s — %s\n        %s\n", $1, $2, $3 }'
  echo ""
  echo -e "${_PPO_YELLOW}   The ticket-number gate (brik-llm#1533) cannot see this: those PRs are on${_PPO_NC}"
  echo -e "${_PPO_YELLOW}   DIFFERENT tickets. Read them before you start writing — that is the${_PPO_NC}"
  echo -e "${_PPO_YELLOW}   whole point of asking now rather than at PR-create. brik-llm#2313.${_PPO_NC}"
  echo ""

  if [ -t 0 ]; then
    echo -e "${_PPO_YELLOW}   Press Enter to continue, Ctrl+C to abort.${_PPO_NC}"
    read -r || true
  else
    echo -e "${_PPO_YELLOW}   → non-interactive: continuing.${_PPO_NC}"
  fi
  return 0
}
