---
title: 构建与发布
---

# 构建与发布

## 构建前端（Admin）

```bash
pnpm --filter yishan-admin build
```

- 构建产物输出到 `dist/`
- 本地预览：
  ```bash
  pnpm --filter yishan-admin preview # 默认端口 8000
  ```

### 同步接口定义（可选）

构建前建议同步最新接口定义以保证类型一致：

```bash
pnpm --filter yishan-admin openapi # 从 /api/docs/json 生成服务定义
```

## 构建并启动后端（API）

```bash
pnpm --filter yishan-api start # 自动构建 TypeScript 并启动 Fastify
```

- 亦可单独构建：`pnpm --filter yishan-api build:ts`，然后使用 `fastify start` 启动 `dist/app.js`

## CI/CD 快速入门

GitHub Actions 工作流目录：

`c:\Workspace\Frontend\yishan\.github\workflows`

当前生效模式（CI/CD 全合并）：

- `yishan-fullstack-ci.yml`：统一 CI（触发前后端相关变更，串行执行 Admin Lint + Build 与 API Generate + Build + Test）
- `yishan-fullstack-cd-fc.yml`：统一 CD（`main` 分支或手动触发，构建前端并同步到 API，最终部署到同一个 FC 函数）

统一 CD 核心流程：

1. 安装 workspace 依赖并构建 `yishan-tiptap`
2. 构建 `yishan-admin`，将 `dist/` 同步到 `apps/yishan-api/public/admin`
3. 构建 `yishan-api` 产物并执行 FC 部署（`apps/yishan-api/deploy/fc3`）

旧模式备份（前后端分离 CI/CD）：

- 备份目录：`c:\Workspace\Frontend\yishan\.github\workflows_backup\split-mode-20260329`
- 备份文件：
  - `yishan-admin-ci.yml`
  - `yishan-admin-cd-fc.yml`
  - `yishan-api-ci.yml`
  - `yishan-api-cd-fc.yml`
- CI 独立备份目录：`c:\Workspace\Frontend\yishan\.github\workflows_backup\split-ci-mode-20260329`
- CI 备份文件：
  - `yishan-admin-ci.yml`
  - `yishan-api-ci.yml`

常用排查顺序：

1. 进入 GitHub Actions 查看对应 Workflow 的失败步骤
2. 检查仓库 Secrets（数据库、Redis、阿里云 AK/SK 等）是否已配置
3. 按失败步骤在本地复现（如 `pnpm --filter yishan-admin lint`、`pnpm --filter yishan-api test`）
4. 修复后重新 push 或手动触发 `workflow_dispatch`

### 使用 act 本地测试合并 CI

建议在仓库根目录执行以下命令：

```bash
act -l
act push -W .github/workflows/yishan-fullstack-ci.yml -j verify -n
act push -W .github/workflows/yishan-fullstack-ci.yml -j verify
```

- `-n` 为 dry-run，先验证 workflow 解析、步骤装配和容器拉起流程
- 不带 `-n` 会真实执行本地 CI 任务

本地验证记录（2026-03-29）：

- `act -l`：成功识别 `yishan-fullstack-ci` 与 `yishan-fullstack-cd-fc`
- `act ... -n`：dry-run 成功进入 `Set up job`
- `act ...`：失败于 Docker 拉取 `catthehacker/ubuntu:act-latest`（`TLS handshake timeout` / `EOF`）

遇到镜像拉取失败时可先重试，或先在本机执行：

```bash
docker pull catthehacker/ubuntu:act-latest
```

## 注意事项

- 生产环境请设置安全的 `JWT_SECRET`，并将数据库、Redis 等连接指向生产实例
- 前端部署时请将 `/api/` 代理指向生产 API 地址，或在 API 层启用 CORS
