# AI 结果展示与导航崩溃修复

- AI 助手挂载在全局宿主，导航和预填结果不再依赖 Router Hook，使用 Umi 的共享 history 跳转，保留本地路由白名单。
- 结构化结果输出完成后立即显示；模型额外解释默认折叠为“补充说明”，与卡片一致的确认语不再重复展示。历史消息也使用同一规则。
- 工具调用按 toolCallId 区分，支持同名工具多次调用；表格使用记录 id 作为稳定行键，数据范围显示中文标签，未知表格类型显示提示。
- 用户、部门和角色表单改用 Ant Design 6 的 destroyOnHidden、mask.closable。
- 示例提问和模型提示区分账号启用状态与人事在职状态，避免错误等同。

## 验证

- 先用真实 useNavigate 在无 Router 的组件测试中复现崩溃，再验证导航、预填、未知类型及无效目标：4 用例通过。
- Admin 全部测试：13 文件、122 用例通过；最终 AI 聚焦测试：3 文件、38 用例通过。
- Admin、System Admin 类型检查和 lint 通过（存在仓库原有 lint warnings）；后端消息流测试 7 用例通过。
- `pnpm build:admin` 通过，有现有 Rollup “use client” 提示。
- 浏览器实际点击导航卡片，从用户页进入角色页；点击预填卡片，从角色页进入用户页并打开带字段的新增表单，随后取消，未保存。
- 复测控制台未出现 destroyOnClose、maskClosable、rowKey index、useNavigate/Router 错误。

本次未修改 API 路径、权限语义和数据库结构。
