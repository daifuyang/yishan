# 插件系统实现状态总结（截至 2026-05-24）

## 1. 目标范围

本文用于汇总当前插件系统在以下方面的落地状态：

- 已实现能力（v1 及基础能力）
- 部分实现能力（可用但未达到目标规范）
- 未实现能力（v2/v3 目标缺口）
- 下一步建议（按优先级）

## 2. 当前总体结论

当前整体处于 **v1 + v2 部分落地** 的阶段。

- v1 基础：插件运行时、插件状态持久化、插件菜单 upsert、超管默认授权、启停联动菜单显示/隐藏。
- v2 部分落地（2026-05-24 实现）：菜单同步策略（strict/safe）、同步审计落库、冲突详情可视化。
- v3 未落地：完整卸载流程、菜单快照导入导出、插件包上传安装流程。

## 3. 已实现能力

### 3.1 插件运行与生命周期基础

- 启动时扫描并加载插件 manifest：`apps/yishan-api/src/app.ts`
- 运行时注册与生命周期管理：`apps/yishan-api/src/plugins-runtime/index.ts`、`apps/yishan-api/src/plugins-runtime/lifecycle.ts`
- 插件基本管理接口（列表/详情/启用/停用）：`apps/yishan-api/src/core/routes/api/v1/admin/system/plugins/index.ts`
- 管理页展示与启停操作：`apps/yishan-admin/src/pages/system/plugins/index.tsx`

### 3.2 插件元数据持久化

- 已有插件相关模型：`sys_plugin`、`sys_plugin_version`、`sys_plugin_install`、`sys_plugin_config_snapshot`
- Schema 定义：`apps/yishan-api/prisma/schema/system.prisma`
- 持久化服务：`apps/yishan-api/src/plugins-runtime/persistence.ts`

### 3.3 菜单同步（v1）

- 已实现插件菜单同步服务：`apps/yishan-api/src/core/services/plugin-menu-sync.service.ts`
  - `upsertPluginMenu`
  - `syncPluginMenus`
  - `hidePluginMenus`
  - `restorePluginMenus`
  - `softDeletePluginMenus`（方法存在）
- 启用插件时触发同步：`apps/yishan-api/src/core/services/plugin-manage.service.ts`
- 停用插件时隐藏菜单：`apps/yishan-api/src/core/services/plugin-manage.service.ts`
- 应用启动时进行一次菜单同步：`apps/yishan-api/src/app.ts`

### 3.4 默认最小授权（仅超管）

- 新创建的插件菜单自动绑定 `roleId=1`（super-admin）：`apps/yishan-api/src/core/services/plugin-menu-sync.service.ts`
- 已授权菜单树接口可用于前端登录后动态菜单：`apps/yishan-api/src/core/routes/api/v1/admin/menus/index.ts`

### 3.5 幂等基础

- 使用 `pluginMenuKey = pluginName:path` 做 upsert 键，重复同步会更新同一条插件菜单：
  - 字段/唯一键：`apps/yishan-api/prisma/schema/system.prisma`
  - 逻辑：`apps/yishan-api/src/core/services/plugin-menu-sync.service.ts`

## 4. 部分实现能力（未达目标规范）

### 4.1 manifest 校验分层不一致

- 运行时校验较宽松（主要校验 name/version 与 menus 基本字段）：
  - `apps/yishan-api/src/plugins-runtime/manifest.ts`
- 架构脚本有更严格 schema 校验（channels/routeBase/permissions/menus 规则）：
  - `scripts/arch/check-manifest.mjs`
  - `scripts/arch/plugin-manifest.schema.json`

结论：**有校验，但运行时与架构检查标准不完全一致**。

### 4.2 冲突处理可见性不足

> **更新（2026-05-24）**：v2 实现后已解决。

- 冲突通过 `sys_plugin_sync_log.conflict_details` 持久化
- 冲突时 strict 模式会标记插件状态为 `error`
- safe 模式允许插件启用但记录冲突数量
- 管理页可查看冲突详情（路径、占用的插件名、原因）

结论：**v2 实现后已满足可治理、可追溯、可视化要求**。

## 5. 已实现能力（v2 增强稳定性）

### 5.1 菜单同步策略（strict/safe）

- **已实现**（2026-05-24）
- `strict` 模式：冲突时插件状态标 `error`，抛出业务异常
- `safe` 模式：冲突项跳过，插件可启用但有告警
- 策略通过 `enablePlugin` 接口的 `strategy` 参数传入，默认为 `safe`
- 代码：`apps/yishan-api/src/core/services/plugin-menu-sync.service.ts`

### 5.2 同步审计

- **已实现**（2026-05-24）
- 新增 `sys_plugin_sync_log` 表记录每次同步结果
- 字段：新增/更新/跳过/冲突数量、冲突详情（path/占用的插件名/原因）、错误信息
- 新增 API：`GET /:name/sync-logs` 查询同步历史
- 代码：`apps/yishan-api/prisma/schema/system.prisma`、`apps/yishan-api/src/core/services/plugin-menu-sync.service.ts`

### 5.3 管理页展示同步状态与冲突详情

- **已实现**（2026-05-24）
- 插件列表新增"同步状态"列（成功/部分成功/失败 + 冲突数）
- 插件详情抽屉展示最近同步结果（新增/更新/跳过/冲突数量 + 冲突明细列表）
- 启用弹窗支持选择同步策略（strict/safe）
- 代码：`apps/yishan-admin/src/pages/system/plugins/index.tsx`

## 6. 未实现能力（对照 v3）

### 6.1 卸载流程

- 缺少正式卸载 API 与服务编排（disable -> soft/hard uninstall）。
- `softDeletePluginMenus` 虽存在，但未接入完整流程。
- `hard-uninstall`（清理插件菜单 + 清理 `sys_role_menu` 关联）未实现。
- “二次确认”机制（接口 token/confirm 字段 + 前端确认）未实现。

### 6.2 导入导出（菜单快照）

- 缺少菜单快照导出接口。
- 缺少快照恢复接口与冲突恢复策略。

### 6.3 其他用户安装插件标准流程

- 当前是本地目录扫描模式，不是“上传插件包安装”模式。
- 缺少插件包上传、解包、manifest 兼容性校验、安装态机流程。
- `coreCompatibility` 目前主要用于存储展示，缺少严格运行时兼容门禁。

## 7. 关键规则达成度评估

1. 插件不能改 core 菜单：**部分达成**
   - 插件菜单以 `source=plugin`、`pluginName`、`pluginMenuKey` 标记。
   - 但未见系统级硬性防护禁止“非插件流程修改插件菜单/核心菜单”。

2. 路径冲突必须可追踪：**未达成**
   - 有错误捕获，但无审计落库与管理页追踪。

3. 默认最小授权（仅超管）：**已达成**
   - 新插件菜单默认绑定 super-admin。

4. 菜单同步必须幂等：**基本达成**
   - 基于 `pluginMenuKey` upsert 实现幂等。

5. 插件升级仅变更该插件菜单：**基本达成（v1 范围）**
   - 同步逻辑聚焦插件来源菜单。
   - 但冲突与异常治理能力不足，存在运维灰区。

## 8. 优先级建议（从 v1 到 v2/v3）

### P0（必须先做）

- 增加菜单同步策略：`strict | safe`
- 引入同步审计模型与 API（按次记录）
- 插件管理页增加“菜单同步状态/冲突详情”

### P1（v3 前置）

- 落地 soft/hard uninstall 全流程
- hard 卸载加入二次确认机制
- 建立“插件卸载影响面”检查（菜单、角色授权、可能的路由引用）

### P2（生态化）

- 菜单快照导出/恢复
- 插件包上传安装流程（含兼容性校验与安装状态机）

## 9. 参考文件

- `SYSTEM_PLUGIN_MIGRATION.md`
- `apps/yishan-api/src/core/services/plugin-menu-sync.service.ts`
- `apps/yishan-api/src/core/services/plugin-manage.service.ts`
- `apps/yishan-api/src/plugins-runtime/*`
- `apps/yishan-api/prisma/schema/system.prisma`
- `apps/yishan-admin/src/pages/system/plugins/index.tsx`
