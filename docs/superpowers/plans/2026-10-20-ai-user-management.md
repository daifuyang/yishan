# AI User Management Implementation Plan

> **For agentic workers:** Use subagent-driven-development to implement and review the following tasks.

**Goal:** 按原生业务协作规范完善用户管理，并移除公共草稿和表单协调中的业务硬编码。

**Architecture:** 业务贡献草稿字段、元数据、授权和候选；AI 统一执行草稿状态机。公开表单注册接口支持 operationId，用户原生表单保持唯一可见编辑状态和正式写入口。

**Tech Stack:** TypeScript、Fastify、TypeBox、React、Ant Design、Vitest、Jest。

**Spec:** ../specs/2026-10-20-ai-user-management-design.md

## Global Constraints

- 只开放 read / prepare，保留用户管理原有 URL、权限与手工流程。
- 不引入依赖升级，不自动应用迁移，不写生产数据库。
- 敏感字段不进入模型、问题、草稿或表单快照。

## Task 1: 业务草稿适配

- [x] 读取现有 action-draft、业务 schema、能力目录与提交参与者。
- [x] 添加测试：注册第三个操作后可创建/更新草稿；错误 module/action 组合拒绝；运行测试确认缺口。
- [x] 在公开契约声明业务草稿适配，通过现有能力目录/装配接入，复用已有用户、部门授权。
- [x] 删除公共状态机、传输检查和准备能力的目标分支，保留原提交参与者。
- [x] 运行 API AI 测试并核查类型。

## Task 2: 通用原生表单协调

- [x] 读取 UserForm、DepartmentForm 和桥接器测试。
- [x] 添加第三个 operationId 注册/卸载及身份、实例失效测试，运行确认缺口。
- [x] 提供公开操作中性注册/协调契约和 useAiForm，接入用户原生表单，保持 dirty/revision 防护。
- [x] 保留现有导出兼容并以行为测试验证新增、编辑、删除及部门桥接。

## Task 3: 可提交 Question

- [x] 增加用户部门/角色问题协议测试：合法答案、旧版本、跨会话、非法候选、重复提交和权限变化。
- [x] 基于草稿最新版本和真实候选生成问题，答案经权限与候选重检后通过 CAS 写草稿。
- [x] 添加原生 Ant Design 问询组件与提交封装，接入草稿卡片；仅点击提交，保留失败输入。
- [x] 更新 OpenAPI 并再生成客户端，运行组件与端点测试。

## Task 4: 集成与交付

- [x] 审查三个任务的接口和权限边界，补齐发现的问题。
- [x] 更新 AI README 与原生表单接入文档为实际实现。
- [x] 运行相关 Jest/Vitest、typecheck:admin、typecheck:api、build:admin、check:boundaries、check:openapi。
- [x] 记录实际结果，说明未运行或环境受限的验证项。

## 实际验证

2026-10-20：`pnpm test`、`pnpm build`、`pnpm lint`、`pnpm typecheck:admin`、`pnpm typecheck:api`、`pnpm check:boundaries`、`pnpm check:openapi` 均通过。Admin 29 个测试集 / 240 项，Demo API 29 个测试集 / 312 项，System API 52 个测试集 / 536 项；数据库包 43 项通过、13 项按环境条件跳过。Question 端点与 OpenAPI 一致性测试通过，已再生成客户端。未执行真实数据库及模型端到端联调；未自动应用迁移。

独立审查发现并修复通用更新工具字段仍限用户、第三操作标题显示用户两项问题；复审无剩余具体发现。最后补充单选值保存为标量及幂等重放回归。保留原有导出、URL、权限和正式人工提交路径。
