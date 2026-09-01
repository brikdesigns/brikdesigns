#!/usr/bin/env bash
# pr-title.sh — derive a PR title from the branch's first commit subject.
#
# pr-task.sh used to synthesize a title from the branch SLUG when no title arg
# was passed (`task/design-1169-card-media` → `design: 1169 card media`). That is
# exactly the antipattern issue-style.md § PR authoring names: no conventional
# type, no imperative verb, and the bare `1169` reads as a second issue ID
# alongside the PR's own `#`. 27 of the last 40 merged PRs carried that shape
# (brikdesigns#1177).
#
# The first commit on a branch is ALREADY a conventional-commit subject (the
# convention every Brik repo follows, conventional-commits.md), so it is the
# right source: `type(scope): imperative description (#N)`. This lib derives the
# title from it, appending `(#N)` from the branch when the subject lacks one.
#
# Pure functions only: no git, no gh, no network. The caller reads the first
# subject off the commit range and hands it in with the branch name, which is
# what makes scripts/__tests__/test-pr-title.sh able to drive every branch
# offline. Same split as lib/pr-labels.sh.

# Conventional-commit types. The 10 from conventional-commits.md § Types, plus
# `ops` and `revert`: `ops` is used as a type in this repo's history
# (`ops(infra): freeze the promote`, dd1ca39) and `revert` is standard. This
# list is the discriminator that separates a real subject (`feat(x): …`) from
# the branch-slug antipattern (`design: …`), where the leading token is the
# SCOPE, not a type.
PR_TITLE_TYPES="feat|fix|refactor|chore|docs|style|test|perf|ci|build|ops|revert"

# is_conventional_subject SUBJECT
# → exit 0 when SUBJECT is `type(scope)?!?: description`, non-zero otherwise.
is_conventional_subject() {
  # `!` (breaking) is accepted in both positions seen in Brik history:
  # `feat!(scope):` (conventional-commits.md's example) and the spec's
  # `feat(scope)!:`.
  printf '%s' "$1" | grep -qE "^(${PR_TITLE_TYPES})!?(\([a-z0-9,._/-]+\))?!?: .+"
}

# subject_has_issue_ref SUBJECT
# → exit 0 when SUBJECT already contains a `(#N)` reference.
subject_has_issue_ref() {
  printf '%s' "$1" | grep -qE '\(#[0-9]+\)'
}

# issue_number_from_branch BRANCH
# → prints the issue number in a `task/{scope}-{N}-{name}` branch, or nothing.
# new-task.sh embeds the ticket number as the first numeric slug segment; a
# ticketless branch (`task/design-how-it-works`) yields no number.
issue_number_from_branch() {
  printf '%s' "$1" | sed -nE 's|^(refs/heads/)?task/[a-z]+-([0-9]+)(-.*)?$|\2|p'
}

# pr_title_from_subject SUBJECT BRANCH
# → prints the resolved PR title and exits 0 when SUBJECT is conventional;
#   exits 1 (printing nothing) when it is not, so the caller can prompt rather
#   than fall back to the branch slug.
#   - subject already has `(#N)` → passed through unchanged
#   - subject lacks `(#N)`, branch carries a number → `(#N)` appended once
#   - subject lacks `(#N)`, branch has no number → passed through as-is
pr_title_from_subject() {
  local subject="$1" branch="$2" n
  is_conventional_subject "$subject" || return 1
  if subject_has_issue_ref "$subject"; then
    printf '%s' "$subject"
    return 0
  fi
  n="$(issue_number_from_branch "$branch")"
  if [ -n "$n" ]; then
    printf '%s (#%s)' "$subject" "$n"
  else
    printf '%s' "$subject"
  fi
}
