# ADR 索引

ADR-002 (plugin-sdk), ADR-003 (plugin-gate), ADR-006 (hello policy) and
`PLUGIN_CONTRACT.md` were retired together with the legacy plugin model
(`plugins/<vendor>/<slug>/`, `plugin-platform/`, `plugin-sdk/`). Their
removal was decided inline during the modules-autoload refactor — see
`git log` for the stage-1 commit and the parent baseline-v2 work.

| ID | 标题 | 状态 |
| --- | --- | --- |
| [ADR-001](./ADR-001-branch-policy.md) | 重构分支策略与发行线 | Accepted |
| [ADR-004](./ADR-004-verify-db.md) | `pnpm verify --profile X` 的数据库策略 | Accepted |
| [ADR-005](./ADR-005-openapi-client-layout.md) | OpenAPI spec 与 admin client 的 per-profile 布局 | Accepted |
| [ADR-007](./ADR-007-provider-secrets.md) | Provider adapter 的 secret 流转 | Accepted |

历史 ADR（已废弃）：

- ADR-002 插件 SDK 包结构与 manifest 形态（被精简替代）
- ADR-003 插件装载与 gate 模型（被精简替代）
- ADR-006 hello 插件在 core profile 中的归属（被精简替代）

## 提议变更的 ADR 主题（v2.1 候选）

- ADR-NEW：modules autoload 的 `.dev-modules.json` 覆盖语义与生产构建隔离
- ADR-NEW：Core admin SDK（`apps/yishan-admin/src/types/sdk/`）的稳定类型边界