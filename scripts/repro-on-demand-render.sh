#!/usr/bin/env bash
# Reproduces the brikdesigns#809 failure mode locally: a CMS page that renders
# fine when prerendered, and 500s the moment it has to render ON DEMAND.
#
# #809 was originally filed as "does not reproduce locally — Netlify-runtime
# only". That was wrong, and the reason is one flag. Node >= 22.12 permits
# `require()` of an ES module; the Netlify function runtime does not. So a local
# `next start` on a modern Node loads the externalized jsdom happily, while the
# deployed function throws ERR_REQUIRE_ESM on the identical bundle.
# `--no-experimental-require-module` restores the stricter semantics, and the
# failure appears locally — same error, same external-module hash as the Netlify
# function log:
#
#   Failed to load external module jsdom-4cccfac9827ebcfe:
#   Error [ERR_REQUIRE_ESM]: require() of ES Module .../@exodus/bytes/encoding-lite.js
#
# Measured on the fix branch vs `staging@c90c998`, same command, same path:
#   pre-fix   on-demand render → 500
#   post-fix  on-demand render → 200
#
# Two things this does NOT verify, so do not treat a green run as sign-off:
#   - the real function's Node version (unknown; Netlify derives the functions
#     runtime from the build's NODE_VERSION, currently "22" in netlify.toml)
#   - anything about the Netlify adapter's own bundling
# The deploy-preview check in the PR is still the acceptance evidence.
#
# The revalidation secret is generated here and forced onto the server process,
# rather than read from 1Password, so the purge cannot 401 on a value mismatch.
# Prints HTTP statuses only; never echoes a credential.
#
# Usage:
#   npm run build                        # a build is required first
#   npm run repro:on-demand-render
#   npm run repro:on-demand-render -- /events/some-other-slug 3899
set -uo pipefail

PATH_UNDER_TEST="${1:-/events/grind-after-graduation}"
PORT="${2:-3899}"
BASE="http://127.0.0.1:$PORT"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG="$REPO/.next/repro-on-demand-render.log"

cd "$REPO" || exit 1

if [ ! -d "$REPO/.next" ]; then
  echo "✗ No .next build found. Run 'npm run build' first." >&2
  exit 1
fi

# op provides Supabase + site env from .env.op; the service-account token that
# lets op run headlessly lives in ~/.secrets (brik-mini has no 1P GUI session).
set -a
for f in "$HOME"/.secrets/*.env; do . "$f" 2>/dev/null; done
set +a

SECRET="local-repro-$RANDOM$RANDOM"

echo "node $(node -v), strict CJS (--no-experimental-require-module)"
echo "path: $PATH_UNDER_TEST"
echo

NODE_OPTIONS="--no-experimental-require-module" \
  op run --env-file=.env.op -- env REVALIDATION_SECRET="$SECRET" \
  npx next start -p "$PORT" >"$LOG" 2>&1 &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null' EXIT

for _ in $(seq 1 60); do
  curl -sf -o /dev/null "$BASE/" 2>/dev/null && break
  sleep 1
done

status() { curl -s -o /dev/null -w '%{http_code}' "$BASE$1"; }

PRERENDERED=$(status "$PATH_UNDER_TEST")
echo "1. prerendered render:      $PRERENDERED"

PURGE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/revalidate" \
  -H 'content-type: application/json' \
  -H "x-revalidate-secret: $SECRET" \
  -d "{\"paths\":[\"$PATH_UNDER_TEST\"],\"tags\":[\"cms-events\"]}")
echo "2. ISR purge:               $PURGE"

if [ "$PURGE" != "200" ]; then
  echo "✗ Purge failed — step 3 would only re-serve the cached page, proving nothing." >&2
  exit 1
fi

sleep 2
ON_DEMAND=$(status "$PATH_UNDER_TEST")
echo "3. ON-DEMAND render:        $ON_DEMAND   <-- the #809 failure point"

echo
if grep -qE 'ERR_REQUIRE_ESM|Failed to load external module' "$LOG" 2>/dev/null; then
  echo "External-module failure in the server log:"
  grep -oE 'Failed to load external module [a-z0-9-]+|ERR_REQUIRE_ESM' "$LOG" | sort -u | sed 's/^/  /'
fi

if [ "$ON_DEMAND" = "200" ]; then
  echo "✓ On-demand render returned 200 under strict CJS."
  exit 0
fi

echo "✗ On-demand render returned $ON_DEMAND — #809 is present. Full log: $LOG" >&2
exit 1
