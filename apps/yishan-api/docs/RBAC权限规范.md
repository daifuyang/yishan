# RBAC 权限规范（Section 1）

> 维护：本文件是 RBAC 的唯一对外说明。新增菜单 / 路由前必须先看这里。

## 原则

```text
用户 → 角色（sys_role）→ 权限点（sys_role_permission.permission_code）
```

- 一个用户可以拥有多个角色（`sys_user_role`）；
- 一个角色可以拥有多个后端权限点（`sys_role_permission`）；
- 菜单关联（`sys_role_menu`）只负责展示与页面入口，不承担授权职责；任何后端接口必须独立做权限校验；
- 超级管理员使用稳定角色 `code = 'super_admin'`，禁止依赖数据库角色 ID；
- 插件 manifest 声明权限点；插件路由必须执行同一套后端权限校验。

## 权限点目录

所有权限点集中在 `apps/yishan-api/src/constants/permission-codes.ts` 的 `PERMISSION_CODES` 常量中。新增权限点请：

1. 在该文件中追加 `<resource>:<entity>:<action>` 形式的常量；
2. 在 `src/core/services/permission.service.ts` 内重新触发缓存失效（直接调用 `PermissionService.invalidate()`）；
3. 把对应路由绑定该常量；
4. 对插件权限，在对应 `manifest.permissions` 同步登记，确保 manifest check 通过。

## 后端校验约定

推荐用统一的 RBAC 装饰器：

```ts
import { PERMISSION_CODES } from "../../constants/permission-codes.js";

fastify.get("/admin/users", {
  preHandler: [
    fastify.authenticate,
    fastify.requirePermission(PERMISSION_CODES.SYSTEM_USER_LIST),
  ],
  schema: { /* ... */ },
});
```

老代码里的 `requireAdmin` 中间件已迁移到根据 `code = super_admin | admin` 判断（见 `core/middleware/require-admin.ts`）。新代码请直接用 `requirePermission` / `requireRole`。

## super_admin 短路

`PermissionService.loadForRoleIds()` 在缓存内加 `__super_admin__` 标记位；任何 `requirePermission` 检查都默认放行（用 `tokenScope` 收窄）。

## PAT 与 scopes

API Token 鉴权场景下：
- 用户的 effective 权限集 = `role perms ∩ token.scopes`；
- 空的 scopes 集合会被 fallback 到空，即 **PAT 不会继承用户全部权限**；
- 通过 `isKnownPermissionCode` 过滤，确保只持久化已知 permission code。

## 路由注册规范

1. 路由的 `preHandler` 必须先 `fastify.authenticate`，再 `fastify.requirePermission(...)` 或 `fastify.requireRole(...)`；
2. 路由必须有完整的 schema 块：`summary`、`operationId`、`tags`、`body/params/response`；
3. 路由必须放在 `core/routes/` 或 `plugins/modules/<name>/routes/` 下，由 `arch:check:routes` 强制扫描；
4. 不允许直接通过 `currentUser.roleIds === [1,2]` 这种“魔法 ID”判定管理员身份。

## 收尾

后续 PR 涉及 RBAC 改动时，请同时更新：
- 本文档；
- `PERMISSION_CODES` 目录；
- 至少一个角色的 `sys_role_permission.permission_code` 授权。
