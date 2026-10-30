#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FC_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
API_ROOT="$(cd "$FC_DIR/../.." && pwd)"
REPO_ROOT="$(cd "$API_ROOT/../../.." && pwd)"

cd "$REPO_ROOT"
pnpm -r --filter @yishan/iximei-crm-api... build

# Admin 是可选产物：不传 ADMIN_DIST 时只发 API，
# /admin/ 会 404（而不是发一个空壳然后前端白屏）。
ADMIN_ARGS=()
if [ -n "${ADMIN_DIST:-}" ]; then
  if [ ! -f "$ADMIN_DIST/index.html" ]; then
    echo "ADMIN_DIST=$ADMIN_DIST 下没有 index.html，拒绝打包。" >&2
    exit 1
  fi
  ADMIN_ARGS=(--admin "$ADMIN_DIST")
fi

node scripts/package-api.mjs \
  --api "$API_ROOT" \
  --output "$FC_DIR/.build/function-code" \
  "${ADMIN_ARGS[@]}"
