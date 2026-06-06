#!/usr/bin/env bash
# set-netlify-env.sh — Set a Netlify env var across ALL deploy contexts at once.
#
# Why: brikdesigns secrets must exist in production + deploy-preview +
# branch-deploy. Setting them one context at a time is how the "PR previews
# broke because deploy-preview was missing the var" bug class happens (see the
# credential-rotation runbook). This sets all three together and verifies, so
# rotations and new secrets (e.g. SLACK_EVENTS_WEBHOOK_URL) can't drift.
#
# The value is read from STDIN — never argv — so it stays out of shell history
# and the process list.
#
# Usage:
#   ./scripts/set-netlify-env.sh SLACK_EVENTS_WEBHOOK_URL
#     (paste the value, then Ctrl-D)
#   printf '%s' "$VALUE" | ./scripts/set-netlify-env.sh SOME_KEY
#
# Requirements:
#   - NETLIFY_AUTH_TOKEN (env var, or sourced from ~/.secrets/netlify.env)
#   - curl, python3
#
# Companion runbook: docs/runbooks/slack-events-webhook.md (minting the webhook
# is an interactive Slack step; this wires whatever value you get from it).

set -euo pipefail

# brikdesigns Netlify site. The deploy contexts written are defined in the
# Python payload below (production + deploy-preview + branch-deploy).
SITE_ID="7664720a-83a6-45e8-b348-b49d07de8ef7"
ACCOUNT="brikdesigns"

KEY="${1:-}"
if [[ -z "$KEY" ]]; then
  echo "usage: $0 <ENV_KEY>   (value read from stdin)" >&2
  exit 2
fi

if [[ -z "${NETLIFY_AUTH_TOKEN:-}" && -f "$HOME/.secrets/netlify.env" ]]; then
  set -a; source "$HOME/.secrets/netlify.env"; set +a
fi
if [[ -z "${NETLIFY_AUTH_TOKEN:-}" ]]; then
  echo "✗ NETLIFY_AUTH_TOKEN not set (source ~/.secrets/netlify.env)" >&2
  exit 2
fi

if [[ -t 0 ]]; then
  printf 'Paste value for %s (then Ctrl-D):\n' "$KEY" >&2
fi
VALUE="$(cat)"
if [[ -z "$VALUE" ]]; then
  echo "✗ empty value — aborting" >&2
  exit 2
fi

API="https://api.netlify.com/api/v1/accounts/${ACCOUNT}"

# Build the create-body in a 0600 temp file so the secret never lands in argv.
BODY_FILE="$(mktemp)"
chmod 600 "$BODY_FILE"
trap 'rm -f "$BODY_FILE"' EXIT
KEY="$KEY" VALUE="$VALUE" python3 - "$BODY_FILE" <<'PY'
import os, sys, json
key, val = os.environ["KEY"], os.environ["VALUE"]
ctxs = ["production", "deploy-preview", "branch-deploy"]
payload = [{"key": key, "values": [{"context": c, "value": val} for c in ctxs]}]
open(sys.argv[1], "w").write(json.dumps(payload))
PY

# Clean upsert: delete any existing key (ignore 404), then create with exactly
# the three contexts. Keeps the var's context set canonical.
curl -s -o /dev/null -X DELETE "${API}/env/${KEY}?site_id=${SITE_ID}" \
  -H "Authorization: Bearer ${NETLIFY_AUTH_TOKEN}" || true

code="$(curl -s -o /tmp/set-netlify-env-resp -w '%{http_code}' \
  -X POST "${API}/env?site_id=${SITE_ID}" \
  -H "Authorization: Bearer ${NETLIFY_AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  --data @"${BODY_FILE}")"

if [[ "$code" != 2* ]]; then
  echo "✗ Netlify API returned ${code}" >&2
  cat /tmp/set-netlify-env-resp >&2 || true
  rm -f /tmp/set-netlify-env-resp
  exit 1
fi
rm -f /tmp/set-netlify-env-resp

# Verify — print the key + contexts only, never the value.
curl -s "${API}/env/${KEY}?site_id=${SITE_ID}" \
  -H "Authorization: Bearer ${NETLIFY_AUTH_TOKEN}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('✓ set', d.get('key'), '→', sorted(v.get('context') for v in d.get('values',[])))"
