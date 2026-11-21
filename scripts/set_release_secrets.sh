#!/bin/bash
# Copy the shared release signing key into kuhyx/mahjong-teacher's Actions
# secrets so .github/workflows/app.yml can publish a signed APK. Values go to
# `gh secret set` on stdin, never argv or the log. Idempotent.
# Usage: scripts/set_release_secrets.sh [--dry-run]
set -euo pipefail

readonly GH_REPO="kuhyx/mahjong-teacher"
readonly PROPS="${MJ_KEY_PROPS:-$HOME/.android/release/key.properties}"

die() { printf 'error: %s\n' "$1" >&2; exit 1; }
prop() { grep -E "^$1=" "$PROPS" | cut -d= -f2-; }

# put NAME VALUE: sets one secret, or reports its length on --dry-run.
put() {
    [[ -n "$2" ]] || die "$1 would be empty; refusing"
    if [[ "$DRY_RUN" == 1 ]]; then
        printf '   %-26s %s chars\n' "$1" "${#2}"
    else
        printf '%s' "$2" | gh secret set "$1" -R "$GH_REPO"
    fi
}

main() {
    DRY_RUN=0
    case "${1:-}" in
        --dry-run) DRY_RUN=1 ;;
        "") ;;
        *) die "usage: $0 [--dry-run]" ;;
    esac
    [[ -f "$PROPS" ]] || die "$PROPS missing"
    local store
    store="$(prop storeFile)"
    [[ -f "$store" ]] || die "keystore $store not found"
    put ANDROID_KEYSTORE_BASE64 "$(base64 -w0 "$store")"
    put ANDROID_KEYSTORE_PASSWORD "$(prop storePassword)"
    put ANDROID_KEY_ALIAS "$(prop keyAlias)"
    put ANDROID_KEY_PASSWORD "$(prop keyPassword)"
    [[ "$DRY_RUN" == 1 ]] || gh secret list -R "$GH_REPO" | cut -f1
}

main "$@"
