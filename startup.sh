#!/usr/bin/env bash
set -euo pipefail
export HOST="${HOST:-0.0.0.0}"
export NITRO_HOST="${NITRO_HOST:-0.0.0.0}"
exec node .output/server/index.mjs
