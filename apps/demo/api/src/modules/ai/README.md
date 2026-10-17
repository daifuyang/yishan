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
| POST /api/ai/v1/conversations/:id/drafts | 在本会话下新建一个动作草稿（目前仅建号） |
| GET /api/ai/v1/drafts/:draftId | 读取草稿（仅归属者可见） |
| PATCH /api/ai/v1/drafts/:draftId | 按字段合并更新草稿，密码永不在其中 |
| POST /api/ai/v1/drafts/:draftId/cancel | 取消草稿 |

建号的字段定义与候选来自系统侧 `GET /api/v1/admin/users/create-form` 与
`/api/v1/admin/users/create-options`，因此助手与普通后台的必填、字段、部门与角色授权同源。

## 动作草稿

模型工具是**只读/预备**的：本模块注册的工具可以查询，也可以调用系统的
`prepare_create_user` 产出一份草稿，但**没有任何工具写业务表**。草稿存 `ai_action_drafts`，
有效期 24 小时（自创建起算，编辑不续期），一份草稿最多完成一次创建。

真正的创建走系统原有的 `POST /api/v1/admin/users`：前端在原生表单点「确定」时带上
`draftSubmission: { draftId, draftVersion }`，服务端以 CAS 取自己存的草稿为唯一可信来源，
在事务内插入用户并写回执；回执写失败则用户一并回滚，事务提交后草稿不再可编辑。
客户端传来的任何「已确认」标记都不是授权。

权限兼容影响：建号沿用 `system:user:create`；助手入口仍需 `ai:chat:use`，且**提交时**重新校验
角色权限与数据范围，授权被回收或范围收窄到仅本人时创建被拒绝（草稿转 `failed`，可人工处理）。

## 配置

- `AI_CHAT_API_KEY`、`AI_CHAT_MODEL`：必填，密钥只在服务器读取。
- `AI_CHAT_BASE_URL`：可选。留空使用 Anthropic 官方地址。
  接 MiniMax 时**必须**用 Anthropic 兼容端点并带 `/v1`：
  `https://api.minimaxi.com/anthropic/v1`。
  原因：OpenAI 兼容端点的 `reasoning_content` 会被 `@ai-sdk/openai` 的
  chat-completions 路径静默丢弃，只有 Anthropic 端点能拿到独立 thinking 块。
  MiniMax 的 thinking 默认关闭，运行时按域名前缀注入 `thinking: {type:'adaptive'}`。

## 权限

全部接口要求 `ai:chat:use`（`PermissionRef` 在 `schemas/ai-chat.schema.ts` 声明）。
入口是 Admin 右下角的全局悬浮宿主，**不在左侧菜单**，因此本模块没有
`config/system-menu.json`；权限由后端强制校验，前端隐藏入口不构成授权。

## 数据库

表 `ai_conversations`、`ai_messages`、`ai_action_drafts`（前缀 `ai_`），迁移账本
`__drizzle_migrations_ai`。迁移不会在应用启动时执行，也**永远不会**自动应用到业务库，
需运维显式运行（重复执行幂等）：

```bash
pnpm --filter @yishan/demo-api db:migrate --dry-run
pnpm --filter @yishan/demo-api db:migrate --apply
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
- 数据库唯一的用户租约限制跨实例并发，180 秒后可恢复进程异常退出留下的租约；保存时
  校验生成 token，防止旧任务覆盖新历史。停止、断线、上游失败均保存已有 parts，并在
  `metadata.status` 标记 complete / aborted / error。生成期间禁止删除或重命名会话。

```bash
pnpm --filter @yishan/demo-api test src/modules/ai/tests
```
