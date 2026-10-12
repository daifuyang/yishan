# Admin CRUD Route Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move uniform admin CRUD actions to `createCrudHandlers` while retaining domain routes on `RouteRegistrar`.

**Architecture:** The factory owns only list/create/update/delete, their four permissions, standard response envelopes, and localized success messages. Each module keeps `route.get/post/put/delete` for detail, trees, grants, authorization, special response contracts, and operations.

**Tech Stack:** TypeScript, Fastify 5, TypeBox, Vitest, tsc-alias.

**Spec:** `docs/superpowers/specs/2026-09-17-admin-crud-route-boundary-design.md`

## Global Constraints

- Preserve all paths, OpenAPI operation IDs, schemas, permission codes, response envelopes, localized messages, and business errors.
- Use `@/` imports for source files touched by this work.
- Do not add custom-route methods to `createCrudHandlers`.
- Exclude attachments, permissions, system routes, and enums.

---

### Task 1: Finalize Factory And Departments Reference

**Files:**
- Modify: `apps/yishan-api/src/core/routes/admin-crud.ts`
- Modify: `apps/yishan-api/src/core/routes/api/v1/admin/departments/index.ts`
- Test: `apps/yishan-api/test/admin-crud.test.ts`
- Test: `apps/yishan-api/test/admin.departments.routes.test.ts`

**Produces:** `CrudHandlers` exposes only `permissions`, `list`, `create`, `update`, and `delete`. Department detail and tree use `route.get` plus `crud.permissions.list`.

- [ ] **Step 1: Run the baseline**

Run: `pnpm --dir apps/yishan-api exec vitest run test/admin-crud.test.ts test/admin.departments.routes.test.ts`

Expected: 13 tests pass.

- [ ] **Step 2: Keep the factory public interface constrained**

```ts
export interface CrudHandlers {
  permissions: Record<'list' | 'create' | 'update' | 'delete', PermissionRef>
  list(config: CrudListConfig): void
  create(config: CrudMutationConfig): void
  update(config: CrudUpdateConfig): void
  delete(config: CrudDeleteConfig): void
}
```

Remove any `route`, `router`, repository, or arbitrary HTTP-method factory API.

- [ ] **Step 3: Preserve direct department special routes**

```ts
route.get('/:id', { access: { permission: crud.permissions.list }, schema: detailSchema }, detailHandler)
route.get('/tree', { access: { permission: crud.permissions.list }, schema: treeSchema }, treeHandler)
```

- [ ] **Step 4: Verify and commit**

Run: `pnpm --dir apps/yishan-api exec vitest run test/admin-crud.test.ts test/admin.departments.routes.test.ts`

Run: `pnpm --dir apps/yishan-api exec tsc --noEmit`

```bash
git add apps/yishan-api/src/core/routes/admin-crud.ts apps/yishan-api/src/core/routes/api/v1/admin/departments/index.ts
git commit -m "refactor(admin-routes): migrate departments to CRUD factory"
```

### Task 2: Migrate Users Standard CRUD

**Files:**
- Modify: `apps/yishan-api/src/core/routes/api/v1/admin/users/index.ts`
- Test: `apps/yishan-api/test/admin.users.routes.test.ts`

**Produces:** factory-managed list/create/update/delete; direct `GET /:id`. User self-protection and super-admin checks remain inside update/delete service callbacks.

- [ ] **Step 1: Establish route regression baseline**

Run: `pnpm --dir apps/yishan-api exec vitest run test/admin.users.routes.test.ts`

Expected: 14 tests pass, including create conflict, password validation, and self/super-admin protection.

- [ ] **Step 2: Replace the local CRUD permission object with factory declaration**

```ts
const crud = createCrudHandlers(route, {
  resource: 'user', group: 'system',
  perms: { list: '用户管理-列表', create: '用户管理-创建', update: '用户管理-更新', delete: '用户管理-删除' },
  messages: {
    listSuccess: (lang) => getUserMessage(UserMessageKeys.LIST_SUCCESS, lang),
    createSuccess: (lang) => getUserMessage(UserMessageKeys.CREATE_SUCCESS, lang),
    updateSuccess: (lang) => getUserMessage(UserMessageKeys.UPDATE_SUCCESS, lang),
    deleteSuccess: (lang) => getUserMessage(UserMessageKeys.DELETE_SUCCESS, lang),
  },
})
```

- [ ] **Step 3: Register standard actions through the factory**

Keep every schema unchanged. In update and delete callbacks, execute the existing `id === 1` and current-user checks before calling `UserService`. Keep detail direct with `access: { permission: crud.permissions.list }`.

```ts
crud.update({ schema: updateSchema, service: async (id, request) => {
  const body = request.body as UpdateUserReq
  if (body.status === '0' && id === 1) {
    throw new BusinessError(UserErrorCode.USER_STATUS_ERROR, '系统管理员不可禁用')
  }
  if (body.status === '0' && request.currentUser?.id === id) {
    throw new BusinessError(UserErrorCode.USER_STATUS_ERROR, '不能禁用当前登录用户')
  }
  return UserService.updateUser(id, body, request.currentUser.id, fastify)
}})
```

- [ ] **Step 4: Verify and commit**

Run: `pnpm --dir apps/yishan-api exec vitest run test/admin.users.routes.test.ts`

Run: `pnpm --dir apps/yishan-api exec tsc --noEmit`

```bash
git add apps/yishan-api/src/core/routes/api/v1/admin/users/index.ts
git commit -m "refactor(admin-routes): migrate users standard CRUD"
```

### Task 3: Migrate Menus Standard CRUD

**Files:**
- Modify: `apps/yishan-api/src/core/routes/api/v1/admin/menus/index.ts`
- Test: `apps/yishan-api/test/admin.menus.routes.test.ts`

**Produces:** factory-managed list/create/update/delete; direct detail/tree/authorized routes. The standalone `system:menu:read-authorized` permission remains local.

- [ ] **Step 1: Establish route regression baseline**

Run: `pnpm --dir apps/yishan-api exec vitest run test/admin.menus.routes.test.ts`

Expected: 15 tests pass, including invalid IDs, tree output, authorized paths, and deletion restrictions.

- [ ] **Step 2: Use the factory for CRUD permissions and retain only the authorized permission**

Create the `menu` factory with the existing four labels and messages. Keep and register only the current `READ_AUTHORIZED` permission for `/tree/authorized` and `/paths/authorized`.

- [ ] **Step 3: Share the current ID parser between factory callbacks and detail**

```ts
const parseMenuId = (rawId: string) => {
  const id = parseInt(rawId, 10)
  if (Number.isNaN(id)) {
    throw new BusinessError(ValidationErrorCode.INVALID_PARAMETER, '菜单ID不能为空')
  }
  return id
}

crud.update({ schema: updateSchema, parseId: parseMenuId, service: (id, request) =>
  MenuService.updateMenu(id, request.body as UpdateMenuReq) })
```

Use `parseMenuId` for delete and detail. Keep tree direct under `crud.permissions.list`; keep authorized routes direct under `READ_AUTHORIZED`.

- [ ] **Step 4: Verify and commit**

Run: `pnpm --dir apps/yishan-api exec vitest run test/admin.menus.routes.test.ts`

Run: `pnpm --dir apps/yishan-api exec tsc --noEmit`

```bash
git add apps/yishan-api/src/core/routes/api/v1/admin/menus/index.ts
git commit -m "refactor(admin-routes): migrate menus standard CRUD"
```

### Task 4: Migrate Uniform Role Actions

**Files:**
- Modify: `apps/yishan-api/src/core/routes/api/v1/admin/roles/index.ts`
- Test: `apps/yishan-api/test/admin.roles.routes.test.ts`

**Produces:** factory-managed list/delete. Detail, create, and update remain direct because create/update require the additional grant permission.

- [ ] **Step 1: Establish route regression baseline**

Run: `pnpm --dir apps/yishan-api exec vitest run test/admin.roles.routes.test.ts`

Expected: 10 tests pass, including role menu-permission assignment.

- [ ] **Step 2: Separate grant from factory CRUD permissions**

```ts
const GRANT_PERMISSION: PermissionRef = {
  code: 'system:role:grant', label: '角色管理-授权', group: 'system',
}
registerPermissions(GRANT_PERMISSION)
```

Create resource `role` with factory CRUD labels/messages. Change direct detail to `crud.permissions.list`; change direct create/update access to `crud.permissions.create`/`crud.permissions.update`, retaining `fastify.requirePermission(GRANT_PERMISSION)` as their existing extra guard.

- [ ] **Step 3: Move list and delete only**

```ts
crud.list({ schema: listSchema, service: (query) => RoleService.getRoleList(query as RoleListQuery) })
crud.delete({ schema: deleteSchema, service: (id) => RoleService.deleteRole(id) })
```

- [ ] **Step 4: Verify and commit**

Run: `pnpm --dir apps/yishan-api exec vitest run test/admin.roles.routes.test.ts`

Run: `pnpm --dir apps/yishan-api exec tsc --noEmit`

```bash
git add apps/yishan-api/src/core/routes/api/v1/admin/roles/index.ts
git commit -m "refactor(admin-routes): migrate roles uniform actions"
```

### Task 5: Migrate Dictionary Type And Data CRUD

**Files:**
- Modify: `apps/yishan-api/src/core/routes/api/v1/admin/dicts/index.ts`
- Test: `apps/yishan-api/test/admin.dicts.routes.test.ts`

**Produces:** one dictionary factory managing both `/types` and `/data` CRUD paths. Type/data detail and data map stay direct.

- [ ] **Step 1: Establish route regression baseline**

Run: `pnpm --dir apps/yishan-api exec vitest run test/admin.dicts.routes.test.ts`

Expected: 6 tests pass, including `DICT_TYPE_NOT_FOUND`, `DICT_DATA_NOT_FOUND`, and pagination bounds.

- [ ] **Step 2: Create one factory with explicit subresource paths**

```ts
crud.list({ path: '/types', schema: typeListSchema, service: (query) =>
  DictService.getDictTypeList(query as DictTypeListQuery) })
crud.create({ path: '/types', schema: typeCreateSchema, service: (request) =>
  DictService.createDictType(request.body as SaveDictTypeReq, fastify) })
crud.update({ path: '/types/:id', schema: typeUpdateSchema, service: (id, request) =>
  DictService.updateDictType(id, request.body as UpdateDictTypeReq, fastify) })
crud.delete({ path: '/types/:id', schema: typeDeleteSchema, service: (id) =>
  DictService.deleteDictType(id, fastify) })
```

Register data paths explicitly as well:

```ts
crud.list({ path: '/data', schema: dataListSchema, service: (query) =>
  DictService.getDictDataList(query as DictDataListQuery) })
crud.create({ path: '/data', schema: dataCreateSchema, service: (request) =>
  DictService.createDictData(request.body as SaveDictDataReq, fastify) })
crud.update({ path: '/data/:id', schema: dataUpdateSchema, service: (id, request) =>
  DictService.updateDictData(id, request.body as UpdateDictDataReq, fastify) })
crud.delete({ path: '/data/:id', schema: dataDeleteSchema, service: (id) =>
  DictService.deleteDictData(id, fastify) })
```

Keep `/types/:id`, `/data/:id`, and `/data/map` direct under `crud.permissions.list` so their distinct not-found and map semantics remain visible.

- [ ] **Step 3: Verify and commit**

Run: `pnpm --dir apps/yishan-api exec vitest run test/admin.dicts.routes.test.ts`

Run: `pnpm --dir apps/yishan-api exec tsc --noEmit`

```bash
git add apps/yishan-api/src/core/routes/api/v1/admin/dicts/index.ts
git commit -m "refactor(admin-routes): migrate dictionaries standard CRUD"
```

### Task 6: Verify And Record Scope

**Files:**
- Modify: `TODO-admin-routes-factory.md`

- [ ] **Step 1: Update progress documentation**

Record positions/departments/users/menus as fully migrated, roles as partial, and dicts as migrated. Record attachments, permissions, system, and enums as deliberately excluded by the uniform-action contract.

- [ ] **Step 2: Run full API verification**

Run: `pnpm --dir apps/yishan-api exec vitest run`

Run: `pnpm --dir apps/yishan-api exec tsc --noEmit`

Expected: all non-environment tests pass and TypeScript exits successfully.

- [ ] **Step 3: Verify emitted alias rewriting**

Run: `pnpm --dir apps/yishan-api run build:ts`

Run: `rg -n -F 'require("@/' apps/yishan-api/dist/core/routes`

Expected: build succeeds and the search finds no unresolved import aliases.

- [ ] **Step 4: Inspect and commit closeout**

Run: `git diff --check`

```bash
git add TODO-admin-routes-factory.md
git commit -m "docs: record admin CRUD route migration scope"
```
