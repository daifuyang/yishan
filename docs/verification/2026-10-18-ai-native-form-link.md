# 原生表单联动验证（2026-10-18）

当前用户新增/修改使用 `form.prefill`，删除使用 `action.confirm`；新对话不再展示 AI 内嵌创建表单。旧草稿消息兼容恢复到原生表单。

已验证：

- Admin Jest：23 个套件、212 项通过，包括现有表单增量填值、真实保存回执、原生删除确认、跨记录拒绝、历史去重、取消生成、思考与工具进度。
- AI API Vitest：11 个文件、184 项通过，包括 SSE 在执行前返回、工具输入与真实结果分阶段输出。
- System API 准备工具：15 项通过，新增/修改/删除准备均无业务写入，编辑只返回明确指定的字段。
- `pnpm typecheck:admin`、`pnpm check:boundaries`、Admin lint、`pnpm build:admin`、`pnpm build:api` 均通过。Admin lint 仍有仓库现有警告。
- 本轮没有对真实业务记录执行删除。新联动的页面测试使用真实组件与模拟接口；模型供应方是否发送 reasoning 取决于其配置与响应。

接入说明见 [原生表单接入 AI 的约定](../ai-native-form-integration.md)。
