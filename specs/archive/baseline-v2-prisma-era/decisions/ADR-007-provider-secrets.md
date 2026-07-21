# ADR-007：Provider adapter 的 secret 流转

- 状态：Proposed（阶段 E 起生效）
- 日期：2026-07-19
- 取代：`.github/workflows/yishan-fullstack-cd-fc.yml` 中硬编码的地域、层名、access alias；`apps/yishan-api/deploy/fc3/certs/*` 提交进仓库
- 影响：CI workflow、release adapter、根脚本、`.gitignore`

## Context

当前部署默认（INVENTORY §7）：

- 地域默认 `cn-shanghai`（CD workflow L238）；
- 层名默认 `yishan-api-runtime-layer`；
- access alias 默认 `enterprise`；
- `apps/yishan-api/deploy/fc3/certs/private.key` 与 `fullchain.cer` **已提交进 git**——这是安全事件，不是配置问题。

方案 §11 明确"不允许把环境专属云账号、地域、bucket、ARN 或 secret 名称作为基座默认值"；方案 §6.2 要求 FC3 adapter 只接收 artifact 与显式环境变量。

## Decision

1. **FC3 adapter 路径**：`deploy/providers/fc3/`，从 `apps/yishan-api/deploy/fc3/` 迁出；adapter 与业务代码完全解耦，不依赖 `apps/yishan-api` 内部结构。
2. **adapter 接口**：

   ```bash
   pnpm deploy:fc3 -- --artifact <path> --env-file <.env.encrypted>
   ```

   adapter 只读：artifact 目录、`--env-file`（由客户项目或 CI secret manager 解密后传入）。**adapter 内部不再有 region / layer-name / access-alias 默认值**——这些必须显式传入。
3. **CI workflow 改动**：
   - 删除 `yishan-fullstack-cd-fc.yml:238-240` 的默认地域/层名/access alias；
   - 这三项改为 `vars.FUNCTION_REGION` / `vars.YISHAN_FC_LAYER_NAME` / `vars.YISHAN_FC_ACCESS_ALIAS`，**没有 vars 就 fail-fast**，不再 fallback。
   - 删除 `apps/yishan-api/deploy/fc3/certs/` 整个目录并加入 `.gitignore`；如需保留示例，新增 `certs/.gitkeep` + `certs/README.md` 注明"客户项目自备，勿提交"。
4. **`apps/yishan-api/deploy/fc3/` 的去留**：当前为业务项目遗留实现。v2 把 `deploy/providers/fc3/` 作为唯一 FC3 adapter；老的 `apps/yishan-api/deploy/fc3/` 在阶段 E 末尾删除（先 git 历史保留，再 git filter-repo 清出 certs）。
5. **Qiniu**：保留作为 storage provider 的实现（`apps/yishan-admin/src/services/generated/storage.ts` 与 schema 已存在），但 deploy 不再直连 qiniu bucket；Qiniu 凭证通过 `STORAGE_QINIU_*` 环境变量在 server 启动时注入，adapter 不知道它的存在。
6. **secret 流转**：基座不内置任何 secret 后端；客户项目自行选择 GitHub Actions secrets / 阿里云 KMS / Vault。文档明确说明"v2 仅约定注入点，不约定来源"。

## Consequences

正向：

- 基座仓库不再携带任何客户项目的环境专属默认值，符合 v2 作为"可复制基座"的定位。
- certs 私钥移出 git 是一次性安全收益（即便现在已经 rotate，仍需清出 git 历史）。
- adapter 与业务代码解耦后，新 provider（SAE / 自建 K8s / Cloudflare Workers）的接入成本可控。

负向 / 风险：

- 客户项目升级 v2 需要把现有 FC3 部署脚本与新 adapter 接口对齐；文档与 migration guide 必须同步。
- `apps/yishan-api/deploy/fc3/certs` 的 git 历史清理需要 `git filter-repo`，会改写所有 commit SHA；阶段 F 末尾单独做一次，PR 标题必须明确。
- vars 改为必填后，存量 CI 必须配置 vars 才能发版；老 CI 配置会 fail-fast 而不是 silently 用默认值。

## 验收

- `rg "cn-shanghai|yishan-api-runtime-layer|enterprise" .github/workflows deploy/` 零命中（除注释与文档）；
- `git ls-files | grep -i 'deploy/.*\.key\|deploy/.*\.pem\|deploy/.*cert/'` 零命中；
- `pnpm deploy:fc3 -- --artifact ./artifacts/release/core/0.1.0` 缺 `--env-file` 时 fail-fast 并提示必需项；
- `apps/yishan-api/deploy/` 在 v2.0.0 tag 时为空（迁移到 `deploy/providers/fc3/`）。