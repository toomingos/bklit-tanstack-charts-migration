#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPOS_DIR="$SCRIPT_DIR/../repos"

echo "==> Cloning bklit-ui (read-only reference)..."
git clone https://github.com/bklit/bklit-ui.git "$REPOS_DIR/bklit-ui"

echo "==> Cloning TanStack Charts (read-only reference)..."
git clone https://github.com/TanStack/charts.git "$REPOS_DIR/tanstack-charts"

echo "==> Done. Repos cloned to $REPOS_DIR/"
