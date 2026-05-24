# 插件 `@org/plugin` 改造执行清单（基于当前代码）

## 1. 结论与边界

- 结论：当前代码已完成 `pluginId=@org/plugin` 的主链路改造，已可进入手动发布执行阶段。
- 核心边界：`system` 作为 core 能力不需要强制改为 `@yishan/system`；仅真正插件化模块使用 `pluginId`。
- 命名策略：所有插件来源统一使用 `@org/plugin`，不再新增裸 `name`。

---

## 2. 已完成项（代码已落地）

## 2.1 Manifest 与规则

- 架构校验已要求 `pluginId` 且校验 `@org/plugin`：`scripts/arch/plugin-manifest.schema.json`
- 架构脚本已校验：
  - `pluginId` 格式
  - `routeBase` 必须是 `/api/modules/{pluginId}/v1`
  - 菜单路径必须以 `/plugins/{pluginId}` 前缀开头
  - 文件：`scripts/arch/check-manifest.mjs`
- 运行时校验已同步 `pluginId` 与菜单前缀：`apps/yishan-api/src/plugins-runtime/manifest.ts`

## 2.2 插件示例已迁移

- `hello`：`@yishan/hello`，路由与菜单前缀已切换：`apps/yishan-api/src/plugins/modules/hello/manifest.ts`
- `portal`：`@yishan/portal`，路由与菜单前缀已切换：`apps/yishan-api/src/plugins/modules/portal/manifest.ts`

## 2.3 数据层与同步键

- `sys_plugin` 已新增字段：`plugin_id/org/slug/source`：`apps/yishan-api/prisma/schema/system.prisma`
- 菜单幂等键已从 `pluginName:path` 切换为 `pluginId:path`：`apps/yishan-api/src/core/services/plugin-menu-sync.service.ts`
- 已有回填辅助脚本（生成映射与 SQL）：`scripts/arch/backfill-plugin-id.mjs`

## 2.4 管理端展示

- Admin 插件列表已展示 `pluginId` 列：`apps/yishan-admin/src/pages/system/plugins/index.tsx`

---

## 3. 发布前必须人工执行项

1. **执行 schema 与客户端生成**
   - `pnpm --filter yishan-api db:generate`
2. **确认数据库结构已生效**
   - 检查 `sys_plugin` 是否存在 `plugin_id/org/slug/source`
3. **执行历史数据回填**
   - 先运行：`node scripts/arch/backfill-plugin-id.mjs`
   - 根据输出 SQL 回填存量 `name -> plugin_id`
4. **处理冲突数据**
   - 如同名插件需人工指定 org，再回填
5. **执行 manifest 架构检查**
   - `node scripts/arch/check-manifest.mjs`
6. **回归测试（最小集）**
   - `pnpm --filter yishan-api test`
   - `pnpm --filter yishan-admin lint`
7. **手工验证核心流程**
   - 插件列表/详情可展示 `pluginId`
   - 启用插件后菜单创建正常
   - 停用插件后菜单隐藏正常

---

## 4. 当前仍需收口的点（建议本轮完成）

## 4.1 API 路由参数仍以 `name` 为主

- 现状：`/admin/system/plugins/:name` 仍使用 `name` 入参：`apps/yishan-api/src/core/routes/api/v1/admin/system/plugins/index.ts`
- 建议：
  - 短期兼容 `name`，新增 `pluginId` 入参通道（query/body/path 任选一种）
  - 中期将接口文档主键切换为 `pluginId`

## 4.2 持久化字段尚未完全收紧

- 现状：`sys_plugin.pluginId`、`name` 仍是可空：`apps/yishan-api/prisma/schema/system.prisma`
- 建议：
  - 回填完成后，把 `plugin_id` 收紧为 `NOT NULL`
  - 保留 `name` 仅兼容读取，不再用于唯一识别

## 4.3 兼容窗口规则需定版

- 建议明确：
  - 从哪个版本开始禁止新增裸 `name`
  - 从哪个版本移除 `name` 主键查询

---

## 5. 建议执行顺序（你手动跑）

1. 跑回填脚本拿映射与 SQL
2. 完成 DB 回填并核对行数
3. 跑 manifest 架构检查
4. 跑 API/Admin 最小回归
5. 在测试环境验证启停与菜单同步
6. 发布并观察插件启停、菜单冲突日志

---

## 6. 回滚预案

- 数据回滚：保留 `name` 兼容查询路径，必要时切回 `name` 定位插件。
- 运行回滚：若 `pluginId` 路径异常，先禁用新增校验，再恢复旧管理操作流程。
- 风险控制：发布窗口内只做 `pluginId` 相关变更，不叠加其他大改。

---

## 7. 完成定义（DoD）

- 存量插件均有合法 `pluginId`（如 `@yishan/hello`）。
- 新插件无法以裸 `name` 通过 manifest 检查。
- 菜单幂等键统一使用 `pluginId:path`。
- 控制台、接口、日志均可追踪到 `pluginId`。
