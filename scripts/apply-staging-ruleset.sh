#!/usr/bin/env bash
# apply-staging-ruleset.sh — put `staging`'s required status checks in code
# (brikdesigns#1334).
#
# Nothing was a required status check on `staging`, so PR #1320 merged with its
# own `mockup` gate red, the checked-in mockup baseline went stale, and every
# PR in the repo failed identically for ~100 minutes. Every gate ran and
# reported correctly; only enforcement was missing.
#
# This lives in the repo rather than in a click-path because a branch ruleset is
# invisible in the tree: nothing in a checkout tells you which checks block, and
# the one signal that did — `gh-wait-checks.sh` printing "no required contexts
# resolved for staging" — was read past as a tooling caveat by three sessions in
# one day. Running this is auditable; clicking it is not.
#
# ── ORDERING (load-bearing) ──────────────────────────────────────────────────
#
# Do NOT apply this before the `changes`-job conversion is on `staging`.
#
# GitHub keeps a path-filter-skipped workflow's check Pending, and a PR that
# requires it "will be blocked from merging"
# (https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax
#  #onpushpull_requestpull_request_targetpathspaths-ignore). While `staging`
# still carries `on.paths` on verify/a11y/visual-mockup/visual-regression, a
# doc-only PR produces no check-run for them at all and would wedge — the same
# repo-wide block this ticket exists to prevent. The conversion makes those
# gates report `skipped` instead, which a required check accepts
# (https://docs.github.com/en/repositories/configuring-branches-and-merges-in-
#  your-repository/managing-protected-branches/about-protected-branches).
#
# Usage:
#   scripts/apply-staging-ruleset.sh --check    # report drift, change nothing
#   scripts/apply-staging-ruleset.sh --apply    # create or update the ruleset

set -euo pipefail

REPO="${REPO:-brikdesigns/brikdesigns}"
RULESET_NAME="staging — required status checks"

# ── The required set, and why each one is on or off it ───────────────────────
#
# ON — every gate that reports a verdict on the PR's own diff:
#   gitleaks                a committed secret must never reach staging
#   closing-keyword-guard   a mis-parsed `Closes #N` silently closes live work
#   verify                  lint + token gate + schema parity
#   axe                     WCAG 2.1 AA on the deploy-preview
#   regression              our own rendering shifted (declaration-waivable)
#   mockup                  the landing baseline moved
#
# `mockup` is the contested one (AC 5): it reddens whenever the checked-in
# baseline drifts, and #837 records that CMS content edits do that routinely.
# It is required anyway, because a stale baseline ALREADY blocks every other PR
# in the repo — that is precisely what #1320 caused. Requiring it moves the
# block onto the PR that caused the drift instead of onto everybody else, and
# the remedy is a one-command rebless the workflow header already documents.
#
# OFF — deliberately:
#   visual-parity      `continue-on-error` by design (visual-parity.yml:92) and
#                      it runs on `push`, not `pull_request`. Requiring it would
#                      invert its stated purpose.
#   require-area-label pr-label-gate.yml:43-49 documents why: a cancelled
#                      check-run keeps reporting `expected` and only a new head
#                      SHA clears it (brik-llm#2094). Requiring it strands PRs.
#   *-contract         the scripts self-test workflows are still path-filtered
#                      at the workflow level, so they are not requirable.
#   refuse-promote-to-main
#                      only fires on PRs targeting `main`; irrelevant to staging.
REQUIRED_CONTEXTS=(
  gitleaks
  closing-keyword-guard
  verify
  axe
  regression
  mockup
)

MODE="${1:-}"
if [[ "$MODE" != "--check" && "$MODE" != "--apply" ]]; then
  echo "usage: $0 --check | --apply" >&2
  exit 2
fi

intended_json() {
  printf '%s\n' "${REQUIRED_CONTEXTS[@]}" \
    | jq -R . | jq -s '{
        name: $name,
        target: "branch",
        enforcement: "active",
        conditions: { ref_name: { include: ["refs/heads/staging"], exclude: [] } },
        bypass_actors: [],
        rules: [{
          type: "required_status_checks",
          parameters: {
            # Loose, not strict: this repo merges with merge-commits and task
            # branches routinely sit behind staging. Strict would demand an
            # update-branch on every PR whenever staging moves, which is a
            # different (and unasked-for) policy.
            strict_required_status_checks_policy: false,
            do_not_enforce_on_create: false,
            required_status_checks: [ .[] | { context: . } ]
          }
        }]
      }' --arg name "$RULESET_NAME"
}

# `gh api --jq` takes no --arg, so the name is bound through a real jq call.
existing_id() {
  gh api "repos/$REPO/rulesets" \
    | jq -r --arg name "$RULESET_NAME" 'map(select(.name == $name)) | .[0].id // empty'
}

live_contexts() {
  local id="$1"
  gh api "repos/$REPO/rulesets/$id" --jq \
    '.rules[] | select(.type=="required_status_checks")
     | .parameters.required_status_checks[].context' 2>/dev/null | sort
}

ID="$(existing_id || true)"

if [[ "$MODE" == "--check" ]]; then
  if [[ -z "$ID" ]]; then
    echo "✗ no ruleset named '$RULESET_NAME' on $REPO — staging is UNPROTECTED"
    exit 1
  fi
  want="$(printf '%s\n' "${REQUIRED_CONTEXTS[@]}" | sort)"
  got="$(live_contexts "$ID")"
  echo "▸ ruleset $ID on $REPO"
  if [[ "$want" == "$got" ]]; then
    echo "✓ required contexts match:"
    printf '    %s\n' $got
    exit 0
  fi
  echo "✗ drift between intended and live required contexts:"
  diff <(printf '%s\n' "$want") <(printf '%s\n' "$got") || true
  exit 1
fi

BODY="$(intended_json)"
if [[ -n "$ID" ]]; then
  echo "▸ updating ruleset $ID on $REPO"
  printf '%s' "$BODY" | gh api --method PUT "repos/$REPO/rulesets/$ID" --input - >/dev/null
else
  echo "▸ creating ruleset on $REPO"
  printf '%s' "$BODY" | gh api --method POST "repos/$REPO/rulesets" --input - >/dev/null
fi

exec "$0" --check
