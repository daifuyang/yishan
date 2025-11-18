#!/usr/bin/env bash
set -euo pipefail   # 遇到错误/未定义变量/管道错误立即退出

echo "1. 安装依赖"
npm install
chmod +x node_modules

export NODE_TLS_REJECT_UNAUTHORIZED=0

echo "2. 生成 Prisma 客户端"
npm run db:generate

echo "3. 编译 TypeScript"
npm run build:ts

echo "4. 拷贝运行时文件到 dist"
cp .env dist/
cp package.json dist/
cp src/generated/prisma/libquery_engine-debian-openssl-1.1.x.so.node dist/generated/prisma/

cp -r node_modules/ dist/

echo "✅ 构建完成"