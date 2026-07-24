# FIX: yishan API 验证发现汇总（2026-07-24 restish 测试）

> 父文档：暂无 · 创建：2026-07-24 · 状态：待 review

## 背景

2026-07-24 用 restish（`docbase-restish` skill 触发）端到端验证 yishan-api 时，发现了若干**服务端实际行为**与**文档/类型契约/代码健壮性**之间的偏差。本文件汇总这些问题、给出修复建议，并按优先级排序。

**OpenAPI spec 缺 security 声明** 已在 [TODO-openapi-module-security.md](./TODO-openapi-module-security.md) 单独记录，本文件不重复。

## 发现汇总

| # | 严重度 | 主题 | 影响范围 | 推荐处理 |
|---|---|---|---|---|
| **N1** | 🟡 中 | 404 envelope 不一致 | 全局 | 与 N2 合并 PR |
| **N2** | 🟡 中 | 业务错误码混用（21001 既用于校验又用于 not-found） | 全局 | 与 N1 合并 PR |
| **N3** | 🟠 中 | `Type.Integer()` 接受科学计数法（`page=1e10` → 10^10） | 所有分页接口 | 单独 PR |
| **N4** | 🟢 低 | OpenAPI example 字段名与实际响应不一致（`accessToken` vs `token`） | `/api/v1/auth/login` 等 | 单独 PR |
| **N5** | 🟢 低 | logout 接口自身需要 auth（"鸡生蛋"） | `/api/v1/auth/logout` | 评估是否值得修 |
| **N6** | 🟢 低 | `get-token-stats` 同时统计 JWT 与 PAT，命名模糊 | `sys/token-stats` | 文档化或拆分 |

---

## N1：404 envelope 与项目标准不一致

### 问题

未知路由（如 `GET /api/this/does/not/exist`）返回 Fastify **默认**的错误格式：

```json
{
  "message": "Route GET:/api/this/does/not/exist not found",
  "error": "Not Found",
  "statusCode": 404
}
```

而项目其他所有接口都用统一 envelope：

```json
{
  "success": false,
  "code": 10001,            // 或业务码
  "message": "...",
  "data": null,
  "timestamp": "..."
}
```

### 影响

- 客户端（特别是 openapi-generator 生成的 SDK）按 spec 期望的 envelope 解析，拿到非标格式后报错或解析失败
- 单元测试 / E2E 测试需要为 404 写特殊断言
- 日志聚合系统按 envelope 字段名提取，404 会丢字段

### 根因

`setNotFoundHandler` 没有注册自定义处理器。Fastify 默认的 `notFound` handler 直接返回 `{message, error, statusCode}`，绕过 `app.ts` 注册的 `globalErrorHandler`。

### 修复

`apps/yishan-api/src/app.ts`（或 core 配置）注册自定义 not-found handler，复用 global error handler 的统一 envelope：

```ts
fastify.setNotFoundHandler((request, reply) => {
  reply.code(404).send({
    success: false,
    code: 10001,            // 建议新增一个 NotFoundErrorCode 常量
    message: `Route ${request.method}:${request.url} not found`,
    data: null,
    timestamp: new Date().toISOString(),
  })
})
```

### 验证

- [ ] `GET /api/this/does/not/exist` 返回项目标准 envelope
- [ ] `code` 是新常量 `NotFoundErrorCode.ROUTE_NOT_FOUND`（建议值 `10001`）
- [ ] 已有的 4xx 测试不回归

---

## N2：业务错误码混用（21001 重复含义）

### 问题

`21001` (VALIDATION_ERROR) 同时被用于：
- **校验失败**（缺字段、类型错、枚举违规、maxLen 违规）
- **资源不存在**（如 `GET /api/v1/admin/dicts/types/99999` → "字典类型不存在"）

实测日志：

```
GET /api/v1/admin/dicts/types/99999
→ {"success":false,"code":21001,"message":"字典类型不存在", ...}
```

vs

```
POST /api/v1/admin/dicts/types  (body 缺 type)
→ {"success":false,"code":21001,"message":"body must have required property 'type'", ...}
```

### 影响

- 客户端 SDK / 前端 `error.code === 21001` 分支无法区分**校验错**（重新提交）和**找不到资源**（跳 404 页面），只能靠 message 文案做兜底判断
- 监控/告警按 `code` 聚合时，"参数错误激增"告警里会混入"找不到资源"流量

### 根因

资源不存在错误抛的是 `BusinessError(ValidationErrorCode.PARAMETER_FORMAT_ERROR, ...)`，复用了校验码。

### 修复

`apps/yishan-api/src/constants/business-codes/` 新增 `resource.ts`（或扩展 `validation.ts`）：

```ts
export enum ResourceErrorCode {
  NOT_FOUND = 24001,        // 通用资源不存在
  ALREADY_EXISTS = 24002,   // 唯一键冲突
  CONFLICT = 24003,         // 状态冲突
}
```

服务层把"字典不存在"这类抛错换成：

```ts
throw new BusinessError(ResourceErrorCode.NOT_FOUND, '字典类型不存在')
```

### 验证

- [ ] 全局 grep `ValidationErrorCode.PARAMETER_FORMAT_ERROR` 替换为新的 `ResourceErrorCode.NOT_FOUND`
- [ ] spec 重生成
- [ ] 前端按 `error.code` 区分校验 / 404 的分支能正常工作

### 关联

可与 **TODO-admin-routes-factory.md**（admin 路由样板抽工厂）合并，因为工厂可以统一注入"资源不存在"的错误码。

---

## N3：`Type.Integer()` 接受科学计数法（数值过大 → 慢查询）

### 问题

实测：

```bash
curl 'http://127.0.0.1:3000/api/v1/admin/dicts/types?page=1e10&pageSize=2'
→ {"success":true,"code":10000,"data":[], "pagination":{"page":10000000000, ...}}
```

服务端把 `page=1e10` 当成整数 `10000000000`，没拒绝。

### 影响

- 分页查询通常拼成 `OFFSET (page-1) * pageSize`，这里会得到 9999999998 行 offset
- MySQL 对大 OFFSET 全表扫描+丢弃，QPS 很低
- 若用 prepared statement + LIMIT 0,20 仍会扫描前 20 行，但 OFFSET 极大时数据库层会耗时
- 在并发场景下可被滥用为 DoS 入口

### 根因

`@sinclair/typebox` 的 `Type.Integer()` 只校验"是整数"，不限制数值大小；Fastify 的 querystring 解析在 `coerceTypes: 'array'` 模式下会接受科学计数法字符串。

### 修复

**方案 A（最简）**：在 swagger 类型上同时加 `maximum`：

```ts
// routes 中
querystring: Type.Object({
  page: Type.Integer({ minimum: 1, maximum: 100000 }),
  pageSize: Type.Integer({ minimum: 1, maximum: 100, default: 10 }),
})
```

**方案 B（全局）**：在 typebox-provider / swagger 配置里加全局 `coerceTypes: false` + 自定义 `coerceTypesTransform`，把 `Number()` 换成 `Math.trunc(Number())` 并钳制到 `[0, Number.MAX_SAFE_INTEGER]` 范围内。

**方案 C（防御）**：在所有分页查询的 repository 层加 OFFSET 截断：`const offset = Math.min((page - 1) * pageSize, 1_000_000)`。

### 推荐

**A + C 组合**：A 让客户端立刻看到 422 错误，C 是兜底防止任何漏掉的接口被攻击。

### 验证

- [ ] `?page=1e10` 返回 `code=21001, "querystring/page must be <= 100000"`
- [ ] `?page=1e20` 同上
- [ ] `?page=1`(正常)仍 200
- [ ] 已有分页测试不回归

---

## N4：OpenAPI example 字段名与实际响应不一致

### 问题

`apps/yishan-api/openapi.json` 中 `/api/v1/auth/login` 的 Response example 写：

```json
{
  "data": {
    "accessToken": "...",
    "refreshToken": "...",
    "expiresIn": 86400
  }
}
```

实际响应：

```json
{
  "data": {
    "token": "eyJ...",
    "expiresIn": 86400,
    "refreshToken": "eyJ...",
    "refreshTokenExpiresIn": 604800,
    "expiresAt": 1784956606,
    "refreshTokenExpiresAt": 1785475006
  }
}
```

### 影响

- openapi-generator / restish 这类 spec-aware 客户端按 `accessToken` 解析会得到 `undefined`
- 文档对开发者误导，schema 字段名稳定性也差

### 根因

路由 schema 用 `Type.Object({ token: Type.String() })` 真实字段是 `token`，但 openapi 文档生成时 example 是早期手写的，未跟随代码同步。

### 修复

`apps/yishan-api/src/core/routes/api/v1/admin/auth/login.ts`（或实际路由位置）的 schema 调整：

```ts
// 1. 把字段名统一为 token（或同时给 accessToken 别名？看下面）
response: {
  200: {
    description: '登录成功',
    content: {
      'application/json': {
        schema: Type.Object({
          success: Type.Boolean(),
          code: Type.Integer(),
          message: Type.String(),
          data: Type.Object({
            token: Type.String(),                       // 与实际一致
            expiresIn: Type.Integer(),
            expiresAt: Type.Integer(),
            refreshToken: Type.String(),
            refreshTokenExpiresIn: Type.Integer(),
            refreshTokenExpiresAt: Type.Integer(),
          }),
          timestamp: Type.String(),
        }),
      },
    },
  },
}
```

### 验证

- [ ] `pnpm --filter yishan-admin openapi` 重生成后 `services/generated/auth.ts` 中 `data.token` 是 string 类型
- [ ] `curl -s localhost:3000/api/docs/json | jq '.components.schemas.LoginResponse.properties.data'` 输出字段与代码一致

---

## N5：logout 接口"鸡生蛋"—— 自身需要鉴权

### 问题

实测：

```bash
# 不带 Authorization
POST /api/v1/auth/logout
Body: {"token": "<access_token>"}
→ {"success":false,"code":22001,"message":"未登录或登录已失效..."}

# 带 Authorization(且 token 与 body 一致)
POST /api/v1/auth/logout
Header: Authorization: Bearer <access_token>
Body: {"token": "<access_token>"}
→ {"success":true,"code":10000,"message":"登出成功"}
```

### 影响

- **典型场景失败**：用户的 access token 已过期但 refresh token 还有效，TA 想登出当前设备（凭 refresh token 撤销）。当前实现不让这么做。
- **客户端实现不一致**：有的客户端 logout 时附 Authorization，有的只放 body，行为差异导致 bug。
- **安全风险轻微**：logout 失败时 token 仍可用，refresh token 仍能换新 token，至少要等到 expires。

### 根因

`/api/v1/auth/logout` 的 preHandler 是 `authenticate`，强制要求请求头带有效 token。但 logout 本身的目标用户是**想撤销自己 token** 的人，应该允许两种鉴权方式：
1. 携带有效 Authorization header
2. 携带有效 refresh token（body 或 header）

### 修复方案

**方案 A（推荐）**：新增一个 `softAuthenticate` preHandler，逻辑：

```ts
async function softAuthenticate(request, reply) {
  // 1. 优先用 Authorization header（标准路径）
  if (request.headers.authorization) {
    await request.jwtVerify()
    return
  }
  // 2. fallback：body.token 可能是 access 或 refresh token
  const { token } = request.body || {}
  if (token) {
    await request.jwtVerify()  // 复用同一签名校验
    return
  }
  // 3. 都没有 → 不强制 401，由 handler 内部决定
  throw new BusinessError(AuthErrorCode.UNAUTHORIZED, '...')
}
```

应用到 logout（以及可能的 refresh 路由）。

**方案 B（不改代码，仅文档）**：在 OpenAPI spec 上写明 logout 必须带 Authorization，承认当前限制。

### 推荐处理

**方案 A**，但优先级 🟢 低。原因：实际生产中 access token 过期前 logout 是常见路径，过期后才想 logout 是边缘场景。

### 验证

- [ ] 不带 Authorization、body 有 access token 的 logout 请求 10000
- [ ] 不带 Authorization、body 有 refresh token 的 logout 请求 10000
- [ ] 完全不带任何 token 的 logout 请求 22001（保持原行为）
- [ ] 已有的 logout 调用方式仍 200（向后兼容）

---

## N6：`get-token-stats` 命名模糊

### 问题

`GET /api/v1/system/token-stats` 返回：

```json
{
  "data": {
    "totalTokens": 6,
    "activeTokens": 1,        // ← 这只是 api_token
    "expiredTokens": 0,       // ← api_token
    "revokedTokens": 5        // ← sys_user_token 中 is_revoked=1 的
  }
}
```

实际统计口径混在一起：API Token（`sys_api_token`）和 JWT access token（`sys_user_token`）。

### 影响

- 监控看板展示时数字含义不清
- 维护者排查"为什么 activeTokens 只有 1，但系统里登录 token 有 6 个"会困惑

### 根因

`get-token-stats` 路由实现：

```ts
// 大致逻辑
const apiTokens = await db.select(...).from(sysApiToken)
const userTokens = await db.select(...).from(sysUserToken)
return {
  totalTokens: apiTokens.total + userTokens.total,
  activeTokens: apiTokens.active,
  ...
  revokedTokens: userTokens.revoked,  // ← 这里只算了 user_token 的
}
```

### 修复

**方案 A（拆分）**：新增两个 endpoint：

```
GET /api/v1/system/api-token-stats       → 只统计 sys_api_token
GET /api/v1/system/user-token-stats      → 只统计 sys_user_token
```

老 endpoint 标 deprecated，返回两者合并但加 `breakdown` 字段。

**方案 B（文档化）**：在 endpoint 上加详细注释 + OpenAPI description，明确口径。

**方案 C（小改）**：保持 endpoint，response 里把数字分类：

```json
{
  "data": {
    "apiTokens": { "total": 1, "active": 1, "expired": 0, "revoked": 0 },
    "userTokens": { "total": 6, "active": 1, "expired": 0, "revoked": 5 }
  }
}
```

### 推荐

**方案 C**：最简，对前端调用方透明。

### 验证

- [ ] response 新结构有 `apiTokens` 和 `userTokens` 两个子对象
- [ ] 老字段保留（或加 `@deprecated` 标记过渡 1-2 个版本）

---

## 推荐修复顺序

```
N3 (integer overflow) → N1+N2 (envelope + 错误码合并) → N4 (OpenAPI 字段) → N6 (token stats) → N5 (logout)
```

理由：

1. **N3** 安全相关，单独 PR，影响面有限（只动 schema 的 number 限制）
2. **N1+N2** 合并 PR，统一错误处理路径，影响面较大但是低风险
3. **N4** 文档同步，几乎零风险
4. **N6** 增强信息密度，可与 N1+N2 合并
5. **N5** 边缘场景，可最后评估

## 已交叉验证（无 bug）

- ✅ 输入校验全场景（缺字段 / 类型错 / 空 body / 枚举 / maxLen / 错误 Content-Type）
- ✅ 分页边界（page=0 / pageSize=999 / page=-1 / page=abc 全部正确拦截）
- ✅ API Token 全生命周期（创建 plaintext 一次性 / 鉴权 200 / 撤销 / 撤销后 22010）
- ✅ JWT 登录流程（login → token+refresh → refresh 换新 → logout 撤销）
- ✅ 限流 login 5/min，第 6 次起 429，**正确密码也被拦**

## 相关文档

- [TODO-openapi-module-security.md](./TODO-openapi-module-security.md) — OpenAPI spec 缺 security 声明
- [TODO-admin-routes-factory.md](./TODO-admin-routes-factory.md) — admin 路由样板抽工厂（N1/N2 改造时一并做更划算）
- `apps/yishan-api/src/constants/business-codes/` — 错误码定义位置
- `apps/yishan-api/src/core/plugins/external/rate-limit.ts` — 限流实现
- `apps/yishan-api/src/core/repositories/user-token.repository.ts` — user token 撤销逻辑

## 附录：本次测试使用的工具与命令模板

```bash
# restish 配置
export YISHAN_PAT="$(cat /home/dfy/workspace/products/yishan/.playwright-cli/.yishan_pat)"

# 起 dev
cd apps/yishan-api
REDIS_PASSWORD="" pnpm dev   # redis7 容器无密码，绕过 .env 默认 123456

# restish 调用
restish yishan <command> --<flag>=<value>
echo '<json>' | restish yishan <write-command>     # 写操作用 stdin

# curl 强制带 auth(用于 spec 没声明 security 的模块端点)
curl -sS -H "Authorization: Bearer $YISHAN_PAT" http://127.0.0.1:3000/api/<path>
```