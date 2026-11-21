#!/bin/bash
# Install, build, (re)start and health-check Mahjong Teacher on this PC.
# Idempotent. Runs from the checkout it lives in (normally ~/src/mahjong-teacher).
# Exits non-zero unless scripts/health.ts passes.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
readonly REPO
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
log "phone app"
# Reinstall com.kuhy.mahjong only when app/ changed since the last install
# (marker = git tree id of app/). The site itself needs no app update; a phone
# that is not attached is skipped, not a failure.
readonly STATE="${XDG_STATE_HOME:-$HOME/.local/state}/mahjong-teacher"
readonly SERIAL="${ADB_SERIAL:-23181JEGR08034}"
app_tree="$(git -C "$REPO" rev-parse HEAD:app)"
if [[ "${MJ_SKIP_PHONE:-0}" == "1" ]]; then
    echo "skipped (MJ_SKIP_PHONE=1)"
elif [[ "$(cat "$STATE/app-tree" 2>/dev/null)" == "$app_tree" ]]; then
    echo "app unchanged"
elif ! adb -s "$SERIAL" get-state >/dev/null 2>&1; then
    echo "phone $SERIAL not attached; app not reinstalled" >&2
else
    [[ -f "$REPO/app/android/key.properties" ]] || install -m 600 "$HOME/.android/release/key.properties" "$REPO/app/android/key.properties"
    for stage in prep dart kotlin assemble install; do
        # System python3 first: phone_lease needs kuhy_credit, which a venv on PATH may lack.
        PATH="/usr/bin:$PATH" "$HOME/.claude/scripts/phone_deploy.sh" "$REPO/app" --release --stage "$stage"
    done
    mkdir -p "$STATE"
    printf '%s\n' "$app_tree" > "$STATE/app-tree"
fi
log "health"
for _ in 1 2 3 4 5 6 7 8 9 10; do
    curl -fsS -o /dev/null "http://127.0.0.1:${MJ_PORT:-8797}/api/health" && break
    sleep 0.5
done
node scripts/health.ts
