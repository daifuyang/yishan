# 原生表单接入 AI 的约定

AI 识别意图、查询真实引用、提取字段并更新草稿。页面打开原有表单，用户检查和修改后点击原有提交按钮；权限、业务规则、上传与正式写入沿用原实现。

## 发现与调用

Runtime 使用四个通用工具：`discover_operations`、`describe_operation`、`query_business_data`、`update_form_draft`。业务能力显式注册在已有 Catalog，或由已安装模块的 `capabilities` 声明贡献；没有语义和安全声明的接口默认不开放。发现按当前身份和模块启用状态过滤，执行仍重新检查权限、PAT 与数据范围。

`operation.id` 是稳定的业务操作标识，如 `user.create`、`department.create`；能力的 `operationId` 对应原业务接口。`describeCapability` 按需返回原业务表单字段与规则，`references` 指向受限的真实候选查询。不可按 HTTP 方法推断安全性，不向模型传全量 OpenAPI，不提供通用 HTTP/SQL 调用。

## 持久创建草稿

用户和部门创建共用现有 `ActionDraftService` 与 `ai_action_drafts`，不新增业务表或草稿状态机。工具返回 `action.draft` 引用，包含 `draftId`、`draftVersion` 和目标；前端读取服务端草稿后打开原生表单。密码、头像和附件不在草稿中。

省略字段表示保持不变，`null` 表示清空；已有草稿更新使用读到的版本。版本变化拒绝过期更新。字段格式、必填和引用授权由同源 Schema 与业务 Service 检查；不存在的 ID 被拒绝，同名引用需用户选择。

Bridge 监听原生表单变化并同步草稿；人工修改字段保留来源信息，AI 再次覆盖须显示差异并由用户确认。工具完成后立即处理一次，历史结果不自动重放。切换身份或会话时解绑旧草稿，在途结果不能跨会话生效。

用户在原表单点击确定时，Bridge 先同步并取得准确草稿版本，再把 `draftSubmission: { draftId, draftVersion }` 交给原创建 API。服务端在原业务事务中认领草稿、校验正式输入、创建记录并写回执；重复请求回读已有结果。AI 没有 submit 句柄，聊天里的“确认”不会触发正式写入。

## 编辑、删除与历史兼容

已有用户编辑继续返回 `form.prefill`，只包含本轮明确提供的补丁；编辑详情由原页面加载，不把整条查询结果当成补丁。删除返回 `action.confirm`，页面重新读取目标并展示原有二次确认；只有用户点击确认才调用原删除接口。

旧的预填和草稿工具、历史卡片保持兼容。新建主流程使用持久草稿。编辑预填仍沿用现有原生页面协议，不能把它描述为已具备创建草稿的完整持久提交状态机。

## 新业务接入

1. 先确认原业务 API 有稳定 operationId、TypeBox Schema、既有权限码和数据范围；受限查询需限制行数和输出字段。
2. 在业务归属位置补充原生表单元数据，派生原 Schema，不在 AI Runtime 中手写字段或业务 Prompt。
3. 显式贡献安全查询和预备能力，补充操作名称、类型、表单标识、描述能力和引用来源。复用原执行链。
4. 为需要持久恢复的创建表单增加轻量草稿适配，接入已有 CAS 引擎；正式 API 通过公开提交参与者复用原事务，不增加另一条创建接口。
5. 原生表单注册快照、版本、补丁应用与变化通知。表单保留自身开关、校验、加载、提交和错误处理；AI 入口打开现有全局助手，不创建页面 Agent。
6. 覆盖无权限、禁用模块、幻觉 ID、字段冲突、会话切换、取消、过期版本、重复提交和回滚，再执行边界、OpenAPI、类型及相关测试。

目前原生目标路由与处理器仍需显式接入，并非安装任意页面即可自动操作。用户和部门是两种不同字段结构的实际适配示例；后续模块复用 Runtime 和草稿状态机，仍需声明自己的安全业务语义和原生表单入口。

### 业务草稿适配器

`@yishan/core-contracts` 的 `AiDraftAdapter` 由业务能力的 `draftAdapter` 字段显式贡献。适配器提供 `action`、`moduleId`、原接口 `operationId`、准备能力名、权限码、`fieldSchemas`、`form()`、`authorize()` 和可选的 `questions()`。字段 Schema 必须取自原业务定义，敏感字段不在可编辑集合；授权调用原业务 Service。用户、部门实现位于 System API 的 `core/ai/draft-adapters.ts`。

AI 从当前应用能力目录读取已注册适配器，生成准备能力并复用统一草稿状态机。新业务不再修改 `ActionDraftService` 的动作分支。正式业务提交仍须接入自身事务参与者；只注册适配器不会自动获得创建权限或提交实现。

### 公共原生表单接口

`@yishan/core-admin/form-assistance` 提供 `registerNativeFormOperation` 和 `useAiForm`。业务注册 `operationId`、名称、路由、字段标签及协作提示，再使用 `useAiForm({ handle, identity, enabled, shouldRestore })` 管理句柄生命周期。句柄只有 `snapshot()`、`open()`、`apply()`；原生表单负责实例标识、revision、人工修改来源、字段白名单与异步候选校验。通过 `publishNativeFormChange` 发布非敏感快照，提交前读取 `peekNativeDraftLink(operationId)`，调用 `prepare()` 后把精确草稿版本交给原 API。

公共接口不接收提交函数。System Admin 的旧 UserCreate 命名导出保留兼容，内部委托同一注册中心；新增业务直接使用操作中性接口。

### 结构化候选问询

草稿卡片通过 `GET /api/ai/v1/drafts/:draftId/questions?conversationId=...` 读取最新问题。用户创建先确认归属部门，再按所选部门查询可授予角色；同名部门展示完整层级路径。空选择须点击确认，唯一候选也不自动选择。候选超过上限时明确提示在原生表单查询完整选项。

答案通过 `POST /api/ai/v1/drafts/:draftId/questions/answer` 提交 `conversationId`、`questionId`、`draftVersion` 和数字 ID 数组 `values`。服务端核对当前用户、会话、草稿状态与版本，并重查业务授权和候选后 CAS 更新。重复的同一答案可回读紧邻版本结果；中间发生其他更新则拒绝。问题不拥有正式写入权限，也不把客户端传入的“确认”当成业务提交凭证。

重放历史只读取最新问题，不自动提交。请求失败保留选择，旧问题可以重新读取。原生表单的待同步人工输入先落入草稿；答案保存后，已打开的原生表单通过现有桥接器读取最新版本，继续沿用人工字段冲突保护。

## 流式体验

正文按真实增量流式渲染，前端平滑逐字展示；供应方返回 reasoning 时显示相应区域，工具进度来自真实执行。没有 reasoning 时不生成虚假的思考文字。停止、超时和失败保存已有消息状态，下一轮忽略未完成工具调用，避免无法继续对话。
