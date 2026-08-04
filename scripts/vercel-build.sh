#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$DIR/.."

bash "$DIR/clone-repos.sh"

cd "$ROOT/showcase"
pnpm install --no-frozen-lockfile
pnpm build
