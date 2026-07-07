#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FC_DIR="$ROOT_DIR/deploy/fc3"
LOCK_FILE="$FC_DIR/layer-lock.json"

if [ -z "${YISHAN_API_RUNTIME_LAYER_ARN:-}" ]; then
  echo "未显式设置 YISHAN_API_RUNTIME_LAYER_ARN，尝试从 layer-lock.json 读取"
  YISHAN_API_RUNTIME_LAYER_ARN="$(node "$FC_DIR/layer-state.cjs" arn "$ROOT_DIR/package.json" "$FC_DIR/layer-dependencies.json" "$LOCK_FILE")"
  export YISHAN_API_RUNTIME_LAYER_ARN
fi

echo "1. 拷贝 Layered 函数部署模板到当前目录"
cp ./deploy/fc3/s-function-layered.yaml ./s.yaml
echo "2. 部署 Layered 函数资源"
s deploy -y
echo "✅ Layered 函数部署完成"
rm ./s.yaml
