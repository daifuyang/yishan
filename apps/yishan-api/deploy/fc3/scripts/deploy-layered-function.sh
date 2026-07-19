#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FC_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$FC_DIR/../.." && pwd)"
LOCK_FILE="$FC_DIR/layer-lock.json"
BUILD_DIR="$FC_DIR/.build"

if [ -z "${YISHAN_API_RUNTIME_LAYER_ARN:-}" ]; then
  if [ ! -f "$LOCK_FILE" ]; then
    echo "❌ 找不到 $LOCK_FILE" >&2
    echo "   首次部署或 lock 缺失时，请先发布 Runtime Layer：" >&2
    echo "     1. bash $FC_DIR/scripts/build-runtime-layer.sh" >&2
    echo "     2. s cli fc3 layer publish --code $BUILD_DIR/runtime-layer \\" >&2
    echo "          --region <region> --layer-name yishan-api-runtime-layer \\" >&2
    echo "          --compatible-runtime custom.debian12 -a enterprise" >&2
    echo "     3. node $FC_DIR/scripts/lib/layer-state.cjs record \\" >&2
    echo "          $ROOT_DIR/package.json $FC_DIR/config/layer-dependencies.json \\" >&2
    echo "          $LOCK_FILE '<layer-arn>'" >&2
    echo "   或者临时用环境变量绕过：" >&2
    echo "     export YISHAN_API_RUNTIME_LAYER_ARN='acs:fc:<region>:<account>:layers/<name>/versions/<v>'" >&2
    exit 1
  fi
  echo "未显式设置 YISHAN_API_RUNTIME_LAYER_ARN，尝试从 layer-lock.json 读取"
  if ! YISHAN_API_RUNTIME_LAYER_ARN="$(node "$FC_DIR/scripts/lib/layer-state.cjs" arn "$ROOT_DIR/package.json" "$FC_DIR/config/layer-dependencies.json" "$LOCK_FILE" 2>&1)"; then
    echo "❌ $LOCK_FILE 存在但与当前依赖不匹配（fingerprint 已变）" >&2
    echo "   请重新发布 Runtime Layer 并更新 lock：" >&2
    echo "     bash $FC_DIR/scripts/build-runtime-layer.sh" >&2
    echo "     s cli fc3 layer publish --code $BUILD_DIR/runtime-layer --region <region> --layer-name yishan-api-runtime-layer --compatible-runtime custom.debian12 -a enterprise" >&2
    echo "     node $FC_DIR/scripts/lib/layer-state.cjs record $ROOT_DIR/package.json $FC_DIR/config/layer-dependencies.json $LOCK_FILE '<new-arn>'" >&2
    exit 1
  fi
  export YISHAN_API_RUNTIME_LAYER_ARN
fi

mkdir -p "$BUILD_DIR"

echo "1. 部署 Layered 函数资源"
s deploy -y -t "$FC_DIR/templates/function.yaml"
echo "✅ Layered 函数部署完成"
