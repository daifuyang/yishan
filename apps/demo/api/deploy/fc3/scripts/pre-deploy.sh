#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FC_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$FC_DIR/../../../../.." && pwd)"

cd "$REPO_ROOT"
pnpm -r --filter @yishan/demo-api... build
node scripts/package-api.mjs \
  --output "$FC_DIR/.build/function-code" \
  --admin "$REPO_ROOT/apps/yishan-admin/dist"
