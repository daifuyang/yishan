# TODO: OpenAPI spec 补齐模块端点的 security 声明

> 父文档：[TODO.md](./TODO.md) · 优先级：🟡 中 · 估算：1-2 小时

## 现状

`apps/yishan-api/src/core/plugins/external/swagger.ts` 在 `components.securitySchemes` 中声明了 `bearerAuth`（JWT 风格），但**没有全局 `security` 块**，且各业务模块路由（`src/modules/{demo,portal,shop}/routes/v1/*`）的 schema 里也**没有**给 operation 单独声明 `security`。

后果：openapi.json 里 `/api/demo/v1/*`、`/api/portal/v1/*`、`/api/shop/v1/*` 这些 path 的 GET/POST/PUT/PATCH/DELETE 全部 `security: undefined`，而 OpenAPI 规范规定这种情况下端点等于"不需要鉴权"。

### 现象（2026-07-24 restish 验证实录）

| 调用 | 结果 |
|---|---|
| `restish yishan get-user-list`（系统端点，`security: [{bearerAuth:[]}]`） | ✅ 200，restish 自动发 bearer |
| `restish yishan get-api-portal-v1-articles`（模块端点，`security: undefined`） | ❌ 401 — restish 不发 bearer |
| `restish yishan demo-v1todos-list` | ❌ 401 — 同上 |
| `restish yishan get-api-shop-v1-products` | ❌ 401 — 同上 |
| `curl -H 'Authorization: Bearer ...' /api/portal/v1/articles` | ✅ 200，绕过问题 |

服务端鉴权本身**完全正确**（curl 强制带 token 后走通完整 PAT/JWT 校验），问题只出在 spec 不完整，导致 spec-aware 的 OpenAPI 客户端（restish、openapi-generator、Stoplight、Insomnia 等）默认把模块端点当公开端点。

### 对照点：Core admin 路由的写法

`src/core/routes/api/v1/admin/{dicts,departments,users}/index.ts` 在每个 route schema 里手工加 `security: [{ bearerAuth: [] }]`，所以 `/api/v1/admin/*` 在 spec 里**有** security 声明。这就是为什么 `get-user-list` 走得通。

模块路由没有这种手写声明，是历史遗漏。

## 目标

让 openapi.json 的所有鉴权端点都正确声明 `security: [{ bearerAuth: [] }]`，任何真正公开的端点显式声明 `security: []`（opt-out）。

## 步骤

### Step 1：在 swagger.ts 加全局 security（推荐做法）

`apps/yishan-api/src/core/plugins/external/swagger.ts:11-49` 的 `fastify.register(fastifySwagger, { openapi: {...} })` 中，`openapi` 配置里加上：

```ts
security: [{ bearerAuth: [] }],   // 默认所有端点要求 bearer
```

放在 `info` 之后、`tags` 之前即可。

这会让 openapi.json 顶层出现 `"security": [{"bearerAuth": []}]`，按 OpenAPI 规范，所有 operation **默认继承**全局 security。

### Step 2：找出真正公开的端点并 opt-out

跑一遍新 spec，把仍然期望公开的端点显式加上 `security: []`：

```bash
pnpm --filter yishan-api dev   # 重启让 swagger.ts 改动生效
curl -s http://127.0.0.1:3000/api/docs/json | jq '
  .paths | to_entries[] | .value | to_entries[]
  | select(.key|test("^(get|post|put|patch|delete)$"))
  | select(.value.security == null)
  | "\(.key | ascii_upcase) \(.value.operationId // "?") — \(.value.summary // "")"
'
```

预期真正公开的端点（需人工确认）：

- `GET /api/health`（健康检查，restish 实测已通）
- `GET /api/v1/ping`、`/api/demo/v1/info` 之类纯探活端点（按路由注册时是否有 `preHandler: [authenticate]` 判定）

对每个确认公开的 operation，在 schema 加：

```ts
security: [],
```

> 备注：如果实际只有 `/api/health` 一个，可以容忍它在 spec 里"假性鉴权要求"——客户端发空 bearer 后服务端会回 401，但 restish `health-check` 实测是通的（说明该路由根本没经过 `authenticate` preHandler）。这是**另一层**问题（路由 preHandler 缺失），不属于本 TODO 范围。

### Step 3：restish 端回归验证

```bash
# 重新拉 spec（profile 缓存）
restish api list    # 看 cached timestamp
# 强制刷新：在 dev 服务运行时，restish 会在调用时自动探活 /api/docs/json

# 之前 401 的命令现在应当自动带 token
restish yishan demo-v1todos-list     # 不再 401，要么 200，要么 22002（RBAC 拒）
restish yishan get-api-portal-v1-articles --page=1 --page-size=2
restish yishan get-api-shop-v1-products --page=1 --page-size=2
```

预期：前两条 200（admin 角色权限码已配齐 + token scope 已包含对应 module 权限码），第三条仍 22002（admin 没 shop 角色权限，**这是 RBAC 业务行为不是 spec bug**）。

### Step 4（可选）：长期改造方向

如果不想每加一个模块路由都靠全局继承，可以加 onRoute hook 自动注入：

```ts
// swagger.ts 末尾
fastify.addHook('onRoute', (route) => {
  const needsAuth = Array.isArray(route.preHandler) &&
                    route.preHandler.some((h: any) => h.name === 'authenticate')
  if (needsAuth && route.schema && !route.schema.security) {
    route.schema.security = [{ bearerAuth: [] }]
  }
})
```

这样任何挂了 `authenticate` preHandler 的路由都会自动声明 security，公开端点自动 opt-out（preHandler 缺失 → security 不注入 → 继承全局"无 security"）。Step 1 + Step 4 二选一，Step 4 更彻底但 PR 影响面更大。

## 验收

- [ ] swagger.ts 加了全局 `security: [{ bearerAuth: [] }]`
- [ ] 真正公开的端点显式声明 `security: []`
- [ ] `pnpm --filter yishan-admin openapi` 重新生成 services 后 TypeScript 不报错
- [ ] `restish yishan demo-v1todos-list` 等模块端点不再 401（要么 200 要么 RBAC 业务拒绝 22002）
- [ ] `restish yishan get-user-list` 等 Core 端点行为不变（继续 200）
- [ ] `restish yishan health-check` 仍 200（公开端点未被误伤）

## 风险

- **Step 4 onRoute hook**：要小心 `preHandler` 链里可能不止 `authenticate`，还有 rate-limit 等；过滤条件要严格只匹配 `authenticate.name === 'authenticate'`（或按 preHandler 函数引用判断）。
- **Step 1 全局 security 后真公开端点会"假性要求鉴权"**：客户端发空 bearer 会被服务端 401。需要 Step 2 给真正公开端点 opt-out，否则 `/api/health` 这种对运维/k8s probe 很重要的端点会被误伤。
- **破坏 openapi.json 的下游消费者**：admin 的 `pnpm openapi` 重新生成 services 时类型签名可能变化（auth 相关的 request 包装）。重生成后跑 `pnpm --filter yishan-admin lint` + `pnpm --filter yishan-admin test` 兜底。

## 相关文件

- `apps/yishan-api/src/core/plugins/external/swagger.ts`（主修改点）
- `apps/yishan-api/src/modules/demo/routes/v1/{todos,info}/index.ts`（后续可对照的样例）
- `apps/yishan-api/src/modules/portal/routes/v1/articles/index.ts`（同上）
- `apps/yishan-api/src/modules/shop/routes/v1/products/index.ts`（同上）
- `apps/yishan-api/src/core/routes/api/v1/admin/dicts/index.ts`（**已有** security 声明的样例，可作为模板参考）
- `apps/yishan-api/openapi.json`（修改后重新生成）
- `apps/yishan-admin/src/services/generated/`（`pnpm openapi` 重新生成）

## 备注：本次发现背景

2026-07-24 用 restish（`docbase-restish` skill 触发）端到端验证 yishan API 时发现。背景：

1. restish 连本地 `yishan` profile → spec 自动从 `/api/docs/json` 拉取
2. `restish yishan health-check` ✅ 200（spec 里 `/api/health` 实际是公开的，restish 没发 bearer，服务端也没鉴权）
3. `restish yishan get-user-list` ✅ 200（Core 端点有 security，restish 自动发 bearer）
4. `restish yishan demo-v1todos-list` 等模块端点 ❌ 401（spec 没 security，restish 不发 bearer，服务端又强制鉴权）
5. 改用 curl 强制带 token 验证服务端 RBAC 正确，最终定位到 OpenAPI spec 不完整