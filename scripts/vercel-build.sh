#!/usr/bin/env bash
set -euo pipefail

# Find the repo root (where clone-repos.sh lives)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

bash "$SCRIPT_DIR/clone-repos.sh"

cd "$ROOT/showcase"
pnpm install --no-frozen-lockfile
pnpm build
