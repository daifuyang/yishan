# AI 助手模块（`ai`）

独立的 AI 业务模块，由产品 Manifest 显式安装（`apps/demo/api/src/manifest.ts`）。
与 `demo` 示例插件同级，不属于示例插件；产品本身不拥有 AI 业务源码。

## 接口

| HTTP 路径 | 功能 |
|---|---|
| GET /api/ai/v1/conversations | 当前用户最近 100 个 AI 会话 |
| POST /api/ai/v1/conversations | 新建 AI 会话 |
| GET /api/ai/v1/conversations/:id | 会话与 UIMessage 历史 |
| PATCH /api/ai/v1/conversations/:id | 重命名会话（title） |
| DELETE /api/ai/v1/conversations/:id | 删除会话及消息 |
| POST /api/ai/v1/chat | AI SDK 7 UI 消息流 |
| POST /api/ai/v1/conversations/:id/drafts | 在本会话下新建用户或部门动作草稿 |
| GET /api/ai/v1/drafts/:draftId | 读取草稿（仅归属者可见） |
| PATCH /api/ai/v1/drafts/:draftId | 按字段合并更新草稿，密码永不在其中 |
| POST /api/ai/v1/drafts/:draftId/cancel | 取消草稿 |
| GET /api/ai/v1/drafts/:draftId/questions | 读取本会话草稿的实时候选问题 |
| POST /api/ai/v1/drafts/:draftId/questions/answer | 人工回答问题，仅更新草稿 |

建号的字段定义与候选来自系统侧 `GET /api/v1/admin/users/create-form` 与
`/api/v1/admin/users/create-options`，因此助手与普通后台的必填、字段、部门与角色授权同源。

## 动作草稿

模型使用四个通用工具 `discover_operations`、`describe_operation`、`query_business_data`、
`update_form_draft`。工具按需读取已注册的操作、同源字段与真实候选，并经原有执行链查询或更新草稿，
**没有任何工具写业务表**。草稿存 `ai_action_drafts`，
有效期 24 小时（自创建起算，编辑不续期），一份草稿最多完成一次创建。

草稿字段、表单元数据、权限校验和候选问题由业务能力显式贡献 `AiDraftAdapter`，公共状态机不再分支识别用户与部门。用户创建的部门/角色问询复用同源候选服务，回答绑定用户、会话和草稿版本，提交时重新检查候选及授权；历史卡片不会自动提交答案。前端公共注册与 `useAiForm` 位于 `@yishan/core-admin/form-assistance`。

真正的创建走系统原有的 `POST /api/v1/admin/users` 或 `POST /api/v1/admin/departments/`：前端在原生表单点「确定」时带上
`draftSubmission: { draftId, draftVersion }`，服务端以 CAS 取自己存的草稿为唯一可信来源，
在原业务事务内创建记录并写回执；回执写失败则创建一并回滚，重复提交回读原记录，事务提交后草稿不再可编辑。
客户端传来的任何「已确认」标记都不是授权。

权限兼容影响：建号沿用 `system:user:create`；助手入口仍需 `ai:chat:use`，且**提交时**重新校验
角色权限与数据范围，授权被回收或范围收窄到仅本人时创建被拒绝（草稿转 `failed`，可人工处理）。

## 配置

Admin 菜单 `/ai/settings` 管理一个 Anthropic 兼容模型：API 地址、模型名称、API Key。数据库存在 `ai_model_settings` 记录就固定优先使用整组配置，无记录才整组回退环境变量，不提供开关、不混用两套参数。每个新请求读取一次，保存后无需重启。数据库读取失败或记录不完整会明确报错，不静默切换供应方。

API Key 是只写字段：GET 和 PUT 响应仅返回 `hasApiKey`，不返回原值或掩码占位值。编辑时省略或留空保留已有数据库密钥，首次保存必须输入，不复制环境密钥。测试连接使用已保存的有效配置，发出短请求，有 15 秒超时，不开放业务工具、不返回上游原始错误。

接口：`GET /api/ai/v1/settings`、`PUT /api/ai/v1/settings`、`POST /api/ai/v1/settings/test`。启用后地址和密钥只在服务器用于模型调用，不进入聊天消息。

- `AI_CHAT_API_KEY`、`AI_CHAT_MODEL`：环境兜底时必填，密钥只在服务器读取。
- `AI_CHAT_BASE_URL`：可选。留空使用 Anthropic 官方地址。
  接 MiniMax 时**必须**用 Anthropic 兼容端点并带 `/v1`：
  `https://api.minimaxi.com/anthropic/v1`。
  原因：OpenAI 兼容端点的 `reasoning_content` 会被 `@ai-sdk/openai` 的
  chat-completions 路径静默丢弃，只有 Anthropic 端点能拿到独立 thinking 块。
  MiniMax 的 thinking 默认关闭，运行时按域名前缀注入 `thinking: {type:'adaptive'}`。

## 权限

聊天及草稿接口要求 `ai:chat:use`。配置读取要求 `ai:settings:read`，修改与连接测试要求 `ai:settings:update`，使用助手不自动获得配置权限。
聊天入口是 Admin 右下角的全局悬浮宿主；配置菜单由 `config/system-menu.json` 和 AI 模块 seed 提供。权限由后端强制校验，前端隐藏入口不构成授权。

## 数据库

表 `ai_conversations`、`ai_messages`、`ai_action_drafts`、`ai_model_settings`（前缀 `ai_`），迁移账本
`__drizzle_migrations_ai`。迁移不会在应用启动时执行，也**永远不会**自动应用到业务库，
需运维显式运行（重复执行幂等）：

```bash
pnpm --filter @yishan/demo-api db:migrate --dry-run
pnpm --filter @yishan/demo-api db:migrate --apply
pnpm --filter @yishan/demo-api db:seed
```

从早期 `demo` 模块下的 `demo_ai_*` 迁移时：本模块迁移为全新账本，
旧表不被删除；确认数据已迁移后再单独下线旧表。

## 实现约束

- `runtime/ai-sdk.mts` 编译为原生 `.mjs`，CommonJS 服务通过保留的动态 `import()`
  加载，**不能**改成 `require`。
- 分层固定为 routes → services → repositories → db/schema；只有 repositories 执行 SQL。
- 聊天接收 DefaultChatTransport 标准 `{id,messages,trigger,messageId}`，服务端仅接收本次
  用户文本，其余上下文读取当前用户持久化历史；重新生成从历史截断目标助手回复。
  输入上限 256 KiB、单次文本 16000 字符、历史 200 条 / 240000 字符，输出最多 4096
  token，生成超时 120 秒。
- 模型输入按完整对话轮裁剪至 32 条 / 48000 字符，完整会话仍由服务端保存；取消后恢复时忽略未完成工具调用。
  单轮真实工具调用最多 12 次（并行调用共用预算），重试最多 1 次，按需描述字段而非发送全量 OpenAPI。
  消息 metadata 保存状态、耗时、工具/模型调用数及可得 Token 用量，不包含密码、密钥或 Cookie。
- 数据库唯一的用户租约限制跨实例并发，180 秒后可恢复进程异常退出留下的租约；保存时
  校验生成 token，防止旧任务覆盖新历史。停止、断线、上游失败均保存已有 parts，并在
  `metadata.status` 标记 complete / aborted / error。生成期间禁止删除或重命名会话。

接入与边界见 [原生表单约定](../../../../../../docs/ai-native-form-integration.md) 和
[架构评估](../../../../../../docs/architecture/ai-native-operations.md)。用户编辑、删除确认保留原生预填兼容，
完整持久提交状态机目前覆盖用户、部门创建。当前系统没有通用租户模型，不能将用户归属与行级范围等同于多租户隔离。

```bash
pnpm --filter @yishan/demo-api test src/modules/ai/tests
```
