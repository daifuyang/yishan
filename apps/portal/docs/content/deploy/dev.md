---
title: 本地开发
---

# 本地开发

先按 .tool-versions 准备 Node22.22.1 / pnpm8.15.9，安装 workspace 并运行 pnpm build:api。MySQL/Redis 的本地开发配置位于 infra/local-dev-stack.yml，禁止把该开发密码用于生产。

产品配置位于 apps/demo/api/.env。pnpm dev:api 监听 Core 与 Demo TS/JSON，合并变更并串行拓扑构建，只在成功后重启 dist/main.js；不手工复制包文件。

数据库迁移与 seed 都是显式命令，见数据库文档。pnpm test:integration 创建自己的随机临时 schema；开发库和生产库都不作为实验对象。
