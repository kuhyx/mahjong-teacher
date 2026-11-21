#!/bin/bash
# Play on this PC: build once, start the loopback bridge, open the game.
# The installed units (scripts/deploy.sh) already do this in the background;
# run.sh is for a checkout without them. Sound is on for you (off in agent runs).
# A bridge already on the port is reused only if it serves THIS checkout's page;
# a stale unit (e.g. left on a deleted worktree) is redeployed from here.
set -euo pipefail
cd "$(dirname "$0")"
readonly PORT="${MJ_PORT:-8797}"
readonly URL="http://127.0.0.1:${PORT}"
HERE="$(pwd -P)"
readonly HERE

# Prints the checkout the live bridge serves, "broken" if it answers without
# a page, or nothing if no bridge answers.
live_root() {
    curl -fsS "${URL}/api/health" 2>/dev/null | jq -r 'if .ok and .page then .root // "broken" else "broken" end' 2>/dev/null || true
}

[[ -d node_modules ]] || pnpm install --frozen-lockfile
bash scripts/build.sh >/dev/null
live="$(live_root)"
if [[ -z "$live" ]]; then
    node services/bridge/main.ts &
    trap 'kill $!' EXIT
    sleep 0.5
elif [[ "$live" != "$HERE" ]]; then
    # Only the unit's own port (8797) is redeployed; any other port is someone else's.
    if [[ "$PORT" == 8797 && "$HERE" == "$(realpath -m "$HOME/src/mahjong-teacher")" ]] && systemctl --user -q is-active mahjong-bridge.service; then
        echo "bridge on :${PORT} serves ${live}; redeploying units from ${HERE}" >&2
        MJ_SKIP_PHONE=1 MJ_SKIP_CADDY=1 bash scripts/deploy.sh >/dev/null
        live="$(live_root)"
    fi
    if [[ "$live" != "$HERE" ]]; then
        echo "bridge on :${PORT} serves ${live}, not ${HERE}; stop it or set MJ_PORT" >&2
        exit 1
    fi
fi
xdg-open "${URL}/" >/dev/null 2>&1 || echo "open ${URL}/"
wait
