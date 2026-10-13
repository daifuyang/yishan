#!/usr/bin/env bash
# 部署 H5 函数；传 --domain 时同时更新 h5 自定义域名（需要 ../certs/fullchain.cer 与 private.key）
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FC_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ ! -f "$FC_DIR/.build/function-code/public/index.html" ]; then
  echo "Missing H5 function code; run pre-deploy.sh first." >&2
  exit 1
fi
s deploy -y -t "$FC_DIR/templates/function.yaml"

if [ "${1:-}" = "--domain" ]; then
  for f in fullchain.cer private.key; do
    [ -f "$FC_DIR/certs/$f" ] || { echo "Missing certificate file: $FC_DIR/certs/$f" >&2; exit 1; }
  done
  s deploy -y -t "$FC_DIR/templates/domain.yaml"
fi
