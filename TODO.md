# TODO — yishan 后台与全栈待办入口

本目录列出当前未做但已经过讨论/摸底的后续工作。每项对应一份细化的 `TODO-*.md`。

## 待办列表

| # | 主题 | 文档 | 优先级 | 估算 |
|---|---|---|---|---|
| 1 | `AttachmentSelect` 1315 行超大门面组件拆分 | [TODO-attachment-select-split.md](./TODO-attachment-select-split.md) | 🟡 中 | 半天 |
| 2 | 后端 admin 路由 5 件套样板抽工厂 | [TODO-admin-routes-factory.md](./TODO-admin-routes-factory.md) | 🔴 高（架构债） | 1-2 天 |
| 3 | ARCHITECTURE.md 与现状同步 | [TODO-architecture-doc-sync.md](./TODO-architecture-doc-sync.md) | 🟡 中 | 半小时 |
| 4 | OpenAPI spec 补齐模块端点的 security 声明 | [TODO-openapi-module-security.md](./TODO-openapi-module-security.md) | 🟡 中 | 1-2 小时 |

## 推荐执行顺序

```
1 → 3 → 4 → 2
```

- 先做 **#1（AttachmentSelect 拆分）**：投入产出比高，改动隔离，能给后续 PR 减少冲突。
- 再做 **#3（ARCHITECTURE.md 同步）**：纯文档，半小时；做完 #2 后文档描述的架构更准确。
- 接着做 **#4（OpenAPI security 补齐）**：纯 swagger.ts + openapi.json 改动，影响面可控；做完后再做 #2 可避免路由工厂改造与 spec 重生成互相干扰。
- 最后做 **#2（admin 路由抽工厂）**：影响面最大、工作量最重；架构债类型，需要专门 PR。

## 已完成（2026-07-22 这轮会话）

最近一次会话集中做了几件事，已经分别 commit。已 commit 的工作**不再**写进 TODO 文档，避免漂移。

- ✅ 菜单动态化（routes.ts 瘦身 + 后端 `sys_menu.component` 驱动）
- ✅ 清理 14 项废弃文件/目录 + 8 个未引用 generated services
- ✅ `auth:logout` 移出 `BYPASS_CODES`（源代码 bug 修复 + 测试对齐）
- ✅ admin `globals.d.ts` 加 ambient types，TS 错误 13 → 0
- ✅ 三个明确的小 bug 修复（`global.tsx:19` log 级别、`e2e/system.spec.ts` 不存在页面、`app.tsx` accessPath 数据源）
- ✅ `/auth/me` refresh 改走 `setCurrentUser` 统一封装

## 文档约定

- 每份 `TODO-*.md` 包含：现状 / 目标 / 步骤 / 验收 / 风险
- 完成后把对应行的状态改为 ✅ 并把本节"待办列表"里那一行移到下方"已完成"
- 完成时间不确定时留空，待 commit 后再回填