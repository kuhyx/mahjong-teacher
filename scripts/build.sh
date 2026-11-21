#!/bin/bash
# Build the site with the Firebase web config (public by design: apiKey, DB URL,
# project) read from ~/.config/crdt-sync/firebase.json, never committed. No uid
# or email goes into the bundle; the database rules hold the uid.
set -euo pipefail
cd "$(dirname "$0")/.."
readonly CFG="$HOME/.config/crdt-sync/firebase.json"
if [[ -f "$CFG" ]]; then
    VITE_FB_API_KEY="$(jq -er .apiKey "$CFG")"
    VITE_FB_DB_URL="$(jq -er .databaseUrl "$CFG")"
    VITE_FB_PROJECT="$(jq -er .projectId "$CFG")"
    VITE_FB_AUTH_DOMAIN="${VITE_FB_PROJECT}.firebaseapp.com"
    export VITE_FB_API_KEY VITE_FB_DB_URL VITE_FB_PROJECT VITE_FB_AUTH_DOMAIN
else
    echo "warning: $CFG missing; building without the phone relay" >&2
fi
pnpm run build
