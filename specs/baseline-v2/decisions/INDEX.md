# ADR 索引

| ID | 标题 | 状态 | 影响阶段 |
| --- | --- | --- | --- |
| [ADR-001](./ADR-001-branch-policy.md) | 重构分支策略与发行线 | Proposed | A |
| [ADR-002](./ADR-002-plugin-sdk.md) | 插件 SDK 包结构与 manifest 形态 | Proposed | B |
| [ADR-003](./ADR-003-plugin-gate.md) | 插件装载与 gate 模型 | Proposed | C |
| [ADR-004](./ADR-004-verify-db.md) | `pnpm verify --profile X` 的数据库策略 | Proposed | E |
| [ADR-005](./ADR-005-openapi-client-layout.md) | OpenAPI spec 与 admin client 的 per-profile 布局 | Proposed | E |
| [ADR-006](./ADR-006-hello-policy.md) | hello 插件在 core profile 中的归属 | Proposed | A |
| [ADR-007](./ADR-007-provider-secrets.md) | Provider adapter 的 secret 流转 | Proposed | E |

## 阶段 → ADR 矩阵

| 阶段 | 必读 ADR |
| --- | --- |
| A 冻结与事实清理 | ADR-001, ADR-006 |
| B 插件 SDK 与目录迁移 | ADR-002 |
| C 运行时正确性 | ADR-003 |
| D 数据库与生成链路 | （无新 ADR；继承 ADR-002、ADR-003 的目录与 gate 假设）|
| E 发布与 CI | ADR-004, ADR-005, ADR-007 |
| F 业务迁移和切换 | 全部 |

## 提议变更的非冲突 ADR 主题（v2.1 候选）

- ADR-008：客户项目 fork 后 SDK 扩展点（plugin author 能否自定义 SDK 字段）
- ADR-009：App（yishan-app）与 Admin 的 client 共享策略（避免 Admin client 重复生成）
- ADR-010：docs 站点的 per-profile 内容差异（`profiles/official` 是否含 portal docs）