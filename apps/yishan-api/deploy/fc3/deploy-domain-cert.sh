#!/usr/bin/env bash
set -euo pipefail
echo "1. 拷贝域名证书部署模板到当前目录"
cp ./deploy/fc3/s-domain-cert.yaml ./s.yaml
echo "2. 部署域名与证书资源"
s deploy -y
echo "✅ 域名证书部署完成"
rm ./s.yaml
