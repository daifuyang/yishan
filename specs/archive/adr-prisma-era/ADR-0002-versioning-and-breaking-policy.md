> Archived 2026-07-19 — superseded by specs/baseline-v2/PROPOSAL.md + decisions/ADR-001..007. This document described the Prisma-era architecture and is kept for historical reference only.

# ADR-0002: 版本策略与 Breaking Change 政策

- 状态：Accepted
- 日期：2026-05-23
- 决策人：Yishan Core Team

## 背景

插件化升级后，Core 与 Plugin 将独立演进。若无统一版本策略，会出现运行期不兼容、灰度失败和回滚困难。

## 决策

### 1) 版本语义（SemVer）

适用对象：

- Core Plugin API（服务端 runtime 契约）
- Admin Plugin API（前端扩展契约）
- 插件包本身（独立版本）

规则：

- MAJOR：不向后兼容变更。
- MINOR：向后兼容功能新增。
- PATCH：向后兼容修复。

推荐字段：

- `coreApiVersion`: Core 契约版本（例如 `2.1.0`）
- `pluginVersion`: 插件实现版本（例如 `1.4.3`）
- `compatRange`: 插件声明兼容范围（例如 `>=2.0.0 <3.0.0`）

### 2) 兼容矩阵

必须维护矩阵（文档 + 运行时校验）：

- Core MAJOR N 只保证兼容 `compatRange` 覆盖 N 的插件。
- Core MINOR 升级不得破坏同 MAJOR 内已发布插件。
- Plugin 若声明跨 MAJOR 兼容，必须提供自动化测试证明。

示例：

- Core `2.3.0` 可运行 `compatRange >=2.0.0 <3.0.0` 的插件。
- Core `3.0.0` 默认拒绝仅声明 `<3.0.0` 的插件加载。

### 3) Breaking Change 触发条件

满足任一条件即视为 breaking：

- 删除或重命名已公开 hook 名称。
- 修改 hook payload 必填字段或字段语义。
- 修改生命周期顺序，导致既有插件行为变化。
- 将默认失败策略从 fail-open 改为 fail-close（或反向）且影响主流程。
- 移除已公开 API 路由/字段，且无兼容层。

### 4) 迁移策略

迁移必须遵循三阶段：

1. Introduce：引入新契约，旧契约保留并标记 deprecated。
2. Observe：至少一个发布周期观测兼容层使用率与错误率。
3. Remove：在下一个 MAJOR 移除旧契约。

迁移资产要求：

- migration guide（步骤、示例、已知风险）
- compatibility report（插件清单与可运行结论）
- fallback plan（开关、回滚版本、数据修复脚本）

### 5) 回滚策略

回滚分级：

- L1（配置回滚）：关闭插件或关闭新 hook 路径。
- L2（版本回滚）：回退插件版本或 Core 次版本。
- L3（发布回滚）：恢复上一稳定构建产物（含 API + Admin 静态资源）。

回滚前置要求：

- 每次 MAJOR/MINOR 发布必须保留上一个稳定构建可快速恢复。
- Prisma 迁移涉及破坏性操作时，必须准备 down plan 或兼容读取策略。

## 运行时强制校验

在 `yishan-api` runtime 加载插件时必须执行：

- 校验 `compatRange` 与当前 `coreApiVersion`。
- 校验插件声明的最小能力集（必须 hook、必须权限）。
- 不兼容插件拒绝启用，并记录结构化错误日志。

## 结果与影响

- 正向影响：升级风险前置，版本行为可预测。
- 代价：发布流程变长，需要维护兼容矩阵与迁移文档。
