# 新建弹窗与逐字显示回归（2026-10-18）

本轮修正用户实测反馈：助手只调用表单定义和选项工具，却声称已打开弹窗；Markdown 正文一次性出现。

- 对明确新增用户的指令，用现有 SDK 的 prepareStep 约束读取定义后的调用，必须把字段交给 prepare_user_create；不会从文字描述猜测并在前端拼出业务写请求。规则、权限等说明性问题不强制打开窗口。
- Markdown 使用独立显示队列逐字推进，即使服务端最后一次返回整块文本也会渐进呈现。历史立即全文显示；会话切换终止旧队列；StrictMode 正常工作。
- 使用本地配置的真实 MiniMax-M3（没有模拟模型响应）验证：实际调用 get_user_create_form、prepare_user_create，返回 form.prefill，正文共 49 个 text-delta 片段，首末文字片段间隔约 4.15 秒。
- 把上述实际模型返回的预填 JSON 交给 Chromium 中的原生 UserList，确认新建窗口打开，登录名、姓名、昵称填入。页面查询使用模拟接口，所有写请求禁止，没有创建用户。
- Chromium 中的实际 AiChatView + Bubble.List + XMarkdown 接收单块 48 字文本：约 123ms 可见 5 字，338ms 可见 16 字，1163ms 全文可见；切会话后历史立即展示，无页面错误。
- AI 后端测试 187 项通过；Admin lint 和前后端构建通过。逐字与历史测试另覆盖真实视图、StrictMode 和最后单块回复。

截图与临时浏览器验证脚本在忽略目录 `.playwright-cli/`，不作为发布产物提交。
