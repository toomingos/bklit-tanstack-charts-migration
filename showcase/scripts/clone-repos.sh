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

# TanStack Charts is NO LONGER vendored as a source clone. Phase 5.0.1 moved
# both the showcase and the bench app onto the published runtime, pinned exact in
# package.json (@tanstack/charts@0.15.0 + @tanstack/react-charts@0.15.0), so it
# installs like any other dependency. Upgrades = bump those pins + full gate run
# (PLAN-phase-3.md architecture contract). The old a285ce7/v0.14.0 clone is
# archived at local_cache/tanstack-charts-a285ce7-v0.14.0 for diffing.
# See docs/phase-5/LOG.md (supersedes D146/D238).

echo "==> Repos ready at $REPOS_DIR/"
