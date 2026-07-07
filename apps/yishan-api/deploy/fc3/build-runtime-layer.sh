#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FC_DIR="$ROOT_DIR/deploy/fc3"
BUILD_DIR="$FC_DIR/.build/runtime-layer"
LAYER_NODEJS_DIR="$BUILD_DIR/nodejs"
SOURCE_PACKAGE="$ROOT_DIR/package.json"
LAYER_CONFIG="$FC_DIR/layer-dependencies.json"
ZIP_PATH="$FC_DIR/runtime-layer.zip"

echo "1. 生成 Layer package.json"
rm -rf "$BUILD_DIR" "$ZIP_PATH"
mkdir -p "$LAYER_NODEJS_DIR"

node "$FC_DIR/write-layer-package.cjs" "$SOURCE_PACKAGE" "$LAYER_CONFIG" "$LAYER_NODEJS_DIR/package.json"
node "$FC_DIR/layer-state.cjs" fingerprint "$SOURCE_PACKAGE" "$LAYER_CONFIG" > "$BUILD_DIR/fingerprint.json"

echo "2. 安装公共运行时依赖到 nodejs/node_modules"
npm install --omit=dev --package-lock=false --prefix "$LAYER_NODEJS_DIR"

echo "3. 打包 runtime-layer.zip"
if command -v zip >/dev/null 2>&1; then
  (cd "$BUILD_DIR" && zip -qr "$ZIP_PATH" nodejs)
  du -sh "$ZIP_PATH"
else
  echo "zip 未安装，已跳过压缩；Layer 目录位于 $BUILD_DIR"
fi

echo "✅ Layer 构建完成: $BUILD_DIR"
echo "当前 Layer 指纹:"
node "$FC_DIR/layer-state.cjs" fingerprint "$SOURCE_PACKAGE" "$LAYER_CONFIG"
