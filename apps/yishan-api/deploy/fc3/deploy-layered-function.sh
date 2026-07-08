#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FC_DIR="$ROOT_DIR/deploy/fc3"
LOCK_FILE="$FC_DIR/layer-lock.json"
BUILD_DIR="$FC_DIR/.build"
FUNCTION_YAML="$ROOT_DIR/.s-layered.yaml"

if [ -z "${YISHAN_API_RUNTIME_LAYER_ARN:-}" ]; then
  echo "未显式设置 YISHAN_API_RUNTIME_LAYER_ARN，尝试从 layer-lock.json 读取"
  YISHAN_API_RUNTIME_LAYER_ARN="$(node "$FC_DIR/layer-state.cjs" arn "$ROOT_DIR/package.json" "$FC_DIR/layer-dependencies.json" "$LOCK_FILE")"
  export YISHAN_API_RUNTIME_LAYER_ARN
fi

mkdir -p "$BUILD_DIR"
trap 'rm -f "$FUNCTION_YAML"' EXIT

echo "1. 生成 Layered 函数临时部署模板"
cp "$FC_DIR/s-function-layered.yaml" "$FUNCTION_YAML"
echo "2. 部署 Layered 函数资源"
s deploy -y -t "$FUNCTION_YAML"
echo "✅ Layered 函数部署完成"
