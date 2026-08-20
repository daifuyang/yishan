#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FC_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$FC_DIR/../.." && pwd)"
FUNCTION_DIR="$FC_DIR/.build/function-code"

cd "$ROOT_DIR"

echo "1. 生成 Drizzle migration 元数据（tag 必须稳定为 'init'，与 checked-in _journal.json 一致；详见 package.json db:generate）"
pnpm db:generate

echo "2. 编译 migration runner"
pnpm build:ts

echo "3. 准备临时 FC Runner 代码"
rm -rf "$FUNCTION_DIR"
mkdir -p "$FUNCTION_DIR"
cp -R dist/. "$FUNCTION_DIR/"
rm -rf "$FUNCTION_DIR/node_modules" "$FUNCTION_DIR/package.json" "$FUNCTION_DIR/package-lock.json" "$FUNCTION_DIR/public" "$FUNCTION_DIR/.env"
# collectMigrationPlan reads checked-in SQL and plugin manifests at runtime.
cp -R drizzle "$FUNCTION_DIR/drizzle"
if [ -d src/plugins/modules ]; then
  mkdir -p "$FUNCTION_DIR/src/plugins"
  cp -R src/plugins/modules "$FUNCTION_DIR/src/plugins/modules"
fi
cp "$FC_DIR/config/migration-runner-package.json" "$FUNCTION_DIR/package.json"

echo "4. 安装 Runner 的最小运行时依赖"
npm install --omit=dev --omit=optional --omit=peer --package-lock=false --prefix "$FUNCTION_DIR"

echo "5. 把 drizzle-kit 平铺到 Runner 包根（runner.ts 通过 DRIZZLE_KIT_BIN 指向它）"
if [ ! -x "$FUNCTION_DIR/drizzle-kit" ]; then
  cp "$ROOT_DIR/node_modules/.bin/drizzle-kit" "$FUNCTION_DIR/drizzle-kit"
  chmod +x "$FUNCTION_DIR/drizzle-kit"
fi

echo "✅ Migration Runner 函数包构建完成: $FUNCTION_DIR"
