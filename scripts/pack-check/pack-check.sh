#!/usr/bin/env bash
# Pre-publish gate: packs the charts package and checks it the way a stranger's project would see it.
# Consumers are installed from the tarball into a temp folder outside the repo, so no workspace link or
# hoisted node_modules can hide a missing dependency.
#
#   bash scripts/pack-check/pack-check.sh            # check showcase/migrated
#   PACK_CHECK_DIR=/some/dir bash scripts/pack-check/pack-check.sh   # keep the work folder
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PKG_DIR="${PACK_CHECK_PKG:-$ROOT/showcase/migrated}"
WORK="${PACK_CHECK_DIR:-$(mktemp -d "${TMPDIR:-/tmp}/pack-check.XXXXXX")}"
PUBLINT="publint@0.3.24"
ATTW="@arethetypeswrong/cli@0.18.5"

mkdir -p "$WORK"
declare -a SUMMARY=()
FAILED=0

stage() {
  local name="$1"
  shift
  echo
  echo "==> $name"
  if "$@"; then
    SUMMARY+=("PASS  $name")
  else
    SUMMARY+=("FAIL  $name")
    FAILED=$((FAILED + 1))
  fi
}

echo "==> Packing $PKG_DIR into $WORK"
rm -rf "$WORK/pack" "$WORK/extract" "$WORK/consumer" "$WORK/start"
mkdir -p "$WORK/pack" "$WORK/extract"
(cd "$PKG_DIR" && pnpm pack --pack-destination "$WORK/pack" >/dev/null) || {
  echo "pack failed"
  exit 1
}
TARBALL="$(ls "$WORK"/pack/*.tgz)"
tar xzf "$TARBALL" -C "$WORK/extract"
PKG_NAME="$(node -p "require('$WORK/extract/package/package.json').name")"
echo "    $PKG_NAME -> $(basename "$TARBALL") ($(du -h "$TARBALL" | cut -f1))"

stage "tarball contents" node "$SCRIPT_DIR/check-tarball.mjs" "$WORK/extract/package"
stage "publint --strict" npx -y "$PUBLINT" run "$TARBALL" --strict
# attw only resolves JS/types; stylesheet subpaths are excluded so they don't read as failures.
CSS_ENTRIES="$(node -p "Object.keys(require('$WORK/extract/package/package.json').exports ?? {}).filter((k) => k.endsWith('.css')).join(' ')")"
# shellcheck disable=SC2086
stage "attw (esm-only)" npx -y "$ATTW" "$TARBALL" --profile esm-only ${CSS_ENTRIES:+--exclude-entrypoints $CSS_ENTRIES}

cp -R "$SCRIPT_DIR/consumer" "$WORK/consumer"
sed -i '' "s|__PKG__|$PKG_NAME|" "$WORK/consumer/types.tsx" 2>/dev/null || sed -i "s|__PKG__|$PKG_NAME|" "$WORK/consumer/types.tsx"

# pnpm's isolated layout: an import the package did not declare fails here.
install_consumer() {
  cd "$WORK/consumer" && pnpm install --silent && pnpm add --silent "$TARBALL"
}
stage "strict install from tarball" install_consumer

stage "SSR render (node, no bundler)" bash -c "cd '$WORK/consumer' && node ssr-smoke.mjs '$PKG_NAME'"
# skipLibCheck is off: shipped .d.ts must hold up under a consumer's own strict settings.
typecheck() {
  local out
  out="$(cd "$WORK/consumer" && npx tsc -p "$1" 2>&1)" && return 0
  echo "$out" | grep -c "error TS" | sed 's/^/    errors: /'
  echo "$out" | grep -o "error TS[0-9]*: [^.']*" | sort | uniq -c | sort -rn | head -6
  return 1
}
stage "types (moduleResolution bundler)" typecheck tsconfig.bundler.json
stage "types (moduleResolution node16)" typecheck tsconfig.node16.json

# Every ```tsx example in the shipped README, docs and skills must typecheck against the packed package (strict, skipLibCheck off).
# Fences are standalone modules; ```tsx skip opts one out.
docs_examples() {
  local pkg="$WORK/extract/package"
  node "$SCRIPT_DIR/docs-examples.mjs" "$WORK/consumer/docs-examples" "$PKG_NAME" "$pkg/README.md" "$pkg/docs" "$pkg/skills" || return 1
  local out
  out="$(cd "$WORK/consumer/docs-examples" && ../node_modules/.bin/tsc -p tsconfig.docs.json 2>&1)" && return 0
  echo "$out" | head -40
  return 1
}
stage "docs examples typecheck (README, docs, skills)" docs_examples

# A minimal TanStack Start app installs the tarball, builds with vite, and serves the SSR page from the built output.
# The server runs on a free port >= 5242 and is stopped by port only.
start_fixture() {
  cp -R "$SCRIPT_DIR/start-fixture" "$WORK/start"
  cd "$WORK/start" || return 1
  pnpm install --silent && pnpm add --silent "$TARBALL" || return 1
  pnpm exec vite build >"$WORK/start/build.log" 2>&1 || {
    tail -20 "$WORK/start/build.log"
    return 1
  }
  local port=5242
  while lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; do port=$((port + 1)); done
  pnpm exec vite preview --port "$port" --strictPort >"$WORK/start/serve.log" 2>&1 &
  local status=1 i body code
  for i in $(seq 1 40); do
    code="$(curl -s -o "$WORK/start/page.html" -w '%{http_code}' "http://localhost:$port/" 2>/dev/null)"
    [ "$code" = "200" ] && break
    sleep 0.5
  done
  if [ "$code" = "200" ] && grep -q "<svg" "$WORK/start/page.html"; then
    echo "    HTTP 200 on :$port, $(grep -o '<svg' "$WORK/start/page.html" | wc -l | tr -d ' ') <svg in the HTML"
    status=0
  else
    echo "    HTTP ${code:-none} on :$port, <svg count: $(grep -o '<svg' "$WORK/start/page.html" 2>/dev/null | wc -l | tr -d ' ')"
    tail -15 "$WORK/start/serve.log"
  fi
  # shellcheck disable=SC2046
  kill $(lsof -t -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null) 2>/dev/null
  return $status
}
stage "TanStack Start (install, vite build, serve, fetch)" start_fixture

echo
echo "==> Summary ($WORK)"
printf '    %s\n' "${SUMMARY[@]}"
exit $((FAILED > 0))
