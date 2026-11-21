#!/bin/bash
# Publish https://mahjong.kuhy.duckdns.org -> 127.0.0.1:8797 through the shared
# Caddy edge. The bridge itself serves only static files to that host (never
# /api), returns real 404s and sets the ai-catalog Link header.
set -euo pipefail
readonly PUBLISHER="$HOME/src/testsAndMisc/linux_configuration/features/publish_caddy_site.sh"
readonly SNIPPET="$HOME/services/gitea/sites/mahjong.kuhy.duckdns.org.caddy"
if [[ -f "$SNIPPET" ]] && grep -q '127.0.0.1:8797' "$SNIPPET"; then
    echo "caddy site already published"
    exit 0
fi
[[ -x "$PUBLISHER" ]] || { echo "Error: $PUBLISHER missing" >&2; exit 1; }
bash "$PUBLISHER" mahjong 8797
