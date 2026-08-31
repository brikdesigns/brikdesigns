#!/usr/bin/env bash
# gh-error-classify.sh — tell an exhausted GitHub quota apart from a broken token.
#
# Spec: brik-llm#1590 (sub-issue of #1587).
#
# The bug this closes: `cleanup-merged-worktrees.sh` did
#
#   REPO_SLUG="$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo '')"
#   [ -z "$REPO_SLUG" ] && echo "Error: gh CLI not authenticated or no repo detected."
#
# which discards stderr and reads ANY failure as an auth failure. During the
# 2026-07-26 GraphQL exhaustion that sent a live session hunting a token problem
# while `gh auth status` was healthy the whole time (#1587). The same
# swallow-stderr shape recurs across the scripts that call `gh`.
#
# HOW THE RATE-LIMIT CASE IS DETECTED — and why not by string matching:
# GitHub documents a rate-limited request as HTTP 403 *or* 429 with
# `x-ratelimit-remaining: 0` and `x-ratelimit-reset` in UTC epoch seconds, but
# it does NOT specify the response body text
# (https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api,
# fetched 2026-07-30). So a regex over the body is a guess. Instead this asks
# `gh api rate_limit`, which is unmetered — measured on #1587, it keeps answering
# after the bucket hits zero, which is exactly the condition being diagnosed.
# Body text is used only as a supplementary signal, never as the primary test.
#
# COST: zero GraphQL points. `gh_repo_slug` reads the git remote instead of
# calling `gh repo view` (1 point), and `rate_limit` is unmetered. A preflight
# that spends quota to check quota is the wrong shape.
#
# ── This file is a byte-identical copy. brikdesigns/brik-llm is the SOURCE. ────
#
# Several repos ship it, and they are separate git repos, so these are deliberate
# copies and not an import. The authoritative list of which repos carry it is the
# `TWINS` registry in brik-llm's scripts/audit/overlap-twin-drift.py, NOT this
# comment — a list written here rots the moment a repo is added, and did: the
# previous wording named two sibling repos while four copies existed, and no two
# copies agreed on which two (brik-llm#2447).
#
# NEVER edit this file anywhere but brik-llm. Fix it there and re-sync every copy
# in the same change — brik-llm's `overlap-twin-drift` workflow compares each
# copy's sha256 against brik-llm's and reads a local edit as DRIFT, not an
# improvement. It fails on a missing copy too.
#
# Usage (sourced):
#   source scripts/lib/gh-error-classify.sh
#
#   # Preferred: zero-cost slug, with a correctly-named error if it can't resolve.
#   REPO_SLUG="$(gh_repo_slug)" || { gh_explain_failure; exit 1; }
#
#   # Or classify a failure you already captured:
#   if ! out="$(gh pr view 1 --json state 2>/tmp/err)"; then
#     gh_explain_failure "$(cat /tmp/err)"
#     exit 1
#   fi
#
#   gh_classify "$stderr_text"   # → auth | rate_limit | network | not_found | unknown
#
# Test: scripts/lib/tests/test-gh-error-classify.sh (stderr fixtures captured
# from real gh failures; the rate-limit probe is stubbed via
# GH_CLASSIFY_RATE_LIMIT_JSON so the tests need no network and spend nothing).

# No `set -e` here — this file is sourced into callers with their own settings.

# ── Zero-API repo slug ──────────────────────────────────────────────────────
# `gh repo view --json nameWithOwner` costs 1 GraphQL point and fails when the
# bucket is empty, which is the whole problem. The remote URL is local and free.
# Echoes owner/name and returns 0, or returns 1 with nothing on stdout.
gh_repo_slug() {
  local url
  url="$(git remote get-url origin 2>/dev/null)" || return 1
  [ -n "$url" ] || return 1
  # git@github.com:owner/name.git | https://github.com/owner/name(.git) |
  # ssh://git@github.com/owner/name.git — brik-mini rewrites git@ → https via
  # insteadOf, so both forms occur on the fleet.
  local slug="$url"
  slug="${slug%.git}"
  slug="${slug#*github.com:}"
  slug="${slug#*github.com/}"
  case "$slug" in
    */*/*|"") return 1 ;;   # not owner/name — refuse rather than guess
    */*) printf '%s\n' "$slug" ;;
    *) return 1 ;;
  esac
}

# ── Rate-limit probe (unmetered) ────────────────────────────────────────────
# Overridable so the tests never touch the network. Empty output means the probe
# itself failed, which the classifier treats as inconclusive, not as "fine".
gh_rate_limit_json() {
  if [ -n "${GH_CLASSIFY_RATE_LIMIT_JSON:-}" ]; then
    printf '%s' "$GH_CLASSIFY_RATE_LIMIT_JSON"
    return 0
  fi
  gh api rate_limit 2>/dev/null || true
}

# Echoes "<bucket> <reset_epoch>" for the first exhausted bucket, else nothing.
# A bucket is exhausted at remaining == 0 — GitHub's documented signal.
gh_exhausted_bucket() {
  local json
  json="$(gh_rate_limit_json)"
  [ -n "$json" ] || return 1
  printf '%s' "$json" | python3 -c '
import json, sys
try:
    res = json.load(sys.stdin).get("resources", {})
except (ValueError, AttributeError):
    sys.exit(1)
for name in ("graphql", "core", "search"):
    b = res.get(name) or {}
    if b.get("remaining") == 0:
        print(name, b.get("reset", 0))
        sys.exit(0)
sys.exit(1)
' 2>/dev/null
}

# ── Reset-time rendering ────────────────────────────────────────────────────
# BSD date (macOS) takes -r <epoch>; GNU date (CI) takes -d @<epoch>.
gh_format_reset() {
  local epoch="${1:-}" when mins
  # Explicit if, not `A && B || C` — with the numeric test guarded by
  # 2>/dev/null for a non-integer epoch, the short-circuit form would run the
  # fallback even on success (SC2015).
  if [ -z "$epoch" ] || ! [ "$epoch" -gt 0 ] 2>/dev/null; then
    printf 'unknown'
    return
  fi
  when="$(date -u -r "$epoch" +'%H:%M UTC' 2>/dev/null \
       || date -u -d "@$epoch" +'%H:%M UTC' 2>/dev/null)"
  mins=$(( (epoch - $(date +%s)) / 60 ))
  [ "$mins" -lt 0 ] && mins=0
  printf '%s (in ~%dm)' "${when:-unknown}" "$mins"
}

# ── Classifier ──────────────────────────────────────────────────────────────
# Args: [stderr_text]. Echoes exactly one of:
#   rate_limit | network | auth | not_found | unknown
#
# Order matters. Network is first because an unreachable API makes every other
# signal untrustworthy — including the rate-limit probe. Rate limit comes before
# auth because that inversion is the bug: a 403 from an empty bucket and a 401
# from a dead token both produce empty stdout, and the old code called both
# "not authenticated".
#
# Every pattern below except the rate-limit body text was captured from a real
# `gh` failure on brik-mini 2026-07-30 (see the test fixtures).
gh_classify() {
  local err="${1:-}"

  # 1. Transport. Captured: `Post "https://api.github.com/graphql":
  #    proxyconnect tcp: dial tcp 127.0.0.1:9: connect: connection refused`
  if printf '%s' "$err" | grep -Eqi \
    'dial tcp|proxyconnect|no such host|connection refused|i/o timeout|TLS handshake|context deadline exceeded|network is unreachable|EOF$'; then
    printf 'network\n'; return 0
  fi

  # 2. Quota. The free probe is authoritative; body text is a fallback for the
  #    secondary-rate-limit case, whose message GitHub documents as existing but
  #    does not specify verbatim.
  if gh_exhausted_bucket >/dev/null 2>&1; then
    printf 'rate_limit\n'; return 0
  fi
  if printf '%s' "$err" | grep -Eqi \
    'rate limit|secondary rate limit|HTTP 429|too many requests|abuse detection'; then
    printf 'rate_limit\n'; return 0
  fi

  # 3. Auth. Captured: `HTTP 401: Bad credentials (https://api.github.com/graphql)`,
  #    `gh: Bad credentials (HTTP 401)`, `Try authenticating with:  gh auth login`
  if printf '%s' "$err" | grep -Eqi \
    'HTTP 401|Bad credentials|gh auth login|not logged in|authentication required|requires authentication|SAML enforcement'; then
    printf 'auth\n'; return 0
  fi

  # 4. Missing target. Captured: `GraphQL: Could not resolve to a Repository
  #    with the name 'owner/name'. (repository)`
  if printf '%s' "$err" | grep -Eqi \
    'Could not resolve to a|HTTP 404|not found|no such repository'; then
    printf 'not_found\n'; return 0
  fi

  printf 'unknown\n'
}

# ── Operator message ────────────────────────────────────────────────────────
# Args: [stderr_text]. Prints a correctly-named diagnosis to STDERR, and echoes
# the bare class on STDOUT so a caller can branch on it:
#   class="$(gh_explain_failure "$err")"   # message goes to the operator
#
# The `unknown` branch prints the raw stderr. Discarding it is the original sin
# this helper exists to undo — an unrecognised failure must still hand the
# operator the actual message, not a confident wrong label.
gh_explain_failure() {
  local err="${1:-}" class bucket reset
  class="$(gh_classify "$err")"

  case "$class" in
    rate_limit)
      read -r bucket reset <<<"$(gh_exhausted_bucket 2>/dev/null)"
      echo "GitHub API quota EXHAUSTED — this is not an auth problem." >&2
      if [ -n "${bucket:-}" ]; then
        echo "  Bucket:  ${bucket} (remaining 0)" >&2
        echo "  Resets:  $(gh_format_reset "${reset:-0}")" >&2
      else
        echo "  A rate limit was reported but the probe could not name the bucket." >&2
      fi
      echo "  Every session and ~15 LaunchAgents share one 5,000/hour GraphQL" >&2
      echo "  bucket on the same token (brik-llm#1587). Do NOT rotate anything." >&2
      echo "  Who spent it:  brik-llm/scripts/audit/gh-call-report.sh --hours 1" >&2
      echo "  Headroom:      gh api rate_limit --jq '.resources'" >&2
      ;;
    auth)
      echo "GitHub authentication failed." >&2
      echo "  Check:  gh auth status" >&2
      echo "  Fix:    gh auth login" >&2
      ;;
    network)
      echo "GitHub is unreachable — transport failure, not auth and not quota." >&2
      echo "  Check:  curl -sSf https://api.github.com/zen" >&2
      ;;
    not_found)
      echo "GitHub returned not-found — the repo or object does not exist, or the" >&2
      echo "  token cannot see it. Not an outage and not a quota problem." >&2
      ;;
    *)
      echo "GitHub call failed for an unrecognised reason. Raw stderr follows —" >&2
      echo "  it is NOT being classified, because guessing is what #1590 fixed." >&2
      ;;
  esac

  if [ -n "$err" ]; then
    printf '  gh said: %s\n' "$(printf '%s' "$err" | head -3 | tr '\n' ' ')" >&2
  fi
  printf '%s' "$class"
}
