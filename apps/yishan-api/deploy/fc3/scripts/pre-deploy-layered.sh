#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FC_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
# ROOT_DIR 是 yishan-api 包目录（build:ts / db:generate / dist 都在这里跑）。
ROOT_DIR="$(cd "$FC_DIR/../.." && pwd)"
# REPO_ROOT 是 monorepo 根目录（admin 产物在 <repo>/apps/yishan-admin/dist）。
REPO_ROOT="$(cd "$FC_DIR/../../../.." && pwd)"
FUNCTION_DIR="$FC_DIR/.build/function-code"
LAYER_CONFIG="$FC_DIR/config/layer-dependencies.json"

cd "$ROOT_DIR"

echo "1. 检查构建依赖"
if [ ! -d "$ROOT_DIR/node_modules" ]; then
  echo "未发现 pnpm 依赖，执行安装"
  pnpm install --no-frozen-lockfile
else
  echo "复用已有 pnpm workspace 依赖"
fi

echo "2. 生成 Drizzle migration 元数据"
npm run db:generate

echo "3. 编译 TypeScript"
npm run build:ts

echo "4. 生成 Layered 函数代码目录"
rm -rf "$FUNCTION_DIR"
mkdir -p "$FUNCTION_DIR"
cp -R dist/. "$FUNCTION_DIR/"
rm -rf "$FUNCTION_DIR/node_modules" "$FUNCTION_DIR/package.json" "$FUNCTION_DIR/package-lock.json" "$FUNCTION_DIR/public" "$FUNCTION_DIR/.env"

echo "5. 安装函数本地依赖"
node "$FC_DIR/scripts/lib/write-function-package.cjs" package.json "$LAYER_CONFIG" "$FUNCTION_DIR/package.json"
if node -e "const p=require('$FUNCTION_DIR/package.json'); process.exit(Object.keys(p.dependencies || {}).length === 0 ? 0 : 1)"; then
  echo "函数包无本地 npm 依赖，跳过 node_modules 安装"
else
  npm install --omit=dev --omit=optional --omit=peer --package-lock=false --prefix "$FUNCTION_DIR"
fi

echo "6. 拷贝 Admin 静态资源"
mkdir -p "$FUNCTION_DIR/public"
ADMIN_STATIC="$REPO_ROOT/apps/yishan-admin/dist"
if [ ! -d "$ADMIN_STATIC" ]; then
  echo "❌ admin 静态资源未找到: $ADMIN_STATIC" >&2
  echo "   部署脚本必须把 admin SPA 打进函数包，否则 /admin/ 在生产环境会 404。" >&2
  echo "   修复方法：先构建 admin 产物再回到本脚本，例如：" >&2
  echo "     pnpm --filter yishan-components-yishan-tiptap build" >&2
  echo "     pnpm --filter yishan-admin exec max setup" >&2
  echo "     PUBLIC_PATH=\${ADMIN_BASE_PATH:-/admin/} pnpm --filter yishan-admin build" >&2
  echo "   然后重新执行本脚本。" >&2
  exit 1
fi
cp -R "$ADMIN_STATIC" "$FUNCTION_DIR/public/admin"
echo "Admin static assets copied from $ADMIN_STATIC"

echo "✅ Layered 函数包构建完成: $FUNCTION_DIR"
