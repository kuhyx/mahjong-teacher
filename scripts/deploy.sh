#!/bin/bash
# Install, build, (re)start and health-check Mahjong Teacher on this PC.
# Idempotent. Runs from the checkout it lives in (normally ~/src/mahjong-teacher).
# Exits non-zero unless scripts/health.ts passes.
set -euo pipefail
readonly REPO="$(cd "$(dirname "$0")/.." && pwd)"
readonly UNITS=(mahjong-bridge.service mahjong-relay.service)
readonly UNIT_DIR="$HOME/.config/systemd/user"
cd "$REPO"

log() { echo "==> $*"; }

log "dependencies"
pnpm install --frozen-lockfile --silent
log "build"
bash scripts/build.sh >/dev/null
log "units"
mkdir -p "$UNIT_DIR"
for u in "${UNITS[@]}"; do
    # Units use %h/src/mahjong-teacher; a checkout elsewhere gets its own path.
    sed "s#%h/src/mahjong-teacher#$REPO#g" "systemd/$u" > "$UNIT_DIR/$u"
done
systemctl --user daemon-reload
systemctl --user enable "${UNITS[@]}" >/dev/null 2>&1
systemctl --user restart "${UNITS[@]}"
# Linger keeps the user units running with no login session (after reboot).
if [[ "$(loginctl show-user "$USER" -p Linger --value 2>/dev/null)" != "yes" ]]; then
    loginctl enable-linger "$USER" || echo "warning: could not enable linger" >&2
fi
log "caddy site"
if [[ "${MJ_SKIP_CADDY:-0}" != "1" ]]; then
    bash scripts/publish_site.sh
fi
log "health"
for _ in 1 2 3 4 5 6 7 8 9 10; do
    curl -fsS -o /dev/null "http://127.0.0.1:${MJ_PORT:-8797}/api/health" && break
    sleep 0.5
done
node scripts/health.ts
