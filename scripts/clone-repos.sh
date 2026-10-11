#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPOS_DIR="$SCRIPT_DIR/../repos"
# The bklit-ui commit the migration is matched against; bump only with a parity pass in Chrome.
BKLIT_UI_REF=f7b3bd2999a5c993863f9cc5523c9cf60b9f3bc2

if [ -d "$REPOS_DIR/bklit-ui" ]; then
  echo "==> repos/bklit-ui already exists, skipping clone"
else
  echo "==> Cloning bklit-ui @ ${BKLIT_UI_REF:0:7} (read-only reference, shallow)..."
  git init -q "$REPOS_DIR/bklit-ui"
  git -C "$REPOS_DIR/bklit-ui" fetch -q --depth 1 https://github.com/bklit/bklit-ui.git "$BKLIT_UI_REF"
  git -C "$REPOS_DIR/bklit-ui" checkout -q FETCH_HEAD
fi

if [ -d "$REPOS_DIR/tanstack-charts" ]; then
  echo "==> repos/tanstack-charts already exists, skipping clone"
else
  echo "==> Cloning TanStack Charts (read-only reference, shallow)..."
  git clone -q --depth 1 --branch v1.1.0 https://github.com/TanStack/charts.git "$REPOS_DIR/tanstack-charts"
fi

echo "==> Repos ready at $REPOS_DIR/"
