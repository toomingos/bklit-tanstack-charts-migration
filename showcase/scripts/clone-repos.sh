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

# Pinned TanStack commit: every gate run (Q1/Q2/Q3, G1-G4) is valid only against
# this exact source. Upgrades = bump this SHA + full gate run (PLAN-phase-3.md
# architecture contract; docs/phase-3/LOG.md D238). An unpinned tip-of-main clone
# here is what broke Vercel production builds when upstream shipped the 0.8.0
# API harmonization.
TANSTACK_CHARTS_PIN="a285ce731f50920d77dd34f2ffd5cad7c9573321"

if [ -d "$REPOS_DIR/tanstack-charts" ]; then
  echo "==> repos/tanstack-charts already exists, skipping clone"
  HAVE="$(git -C "$REPOS_DIR/tanstack-charts" rev-parse HEAD 2>/dev/null || echo unknown)"
  if [ "$HAVE" != "$TANSTACK_CHARTS_PIN" ]; then
    echo "==> WARNING: repos/tanstack-charts is at $HAVE, expected pin $TANSTACK_CHARTS_PIN" >&2
    echo "==> Delete the directory and re-run to fetch the pinned commit." >&2
  fi
else
  echo "==> Fetching TanStack Charts (read-only reference, pinned $TANSTACK_CHARTS_PIN)..."
  git init -q "$REPOS_DIR/tanstack-charts"
  git -C "$REPOS_DIR/tanstack-charts" remote add origin https://github.com/TanStack/charts.git
  git -C "$REPOS_DIR/tanstack-charts" fetch -q --depth 1 origin "$TANSTACK_CHARTS_PIN"
  git -C "$REPOS_DIR/tanstack-charts" checkout -q FETCH_HEAD
fi

echo "==> Repos ready at $REPOS_DIR/"
