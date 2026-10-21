---
title: 生产部署
---

# 生产部署

Demo 产物采用 pnpm 生产依赖闭包，包含四个 Core package exports、CommonJS dist、SQL/journal/JSON 资源；不带 .env、源码或测试工具。node scripts/package-api.mjs --output `<directory>` 会校验全部依赖、内部链接和仓库外启动。

入口 node dist/main.js。应用读取独立数据库、Redis namespace 与 JWT 配置；生产弱 JWT_SECRET 拒绝启动。FC3 模板 custom runtime 和 PORT 均为3000，本地默认3100。配置见 apps/demo/api/deploy/fc3/。

CD 将 `YISHAN_API_REDIS_URL` Secret 原样传给函数的 `REDIS_URL`；`rediss://` 会保留 TLS 配置，URL 优先于主机和端口分项。GitHub Environment 的 `CACHE_NAMESPACE` 变量默认 `yishan:demo`，不同产品或独立部署应使用不同命名空间。

编译、打包、API启动不生成/执行迁移或 seed。发布前单独审查 `--dry-run`，只有明确 `--apply` 才能写数据库；不要自动 reset 或删除历史。

> 阿里云 FC 发布链路已于 2026-10-21 下线：`yishan-api-cd.yml`、`yishan-h5-cd.yml`、
> `yishan-fc-migrate.yml` 与两条证书轮转工作流已移出 `.github/workflows/`，
> 作为参考实现保留在 `apps/demo/api/deploy/fc-example/`。同账号上仍在运行的
> 只有 `yishan-crm` 函数。当前只有演示环境（Ubuntu 主机）的两条 CD：`yishan-api-cd-ubuntu.yml` 发布 API 与 Admin，`yishan-h5-cd-ubuntu.yml` 发布小程序 H5 静态目录。

发布走 Ubuntu 主机链路，推送 `main` 后按路径自动触发：`yishan-api-cd-ubuntu.yml` 发布 API 与 Admin（先在目标机跑数据库迁移，迁移失败即不部署代码；Admin 编译进同一产物，由后端静态托管在 `/` 提供）。该链路**不等 CI**（演示站对外可见，延迟优先），构建失败本身会挡住发布；`release.sh` 会在健康检查失败时回滚。

CI 覆盖 API类型/构建/单元/隔离数据库集成、包边界、迁移哈希及 OpenAPI一致性。Web/App 的构建与业务行为保持现状。
