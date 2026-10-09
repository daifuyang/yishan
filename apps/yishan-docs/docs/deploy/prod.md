---
title: 生产部署
---

# 生产部署

Demo 产物采用 pnpm 生产依赖闭包，包含四个 Core package exports、CommonJS dist、SQL/journal/JSON 资源；不带 .env、源码或测试工具。node scripts/package-api.mjs --output `<directory>` 会校验全部依赖、内部链接和仓库外启动。

入口 node dist/main.js。应用读取独立数据库、Redis namespace 与 JWT 配置；生产弱 JWT_SECRET 拒绝启动。FC3 模板 custom runtime 和 PORT 均为3000，本地默认3100。配置见 apps/demo/api/deploy/fc3/。

CD 将 `YISHAN_API_REDIS_URL` Secret 原样传给函数的 `REDIS_URL`；`rediss://` 会保留 TLS 配置，URL 优先于主机和端口分项。GitHub Environment 的 `CACHE_NAMESPACE` 变量默认 `yishan:demo`，不同产品或独立部署应使用不同命名空间。

编译、打包、API启动不生成/执行迁移或 seed。发布前单独审查 `--dry-run`，只有明确 `--apply` 才能写数据库；不要自动 reset 或删除历史。

生产 CD 工作流 `yishan-fullstack-cd-fc.yml` 仅支持 `workflow_dispatch`，提交代码不会自动发布生产。人工选择 commit 后，默认等待该 commit 的 CI 通过，再构建 Web 和独立 API 产物并部署。保留既有的人工紧急 `skip_ci_gate` 选项，只有显式勾选时才跳过该等待。

CI 覆盖 API类型/构建/单元/隔离数据库集成、包边界、迁移哈希及 OpenAPI一致性。Web/App 的构建与业务行为保持现状。
