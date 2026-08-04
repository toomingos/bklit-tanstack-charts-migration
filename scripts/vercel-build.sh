#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$DIR/.."

# Clone reference repos (shallow)
bash "$DIR/clone-repos.sh"

# Install showcase deps
cd "$ROOT/showcase"
pnpm install --no-frozen-lockfile

# Replace pnpm's .pnpm store copies with direct symlinks
# so relative imports (../../repos/..., ../../migrated/...) resolve correctly
rm -rf node_modules/@showcase
mkdir -p node_modules/@showcase
ln -sf ../../packages/bklit-charts node_modules/@showcase/bklit-charts
ln -sf ../../packages/migrated-charts node_modules/@showcase/migrated-charts

pnpm build
