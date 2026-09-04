#!/usr/bin/env bash
# wait-for-netlify-preview.sh — block until a PR's Netlify deploy-preview is
# serving THIS commit, then until the gated route itself has settled.
#
# Why this exists (brikdesigns#1218): the visual gates used to poll
# `deploy-preview-<pr>--brikdesigns.netlify.app/` for a bare HTTP 200 and treat
# that as "ready". That URL is stable across every deploy of the PR, so a 200
# proves only that SOME deploy has been served there at SOME point — not that
# the build for the head commit has finished, and not that the route being
# gated has been rendered. On PR #1217 the mockup gate screenshotted a
# partially-rendered page and scored 66.02% against a 5% threshold on
# `/events/grind-after-graduation`, a route that branch does not touch; a re-run
# of the identical job on the identical commit passed.
#
# Two waits, in order:
#
#   1. The Netlify commit STATUS on the head SHA — context
#      `netlify/brikdesigns/deploy-preview`. This is the only signal tied to a
#      specific commit rather than to the PR. Its `target_url` is the deploy URL
#      Netlify actually published, so the URL is read from Netlify rather than
#      reconstructed from the PR number.
#
#   2. The gated ROUTE, until it returns 200 with a byte length that repeats
#      across two consecutive reads. Step 1 concludes when Netlify finishes
#      uploading; a Next.js route can still be cold on first request, and the
#      capture is a screenshot, not a fetch.
#
# Both waits are bounded and print what they were waiting on when they give up
# — the previous step failed with "Deploy never reached HTTP 200", which does
# not distinguish a build that failed from a URL that was never going to exist.
#
# Usage:
#   scripts/wait-for-netlify-preview.sh --sha <head-sha> --route <path> [--repo owner/name]
#
# Writes `url=<deploy url>` to $GITHUB_OUTPUT when set, and echoes it on stdout
# either way so it is usable outside Actions.
#
# Requires `gh` authenticated for the repo (Actions: GITHUB_TOKEN with
# `statuses: read`).

set -euo pipefail

REPO="${GITHUB_REPOSITORY:-brikdesigns/brikdesigns}"
SHA=""
ROUTE="/"
STATUS_CONTEXT="netlify/brikdesigns/deploy-preview"

# Deploy-status wait: 60 × 10s = 10 minutes, matching the bound the inline
# poller it replaces used. Route settle: 12 × 5s = 1 minute on top, which is a
# cold render, not a build.
STATUS_ATTEMPTS="${WAIT_STATUS_ATTEMPTS:-60}"
STATUS_SLEEP="${WAIT_STATUS_SLEEP:-10}"
ROUTE_ATTEMPTS="${WAIT_ROUTE_ATTEMPTS:-12}"
ROUTE_SLEEP="${WAIT_ROUTE_SLEEP:-5}"

while [ $# -gt 0 ]; do
  case "$1" in
    --sha)     SHA="$2"; shift 2 ;;
    --route)   ROUTE="$2"; shift 2 ;;
    --repo)    REPO="$2"; shift 2 ;;
    --context) STATUS_CONTEXT="$2"; shift 2 ;;
    *) echo "Unknown flag: $1" >&2; exit 2 ;;
  esac
done

if [ -z "$SHA" ]; then
  echo "✗ --sha is required (the PR head commit the deploy must be for)." >&2
  exit 2
fi

# ── 1. Netlify deploy status for this exact commit ──────────────────────────
echo "▸ Waiting for '$STATUS_CONTEXT' on $REPO@${SHA:0:8} …"

state=""
deploy_url=""
for i in $(seq 1 "$STATUS_ATTEMPTS"); do
  # `|| true` — a commit with no statuses yet returns an empty array, not an
  # error, but a transient API failure must not kill the poll loop either.
  line=$(gh api "repos/$REPO/commits/$SHA/status" \
           --jq ".statuses[] | select(.context == \"$STATUS_CONTEXT\") | .state + \" \" + (.target_url // \"\")" \
         2>/dev/null | head -1 || true)
  state="${line%% *}"
  deploy_url="${line#* }"

  case "$state" in
    success)
      echo "  ✓ Netlify reports the deploy for ${SHA:0:8} is live (attempt $i)."
      break
      ;;
    failure|error)
      echo "✗ Netlify's deploy for ${SHA:0:8} finished '$state' — the preview will never be correct." >&2
      echo "  status: $STATUS_CONTEXT → $state${deploy_url:+ ($deploy_url)}" >&2
      exit 1
      ;;
    pending|"")
      echo "  attempt $i: status=${state:-<not reported yet>} — sleeping ${STATUS_SLEEP}s"
      sleep "$STATUS_SLEEP"
      ;;
    *)
      echo "  attempt $i: status=$state (unrecognised) — sleeping ${STATUS_SLEEP}s"
      sleep "$STATUS_SLEEP"
      ;;
  esac
done

if [ "$state" != "success" ]; then
  echo "✗ Gave up after $((STATUS_ATTEMPTS * STATUS_SLEEP))s waiting for '$STATUS_CONTEXT' on ${SHA:0:8}." >&2
  echo "  last state: ${state:-<never reported>}" >&2
  echo "  This is a build that has not finished, not a flaky gate — check the Netlify deploy log." >&2
  exit 1
fi

if [ -z "$deploy_url" ]; then
  echo "✗ '$STATUS_CONTEXT' succeeded but carried no target_url — nothing to screenshot." >&2
  exit 1
fi

# ── 2. The gated route itself, until its size repeats ───────────────────────
# A repeated content-length, not a single 200: the failure this exists to stop
# was a page that answered 200 while still assembling.
echo "▸ Waiting for $deploy_url$ROUTE to settle …"

code=""
len=""
prev_len=""
for i in $(seq 1 "$ROUTE_ATTEMPTS"); do
  # Command substitution, not `read < <(…)`: curl's -w output carries no
  # trailing newline, so `read` returns 1 at EOF and `set -e` kills the loop
  # before its first iteration prints anything (measured 2026-09-04).
  probe=$(curl -sS -o /dev/null -w '%{http_code} %{size_download}' --max-time 20 \
            "$deploy_url$ROUTE" 2>/dev/null || echo "000 0")
  code="${probe%% *}"
  len="${probe##* }"

  if [ "$code" = "200" ] && [ "$len" -gt 0 ] && [ "$len" = "$prev_len" ]; then
    echo "  ✓ Route stable at ${len} bytes across two reads (attempt $i)."
    if [ -n "${GITHUB_OUTPUT:-}" ]; then
      echo "url=$deploy_url" >> "$GITHUB_OUTPUT"
    fi
    echo "$deploy_url"
    exit 0
  fi

  echo "  attempt $i: HTTP $code, ${len} bytes (previous: ${prev_len:-—}) — sleeping ${ROUTE_SLEEP}s"
  prev_len="$len"
  sleep "$ROUTE_SLEEP"
done

echo "✗ Gave up after $((ROUTE_ATTEMPTS * ROUTE_SLEEP))s waiting for $deploy_url$ROUTE to settle." >&2
echo "  last read: HTTP $code, ${len} bytes; previous read ${prev_len:-—} bytes" >&2
exit 1
