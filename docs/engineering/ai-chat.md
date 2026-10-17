# AI 智能助手

AI 聊天是**独立可安装的业务模块** `ai`，不是 Demo 产品页：后端 `apps/demo/api/src/modules/ai`（前缀 `/api/ai/v1`，表前缀 `ai_`），前端 `apps/demo/admin/src/modules/ai`。Core 不承载 AI 业务。

- 模块安装：`src/manifest.ts` 的 `demoModules` 显式列出 `aiModule`；移除即卸载（模块管理页）。
- 权限：`ai:chat:use`。入口与接口共用同一权限。
- **无菜单配置**：模块不提供 `config/system-menu.json`，入口只有右下角全局悬浮按钮；旧书签 `/demo/ai-chat` 在 `config/routes.ts` 重定向到 `/`。

## 展示形态

`AiViewMode = 'closed' | 'floating' | 'fullscreen'` 是唯一展示态权威，由 `AiChatProvider` 持有；`AiChatHost` 是唯一展示控制器。悬浮与全屏互斥，**全屏不是路由跳转**，地址栏保持当前业务 URL。

## 官方资产

开发读取了官方 `x-components`、`x-markdown`、`use-x-chat`、`x-chat-provider`、`x-request` Skills。`@ant-design/x-skill` 已安装；安装器需要交互终端，因此使用其官方源码手动注册到 Codex 的用户 Skills 目录。Ant Design CLI Skill 的 Git 安装因 TLS 握手失败，改从官方仓库下载 SKILL.md；`@ant-design/cli` 已安装并执行组件属性、Demo、Token 和项目兼容性查询。

- [Independent](https://github.com/ant-design/x/blob/main/packages/x/docs/playground/independent.tsx)：双栏、Conversations、欢迎区、Bubble.List 与底部 Sender 的组合。
- [Copilot](https://github.com/ant-design/x/blob/main/packages/x/docs/playground/copilot.tsx)：紧凑标题操作、历史快捷入口、轻量助手容器。
- [Ultramodern](https://github.com/ant-design/x/blob/main/packages/x/docs/playground/ultramodern.tsx)：消息宽度、留白、空会话和有消息时的层级。

保留这些样板的组件组合与布局思路，移除演示请求、Mock 历史、附件、语音及装饰品牌。X SDK Skills 仅用于理解官方协议和架构；正式聊天状态只由 `@ai-sdk/react` 的 `useChat` 管理。

## 运行与部署

Node.js 最低为 22，仓库 `.tool-versions` 固定 22.22.1。API 继续采用 CommonJS / Node16 编译；AI Runtime 使用 `.mts` 输出原生 `.mjs`，服务通过保留为原生语法的 `import()` 加载。无需迁移整个 Monorepo 到 ESM。生产包必须包含编译后的 AI Runtime 和 `ai`、`@ai-sdk/anthropic` 的依赖闭包。

模型凭证仅在服务端设置：

```dotenv
AI_CHAT_API_KEY=
AI_CHAT_MODEL=
AI_CHAT_BASE_URL=
```

后端使用 **Anthropic 兼容协议**（`createAnthropic`）。必须走 Anthropic 端点而非 OpenAI 端点：OpenAI 端点的 `reasoning_content` 会被 `@ai-sdk/openai` v4 静默丢弃，思考内容拿不到。`AI_CHAT_BASE_URL` 要带 `/v1`（AI SDK 会再拼 `/messages`），例如 `https://api.minimaxi.com/anthropic/v1`；留空则用 Anthropic 官方地址。密钥按站点分区（国内 key 只能访问 `api.minimaxi.com`），且不得写入前端配置、提交到仓库或包含在日志中。

`ai` 模块自带迁移账本 `__drizzle_migrations_ai`，迁移不会在启动时自动执行；应用启动也不会写入菜单（模块本就无菜单）：

```bash
pnpm build:api
pnpm --filter @yishan/demo-api db:migrate --dry-run
pnpm --filter @yishan/demo-api db:migrate --apply
```

管理员需将 `ai:chat:use` 权限分配给目标角色；未安装 `ai` 模块的产品不出现悬浮入口。

## 动作草稿：助手协助建号

助手可以**准备**一个建号动作，但**没有任何工具能写业务数据**。模型的工具集是只读的：
`prepare_create_user` 把用户在对话里给出的字段整理成一份服务端草稿存进 `ai_action_drafts`，
回给前端的是一个草稿引用，不是用户记录。

- 端点（与聊天端点平级，均在 `/api/ai/v1` 下）：`POST /api/ai/v1/conversations/:id/drafts`、
  `GET/PATCH /api/ai/v1/drafts/:draftId`、`POST /api/ai/v1/drafts/:draftId/cancel`。
  前端客户端只暴露这四个动作（读、改、取消），没有「创建」和「提交」。
- 真正的创建只发生在系统原有的 `POST /api/v1/admin/users`，由 `UserForm` 自己的 `onFinish`
  发起，也就是**人点了确定**。聊天文本不能触发创建，客户端传来的 `confirmed: true` 也**不是**
  授权——提交时按 `draftId + draftVersion` 做 CAS，服务端以自己存的草稿为唯一可信来源。
- **密码永不进入任何一侧**：不进草稿、不进聊天历史、不进工具参数、不进模型上下文、不进遥测
  与审计体。密码只在表单里由人输入。
- **24 小时有效期**从草稿创建时算起，编辑不续期；一份草稿最多完成一次创建；处于 `submitting`
  的草稿不可编辑。
- 字段定义与候选来自 `GET /api/v1/admin/users/create-form`、`/create-options`，由后端从真实
  create schema 派生，因此助手与普通后台的必填、字段、部门、角色授权**同源**。前端不再维护
  第二份字段表（历史上曾有一份手写的 `services/user-create-form.ts`，已删除）。
- 并发：同一草稿被两个实例同时提交时，第二个请求返回**既有用户**而不是 409；用户行与草稿回执
  在同一事务内提交，回执写失败时用户一并回滚。提交前会重新校验角色权限与数据范围——授权被
  回收或范围收窄到「仅本人」时，创建被拒绝且草稿转为 `failed`。

### 安装 / 卸载

`ai` 模块连同 `ai_action_drafts` 表一起安装或移除。安装后新增迁移，**不会**自动执行：

```bash
pnpm build:api
pnpm --filter @yishan/demo-api db:migrate --dry-run   # 先看
pnpm --filter @yishan/demo-api db:migrate --apply    # 再写
```

迁移是幂等的，重复执行安全（`ai` 模块自带账本 `__drizzle_migrations_ai`）。
卸载模块不会自动删除表；确认没有草稿需要保留后再由运维手工处理。

### 失败诊断

| 现象 | 原因 |
|---|---|
| 草稿端点 404 | 路由被 autoload 按文件名加了前缀；草稿路由必须显式 `prefix: '/v1'` 注册 |
| 草稿读写出错（列不存在） | Drizzle schema 的 JSON 列名必须与迁移里的 snake_case 一致 |
| 重放返回「已完成，用户已被删除」 | 读取已完成结果必须是事务内的当前读（`FOR UPDATE`），一致性快照读不到并发新建的行 |
| 前端字段与后台对不上 | 重新执行 `pnpm --filter @yishan/demo-admin openapi`，不要手工改生成类型 |

## 数据与状态

会话与消息存入 `ai_conversations`、`ai_messages`，保存 UIMessage 的稳定 ID、顺序、parts 和终态。每次访问都检查当前用户归属；服务端使用数据库租约限制同一用户并行生成，避免多实例竞争。客户端不能用提交的历史替换服务端历史。

`AiChatProvider`（`rootContainer` 挂载）持有唯一的 `useChat` 引擎、活动会话和草稿；浮窗与全屏只是同一份状态的两种外层布局，切换形态不重建引擎、不清空会话，也不产生第二个状态管理器。关闭浮窗与业务路由切换不停止生成；停止按钮、登出或身份变化会取消请求并清空。生成期间需先停止或等待完成，再切换会话。页面刷新后从服务端加载历史；未发送草稿只在当前应用生命周期内保留。

Markdown 使用 XMarkdown 的流式解析及 HTML 转义，代码展示和复制使用官方组件。未知 parts 不会导致消息适配层抛错；扩展类型仍保存在消息结构中。

## 验收边界

单元测试中的模型传输替身只用于协议、取消及异常测试，不是生产服务。真实模型联调需要有效的服务端模型配置；未配置时必须明确返回配置错误，不能返回假回答。浏览器和真实数据库的验收结果见本次交付记录。
