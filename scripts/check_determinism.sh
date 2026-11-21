#!/bin/bash
# Fail if the engine, AI or log code reads a nondeterministic source.
# Every random number must come from the seeded Rng so a seed replays exactly.
set -euo pipefail
cd "$(dirname "$0")/.."
if grep -rnE 'Math\.random|Date\.now|performance\.now' src/engine src/ai src/log; then
    echo "Error: nondeterministic call in engine/ai/log (use the seeded Rng)" >&2
    exit 1
fi
