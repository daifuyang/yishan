# `插件管理` 作为 Core 内置能力执行文档

## 1. 目标

- 明确 `/system/plugins` 是 **core 控制面能力**，不属于业务插件。
- 保证无论插件启停状态如何，管理员都能进入插件管理页执行恢复操作。
- 避免“插件管理页依赖插件菜单”带来的自锁风险。

---

## 2. 设计结论

- `插件管理` 页面（`/system/plugins`）保留在 core 路由与 core 菜单体系。
- 插件 manifest 不负责声明 `/system/plugins`。
- 插件只负责自己的业务路由与业务菜单（例如 `@yishan/hello`、`@yishan/portal`）。

---

## 3. 代码现状核对

当前代码已满足一半：

- 前端页面已存在：`apps/yishan-admin/src/pages/system/plugins/index.tsx`
- 前端路由已存在：`apps/yishan-admin/config/routes.ts`（`/system/plugins`）

当前缺口：

- 后端 seed 菜单未包含 `/system/plugins`，导致动态菜单不展示入口。

---

## 4. 执行步骤（手动）

## 步骤 1：补齐 core 菜单 seed

在 `apps/yishan-api/src/scripts/seed/config.ts` 的系统菜单 children 中新增：

```ts
{ name: '插件管理', path: '/system/plugins', type: 1, sortOrder: 12, component: './system/plugins' }
```

说明：

- `type=1` 表示菜单页面。
- `sortOrder` 按你现有系统菜单顺序调整即可。

## 步骤 2：执行 seed 更新

如果是重置环境：

```bash
pnpm --filter yishan-api db:seed
```

如果是已有环境（不想全量重置）：

- 可通过已有 seed 流程做 upsert；
- 或手动插入 `sys_menu` 对应记录，并给 super-admin 角色授权（`sys_role_menu`）。

## 步骤 3：验证菜单可见性

- 使用管理员登录后台。
- 确认左侧出现“插件管理”。
- 打开 `/system/plugins` 页面，确认插件列表可正常加载。

---

## 5. 验收标准（DoD）

- `/system/plugins` 在菜单中稳定可见（至少 super-admin 可见）。
- 停用任意业务插件后，`/system/plugins` 仍可访问。
- 插件管理功能（列表、启用、停用、同步日志）不依赖业务插件路由存在。

---

## 6. 风险与注意事项

- 不要将 `/system/plugins` 从 core 菜单迁移到 plugin manifest，否则会形成管理入口耦合。
- 若使用动态菜单缓存，更新 seed 后需重新登录或清理菜单缓存。
- 如果本地 DB 有历史脏数据，先检查 `sys_menu.path='/system/plugins'` 是否重复。

---

## 7. 推荐后续收口

1. 在架构文档中明确“control plane（core）/data plane（plugin）边界”。
2. 在 CI 增加规则：禁止插件 manifest 声明 `/system/plugins`。
3. 在 seed 回归用例中加入 `/system/plugins` 必存在断言。
