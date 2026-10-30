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

# 产物必须落在**仓库之外**（默认 /tmp）：fc3 组件打包 code 目录时会套用
# .gitignore 规则，而 apps/iximei-crm/api/.gitignore 里有 `/public/admin`，
# 正好把 Admin 静态资源整个排除掉。表现是函数里压根没有 public/admin，
# /admin/ 读 index.html 抛 ENOENT，被 error handler 翻成 500。
# 放到 /tmp 就没有任何 ignore 规则与之匹配，admin 才能跟着上传。
OUT="${FUNCTION_CODE_DIR:-$FC_DIR/.build/function-code}"
mkdir -p "$(dirname "$OUT")"

node scripts/package-api.mjs \
  --api "$API_ROOT" \
  --output "$OUT" \
  "${ADMIN_ARGS[@]}"
