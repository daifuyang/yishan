# AI 结构化问询与用户创建验证（2026-10-18，历史方案）

> 本页记录的 AI 内嵌问询/预览方案已按用户要求撤回。当前采用原生表单字段补丁与原生删除确认，参见 [接入约定](../ai-native-form-integration.md)。下文仅保留历史验证记录，不代表当前实现。

## 实现与兼容

保持唯一 AiChatProvider/useChat、现有 Vercel AI SDK 7 tool output 流、Bubble.List、Sender 和 XMarkdown。工具 action.draft 的 render.payload 增加 interaction 引用：

```json
{
  "type": "question",
  "id": "<draftId>:<draftVersion>",
  "formKey": "user.create",
  "draftId": "<draftId>",
  "draftVersion": 1
}
```

字段与候选不由模型定义：界面校验引用后读取现有 create-form/create-options 与最新草稿。收集完成使用 form-preview；真实结果来自创建 API 或草稿 completed 回执。沿用现有数据库和 HTTP 契约，无新增迁移，无须重新生成 OpenAPI 客户端。旧的 action.draft 消息仍保留原生表单恢复入口；新协议不再同时自动弹原生表单。相同草稿只渲染最新一张交互卡片。

## 流程

- 已提供的姓名、昵称、手机号等进入现有持久化草稿，问询只展示未收集字段与待更正项。
- 部门使用可搜索、多选 TreeSelect，标签包含完整层级名称；角色使用真实授权候选多选与远程搜索，按部门重算。
- 部门/角色/头像沿用真实 API 的可选语义，不擅自改成必填。空部门、空角色有明确占位提示。
- 提交问询只 PATCH 非敏感草稿，并通过现有 send 进入下一轮；可选部门和角色未选择时显式保存空数组作为已确认答案。
- 完整预览可编辑全部非敏感字段；返回修改、取消均不调用 createUser。
- 最终确认先读取最新回执/版本、重查候选、验证字段并同步草稿，然后调用原有 createUser，带 draftSubmission 参与现有事务与幂等保护。
- 请求失败保留表单；响应丢失先读回执，提供明确重新载入入口，不自动重发创建。界面加载/异步提交均校验会话与身份，避免迟到结果写入新会话。
- 问询组件有局部错误边界，不解析 Markdown 语句生成控件。

## 敏感与权限边界

密码仅在最终预览的 Input.Password 和一次业务请求内存在，不进入草稿、chat.send、模型或消息历史。头像复用 AttachmentSelect 的图片上传/媒体选择，仅随最终业务请求提交；补齐了后端草稿合并对本地头像的保留，密码仍使用既有校验和哈希。

草稿 HTTP 创建/更新现在从认证请求传入 actorId/tokenScope，执行既有 validateUserCreation；最终创建仍由系统 API 重验权限、部门、角色与字段。界面本地锁阻止双击；服务端同一草稿的事务回执防止跨请求重复创建。

## 已执行验证

- Admin 全量 Jest：19 套、204 项通过（含新增问询/预览/异常恢复、真实选择控件接线测试）。
- API AI 模块 Vitest：11 套、183 项通过。
- Core System API 全量单测：50 套、505 项通过。
- 真实 MySQL 产品集成：2 套、9 项通过。测试创建随机隔离 schema，并在结束后清理；新增流程读取真实定义与候选，确认前 sys_user 数为 0，确认后为 1，重复提交返回同一个 ID，头像持久化且回执无密码。
- Admin、Core Admin、Core System Admin 严格 TypeScript 检查通过；API 及依赖构建、Admin 生产构建通过。
- 新增/修改的 AI 前端文件格式和 lint 检查通过；Admin 全量 lint 无错误，有既有警告。
- 只读代码审查与修复后复查完成，未发现遗留重要问题。

- 使用仓库锁定 pnpm 8.15.9 执行完整仓库 lint、test、build，均通过；原有 lint 警告/提示保留。
- 最终变更后的 typecheck:admin 与 Admin 生产构建再次通过；最终问询/协议重点测试 2 套、13 项通过（包括已确认部门仍驱动角色候选查询，以及畸形协议不抛异常）。
- 根 test 默认有一套需单独启用的 Core Database MySQL 测试跳过；本任务另行执行的 Demo 产品真实 MySQL 集成 9 项全部通过。

## 主要文件

- apps/demo/admin/src/modules/ai/adapters/interactions.ts：结构化引用、运行时校验、非敏感字段过滤。
- apps/demo/admin/src/modules/ai/components/AiInteractionRenderer.tsx：问询/预览/确认/真实结果与恢复。
- apps/demo/admin/src/modules/ai/components/AiQuestionField.tsx：真实元数据驱动的 Ant Design 控件和校验。
- apps/demo/admin/src/modules/ai/services/userCreateInteraction.ts：真实字段定义、完整授权角色候选与部门树。
- apps/demo/admin/src/modules/ai/context/chatContext.ts：提取轻量 context 定义，原 Provider 保留兼容导出，唯一 useChat 实例不变。
- apps/demo/api/src/modules/ai/capabilities/action-drafts.ts：在原有工具输出附带结构化交互引用。
- apps/demo/api/src/modules/ai/routes/v1/drafts.ts：将认证操作者上下文传给现有授权策略。
- packages/core/system-api/src/core/services/user-creation.ts：最终业务请求中的头像参与创建，始终不进入对话草稿。
- apps/demo/api/test/integration/product.test.ts：真实 API/数据库完整流程与重复提交验收。

未连接真实模型进行浏览器手动验收；模型以外的交互组件、真实业务 API 和数据库提交链路已分别测试。

## 补充：原生表单与助手同时打开时无法输入

根因：Ant Design 6 的 rc-dialog 在 window 上监听 focusin，将助手区域的焦点重新拉回原生表单。原有协作 hook 仅处理 Esc，因此输入框未 disabled，却无法保留焦点和接收打字。

修复位于 packages/core/system-admin/src/form-assistance/overlay.ts：仅在参与协作的原生表单打开期间，截断已注册助手区域的 focusin 事件到 window 的冒泡。React 输入焦点事件已经处理，其他区域的原生 Modal 焦点约束保留；hook 关闭或卸载后移除监听。

验证：
- 真实 Chromium，使用项目实际安装的 Ant Design Modal + Ant Design X Sender：修复前点击输入框后 value 为空、focused=false；修复后保持焦点，可以打字、Enter 提交，背景输入仍受原生表单焦点限制。
- 新增 aiAssistantFocus.test.tsx，连同 aiAssistantOverlay.test.tsx 共 29 项通过，覆盖助手焦点、背景焦点、关闭协作与 Esc。
- Core System Admin / Demo Admin 严格 TypeScript 检查通过，修改文件 lint 通过。
- 开发服务器的热更新产物已包含修复，无需重启后端。
