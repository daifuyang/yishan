# TODO: 后端 admin 路由抽工厂（5 件套样板去重）

> 父文档：[TODO.md](./TODO.md) · 优先级：🔴 高（架构债） · 估算：1-2 天

## 现状

`apps/yishan-api/src/core/routes/api/v1/admin/` 下 8 个路由文件（users / roles / menus / departments / dicts / positions / permissions / attachments）每个都重复同样的样板：

```ts
// 1. import
import { createRouteRegistrar } from '../../../../route-registrar.js'

// 2. PERMS 注册
const PERMS: { readonly [k: string]: PermissionRef } = Object.freeze({
  LIST:   { code: 'xxx:list',   label: '...', group: '...' },
  CREATE: { code: 'xxx:create', label: '...', group: '...' },
  UPDATE: { code: 'xxx:update', label: '...', group: '...' },
  DELETE: { code: 'xxx:delete', label: '...', group: '...' },
})
registerPermissions(...Object.values(PERMS))

// 3. router 初始化
const admin: FastifyPluginAsync = async (fastify, opts) => {
  const route = createRouteRegistrar(fastify)

  // 4. 每个 handler 中
  route.get('/list', {
    access: { permission: PERMS.LIST },
    schema: { ... },
  }, async (req, reply) => {
    const items = await XxxService.list(...)
    const message = getXxxMessage(Keys.LIST_SUCCESS, req.headers['accept-language'])
    return ResponseUtil.paginated(reply, items, message)
  })

  // 5. 错误抛出
  throw new BusinessError(XxxErrorCode.NOT_FOUND, '...')
}
```

每个文件**完全一致**地重复 80-150 行样板。

### 涉及文件与行数

| 文件 | 行数 | 备注 |
|---|---|---|
| `attachments/index.ts` | 550 | 文件最长，含 stream pipeline |
| `dicts/index.ts` | 271 | |
| `menus/index.ts` | 258 | |
| `users/index.ts` | 231 | |
| `departments/index.ts` | 198 | |
| `roles/index.ts` | 193 | 内部有 `preHandler: [fastify.requirePermission(PERMS.GRANT) as any]` 这种 `as any` 强制转换，说明权限 API 设计需要同时收口 |
| `positions/index.ts` | 177 | |
| `permissions/index.ts` | 38 | 只有 GET /catalog，结构不一致 |

## 目标

抽取一个 `createCrudHandlers` 工厂，把上述样板收敛到一个地方，新增 admin 路由**不再需要复制粘贴**。

```ts
// 用法示例（目标形态）
const route = createRouteRegistrar(fastify)
const x = createCrudHandlers(route, {
  resource: 'user',
  group: 'system',
  perms: {
    list: '用户列表', create: '新建用户', update: '编辑用户', delete: '删除用户',
  },
  service: UserService,
  messages: userMessages,
})

x.list()      // GET /list
x.create()    // POST /
x.update()    // PUT /:id
x.delete()    // DELETE /:id
```

## 步骤

### Step 1：抽象工厂接口

新建 `apps/yishan-api/src/core/routes/admin-crud.ts`，定义：

```ts
interface CrudHandlersOptions<TListItem, TCreate, TUpdate> {
  resource: string                      // 'user' | 'role' | ...
  group: string                         // 'system' | 'demo' | ...
  perms: Record<'list'|'create'|'update'|'delete', string>   // 中文 label
  service: {
    list(query): Promise<{ list, total }>
    create(input): Promise<T>
    update(id, input): Promise<T>
    remove(id): Promise<void>
  }
  messages: {
    listSuccess: MessageKey
    createSuccess: MessageKey
    updateSuccess: MessageKey
    deleteSuccess: MessageKey
  }
  // 可选：list 的额外参数处理、create 的输入 schema 等
}

export function createCrudHandlers<T>(route, opts: CrudHandlersOptions<T>): {
  list(), create(), update(), delete()
}
```

### Step 2：抽 PERMS 注册工具

在同一个文件加：

```ts
function registerCrudPerms(resource: string, group: string, labels: Record<...>): Record<'list'|'create'|'update'|'delete', PermissionRef>
```

返回 PERMS 字典，**自动 registerPermissions**。

### Step 3：抽响应包装

```ts
function respondWithMessage(reply, data, messageKey, acceptLang): Response
```

封装 `ResponseUtil.success/paginated` + `getXxxMessage` 的样板。

### Step 4：迁移一个最简单的路由作为试点

- 选 `permissions/index.ts`（38 行，只有 GET /catalog）— **不直接适用** createCrudHandlers，但可以用作参照
- 选 `positions/index.ts`（177 行，4 个标准 CRUD） — **最合适**
- 改完后跑测试：`cd apps/yishan-api && pnpm exec vitest run` 必须全过

### Step 5：迁移其余 7 个路由

逐个迁移，每个 commit 一个文件，便于 review：

```
refactor(admin-routes): extract createCrudHandlers factory + migrate positions
refactor(admin-routes): migrate departments
refactor(admin-routes): migrate users
refactor(admin-routes): migrate roles
refactor(admin-routes): migrate menus
refactor(admin-routes): migrate dicts
refactor(admin-routes): migrate attachments
```

attachments 因为有 stream pipeline，可能需要 createCrudHandlers 之外的额外处理；可以最后做或者作为工厂的扩展点。

### Step 6：清理 `as any` 强制转换

迁移过程中如果发现 `preHandler: [...as any]` 这类用 `as any` 绕过的，说明 `requirePermission` 类型定义不完整。顺手补：

```ts
// route-registrar.ts
guards.push((fastify as any).requirePermission(access.permission))   // ← 这里的 as any
```

正确做法：定义 `FastifyInstance` 的 `declare module 'fastify'` 扩展，把 `authenticate` / `requirePermission` 类型补完整。

## 验收

- [ ] `createCrudHandlers` 工厂实现并通过测试
- [ ] 8 个 admin 路由全部迁移完成
- [ ] 每个 admin 路由文件行数 < 100（除了 attachments 可能例外）
- [ ] 没有任何 `as any` 强制转换（Step 6 收口）
- [ ] `pnpm exec vitest run` 215/215 通过
- [ ] `pnpm exec tsc --noEmit` 0 错误
- [ ] 手动 `pnpm dev:api` + `pnpm dev:admin`，验证 `/system/user`、`/system/role` 等 CRUD 流程

## 风险

- **响应包装语义**：每个路由的 `paginated` vs `success` 形态不一致，工厂要支持多种 → 设计时把响应包装做成 callback 由调用方提供
- **业务特例**：attachments 有 stream，menus 有 component 校验 → 工厂保留 `extraHandlers` 字段供特殊路由追加
- **改完测试**：`permissions/index.ts` 只有一个 `GET /catalog`，跟 CRUD 不一致，可能不适合工厂 → 保留原样或单独做 `createListHandler`
- **PR review 成本**：7 个路由迁移每个 1 个 commit，PR 数量多 → 可以拆"工厂 + 一个迁移"为一个大 PR，其余 6 个作为后续 commit

## 相关文件

- `apps/yishan-api/src/core/routes/route-registrar.ts`（工厂基础）
- `apps/yishan-api/src/core/routes/api/v1/admin/{users,roles,menus,departments,dicts,positions,permissions,attachments}/index.ts`
- `apps/yishan-api/src/core/utils/response.ts`（ResponseUtil）
- `apps/yishan-api/src/constants/messages/`（各资源的中文消息 key）