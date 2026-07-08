# Archived Prisma Schemas

这个目录存放**已下线的 Prisma schema 文件备份**，供将来恢复时参考。

## 2026-07-08-sys-app-and-form-models.prisma

**原文件**：`prisma/schema/app.prisma`

**下线原因**：
"应用管理"模块（SysApp + SysAppMenu + SysAppResource + SysFormField + SysFormData）
在评估后被判定为半成品/选型不成熟（详见归档 PR 描述），决定先移除以止损。

**恢复方式**：
1. 切到归档分支 `git checkout archive/app-management`，参考完整历史
2. 把本文件内容复制回 `prisma/schema/app.prisma`
3. 跑 `pnpm db:generate && pnpm db:migrate` 重新生成 Prisma client
4. 把代码（`pages/system/apps/`、`core/services/*` 等）从 `archive/app-management` 合并回来
5. 重新跑 OpenAPI 生成和 `gen:plugin-routes`

**相关分支**：`archive/app-management`（包含完整代码 + 数据库迁移历史）

## 2026-07-08-APP_DETAIL_DESIGN.md

**原文件**：`apps/yishan-api/APP_DETAIL_DESIGN.md`

应用详情页的信息架构和 API 设计文档。随模块下线时一并归档。

