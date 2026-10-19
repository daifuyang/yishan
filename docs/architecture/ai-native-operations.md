# AI Native 业务辅助架构

AI 是现有系统的辅助交互层。业务 Schema、权限、数据范围、业务 Service 和正式提交 API 仍是业务执行的唯一来源。本文以实际源码为准，接入细节见 [原生表单约定](../ai-native-form-integration.md)。

## 审查基线

2026-10-18，`dev @ 83b995de`；开始审查时工作区干净。AI API 位于 `apps/demo/api/src/modules/ai`，Admin 位于 `apps/demo/admin/src/modules/ai`。仓库不存在需要迁移的 `modules/ai/api`、`modules/ai/admin`，不为预设目录迁移源码或修改 Workspace。

已存在且应复用：

| 能力 | 现有实现 |
| --- | --- |
| 单一模型运行时、标准流式协议 | `apps/demo/api/src/modules/ai/runtime/ai-sdk.mts` |
| 服务端会话归属、消息持久化、跨实例生成租约 | `services/ai-chat.service.ts`、`repositories/ai-chat.repository.ts` |
| 作用域内显式能力注册 | `packages/core/api/src/ai-capability-catalog.ts` |
| 每次调用重新鉴权、PAT 收窄、行级数据范围、审计 | AI `services/ai-execution-chain.ts`，复用 System 权限实现 |
| 真实字段与可分配部门、角色 | System `core/services/user-creation-form.service.ts` |
| 持久草稿、归属、CAS、生命周期和提交参与者 | AI `services/action-draft.service.ts` 与现有业务提交路径 |
| 全局浮窗、工作台、原生表单桥接 | Admin AI 模块及 `packages/core/system-admin` 原生页面 |

基线的主要缺口：默认内存预填绕过了草稿恢复与人工冲突保护；Runtime 包含用户专用提示和流程；模块能力声明未被装配；发现未排除禁用模块；部门字段 `sortOrder` 与原生 `sort_order` 不一致。现有 `@json-render` 依赖未用于这些原生表单，不应为使用依赖而重写表单。

## 职责与信任边界

业务模块显式声明安全能力，安装清单决定代码是否存在，模块状态决定是否启用，既有权限决定用户是否可尝试调用。能力目录只提供发现提示；执行时仍按当前身份重新鉴权。不能通过 HTTP 方法推断安全性，也不能自动暴露所有 OpenAPI 接口。

统一 Runtime 只负责模型和工具调度。业务模块提供操作语义、原有 Schema、受限查询及原生表单适配，不提供独立模型、Agent 类或重复 Prompt。通用门面将发现、描述、查询和草稿更新映射到现有能力执行链；不接受任意 URL、SQL、角色或用户身份。

草稿是辅助交互状态，不是正式业务记录。敏感字段只在原生表单填写；名称和备注等查询结果视为不可信数据。模型的“确认”不具备提交权限。原生按钮触发原业务 API，服务端重新执行权限、范围、业务校验，并使用草稿版本及原有事务机制处理重复提交。

Core Contracts 只定义共享契约；Core API 提供目录和装配；System 提供自身业务能力和表单；AI 模块消费公开能力。禁止 Core 反向导入 AI 产品源码，禁止 Admin 导入后端，禁止 AI 访问其他模块私有 Repository。

## 成本与兼容

按需发现和描述操作，避免每轮附带全量 OpenAPI。保留完整服务端会话记录，但限制发送给模型的上下文；工具调用数、输出和时间预算由服务器控制。元数据缓存只能在已授权的请求作用域内复用，不能跨用户共享权限裁剪结果。

原有只读快捷意图、历史会话、草稿接口与原生提交入口需兼容。流式工具状态来自真实执行，正文来自供应方增量；不伪造思考过程。记录状态、耗时、调用数量和可得 Token 用量，不记录密码、密钥、Cookie 或完整敏感业务对象。

当前系统有 RBAC/PAT 和数据范围模型；不存在已证实的通用多租户模型，不能把现有用户归属或行级范围等同于跨租户隔离。后续租户能力必须由业务身份与数据访问层统一实现，AI 继承该能力。
