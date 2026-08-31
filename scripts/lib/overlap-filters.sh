# lib/overlap-filters.sh — pure helpers for new-task.sh's two overlap gates.
#
# Sourced. Defines:
#   derive_issue_from_slug SLUG          -> echoes a ticket number, or nothing
#   filter_live_branches BASE MERGED_LIST < candidates   -> echoes live ones only
#
# These live here rather than inline in new-task.sh for one reason: new-task.sh
# refuses to run outside the primary worktree (by design), so inline logic cannot
# be exercised by a test. Both gates failed silently in production for months —
# untestable guards are how that happens. Sibling of lib/issue-overlap.sh.
#
# brik-llm#1485.

# shellcheck disable=SC2148  # sourced

# A ticket number embedded at the end of a slug. Brik slugs routinely carry it:
# agent-brik-llm-1461, launch-agent-health-672, claude-home-sync-1301.
#
# Deliberately narrow — 2 to 5 digits, at the END, preceded by a non-digit:
#   - 1 digit would match "phase-2" and "v3", which are not tickets
#   - 6+ digits is a date or an id (20260727), not a brik issue number
#   - mid-slug numbers ("phase-3-5-content-audit") are version markers; matching
#     them would gate on a wrong, possibly real, ticket — worse than not gating
derive_issue_from_slug() {
  printf '%s' "${1:-}" | sed -n 's/.*[^0-9]\([0-9]\{2,5\}\)$/\1/p'
}

# Read candidate branch lines on stdin (as `git branch -r` prints them) and echo
# only those that are still LIVE — not merged via a PR, and not already contained
# in BASE.
#
# Args: BASE_REF (e.g. origin/main), MERGED_HEADS (newline-separated head refs).
#
# Why both checks: a squash-merged PR leaves the branch NOT an ancestor of base,
# so the ancestor test alone misses it; and a branch merged directly (or whose PR
# record is unavailable because the gh call failed) is missed by the PR list
# alone. Either signal is sufficient to call it landed.
filter_live_branches() {
  local base_ref="${1:?filter_live_branches needs a base ref}"
  local merged_heads="${2:-}"
  local line cand
  while IFS= read -r line; do
    [ -n "$line" ] || continue
    cand="$(printf '%s' "${line#*origin/}" | tr -d '[:space:]')"
    [ -n "$cand" ] || continue
    if [ -n "$merged_heads" ] && printf '%s\n' "$merged_heads" | grep -qxF "$cand"; then
      continue
    fi
    if git merge-base --is-ancestor "origin/$cand" "$base_ref" 2>/dev/null; then
      continue
    fi
    printf '%s\n' "$line"
  done
}

# Second pass: for each SURVIVING candidate on stdin, ask GitHub directly whether
# its PR merged, and drop it if so.
#
# Needed because the bulk pass has two blind spots that overlap exactly:
#   - `gh pr list --state merged --limit N` only covers the N most recent PRs, so
#     an old branch (measured: task/security-leak-guard-netlify-env-get, PR #308)
#     is absent from the list
#   - and a SQUASH-merged branch is not an ancestor of base, so the cheap git
#     check misses it too
# Together those left one tombstone still warning after the bulk filter.
#
# Affordable because it runs only on survivors — typically 0-3 branches, versus
# one call per candidate which would burn the fleet's shared hourly GitHub quota
# (rag:github-api-quota-is-shared-across-the-fleet) on every single new task.
#
# GH_PR_STATE_CMD is an injection point for tests; it defaults to the real gh.
drop_merged_by_lookup() {
  local line cand state
  while IFS= read -r line; do
    [ -n "$line" ] || continue
    cand="$(printf '%s' "${line#*origin/}" | tr -d '[:space:]')"
    [ -n "$cand" ] || continue
    state="$(${GH_PR_STATE_CMD:-_gh_pr_state} "$cand" 2>/dev/null || true)"
    [ "$state" = "MERGED" ] && continue
    printf '%s\n' "$line"
  done
}

_gh_pr_state() {
  gh pr list --head "$1" --state all --limit 1 --json state --jq '.[0].state // ""' 2>/dev/null
}
