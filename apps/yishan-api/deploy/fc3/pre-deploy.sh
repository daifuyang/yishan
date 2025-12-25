#!/usr/bin/env bash
set -euo pipefail

echo "1. 安装依赖"

npm install
chmod +x node_modules

echo "2. 生成 Prisma 客户端"
npm run db:generate

echo "3. 编译 TypeScript"
npm run build:ts

echo "4. 拷贝运行时文件到 dist"
cp .env dist/
cp package.json dist/

cp -r node_modules/ dist/

echo "✅ 构建完成"
