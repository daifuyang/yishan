#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FC_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
if [ ! -f "$FC_DIR/.build/function-code/.yishan-api-artifact.json" ]; then
  echo "Missing verified API artifact; run pre-deploy.sh first." >&2
  exit 1
fi
s deploy -y -t "$FC_DIR/templates/function.yaml"
