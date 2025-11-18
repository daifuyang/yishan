#!/usr/bin/env bash
set -euo pipefail   # 遇到错误/未定义变量/管道错误立即退出
echo "1. 安装依赖"
pnpm install --filter yishan-admin
echo "2. 构建项目"
pnpm build
echo "3. 复制 nginx.conf 到 dist 目录"
cp ./deploy/fc3/nginx.conf ./dist/nginx.conf
echo "4. 先将s.yaml复制到根路径，再执行部署命令"
cp ./deploy/fc3/s.yaml ./s.yaml
echo "5. 部署到 FC3"
s deploy -y
echo "6. 部署完成，删除 s.yaml"
rm ./s.yaml
