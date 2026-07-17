#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FC_DIR="$ROOT_DIR/deploy/fc3"
FUNCTION_DIR="$FC_DIR/.build/function-code"
LAYER_CONFIG="$FC_DIR/layer-dependencies.json"

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
node "$FC_DIR/write-function-package.cjs" package.json "$LAYER_CONFIG" "$FUNCTION_DIR/package.json"
if node -e "const p=require('$FUNCTION_DIR/package.json'); process.exit(Object.keys(p.dependencies || {}).length === 0 ? 0 : 1)"; then
  echo "函数包无本地 npm 依赖，跳过 node_modules 安装"
else
  npm install --omit=dev --omit=optional --omit=peer --package-lock=false --prefix "$FUNCTION_DIR"
fi

echo "6. 拷贝 Admin 静态资源"
mkdir -p "$FUNCTION_DIR/public"
cp -R public/admin "$FUNCTION_DIR/public/"

echo "✅ Layered 函数包构建完成: $FUNCTION_DIR"
