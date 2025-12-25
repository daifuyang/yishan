#!/usr/bin/env bash
set -euo pipefail
echo "1. 拷贝 s.yaml 到当前目录"
cp ./deploy/fc3/s.yaml ./s.yaml
echo "2. 部署函数"
s deploy -y
echo "✅ 部署完成"
rm ./s.yaml
