# ADR-0003: 插件生命周期与 Hook 机制

- 状态：Accepted
- 日期：2026-05-23
- 决策人：Yishan Core Team

## 背景

插件系统若缺少统一生命周期与 Hook 语义，会导致执行顺序不确定、失败外溢和排障困难。需要在 Fastify + Prisma + Umi 的现有技术栈上给出可执行规范。

## 决策

### 1) 生命周期模型

服务端插件生命周期（API Runtime）：

1. `registered`：已注册，尚未加载。
2. `loaded`：代码与 manifest 校验完成。
3. `enabled`：可接收 hook 事件。
4. `disabled`：临时停用，不参与执行。
5. `unloaded`：已卸载，不保留执行上下文。

生命周期回调（可选）：

- `onLoad(context)`
- `onEnable(context)`
- `onDisable(context)`
- `onUnload(context)`

约束：

- 允许状态迁移：
  - `registered -> loaded -> enabled`
  - `enabled -> disabled -> enabled`
  - `disabled -> unloaded`
- 禁止跨级跳转：例如 `registered -> enabled`。

### 2) Hook 事件命名规范

采用分层命名：`<domain>.<entity>.<action>.<phase>`

- domain：`api` | `admin` | `system`
- entity：业务实体，如 `post`, `user`, `plugin`
- action：行为，如 `create`, `update`, `delete`, `publish`
- phase：`pre` | `main` | `post`

示例：

- `api.post.create.pre`
- `api.post.create.main`
- `api.post.create.post`

禁止：

- 使用无语义缩写（如 `evt1`）。
- 在同一事件名下变更 payload 语义而不升 MAJOR。

### 3) 执行顺序与优先级

排序规则：

1. phase 顺序固定：`pre -> main -> post`
2. 同 phase 内按 `priority` 降序（默认 `100`）
3. priority 相同按插件名升序，确保确定性

并发规则：

- 默认串行，确保可预测。
- 仅对显式标记 `parallelSafe=true` 且无共享副作用的 hook 允许并发。

### 4) 幂等与重入

幂等要求：

- 对可能重试的 hook，必须支持 `idempotencyKey`。
- 建议键组成：`<eventName>:<resourceId>:<requestId>`。

实现建议（API）：

- 在 Prisma 中记录最近执行键与状态。
- 检测到重复键时，直接返回已完成结果或跳过副作用。

### 5) 超时与失败处理

超时策略：

- 默认超时：`1500ms`（可按 hook 覆盖）
- 最大超时：`10000ms`
- 超时后标记 `timeout` 并进入失败策略

失败策略：

- `fail-open`：插件失败不阻断主流程（默认用于非关键扩展）
- `fail-close`：插件失败阻断主流程（仅关键校验类 hook）

重试策略：

- 仅对幂等 hook 重试。
- 最大重试次数建议 `2`，退避策略指数退避。

错误观测：

- 结构化日志字段：`traceId`, `plugin`, `event`, `phase`, `durationMs`, `status`, `errorCode`
- 必须可关联 Fastify request id。

### 6) Admin 侧对齐规则

- Admin 仅消费 API 暴露的插件状态，不自行推断生命周期。
- Umi 页面中的插件操作（启用/停用/回滚）必须走 API 管理接口。
- 前端 Hook（若实现）沿用同名规范，并与 API 事件建立映射关系。

## 结果与影响

- 正向影响：执行链路确定，故障可定位，可进行灰度和回滚。
- 代价：插件开发需遵循更多约束，初始接入成本上升。

## 最小验收标准

- 生命周期状态机有单测覆盖。
- 至少 3 个关键业务事件完成 `pre/main/post` 实装与验证。
- 故障注入场景（超时、异常、重试）有自动化测试结果。
