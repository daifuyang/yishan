#!/usr/bin/env bash
# 构建 H5 生产包并组装 FC 函数代码目录：.build/function-code/{server.mjs,public/}
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FC_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_DIR="$(cd "$FC_DIR/../.." && pwd)"
OUT_DIR="$FC_DIR/.build/function-code"

# 线上 H5 走同源 /api（由 FC 域名路由转给 API 函数），不注入 API 地址
unset YISHAN_APP_API_BASE_URL
(cd "$APP_DIR" && NODE_ENV=production pnpm run build:h5)

if [ ! -f "$APP_DIR/dist/h5/index.html" ]; then
  echo "H5 build output missing: $APP_DIR/dist/h5/index.html" >&2
  exit 1
fi

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR/public"
cp "$FC_DIR/server.mjs" "$OUT_DIR/server.mjs"
cp -R "$APP_DIR/dist/h5/." "$OUT_DIR/public/"
echo "H5 function code ready: $OUT_DIR ($(find "$OUT_DIR/public" -type f | wc -l | tr -d ' ') files)"
