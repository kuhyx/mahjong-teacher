#!/bin/bash
# Install the toolchain and dependencies for Mahjong Teacher.
set -euo pipefail
cd "$(dirname "$0")"
ensure() {
    local bin="$1" pkg="$2"
    command -v "$bin" >/dev/null 2>&1 && return 0
    echo "==> installing $pkg"
    sudo pacman -S --needed --noconfirm "$pkg"
}
ensure node nodejs
ensure pnpm pnpm
ensure jq jq
ensure chromium chromium
ensure fc-list fontconfig
# CJK glyphs for the tile faces (萬, 東, 發, 中) in headless runs.
fc-list :lang=ja | grep -q . || sudo pacman -S --needed --noconfirm wqy-zenhei
pnpm install --frozen-lockfile
command -v pre-commit >/dev/null 2>&1 && pre-commit install --install-hooks >/dev/null || true
echo "==> ready: ./run.sh to play, scripts/deploy.sh to install the services"
