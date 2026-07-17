#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FC_DIR="$ROOT_DIR/deploy/fc3"
FUNCTION_DIR="$FC_DIR/.build/function-code"

cd "$ROOT_DIR"

echo "1. 生成 Drizzle migration 元数据"
pnpm db:generate

echo "2. 编译 migration runner"
pnpm build:ts

echo "3. 准备临时 FC Runner 代码"
rm -rf "$FUNCTION_DIR"
mkdir -p "$FUNCTION_DIR"
cp -R dist/. "$FUNCTION_DIR/"
rm -rf "$FUNCTION_DIR/node_modules" "$FUNCTION_DIR/package.json" "$FUNCTION_DIR/package-lock.json" "$FUNCTION_DIR/public" "$FUNCTION_DIR/.env"
cp "$FC_DIR/migration-runner-package.json" "$FUNCTION_DIR/package.json"

echo "4. 安装 Runner 的最小运行时依赖"
npm install --omit=dev --omit=optional --omit=peer --package-lock=false --prefix "$FUNCTION_DIR"

echo "✅ Migration Runner 函数包构建完成: $FUNCTION_DIR"
