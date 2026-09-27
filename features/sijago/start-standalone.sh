#!/usr/bin/env bash
# Start the AI Mastery production (standalone) server against a chosen backend.
#
# Why this script exists
# ----------------------
# `lib/backend-runtime-config.ts` resolves the FastAPI address in this order:
# DEEPTUTOR_API_BASE_URL -> BACKEND_PORT -> NEXT_PUBLIC_API_BASE -> :8001.
# The last one is a silent trap. This box has TWO FastAPI processes:
#
#   :8011  cwd=/home/vyns/Documents/github/DeepTutor-main  (the checkout — current)
#   :8001  cwd=/home/vyns                                (installed deeptutor 1.6.9)
#
# `node .next/standalone/server.js` does NOT read .env / .env.local (Next loads
# those at build time and for `next dev`, not for a bare standalone process), so
# without an explicit variable the proxy falls through to :8001 and every chat
# turn dies with:
#
#   protocol_error / invalid_command / "Command does not match the turn protocol."
#
# The installed 1.6.9 copy has an older turn protocol than contracts/generated/
# in this tree, so the command the browser sends no longer validates. Pointing at
# :8011 fixes it.
#
# Usage:  ./start-standalone.sh [port] [backend-base-url]
set -euo pipefail

PORT="${1:-3790}"
API_BASE="${2:-http://127.0.0.1:8011}"

cd "$(dirname "$0")"

if [ ! -f .next/standalone/server.js ]; then
  echo "No standalone build found. Run 'npm run build' first." >&2
  exit 1
fi

# public/ and .next/static are not copied into .next/standalone by the build, so
# they have to be synced here — on EVERY start, not just the first one.
#
# The `! -d` guard this replaced was a stale-asset trap. After `npm run build`,
# `server.js` referenced the new hashed chunks while the directory already
# existed and still held the previous build's files, so the copy was skipped.
# The server then answered 500 for every chunk the page asked for, the document
# never hydrated, and the tutor drawer (`/embed/chat`) rendered as a blank white
# panel — a failure that looks exactly like a theme bug and is nothing of the
# kind. Always re-syncing costs a directory copy and removes that whole class of
# "blank iframe after rebuild".
rm -rf .next/standalone/public .next/standalone/.next/static
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/

echo "AI Mastery standalone on :${PORT}  ->  backend ${API_BASE}"

# Kill whatever currently holds the port, by PID. Never pkill -f: that pattern
# also matches this script and the editor's own command line.
OLD_PID="$(ss -tlnp 2>/dev/null | grep ":${PORT}\b" | grep -oP 'pid=\K[0-9]+' | head -1 || true)"
if [ -n "${OLD_PID}" ]; then
  kill "${OLD_PID}" 2>/dev/null || true
  sleep 3
fi

# Bind all interfaces by default. Without this, the standalone server listens
# only on the machine's hostname, and browsing via localhost/127.0.0.1 serves
# HTML whose _next/* assets all 404 — the page never hydrates and looks blank.
PORT="${PORT}" HOSTNAME="${HOSTNAME:-0.0.0.0}" DEEPTUTOR_API_BASE_URL="${API_BASE}" exec node .next/standalone/server.js
