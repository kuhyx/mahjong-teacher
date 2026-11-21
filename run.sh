#!/bin/bash
# Play on this PC: build once, start the loopback bridge, open the game.
# The installed units (scripts/deploy.sh) already do this in the background;
# run.sh is for a checkout without them. Sound is on for you (off in agent runs).
set -euo pipefail
cd "$(dirname "$0")"
readonly PORT="${MJ_PORT:-8797}"
[[ -d node_modules ]] || pnpm install --frozen-lockfile
bash scripts/build.sh >/dev/null
if ! curl -fsS -o /dev/null "http://127.0.0.1:${PORT}/api/health" 2>/dev/null; then
    node services/bridge/main.ts &
    trap 'kill $!' EXIT
    sleep 0.5
fi
xdg-open "http://127.0.0.1:${PORT}/" >/dev/null 2>&1 || echo "open http://127.0.0.1:${PORT}/"
wait
