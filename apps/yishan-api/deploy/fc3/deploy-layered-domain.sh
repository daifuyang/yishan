#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FC_DIR="$ROOT_DIR/deploy/fc3"
DOMAIN_TEMPLATE="$FC_DIR/s-domain-layered.yaml"

export FC_FUNCTION_NAME="${FC_FUNCTION_NAME:-yishan-demo-layered}"
export FC_CUSTOM_DOMAIN="${FC_CUSTOM_DOMAIN:-example.zerocmf.com}"
export FC_CERT_NAME="${FC_CERT_NAME:-$(echo "$FC_CUSTOM_DOMAIN" | tr '.' '-')-$(date +%Y%m%d)}"

echo "1. 部署 Layered 域名与证书资源"
echo "   function: $FC_FUNCTION_NAME"
echo "   domain: $FC_CUSTOM_DOMAIN"
echo "   cert: $FC_CERT_NAME"
s deploy -y -t "$DOMAIN_TEMPLATE"
echo "✅ Layered 域名证书部署完成"
