#!/usr/bin/env bash
# dev-restart.sh — Clean restart of the brikdesigns dev server, with secrets.
#
# Two stalls this removes (#857, surfaced building #852):
#
#   1. A bare `next dev` cannot render any CMS route. `createPublicClient`
#      (src/lib/supabase/server.ts) throws "Your project's URL and Key are
#      required to create a Supabase client!" and /events/[slug] 500s. The
#      credentials live in .env.op, so dev has to run under `op run` — the
#      same wrapper CLAUDE.md already mandates for `npm install`.
#
#   2. The Next data cache serves stale CMS rows. After editing an `events`
#      row in staging Supabase, a plain restart — and even
#      `rm -rf .next/cache/fetch-cache` — kept rendering the previous
#      `blocks` payload. Only `rm -rf .next` picked it up. That is --fresh.
#
# Usage: ./scripts/dev-restart.sh [--fresh] [--port N] [--foreground]
#   --fresh       Purge .next entirely — use after editing CMS rows in Supabase
#   --port N      Override the port (default: 3000, or 3001+ in a worktree)
#   --foreground  Run in the foreground instead of detaching
#
# Project-scoped: only kills processes belonging to THIS worktree, so a server
# running in the main checkout survives a restart launched from a worktree.
#
# Precedent: brik-client-portal/scripts/dev-restart.sh.

set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT_DIR="$(pwd)"

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

# ── OP_SERVICE_ACCOUNT_TOKEN loader (#813 / #820 / #785) ──
# `op run` needs the token, and brik-mini is headless — no 1Password GUI and no
# interactive `op signin` — so with nothing in the environment op aborts with
# "You are not currently signed in" before next dev ever starts. brik-llm owns
# the one implementation; source it rather than adding another local copy.
# Guarded and cross-repo: this repo can be cloned without its sibling, and the
# `op run` invocation below still fails loudly if the token is genuinely gone.
for _op_wrapper in \
  "${PROJECT_DIR}/../../brik/brik-llm/scripts/lib/op-run-wrapper.sh" \
  "$HOME/Documents/GitHub/brik/brik-llm/scripts/lib/op-run-wrapper.sh"; do
  if [ -r "$_op_wrapper" ]; then
    # shellcheck source=/dev/null  # sibling repo, resolved at runtime
    source "$_op_wrapper"
    break
  fi
done
if declare -F rws_load_sa_token >/dev/null 2>&1; then
  rws_load_sa_token
fi

if ! command -v op &>/dev/null; then
  printf '%b\n' "${RED}✗ 1Password CLI (op) not found.${NC}" >&2
  printf '%b\n' "  .env.op resolves PACKAGES_READ_TOKEN and the Supabase keys;" >&2
  printf '%b\n' "  without op, every CMS route 500s on a missing Supabase client." >&2
  exit 1
fi

if [ ! -f ".env.op" ]; then
  printf '%b\n' "${RED}✗ .env.op not found in $PROJECT_DIR${NC}" >&2
  exit 1
fi

# ── Port selection ──
# Main checkout uses 3000 (matches README). Git worktrees auto-assign 3001+
# from a hash of the worktree directory name, so each worktree gets a stable
# port and this script never kills a sibling worktree's server.
PORT=3000
if git rev-parse --git-common-dir &>/dev/null; then
  COMMON="$(git rev-parse --git-common-dir)"
  ACTUAL="$(git rev-parse --git-dir)"
  if [ "$COMMON" != "$ACTUAL" ]; then
    HASH=$(basename "$PROJECT_DIR" | cksum | awk '{print $1 % 100}')
    PORT=$((3001 + HASH))
  fi
fi

FRESH=false
FOREGROUND=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --fresh)      FRESH=true; shift ;;
    --port)       PORT="$2"; shift 2 ;;
    --foreground) FOREGROUND=true; shift ;;
    -h|--help)
      cat <<'USAGE'
Usage: ./scripts/dev-restart.sh [--fresh] [--port N] [--foreground]

  --fresh       Purge .next entirely. Use after editing a CMS row in Supabase —
                the Next data cache survives a plain restart and keeps serving
                the previous payload.
  --port N      Override the port (default: 3000, or a stable 3001+ per worktree)
  --foreground  Run in the foreground instead of detaching

Always starts under `op run --env-file=.env.op`, self-sourcing the 1Password
service-account token when it is absent from the environment. Without those
secrets every CMS route 500s on a missing Supabase client.

Project-scoped: only kills processes belonging to THIS worktree.
USAGE
      exit 0 ;;
    *)
      printf '%b\n' "${RED}Unknown flag: $1${NC}" >&2
      exit 2 ;;
  esac
done

# 1. Kill only THIS worktree's dev server. Anything listening on our port is
#    the definitive owner; the ps sweep catches a boot that has not bound yet.
echo "→ Killing dev processes for $(basename "$PROJECT_DIR") on port $PORT..."
PORT_PIDS=$(lsof -ti :"$PORT" 2>/dev/null || true)
if [[ -n "$PORT_PIDS" ]]; then
  echo "$PORT_PIDS" | xargs kill -9 2>/dev/null || true
fi
NODE_PIDS=$(ps aux | grep "node" | grep "$PROJECT_DIR" | grep -v grep | awk '{print $2}' || true)
if [[ -n "$NODE_PIDS" ]]; then
  echo "$NODE_PIDS" | while read -r pid; do
    kill -9 "$pid" 2>/dev/null || true
  done
fi

# 2. Wait for the port to release, then force-kill stragglers.
sleep 0.5
PORT_PIDS=$(lsof -ti :"$PORT" 2>/dev/null || true)
if [[ -n "$PORT_PIDS" ]]; then
  echo "→ Port $PORT still held — force-killing stragglers..."
  echo "$PORT_PIDS" | xargs kill -9 2>/dev/null || true
  sleep 0.5
fi

# 3. Verify the port is free. Without this, `next dev` picks the next free
#    port and prints a URL nobody is watching.
if lsof -i :"$PORT" -sTCP:LISTEN &>/dev/null; then
  printf '%b\n' "${RED}✗ Port $PORT still in use after cleanup. Check: lsof -i :$PORT${NC}" >&2
  exit 1
fi

# 4. Purge the Next cache when asked.
if [[ "$FRESH" == true ]]; then
  echo "→ Purging .next (data cache included — edited CMS rows will re-fetch)..."
  rm -rf .next
fi

# 4b. Fail loudly when the installed BDS does not satisfy package.json (#1021).
#     A stale node_modules 500s EVERY route on `Export <Name> doesn't exist in
#     target module` — which reads as a broken component or a bad import, not as
#     a missing `npm ci`. Seen 2026-08-23: staging had moved to ^0.167.0 while
#     the primary worktree still had 0.155.1 installed, so `SectionHeader` was
#     absent and the whole marketing surface 500'd. Same class as the missing-
#     secrets stall in #857 above: a setup fault wearing a code fault's error.
#
#     Deliberately advisory-free — this exits non-zero rather than warning,
#     because a dev server that cannot render any route is not worth starting.
BDS_WANT=$(node -p "require('./package.json').dependencies['@brikdesigns/bds']" 2>/dev/null || echo "")
if [[ -n "$BDS_WANT" ]]; then
  # Path form, not the bare specifier: the package's `exports` map blocks
  # `require('@brikdesigns/bds/package.json')` outright.
  BDS_HAVE=$(node -p "require('./node_modules/@brikdesigns/bds/package.json').version" 2>/dev/null || echo "")
  if [[ -z "$BDS_HAVE" ]]; then
    printf '%b\n' "${RED}✗ @brikdesigns/bds is not installed (package.json wants ${BDS_WANT}).${NC}" >&2
    printf '%b\n' "  Fix: op run --env-file=.env.op -- npm ci" >&2
    exit 1
  fi
  # semver check via npm's own matcher — no hand-rolled range parsing.
  if ! node -e "process.exit(require('semver').satisfies('$BDS_HAVE','$BDS_WANT')?0:1)" 2>/dev/null; then
    printf '%b\n' "${RED}✗ Installed @brikdesigns/bds ${BDS_HAVE} does not satisfy ${BDS_WANT}.${NC}" >&2
    printf '%b\n' "  Every CMS route will 500 on \`Export <Name> doesn't exist in target module\`," >&2
    printf '%b\n' "  which reads like a broken import rather than a stale install." >&2
    printf '%b\n' "  Fix: op run --env-file=.env.op -- npm ci" >&2
    exit 1
  fi
  printf '%b\n' "${GREEN}✓ @brikdesigns/bds ${BDS_HAVE} satisfies ${BDS_WANT}${NC}"
fi

# 5. Start under op run. --no-masking keeps op from redacting substrings of the
#    injected values where they collide with ordinary dev-server output.
LOG="/tmp/brikdesigns-dev-${PORT}.log"

if [[ "$FOREGROUND" == true ]]; then
  echo "→ Starting dev server on port $PORT (foreground)..."
  exec op run --no-masking --env-file=.env.op -- npx next dev --port "$PORT"
fi

echo "→ Starting dev server on port $PORT..."
nohup op run --no-masking --env-file=.env.op -- npx next dev --port "$PORT" \
  > "$LOG" 2>&1 &

# 6. Wait for the server to bind (up to 40s — a cold Turbopack boot with no
#    .next is slower than the portal's 20s budget).
echo "→ Waiting for port $PORT... (log: $LOG)"
for _ in {1..40}; do
  if lsof -i :"$PORT" -sTCP:LISTEN &>/dev/null; then
    ACTUAL_PID=$(lsof -ti :"$PORT" -sTCP:LISTEN | head -1)
    printf '%b\n' "${GREEN}✓ Dev server running on http://localhost:$PORT (PID: $ACTUAL_PID)${NC}"
    echo "  Log: $LOG"
    exit 0
  fi
  sleep 1
done

printf '%b\n' "${RED}✗ Server failed to bind port $PORT within 40s.${NC}" >&2
printf '%b\n' "${YELLOW}  Last 20 log lines:${NC}" >&2
tail -20 "$LOG" >&2 || true
exit 1
