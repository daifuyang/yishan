#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FC_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# 与 pre-deploy.sh 保持一致：产物默认在仓库外，避免 fc3 打包时套用
# .gitignore 把 public/admin 排除掉。
CODE_DIR="${FUNCTION_CODE_DIR:-$FC_DIR/.build/function-code}"
if [ ! -f "$CODE_DIR/.yishan-api-artifact.json" ]; then
  echo "Missing verified API artifact at $CODE_DIR; run pre-deploy.sh first." >&2
  exit 1
fi
# 传给 function.yaml 的 ${env(FUNCTION_CODE_DIR)}，让 code 指向同一目录。
export FUNCTION_CODE_DIR="$CODE_DIR"

s preview -t "$FC_DIR/templates/function.yaml" >/dev/null
s deploy -y -t "$FC_DIR/templates/function.yaml"
