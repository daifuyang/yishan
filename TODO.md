# TODO — yishan 后台与全栈待办入口

本文件只保留当前仍值得推进的事项。已完成或失去目标的 TODO 统一归档到 [`docs/archive/todos/`](./docs/archive/todos/)。

## 待办列表

当前没有待办项。

## 已完成（2026-07-22 这轮会话）

最近一次会话集中做了几件事，已经分别 commit。已 commit 的工作**不再**写进 TODO 文档，避免漂移。

- ✅ 菜单动态化（routes.ts 瘦身 + 后端 `sys_menu.component` 驱动）
- ✅ 清理 14 项废弃文件/目录 + 8 个未引用 generated services
- ✅ `auth:logout` 移出 `BYPASS_CODES`（源代码 bug 修复 + 测试对齐）
- ✅ admin `globals.d.ts` 加 ambient types，TS 错误 13 → 0
- ✅ 三个明确的小 bug 修复（`global.tsx:19` log 级别、`e2e/system.spec.ts` 不存在页面、`app.tsx` accessPath 数据源）
- ✅ `/auth/me` refresh 改走 `setCurrentUser` 统一封装

## 文档约定

- 每份当前 TODO 包含：现状 / 目标 / 步骤 / 验收 / 风险。
- 完成后将对应文档移入 `docs/archive/todos/`，并在上方“已归档”中留下结论。

## 已归档

- [`TODO-attachment-select-split.md`](./docs/archive/todos/TODO-attachment-select-split.md)：拆分已完成，当前 `AttachmentSelect` 为 311 行。
- [`TODO-openapi-module-security.md`](./docs/archive/todos/TODO-openapi-module-security.md)：已由 API `onRoute` hook 自动注入 security 声明。
- OpenAPI spec 同步：已由 `openapi:dump` 和 CI drift 检查闭环，相关 TODO 已清理。
- [`TODO-architecture-doc-sync.md`](./docs/archive/todos/TODO-architecture-doc-sync.md)：目标文件不存在，相关内容已沉淀到 `CLAUDE.md` 与 `docs/module-onboarding.md`。
