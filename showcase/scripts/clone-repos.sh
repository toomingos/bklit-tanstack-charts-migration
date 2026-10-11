#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPOS_DIR="$SCRIPT_DIR/../repos"

if [ -d "$REPOS_DIR/bklit-ui" ]; then
  echo "==> repos/bklit-ui already exists, skipping clone"
else
  echo "==> Cloning bklit-ui (read-only reference, shallow)..."
  git clone --depth 1 https://github.com/bklit/bklit-ui.git "$REPOS_DIR/bklit-ui"
fi

# TanStack Charts ships as a pinned npm dep, not a clone; upgrades = bump pins + full gate run.
echo "==> Repos ready at $REPOS_DIR/"
