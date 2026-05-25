#!/usr/bin/env bash
set -euo pipefail
echo "1. 拷贝函数部署模板到当前目录"
cp ./deploy/fc3/s-function.yaml ./s.yaml
echo "2. 部署函数资源"
s deploy -y
echo "✅ 函数部署完成"
rm ./s.yaml
