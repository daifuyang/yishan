# Yishan API / Admin 现状审计与问题台账

> 审计日期：2026-07-13
> 审计基线：`drizzle` 分支 HEAD = `e5abe70 docs(api): CLI 文档迁移到 Restish OpenAPI CLI`
> 审计范围：`apps/yishan-api`、`apps/yishan-admin`，以及直接影响二者的根目录脚本、CI/CD 和架构文档  
> 系统定位假设：单租户、资源权限点 RBAC、仓库内编译时插件、企业内部生产使用并准备对外开源  
> 本文只记录现状与修复建议，不代表相关修复已经实施。所有结论附当前代码证据与可复现命令。**不再保留任何 Prisma 兼容性方案**。

## 1. 如何使用本文

- 按文末"修复索引"的顺序逐条处理；不要直接按文件批量重构。
- 修复某项时，把状态从 `待处理` 改为 `处理中`，验收完成后改为 `已完成`，并附 PR 或提交号。
- P0 表示可能导致越权、敏感数据泄漏、生产不可控或发布门禁失效；P1 表示基座复制前必须收口；P2/P3 可结合业务节奏处理。
- "工作区问题"表示结论来自当前未提交代码，合并前可能变化；"确认存在"表示当前代码路径可以直接证明；"潜在风险"表示需结合实际网关或生产配置复核；"本轮新增"表示仅在本轮基线（2026-07-13）上首次列入台账。
- 文件定位使用审计时路径和符号名，不绑定容易漂移的绝对行号；每条结论给出当前代码行号或 grep 关键字，便于回归复核。
- 所有"Prisma"字样均视为历史问题，本文不复述任何 Prisma 兼容性方案。

## 2. 审计摘要

### 2.1 当前值得保留的设计

1. API 已形成 `route -> service -> repository -> mapper -> Drizzle` 的基本分层，TypeBox、统一响应、业务码和异常类型已经具备继续规范化的基础。
2. SQL migration 带文件 hash 校验，`scripts/migrate.ts` 能拒绝已执行 migration 被修改，这是正确的不可变迁移方向。
3. **API 当前 23 个测试文件、141 个测试全部通过**（本次实测 `pnpm --filter yishan-api test`，覆盖 auth、admin、me-api-tokens、portal、shop、plugins-runtime 等核心路由）。
4. **Admin 当前 Biome + tsc 严格检查通过**（`pnpm --filter yishan-admin lint`，163 个文件无 lint 错误）。
5. **API `build:ts` 编译通过**（`tsc && tsc-alias` 输出空）。
6. API Token 当前实现采用随机明文只展示一次、数据库仅保存 SHA-256 hash 的方式，所有者范围查询与撤销逻辑方向正确；高频 `touch` 操作改用 `setImmediate` 延后触发，但每个 PAT 请求仍会落库一次（未做时间窗口节流或聚合写入）。
7. Admin 已使用 Umi access、动态菜单、统一请求拦截和 OpenAPI 生成服务，基础设施齐全，问题主要在事实源与执行闭环。
8. Admin 静态资源与 API 一体化部署符合当前 FC3 交付模型，避免了前后端独立部署版本错配。

### 2.2 总体结论

当前系统属于"功能可运行、API 测试覆盖显著改善，但平台级约束没有闭环"的模块化单体。最明显的矛盾是：文档已经按企业级插件基座描述，但权限执行、插件启停、契约生成、迁移治理和 CI 门禁仍存在绕过路径。若直接作为多个开源项目的公共基座复制，这些问题会随项目数量成倍扩大。

本轮基线（2026-07-13）相比 2026-07-11 审计的关键改善：

- portal / shop 插件的 models 全部删除，迁到 mapper + repository + service 三层，模型层冗余代码 -1302 行。
- 10 个 schema 文件移除 `Type.Optional` 字段的 default，避免 `Fastify Ajv useDefaults:true` 把字段默认值注入到 update 请求体（QUALITY-009，本轮新发现并修复）。
- shop 订单列表 500 bug（ShopOrderListItemSchema）已修复（ShopOrderList 修复，本轮新发现并修复）。
- 工作区除本文档修改外已干净，所有"工作区问题"已落地或回归至主线代码。

仍存在的首要风险包括：未验签登出导致任意用户会话可能被注销、日志记录完整请求体、Admin API 只有认证而没有资源权限校验、生产配置存在不安全兜底、三项架构守卫全部为空实现、Admin 类型检查虽已通过但 CI 仍依赖数据库 secrets 而非 `--frozen-lockfile`、SQL 生成器继续用正则启发式推断关系、test-generator 硬编码迁移文件名而新表会被漏测。

### 2.3 本次实际验证（2026-07-13）

| 检查 | 命令 | 当前结果 | 说明 |
|---|---|---|---|
| API 测试 | `pnpm --filter yishan-api test` | **通过** | 23 个文件，141 个测试全部通过 |
| API 编译 | `pnpm --filter yishan-api build:ts` | **通过** | `tsc && tsc-alias` 无输出（exit 0） |
| Admin 检查 | `pnpm --filter yishan-admin lint` | **通过** | Biome 163 个文件无 lint 错误；`tsc --noEmit` 无输出 |
| 架构检查 | `pnpm arch:check` | **失败（语义）** | 三项脚本各打印一行 `skipped` 并以 0 退出（QUALITY-002 仍存在） |
| 数据库集成测试 | 直接执行 `pnpm --filter yishan-api test` | **未发现** | Vitest setup 全局 mock 数据库层（QUALITY-004 仍存在） |
| Admin 单元测试 | `find apps/yishan-admin -name '*.test.*' -not -path '*/node_modules/*'` | **存在 E2E 但未纳入 CI** | `apps/yishan-admin/e2e/api-token.spec.ts`（Playwright）已就位，但 CI 未跑且依赖本地 API/Admin/种子数据（QUALITY-005 仍存在） |

## 3. P0 问题：必须先止血

### API-SEC-001：登出接口信任未验签 JWT，可被用于注销其他用户全部会话

- **优先级**：P0
- **状态**：确认存在
- **现状**：`POST /api/v1/auth/logout` 的 schema 块未声明 `preHandler: fastify.authenticate`，仅要求 `Authorization` 头存在。`AuthService.logout()` 对传入字符串调用 `fastify.jwt.decode<{ id?: number }>(token.replace('Bearer ', ''))`，从未验签载荷读取 `id`，然后通过 `UserTokenRepository.findActiveTokensByUserId` 撤销该 ID 用户的全部活跃 Token。`decode()` 只解析载荷，不证明签名、有效期或 Token 类型。
- **证据**：`apps/yishan-api/src/core/routes/api/v1/auth/index.ts:46-83`（无 `preHandler`）；`apps/yishan-api/src/core/services/auth.service.ts:140-170`（`logout()` 调用 `fastify.jwt.decode`）。
- **风险**：攻击者可构造包含目标用户 ID 的伪 JWT 调用公开登出接口，使目标用户所有活跃会话被撤销，形成低成本账号拒绝服务。当前实现隐式语义是"logout 即退出该用户所有会话"。
- **复现命令**：`curl -X POST http://127.0.0.1:3000/api/v1/auth/logout -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJpZCI6MTAwfQ.fake"` —— 任意 JWT 载荷中只要带 `id` 字段就会触发全会话撤销。
- **推荐修复方案**：
  1. 给 logout 路由加 `preHandler: fastify.authenticate`，强制验签后再解码。
  2. 默认 logout 行为改为撤销当前 session（按 jti / tokenHash），引入独立 `POST /auth/logout-all` 接口处理"全部设备"语义。
  3. `fastify.jwt.decode` 调用替换为 `fastify.jwt.verify`，失败抛业务错误而非静默忽略。
- **注意事项**：CLI 和 Admin 当前可能依赖"logout 即退出全部设备"的隐式行为；修改前先确定产品语义。API Token 不应调用用户会话 logout 逻辑。
- **验证方式**：增加伪造 JWT、过期 JWT、refresh token、他人用户 ID、当前 session、logout-all 六类测试。
- **完成标准**：未经认证无法调用 logout；伪造载荷不能影响任何会话；普通 logout 只撤销当前 session；logout-all 行为明确且有测试。

### API-SEC-002：全局错误日志记录完整请求体，可能泄漏密码和 Token

- **优先级**：P0
- **状态**：确认存在
- **现状**：全局错误处理器记录 `params`、`query` 和完整 `body`。登录请求包含密码，刷新请求包含 refresh token，存储配置接口可能包含云密钥；异常时这些内容都会进入 Pino/平台日志。生产模式仅将响应 `message` 替换为通用文本，但日志侧 `body` 仍完整落盘。
- **证据**：`apps/yishan-api/src/core/plugins/external/error-handler.ts:14-22`，日志字段含 `body: request.body`；同文件第 88 行仅在响应侧做生产脱敏。
- **风险**：日志平台、排障导出或第三方采集系统将成为凭据副本；日志读取权限通常比生产数据库更宽，泄漏影响非常大。
- **复现命令**：`curl -X POST http://127.0.0.1:3000/api/v1/auth/login -d '{"username":"admin","password":"any"}' -H 'Content-Type: application/json'` 后检查 Pino 日志中会出现明文 password。
- **推荐修复方案**：建立统一日志脱敏 serializer。默认不记录 body，仅对白名单业务字段记录摘要；全局递归遮蔽 `password`、`token`、`authorization`、`secret`、`cookie`、`accessKey`、`refreshToken`、`apiKey` 等字段（大小写不敏感，覆盖嵌套对象、数组和 header）。认证和存储配置路由禁止记录请求体。
- **注意事项**：不要只按精确字段名过滤，应大小写不敏感并覆盖嵌套对象、数组和 header。错误对象保留 stack，但不得把内部 details 返回给客户端。
- **验证方式**：向登录、刷新、API Token、存储配置接口注入故障，捕获日志并断言秘密值不存在。
- **完成标准**：日志中无法搜索到测试密码、JWT、PAT、refresh token 和云密钥；仍能通过 request ID、路由、用户 ID 和业务码定位错误。

### API-SEC-003：Admin API 只有身份认证，没有资源级授权

- **优先级**：P0
- **状态**：确认存在
- **现状**：`/api/v1/admin/**` 的目录级 autohook 只调用 `fastify.authenticate`；portal 与 shop 插件的 admin autohook 同样仅认证。用户、角色、菜单、插件等管理接口没有统一 permission code 校验。Admin 前端的 `canDo` 只根据 `accessPath` 决定页面是否展示。
- **证据**：`apps/yishan-api/src/core/routes/api/v1/admin/autohooks.ts:3-7`；`apps/yishan-api/src/plugins/modules/portal/routes/v1/admin/autohooks.ts:3-7`；`apps/yishan-api/src/plugins/modules/shop/routes/v1/admin/autohooks.ts:3-7`；`apps/yishan-admin/src/access.ts:14-15`。
- **风险**：任意已登录普通用户只要知道 URL，就可能直接调用后台管理 API。前端隐藏菜单不是安全边界，浏览器、curl 或 API Token 都可绕过。
- **复现命令**：`curl -X POST http://127.0.0.1:3000/api/v1/admin/user -H "Authorization: Bearer <普通用户JWT>"` 不会返回 403（用户管理路由前缀为单数 `/api/v1/admin/user`，非 `/admin/users`）。
- **推荐修复方案**：建立资源权限点 RBAC：路由通过统一 metadata 声明 `permission`，目录 hook 先认证再调用 `authorize(permission)`；角色绑定 permission，而不是仅绑定菜单。菜单的 `perm` 只引用同一个 permission code 用于展示。
- **注意事项**：先建立权限清单和兼容映射，再切换 fail-close。批量上线前需验证 seed 中超级管理员拥有全部权限，防止把所有管理员锁在系统外。
- **验证方式**：为每个管理资源至少覆盖未登录 401、无权限 403、只读权限、写权限和超级管理员五种矩阵。
- **完成标准**：管理 API 不再依赖前端路径授权；每条非公开管理路由都能被自动检查出权限声明缺失。

### API-SEC-004：`requireAdmin` 硬编码角色 ID，安全语义依赖数据顺序

- **优先级**：P0
- **状态**：确认存在
- **现状**：`ADMIN_ROLE_IDS = [1, 2]`，只要用户拥有数据库 ID 1 或 2 的角色就被视为管理员。
- **证据**：`apps/yishan-api/src/core/middleware/require-admin.ts:5-14`。
- **风险**：迁移、导入、重建 seed 或用户自定义角色后，ID 1/2 可能不再代表预期角色；这会产生误授权或管理员失权。插件菜单同步也多处硬编码角色 1。
- **推荐修复方案**：删除固定 ID 判断。过渡期可使用不可变 role code；目标态使用 permission code。超级管理员采用明确的系统角色标识或策略，不依赖自增主键。
- **注意事项**：role code 应有唯一约束并禁止普通接口修改系统角色标识。
- **验证方式**：使用非 1/2 的管理员角色、ID 为 1 的普通角色及重建数据库顺序测试。
- **完成标准**：权限语义与自增 ID 完全解耦。

### API-SEC-005：生产环境可使用默认 JWT secret 和宽松配置启动

- **优先级**：P0
- **状态**：确认存在
- **现状**：JWT secret 缺失时使用公开字符串；数据库配置也存在默认 root 连接。所有数字配置直接 `parseInt`，未校验 NaN、上下界或生产环境必填项。
- **证据**：`apps/yishan-api/src/config/index.ts:9` `secret: process.env.JWT_SECRET || 'your-secret-key-change-this-in-production'`；`:35` `url: process.env.DATABASE_URL || 'mysql://root:root@localhost:3306/yishan'`；`:17` `parseInt(process.env.JWT_ACCESS_TOKEN_EXPIRES_IN || '86400')` 无 NaN/上下界校验。
- **风险**：部署漏配环境变量时服务仍可启动，攻击者可用已知默认 secret 签发合法 JWT。非法 TTL 或端口会在运行中以难定位方式失败。
- **复现命令**：`NODE_ENV=production node dist/server.js` 在缺失所有环境变量时仍正常启动并监听 3000。
- **推荐修复方案**：增加启动期配置 schema，一次性解析并冻结配置；生产环境拒绝默认/短 secret、缺失数据库参数、非法端口和异常 TTL。开发默认值只放在 `.env.example` 或显式 development profile。
- **注意事项**：不要在校验错误中打印 secret 实值；FC3 的真实环境变量列表必须同步补齐 JWT、Redis 和存储配置。
- **验证方式**：生产模式分别缺失、使用默认、过短和非法数值启动，均应在监听端口前失败。
- **完成标准**：生产配置错误 fail-fast，错误信息只说明缺哪个配置，不泄漏值。

### QUALITY-002：架构检查是"成功退出的空实现"

- **优先级**：P0
- **状态**：确认存在
- **现状**：`scripts/arch/check-routes.mjs`、`scripts/arch/check-manifest.mjs`、`scripts/arch/check-boundaries.mjs` 各自只打印一行 `console.log('[arch] ... skipped')` 并以 0 退出。`scripts/arch/check-all.mjs` 只是顺序调用上面三个并传播退出码。CI 将 `pnpm arch:check` 作为 Architecture Guard。
- **复现命令**：`pnpm arch:check` 输出 `[arch] check-routes: no custom route guard configured, skipped` 等三行并以 0 退出（2026-07-13 实测）。
- **风险**：团队和贡献者会误认为边界、manifest、路由已经被机器校验，实际上所有违规都能通过。文档中的强约束因此只是约定。
- **推荐修复方案**：实现真实检查并配套反例 fixture：Core 禁止导入具体插件、插件只能导入公开 Core 契约、manifest 唯一性/兼容范围/权限/菜单路径校验、前后端插件路由映射、所有 admin 路由权限声明检查。
- **注意事项**：检查器必须对"扫描不到目标文件"失败，而不是静默通过；新增规则应先 report-only 清理存量，再切为 fail。
- **验证方式**：故意加入越界 import、重复 pluginId、缺 permission 和重复路由，CI 必须失败。
- **完成标准**：三个脚本有正反例测试，输出扫描数量，零扫描视为错误。

### API-DATA-001：已发布基础 migration 在历史基线中被修改

- **优先级**：P0
- **状态**：确认存在
- **现状**：`apps/yishan-api/drizzle/0000_initial.sql` 中包含 `sys_api_token` 表（第 646-664 行），该表是历史提交 `88a345e feat: add API tokens, profile page, Drizzle fix, sortBy standardization` 合入 0000 的结果。`git log --oneline --follow apps/yishan-api/drizzle/0000_initial.sql` 末两条为 `0a38bef feat(api): migrate from Prisma to Drizzle ORM` 与 `88a345e`，**没有任何 0000 之后的新提交再次修改该文件**，所以已部署环境如果在 88a345e 之前升级过，重新部署时会因 SHA-256 校验失败而无法继续。
- **证据**：`git log --follow apps/yishan-api/drizzle/0000_initial.sql`；`apps/yishan-api/scripts/migrate.ts` 的 applied hash 校验；本轮 5 个 commit `git diff c511c75..e5abe70 -- apps/yishan-api/drizzle/` 输出为空。
- **风险**：任何执行过 88a345e 之前版本的 0000 的环境都会在升级时直接失败；修改基础 migration 只对全新数据库有效。
- **推荐修复方案**：在不破坏线上已部署环境的前提下，最优路径是新增 `0003_*.sql` 把 `sys_api_token` 从 0000 拆出来（drop + create + 数据回填），并在 CI 同时跑空库全量安装和从 88a345e 之前快照升级两条路径，验证两条路径都能落地。
- **注意事项**：若线上已部署且包含业务数据，必须先做 schema diff 影响面分析（外键、索引、约束），不可直接 drop column。
- **验证方式**：分别用 88a345e 之前快照与空库升级到 HEAD，记录两边 migration 结果。
- **完成标准**：两条升级路径均成功；HEAD 不再把 88a345e 的改动留在 0000。

## 4. P1 问题：基座复制前应完成

### API-SEC-006：JWT access/refresh token 以明文存入数据库

- **优先级**：P1
- **状态**：确认存在
- **现状**：`sys_user_token` 表保留 `access_token VARCHAR(512)`、`refresh_token VARCHAR(512)` 两个明文长字段；`apps/yishan-api/src/core/repositories/user-token.repository.ts` 通过 `findByAccessToken` 等做完整字符串匹配。
- **证据**：`apps/yishan-api/drizzle/0000_initial.sql:223-241`；`apps/yishan-api/src/core/repositories/user-token.repository.ts`（`findByAccessToken`）。
- **风险**：DB 备份导出、SQL 注入或运维导出均会直接获得明文 Token；与 API Token 的"明文只展示一次 + DB 仅存 hash"做法不一致。
- **推荐修复方案**：access/refresh token 入库前用 SHA-256 hash（与 API Token 一致）；引入 session id（jti）作为主键定位，token 字符串只展示一次；历史存量数据需要迁移脚本。
- **验证方式**：DB dump 中已不存在明文 token；同 hash 仍能定位 session。
- **完成标准**：DB 中所有 token 字段均为不可逆 hash；revoke 仅依赖 hash 匹配。

### API-SEC-007：登录锁定配置未落地，也没有接口级限流

- **优先级**：P1
- **状态**：确认存在
- **现状**：`apps/yishan-api/src/config/index.ts:69-72` 定义 `maxFailedAttempts` / `lockoutDuration`，但全仓 `grep -E 'rate-limit|@fastify/rate-limit|rateLimit'` 全部无命中；登录失败计数仅写 `login_log`，不在 Redis 维护。
- **复现命令**：并发 1000 次错误登录同一账号，仅得到日志写入和错误响应，没有阻断。
- **推荐修复方案**：注册 `@fastify/rate-limit`，按 IP + username 双维度计数；锁定阈值与时长从 config 读取；锁定状态入 Redis 并设置 TTL。Redis 不可用时降级为内存 LRU + 告警。
- **验证方式**：连续错误登录触发 423 Locked；正常登录冷却后恢复；Redis 重启后状态可重建。
- **完成标准**：登录接口在阈值外返回 429 / 423；锁定 TTL 精确生效；降级路径有指标。

### API-SEC-008：API Token 没有 scope，写入未真正节流，默认继承用户全部权限

- **优先级**：P1
- **状态**：部分解决（每请求写库，scope 仍未加入）
- **现状**：
  - **写入未真正节流**：`apps/yishan-api/src/core/plugins/external/jwt-auth.ts:78-82` 用 `setImmediate(() => ApiTokenRepository.touch(...).catch(...))` 仅把同步 await 改为延后 fire-and-forget，每个 PAT 请求仍会触发一次 `update sys_api_token set last_used_at/last_used_ip` 写库。优化目标应是"时间窗口节流（例如 ≥30s 才写一次）"或"异步聚合写队列"。
  - **scope 仍未加入**：`apps/yishan-api/src/db/schema/tables.ts:695-714` `sysApiToken` 表仅有 `id/name/tokenHash/userId/expiresAt/lastUsedAt/lastUsedIp/createdAt/updatedAt/deletedAt/version`；`apps/yishan-api/src/core/services/api-token.service.ts:45-81` `createToken` 入参也只有 name/duration/expiresAt。
  - **用户权限全继承**：`apps/yishan-api/src/core/plugins/external/jwt-auth.ts:62` `currentUser = await UserService.getUserById(apiToken.userId)` 直接把完整用户信息挂到 `request.currentUser`，与 JWT 等价。
- **证据**：上列各行号。
- **风险**：被盗用的 PAT 与被盗用的用户密码等价，没有可独立撤销的细粒度授权；高频 PAT 调用也会放大单请求写库次数。
- **推荐修复方案**：
  1. 写库侧：增加内存 LRU + Redis 节流（同一 token 在 N 秒内只写一次），未命中窗口的请求聚合写最近一次时间/IP；token 撤销或 status 变更时同步刷新。
  2. 授权侧：在 `sys_api_token` 增加 `scopes JSON` / `permissions JSON` 列；`createToken` 入参接受可选 scopes，缺省取"创建者拥有的全部权限"并快照保存（防止后续角色降权后旧 token 仍享受旧权限）。jwt-auth 在 PAT 分支优先以 PAT 自身 scopes 覆盖用户 scopes。
- **验证方式**：高频 PAT 请求在窗口内只产生一次写；创建低权限 PAT 后访问受保护路由返回 403；role 降级后旧 PAT 不再越权。
- **完成标准**：PAT 的写库与权限范围均可独立控制，不受用户角色变动与单次请求粒度影响。

### API-SEC-009：HTTP 安全基线未形成统一配置

- **优先级**：P1
- **状态**：确认存在
- **现状**：`apps/yishan-api/src/core/plugins/external/` 当前仅注册 `database.ts / error-handler.ts / jwt-auth.ts / multipart.ts / redis.ts / schemas.ts / sensible.ts / static.ts / swagger.ts / typebox.ts`——`@fastify/cors`、`@fastify/helmet`、`@fastify/rate-limit` 三个安全插件即使在 `package.json`（仅 `@fastify/cors`）中也没有在源码注册；`apps/yishan-api/src/server.ts:39-48` 没有声明 `trustProxy`。
- **复现命令**：`curl -X OPTIONS -H "Origin: https://evil.com" -H "Access-Control-Request-Method: POST" http://127.0.0.1:3000/api/v1/auth/login`——无 CORS 头，但也没有显式 deny，行为依赖底层默认值。
- **推荐修复方案**：注册 helmet（默认开启 CSP/HSTS/X-Frame-Options）、注册 cors（按环境变量配置 allow-origin 白名单）、注册 rate-limit（按 IP 与路由分组）。`server.ts` 显式声明 `trustProxy: 1` 以使日志 IP 与限流 IP 与网关一致。
- **验证方式**：curl 验证响应头含 helmet 默认；OPTIONS 请求返回 CORS 白名单；高频请求触发 429。
- **完成标准**：基础安全头在所有响应一致；CORS 仅白名单域可跨域；公共接口具备限流基线。

### API-CONTRACT-001：路由契约和类型仍可被大量 `any` 绕过

- **优先级**：P1
- **状态**：确认存在
- **现状**：本轮 model → mapper/repository/service 重构未直接清理 `any`。当前残留：
  - `apps/yishan-api/src/core/services/plugin-manage.service.ts:185` `let plugin: any = null`
  - `apps/yishan-api/src/core/plugins/external/jwt-auth.ts:89` `} catch (jwtErr: any) {`
  - `apps/yishan-api/src/core/plugins/external/swagger.ts:44` `buildLocalReference: (json: any, baseUri: any, fragment, i)` —— 影响所有 OpenAPI 生成结果。
  - `apps/yishan-api/src/core/plugins/external/redis.ts:9` `let redisConfig: any = {}`
  - `apps/yishan-api/src/core/plugins/external/database.ts:296` `stats: any`
  - `apps/yishan-api/src/core/routes/api/v1/admin/system/qiniu/index.ts:44` `let cfg: any = {}`
  - `apps/yishan-api/src/core/routes/api/v1/admin/system/options/index.ts:153` `catch (err: any)`
  - `apps/yishan-api/src/core/routes/api/v1/admin/attachments/index.ts:462` `catch (error: any)`
  - `apps/yishan-api/src/core/routes/api/v1/app/menus/index.ts:62-63` `const flatten: any[]; const walk = (nodes: any[]) => {}`
  - `apps/yishan-api/src/core/schemas/common.ts:24` / `apps/yishan-api/src/plugins/modules/portal/schemas/common.ts:23` / `apps/yishan-api/src/plugins/modules/shop/schemas/common.ts:27` `const properties: any = {}` —— 动态构造 Type.Object 的辅助函数。
  - `apps/yishan-api/src/plugins/modules/portal/routes/v1/admin/articles/index.ts:373` 与 `pages/index.ts:250` `Body: { schema: any[] }`。
  - Admin `apps/yishan-admin/src/services/yishan-admin/` 中 27 个 `request<any>`（`shopSkus.ts`、`shopCategories.ts`、`shopAttributes.ts`、`system.ts` 等）。
- **风险**：错误响应形状偏离 OpenAPI；前端依赖生成的类型会与运行时不一致。
- **推荐修复方案**：catch 子句改 `unknown` + 守卫；swagger.ts 用 `TSchema`；schemas/common.ts 改 `Record<string, TSchema>`；Admin 生成代码加入 `generated/` 隔离，手写服务通过薄 adapter 使用。
- **验证方式**：CI `tsc --noEmit` 启用 `noImplicitAny` 后所有改动通过；生成的 OpenAPI 与运行时响应字段一致。
- **完成标准**：新增代码不允许 `any`；存量 `any` 在 ARCH/PLUGIN/PERF 重构中一并清理。

### API-CONTRACT-002：错误响应可能暴露内部 details，且缺少 request ID

- **优先级**：P1
- **状态**：确认存在
- **现状**：`apps/yishan-api/src/utils/response.ts:48-66` `ResponseUtil.error()` 仍把 `details` 直接放进 `error` 字段；`apps/yishan-api/src/core/plugins/external/error-handler.ts:97` requestId 只写入 `request.errorContext.requestId`，并未出现在响应体或响应头。响应 JSON 字段为 `success/code/message/data/error/timestamp`，无 `requestId`。
- **复现命令**：在 controller 中 `throw new BusinessError(..., '...', { sql: '...' })` —— `error` 字段会原样返回到客户端。
- **推荐修复方案**：error-handler 在响应侧删除 `error` 字段（保留日志侧）；新增 `requestId` 字段与同值 `X-Request-Id` 响应头，前端日志与后端日志可关联。
- **验证方式**：故意抛带 details 的错误，客户端拿不到 details；响应头包含 `X-Request-Id`。
- **完成标准**：details 仅服务端可见；requestId 在响应体与响应头一致。

### API-PLUGIN-001：插件启停不控制路由注册，状态与真实可用性不一致

- **优先级**：P1
- **状态**：确认存在
- **现状**：`apps/yishan-api/src/app.ts:25-60` 启动时无条件 `register/load/enable` 所有插件并自动 sync 菜单；`apps/yishan-api/src/plugins-runtime/lifecycle.ts:36-48` 提供 disable 方法，但全仓 `grep -E 'onDisable|disabled.*hook|disabled.*state'` 在路由/hook 层均无命中——管理接口 disable 只更新 `sysPluginInstall.enabled=false`，已注册的 Fastify 路由不会失效。
- **复现命令**：`POST /api/v1/admin/system/plugins/<id>/disable` 之后直接 `curl http://127.0.0.1:3000/api/v1/admin/<plugin>/...` 仍可访问。
- **推荐修复方案**：plugin lifecycle 引入"已注册但禁用"中间状态，路由注册前读取 `enabled`；启用 / 停用接口对应注册 / 注销；Fastify scope 隔离每个插件，禁用即注销整个 scope。
- **验证方式**：禁用后路由返回 404 或 503；启用后自动恢复。
- **完成标准**：disabled 状态与可访问性一致；状态变更不需重启。

### API-PLUGIN-002：manifest 权限仅用于说明和菜单，没有授权执行闭环

- **优先级**：P1
- **状态**：确认存在
- **现状**：`apps/yishan-api/src/plugins/modules/portal/manifest.ts` 与 `shop/manifest.ts` 都声明细粒度 permissions 数组；admin autohook 仍只跑 `authenticate`；route 中也没有 `permission: "..."` 声明。
- **风险**：plugin 的 manifest 权限与运行时权限完全脱钩，无法回答"这个 plugin 实际启用了哪些权限点"。
- **推荐修复方案**：admin autohook 增加 `permission` 解析与校验；每个 admin route 通过 `config.permission = "plugin:resource:action"` 声明；manifest 与权限清单做交叉校验（QUALITY-002 实现后接管）。
- **验证方式**：未授权用户调用带 permission 的路由返回 403；manifest 与路由权限一致。
- **完成标准**：每个 admin 路由都有显式 permission 声明；插件启停不影响该插件的 permission 清单。

### API-PLUGIN-003：启动阶段执行菜单写入并硬编码超级管理员角色

- **优先级**：P1
- **状态**：确认存在
- **现状**：`apps/yishan-api/src/app.ts:32-50` 仍执行 `new PluginMenuSyncService().syncPluginMenus(item.manifest, 1)`，失败仅 `fastify.log.warn`。`apps/yishan-api/src/core/services/plugin-menu-sync.service.ts` 全程直接 `drizzleDb`（10+ 处），无锁、无幂等键。
- **风险**：并发冷启动会产生菜单重复写入；硬编码 role 1 与 SEC-004 互相强化。
- **推荐修复方案**：移除启动期菜单写入，改为显式管理接口触发；service 内的 `drizzleDb` 调用迁到聚合 repository（参见 N1 API-ARCH-003）；幂等键 `(plugin_name + menu_key)` 防重。
- **验证方式**：同时启动两个实例验证不出现重复 menu；移除硬编码 role 1 仍可同步给超级管理员。
- **完成标准**：冷启动只读；菜单写入走管理接口或 job；角色不再依赖自增 ID。

### API-ARCH-001：Core/Plugin 边界与 ADR 不一致

- **优先级**：P1
- **状态**：确认存在
- **现状**：`apps/yishan-api/src/app.ts` 仍用 `readdirSync(plugins/modules)` 写死模块目录；插件内部 repository 仍直接 `import` `@/db`、`@/db/schema`（参见 N1 API-ARCH-003）。`docs/architecture/adr/ADR-0001-core-plugin-boundary.md:11` 仍写 Prisma（历史漂移）。
- **复现命令**：`grep -rn "from '@/db'" apps/yishan-api/src/plugins/modules/` 命中 13 处。
- **推荐修复方案**：plugin runtime 暴露显式 DB facade（`PluginDb`），不允许插件直接 import `@/db`；arch:check 加 import-boundary 规则。
- **验证方式**：故意写 `import { drizzleDb } from '@/db'` 在 plugin 内，arch:check 失败。
- **完成标准**：插件运行时只能通过受控 facade 访问 DB。

### API-DATA-002：DDL 没有数据库外键，引用完整性完全依赖应用代码

- **优先级**：P1
- **状态**：确认存在
- **现状**：`grep -c FOREIGN apps/yishan-api/drizzle/*.sql` 在 0000/0001/0002 三文件全部 = 0；`grep -cE '^[ ]*\`[a-z_]+_id\`' apps/yishan-api/drizzle/0000_initial.sql` = 124——124 个 `*_id` 列全部没有 FK 约束。生成器 `apps/yishan-api/scripts/generate-drizzle-schema.mjs:157-244` 仍以 `FK_MAP` + `SEMANTIC_RELATION_ALIAS` + `parent_id` 自指判断命名启发式推断关系（参见 N3 API-DATA-005）。
- **风险**：孤儿数据、跨模块迁移无从约束；关系图依赖运行时 join 而不是 schema。
- **推荐修复方案**：以 Drizzle `relations(...)` 关系声明为真源；schema 与 DB 元数据双向 diff；不依赖命名启发式。生产环境再考虑是否加物理 FK（高写入代价场景可选）。
- **验证方式**：故意在 DB 写入孤儿行，集成测试断言检测并告警；generator 输出与 Drizzle relations 一致。
- **完成标准**：所有声明的 relation 都有 Drizzle 端定义 + 命名一致；新增表无需手工登记 FK_MAP。

### API-DATA-003：数据库连接探测重复，状态信息不真实

- **优先级**：P1
- **状态**：确认存在
- **现状**：`apps/yishan-api/src/core/plugins/external/database.ts:138-187` 启动时依次跑 TCP probe、MariaDB driver probe、`pool.getConnection()` race、`dbManager.healthCheck()`；`apps/yishan-api/src/db/manager.ts:40-45` `getConnectionStatus()` 仍 hard-code `stats: { queryCount: 0, ... }`；`isConnected` 仅在 `connect()` 路径设为 true，启动路径不调用 `dbManager.connect()`。
- **风险**：`/api/v1/health/db` 的 `connected` 字段长期 `false`，但实际 SQL 已可执行；监控告警不可信。
- **推荐修复方案**：删除 hard-code 状态；统一从真实 `SELECT 1` 结果回填；删除冗余 probe，只保留一次 `dbManager.healthCheck()`。
- **验证方式**：kill 数据库后 health 接口返回 disconnected；恢复后立刻返回 connected。
- **完成标准**：health 接口与实际连接状态一致；启动探测 < 1 次连接失败循环。

### ADMIN-AUTH-001：Access/Refresh Token 存在 localStorage，XSS 后可直接窃取长期会话

- **优先级**：P1
- **状态**：确认存在
- **证据**：`apps/yishan-admin/src/utils/token.ts:35-46` 四处 `localStorage.setItem(TOKEN_KEYS.ACCESS_TOKEN, ...)` 等。
- **风险**：任何 XSS 漏洞（富文本、第三方依赖、JSON 注入）均能直接拿到长期 refresh token。
- **推荐修复方案**：access token 存内存 + httpOnly cookie 持有 session id；refresh token 仅存 httpOnly + SameSite=Strict cookie；前端通过 CSRF token 拉新 access。
- **验证方式**：DevTools 无法读取 token；XSS payload 拿不到 refresh；cookie flags 正确。
- **完成标准**：JavaScript 无法读取长期凭据。

### ADMIN-AUTH-002：并发 401 会触发多个 refresh，并通过整页 reload 恢复

- **优先级**：P1
- **状态**：确认存在
- **证据**：`apps/yishan-admin/src/requestErrorConfig.ts:76-104` 每次 401 独立调用 `apiRefreshToken`，没有 single-flight，也没有 promise 缓存。
- **复现命令**：DevTools Network 限制 Slow 3G 并发触发 10 个 GET——观察到 10 次 refresh 请求。
- **推荐修复方案**：实现单例 refresh promise；401 请求等待同一次刷新，成功后用新 access token 重放一次，失败统一清理会话。对 refresh 请求本身和已重试请求设置防循环标记。
- **注意事项**：服务端 refresh rotation 必须与客户端并发策略配套；非幂等请求重放要非常谨慎，需幂等键或不自动重放。
- **验证方式**：10 个并行 GET 过期、refresh 失败、网络断开、POST 401 和跨标签页场景测试。
- **完成标准**：同一时刻只有一个 refresh，请求可控恢复且不整页刷新。

### ADMIN-AUTH-003：菜单路径同时承担导航和页面权限，无法控制按钮级操作

- **优先级**：P1
- **状态**：确认存在
- **证据**：`apps/yishan-admin/src/access.ts:14-15` `canDo: (route: Route) => currentUser?.accessPath?.includes(route.path)`；`apps/yishan-api/src/core/routes/api/v1/auth/index.ts:107-111` `auth/me` 仍只返回 `accessPath` 数组，无 `permissions: string[]` 字段。
- **风险**：只能表达"能否进入页面"，不能表达读/写/审批/导出等动作。路径重命名会意外改变权限。
- **推荐修复方案**：`currentUser` 返回 `permissions: string[]`；Admin 提供 `can(permission)` 和 `<Can>` 组件。route access 使用页面 read permission，按钮使用动作 permission；菜单仍由后端授权树控制展示。
- **验证方式**：只读用户进入页面但看不到/不能调用写操作；路径变更不影响 permission。
- **完成标准**：路径与权限解耦，前后端使用相同 permission code。

### ADMIN-ARCH-001：静态路由、生成插件路由和后端菜单形成多重事实源

- **优先级**：P1
- **状态**：确认存在
- **证据**：`apps/yishan-admin/src/config/routes.ts`、`scripts/generate-plugin-routes.mjs`、`apps/yishan-admin/src/app.tsx:116-117` 模块级 `let extraRoutes`、`const clickableRoutePaths = new Set<string>()`；`patchClientRoutes({routes}: {routes: any[]})` 用 `any[]` 原地修改 Umi routes（行 277-291）。
- **风险**：任何一处缺失都会产生"菜单可见但页面 404""页面可直达但菜单不可见"或权限拒绝。
- **推荐修复方案**：明确唯一关系：前端 manifest 是可编译页面注册源，后端 manifest/权限是运行时导航授权源；构建时生成 route manifest，并在 CI 与后端菜单 key/path 做交叉校验。核心路由也使用同一结构化声明或纳入校验清单。
- **验证方式**：重复路径、后端独有路径、前端独有路径、动态参数和插件删除测试。
- **完成标准**：所有漂移在构建期失败。

### ADMIN-ARCH-002：手写 service 与 OpenAPI 生成 service 并存，类型持续漂移

- **优先级**：P1
- **状态**：部分变化（本轮 5ca1465 新增 api-token 手写 service）
- **证据**：`apps/yishan-admin/src/services/yishan-admin/` 中既有 `api-token.ts`（手写）又有 `shopSkus.ts`、`shopCategories.ts`、`shopAttributes.ts`、`system.ts`（自动生成 + 27 个 `request<any>`）。`api-token.ts:43` 直接手写 4 个端点。
- **风险**：重新运行 `max openapi` 可能覆盖手工修改；不运行生成则 API 变化无法传导。页面开发者不知道哪个 service 是权威入口。
- **推荐修复方案**：生成代码进入明确的 `generated/` 且禁止手改；业务侧通过薄 adapter 使用生成 client，仅处理 UI 需要的映射。CI 启动测试 API 导出 OpenAPI、重新生成并验证无 diff。
- **验证方式**：删除生成目录后可一键重建，Admin lint/build 无需手工补类型。
- **完成标准**：生成文件可随时删除重建，业务代码不导入不稳定内部类型。

### ADMIN-PERF-001：应用初始化存在串行请求瀑布

- **优先级**：P1
- **状态**：确认存在
- **证据**：`apps/yishan-admin/src/app.tsx` 启动阶段依次 `fetchUserInfo / fetchDictDataMap / fetchCloudStorageConfig`，无并行。
- **风险**：每个后台刷新都被多个 API RTT 累加；字典或存储配置失败会延迟基础布局。
- **推荐修复方案**：认证用户成功后，并行请求菜单、字典和必要配置；非首屏的存储配置按页面/上传组件懒加载并缓存。可以由 API 提供小型 bootstrap 聚合接口。
- **验证方式**：浏览器 waterfall、慢网和单接口失败测试；记录首屏可交互时间。
- **完成标准**：无依赖请求并行，非首屏数据不阻塞 Layout。

### QUALITY-003：CI 安装不可复现且质量门禁不完整

- **优先级**：P1
- **状态**：确认存在
- **现状**：`.github/workflows/yishan-fullstack-ci.yml:46` 仍 `pnpm install --no-frozen-lockfile --force --prod=false`；`setup-node@v4` 出现两次；CI 仍消费 `${{ secrets.YISHAN_API_DATABASE_* }}` 跑 `db:generate`；`.github/workflows/yishan-fullstack-cd-fc.yml` 仍由 `push: branches: [main]` 触发；Admin test 仍未在 CI 中。
- **风险**：同一提交在不同时间解析出不同依赖；PR CI 需要生产/共享数据库 secret；测试未通过或 CI 未完成时 CD 仍可能启动。
- **推荐修复方案**：使用固定 pnpm + `--frozen-lockfile`；合并 setup-node；schema 生成不连接数据库；Admin test 纳入 CI。部署改为 `workflow_run`/可复用 workflow 或环境 required checks。
- **验证方式**：无 secrets 的 fork PR 能完成 CI；修改 lockfile 不一致时失败；故意让 Admin test 失败时部署不触发。
- **完成标准**：同一 SHA 只有一个可追踪构建结果。

### QUALITY-004：API 测试全部 mock 数据库，缺少真实 migration/SQL 验证

- **优先级**：P1
- **状态**：确认存在
- **现状**：`apps/yishan-api/test/setup.ts:33-35` 仍 `vi.mock('../src/db/index.js')`、`vi.mock('../src/db/manager.js')`、`vi.mock('../src/db/client.js')`——所有 141 个测试跑在 mock 上。
- **风险**：生成 relation 错误、列类型不匹配、migration 无法升级、事务遗漏等问题可能在全部单测通过后才在部署环境出现。
- **推荐修复方案**：保留快速 mock 测试，新增独立 integration suite，使用临时 MySQL 容器执行全量 migration、seed 最小数据和关键 CRUD/事务。另增加从上一发布 migration 快照升级的测试。
- **验证方式**：故意制造错误列名、孤儿关系或 migration hash 变化，集成 CI 必须失败。
- **完成标准**：核心认证、RBAC、插件状态和至少一个业务插件在真实 MySQL 上有回归覆盖。

### QUALITY-005：Admin 存在 E2E 但未纳入 CI，依赖本地 API/Admin/种子数据

- **优先级**：P1
- **状态**：确认存在
- **现状**：`apps/yishan-admin/e2e/api-token.spec.ts`（Playwright）已落地，对应 `apps/yishan-api/e2e/api-token.sh` 阶段一契约；但 `.github/workflows/yishan-fullstack-ci.yml` 未运行 Playwright，本地执行依赖可用的 API 实例、Admin 静态资源和数据库种子数据。
- **风险**：动态菜单、401 refresh、403、API Token 和插件管理等高风险交互只能人工回归；CI 不跑 E2E 意味着 PR 无法阻断回归。
- **推荐修复方案**：优先测试行为而非快照：登录与重定向、权限页/按钮、单次 refresh、菜单加载失败、插件启停、API Token 明文一次性展示与撤销。再补构建后 Admin + API 的 Playwright 冒烟；CI 启动 headless 浏览器与种子 DB job；E2E 退出非零即 fail。
- **验证方式**：故意让 E2E 失败时 CI 失败；不依赖任何本地 3000 端口与未初始化数据。
- **完成标准**：关键安全和导航流程具备自动化回归，CI 必跑；Playwright 与阶段一 bash 契约一致。

### API-OPS-001：部署环境和构建产物缺少完整、可审计的发布契约

- **优先级**：P1
- **状态**：潜在风险
- **证据**：`.github/workflows/yishan-fullstack-cd-fc.yml:186` 仍跑 `bash ./deploy/fc3/pre-deploy.sh`，pre-deploy 步骤生成 `.env` 并复制到 dist；未发现 release manifest（commit / Admin hash / API hash / migration head / layer ARN）生成步骤；回滚 workflow 不存在。
- **风险**：事故时无法快速定位是哪一个构建产物；无法按 SHA 回滚。
- **推荐修复方案**：构建步骤生成 `release.json`，包含 commit、API build hash、Admin build hash、migration head、FC layer ARN；CD 仅接受此 manifest 部署；提供显式 rollback workflow。
- **完成标准**：每个生产部署都对应一个不可篡改的 manifest。

### N5. QUALITY-009：Fastify Ajv useDefaults 把字段默认值注入到 update 请求体（已修复）

- **优先级**：P1
- **状态**：本轮已修复（commit b83da1d / d92e7ef / 3b8aea5）
- **现状**：Fastify 默认 Ajv 校验器开启 `useDefaults:true`，会把 schema 中 `default` 的值注入到请求体。当 `UpdateXxxReq = Type.Partial(CreateXxxReq)` 时，CreateXxxReq 中 `Type.Optional` 字段上的 `default` 会被 Type.Partial 保留下来。例：`body={password:"X"}` 经过 Fastify 校验后变成 `body={password:"X", status:"1", sort_order:0, dataScope:"1"}`，导致 Service 层 update 时把未显式传入的字段全部重置为 schema 默认值。
- **本轮修复**：在 10 个 schema 文件（core 6 + portal 3 + shop 1）移除 `Type.Optional` 字段上的 `default`，保留字段为可选但不再注入默认值：
  - core（6）：`apps/yishan-api/src/core/schemas/{user,role,department,attachment,dict,menu}.ts`
  - portal（3）：`apps/yishan-api/src/plugins/modules/portal/schemas/{article,page,template}.ts`
  - shop（1）：`apps/yishan-api/src/plugins/modules/shop/schemas/shop.ts`
- **验证结果**（Restish 端到端）：user.update 改 password 后 status 保留原值；role.update 改 description 后 dataScope 保留原值；dept.update 改 description 后 sort_order 保留原值；attachment folder / dict type / menu 同上；create 兼容性未受影响（service 层用 `??` 显式赋默认值）。
- **完成标准**：保持——所有 schema 不再依赖 Ajv 注入默认；新 schema 模板加入"UpdateXxxReq 不允许 default"的检查（待 QUALITY-002 实现后接管）。

### N3. API-DATA-005：SQL→Drizzle schema 生成器用 FK_MAP + 表名前缀 + 字段命名启发式推断关系

- **优先级**：P1
- **状态**：本轮新发现，仍存在
- **现状**：`apps/yishan-api/scripts/generate-drizzle-schema.mjs:157-244` 用 `FK_MAP`、`SEMANTIC_RELATION_ALIAS`、`SKIP_FOR_RELATIONS`、`parent_id` 自指判断命名启发式推断关系。本轮新增 `apps/yishan-api/src/core/repositories/api-token.repository.ts` 能跑通，是因为 `sys_api_token.user_id` 已在 FK_MAP 中登记；下一次业务模块若新增 `*_id` 列但忘了登记，会出现"FK 静默丢失"。
- **复现命令**：在任一迁移添加 `` `random_thing_id` INTEGER NOT NULL `` 列，运行 `node scripts/generate-drizzle-schema.mjs`，relations.ts 不会出现 random_thing 表的 relation。
- **风险**：新业务字段容易被静默丢失关系；schema generator 与真源 SQL 语义存在差距。
- **推荐修复方案**：移除启发式关系推断；Drizzle relations 改为手工声明 + arch:check 强制覆盖。schema 真源应是受控、隔离数据库的 migration 执行结果（CI 拉起的临时 MySQL 跑完全量 migration 后做 introspection），不能直接读取生产 INFORMATION_SCHEMA——否则会把当前生产漂移（DDL 已与代码不一致）反向污染 generator 行为，并在生产审计时制造新的攻击面。
- **完成标准**：删除 FK_MAP；relations.ts 完全由显式声明驱动；新增 `*_id` 列时 generator 给出明确警告或拒绝；introspection 来源固定为隔离环境 migration 输出。

## 5. P2/P3 问题：长期治理

### QUALITY-006：workspace 版本基线分裂

- **优先级**：P2
- **状态**：确认存在
- **证据**：根 `package.json` 仅声明 `engines.node >=20`；CI/CD 固定 22.14；`apps/yishan-admin/package.json:3` `"type": "module"` 与 `"typescript": "^6.0.0"`；无 `.nvmrc`。
- **推荐修复方案**：根目录加入 `.nvmrc`、`engines.pnpm`；统一 TS 至稳定 major；CI 用 asdf 或 setup-node + cache。
- **完成标准**：本地与 CI 使用一致 node/pnpm/TS 版本。

### QUALITY-007：生成产物和临时目录进入源码树，清理规则不完整

- **优先级**：P2
- **状态**：确认存在
- **证据**：`apps/yishan-admin/src/.umi` 与 `.umi-production` 仍在源码树内；`apps/yishan-admin/src/.umi/core/route.tsx:7` 含 `import('@/pages/account/api-tokens/index.tsx')`，证明 .umi 已被 umi 实际写入源码树。
- **推荐修复方案**：根 `.gitignore` 与 `.dockerignore` 加入 `.umi*` / `dist/` / `node_modules/`；umirc 显式 `outputPath`；umirs 不提交。
- **完成标准**：仓库内无生成产物目录。

### N1. API-ARCH-003：service 层仍直接 drizzleDb 访问表，事务边界规范需保持

- **优先级**：P2
- **状态**：本轮新发现
- **现状**：本轮 commit `b83da1d refactor(core): 收尾剩余 service 层的规范化与 bug fix` 名义上"完成 core service 规范化"，但仍有 7 个 core service 直接 `import { drizzleDb }`：
  - `apps/yishan-api/src/core/services/auth.service.ts:13`（`update sysUser.lastLoginTime`）
  - `apps/yishan-api/src/core/services/dashboard.service.ts:3`（5 处 `drizzleDb.select(...).from(...)`）
  - `apps/yishan-api/src/core/services/region.service.ts:2`（4 处 drizzleDb 调用）
  - `apps/yishan-api/src/core/services/system.service.ts:6`
  - `apps/yishan-api/src/core/services/plugin-manage.service.ts:2`（3 处 drizzleDb）
  - `apps/yishan-api/src/core/services/plugin-menu-sync.service.ts:2`（10+ 处 drizzleDb.query.sysMenu.* 与 drizzleDb.insert/update sysMenu/sysPluginSyncLog）
  - `apps/yishan-api/src/core/services/user.service.ts:10`（5 处 drizzleDb 调用，含 `drizzleDb.transaction` 与 `drizzleDb.select`）
- 此外 `apps/yishan-api/src/plugins/modules/shop/services/order.service.ts`、`product.service.ts`、`sku.service.ts` 用 `drizzleDb.transaction(...)` 编排跨表业务（每个 service 文件 1-4 处）。
- **风险**：迁移到三层架构（service → repository → mapper → Drizzle）只覆盖了 model 删除部分；`drizzleDb.query.*`、`drizzleDb.select/insert/update` 的表访问散落在 service 内，违反既定 Repository 单一职责。Plugin 管理和菜单同步还混合数据访问、业务状态与审计写入。
- **注意——禁止改动事务归属**：根据 `apps/yishan-api/docs/后端代码架构规范.md` 与 `AGENTS.md:52,63`，Service 是事务边界（transaction owner）的合法持有者，`drizzleDb.transaction(...)` 编排应继续保留在 Service。整改目标是禁止 Service 直接对表执行查询/写入（含 `drizzleDb.query.*`、`drizzleDb.select/insert/update/delete`），而不是把已合法的事务编排迁入 Repository。
- **推荐修复方案**：把所有持久化操作收敛到聚合 Repository（region.repository / dashboard.repository / user.repository / plugin.repository / menu-sync.repository / order.repository 等），Repository 暴露以 `tx` 为入参的方法供 Service 在事务中复用；Service 仍保留 `drizzleDb.transaction(async (tx) => { const repo = new XxxRepository(tx); ... })` 形式。
- **完成标准**：core service 中 `grep -E "drizzleDb\.(query|select|insert|update|delete)"` 命中 0；`drizzleDb.transaction(` 仅出现在 Service 与 Repository 协作的边界，不出现在 Repository 内部。

### N2. API-CONTRACT-003：`any` 仍集中于 jwt-auth / 错误处理 / swagger / schema 构造

- **优先级**：P2
- **状态**：本轮新发现
- **现状**：迁移后仍有 key 残留 `any`：
  - `apps/yishan-api/src/core/services/auth.service.ts:143` `fastify.jwt.decode<{ id?: number }>(...)` —— 类型参数只能约束返回值类型，使用上仍不安全（已被 API-SEC-001 标记）。
  - `apps/yishan-api/src/core/plugins/external/jwt-auth.ts:89` `} catch (jwtErr: any) {`。
  - `apps/yishan-api/src/core/plugins/external/swagger.ts:44` `buildLocalReference: (json: any, baseUri: any, fragment, i)` —— OpenAPI refResolver 的任意类型签名影响所有 OpenAPI 生成结果。
  - `apps/yishan-api/src/core/schemas/common.ts:24`、portal/shop 的 `schemas/common.ts:23/27` 三处 `const properties: any = {}` 是动态构造 Type.Object 的辅助函数。
- **推荐修复方案**：jwtErr 改为 `unknown` + 守卫；swagger.ts 的 buildLocalReference 用 `unknown`/`TSchema`；schemas/common.ts 用 `Record<string, TSchema>`。
- **完成标准**：插件层与 schema 构造层 0 个 `any`；剩余 `any` 仅在业务边界并附理由注释。

### N4. QUALITY-008：test-generator 硬编码仅校验 0000-0002，CI 缺失对应门禁

- **优先级**：P2
- **状态**：本轮新发现
- **现状**：`apps/yishan-api/scripts/test-generator.mjs:55-59` 直接硬编码 `0000_initial.sql / 0001_portal.sql / 0002_shop.sql` 三个文件路径；本轮 commit `3b8aea5` 新增了 `0002_shop.sql`，但下一个 `0003_*.sql` 不会自动被 test-generator 覆盖；测试本身会改写受版本控制的 schema（generator 直接写入 `src/db/schema/*.ts`），CI 也未验证生成后无 diff。**当前 CI 完全没跑该脚本**（`.github/workflows/yishan-fullstack-ci.yml` 仅 `pnpm --filter yishan-api db:generate`，未调用 `db:generate:test`），属门禁缺失而非"测试覆盖不全"。
- **推荐修复方案**：动态枚举全部 migration；测试在隔离目录生成并执行 `git diff --exit-code` 验证无意外写入；CI 在隔离环境下跑而不是写回源码树；把 `pnpm --filter yishan-api db:generate:test` 纳入 CI 必跑门禁。
- **验证方式**：故意新增 `0003_test.sql` 含一张表，跑 `pnpm --filter yishan-api db:generate:test` 必须断言新表被处理；故意在 `src/db/schema/*.ts` 加一行，跑 generator 后必须失败；CI 必跑该脚本且非零退出即失败。
- **完成标准**：generator 测试覆盖所有迁移文件且无副作用；CI 必跑该脚本。

### N6. ShopOrderList 500 bug（已修复）

- **优先级**：P2
- **状态**：本轮已修复（commit 3b8aea5）
- **现状**：`ShopOrderMapper.toListResp()` 返回轻量结构，但 list 响应 schema 仍引用完整 `ShopOrderSchema`（要求 `addressId/address/items` 等必填字段），当订单表非空时 Fastify response schema 校验直接 500。
- **修复**：`apps/yishan-api/src/plugins/modules/shop/schemas/shop.ts:382-400` 新增 `ShopOrderListItemSchema`（`$id: "shopOrderListItem"`），仅包含 list 实际返回字段；`shopOrderListResp` 引用该轻量 schema；`shopOrderDetailResp` 保留引用完整 `ShopOrderSchema`。
- **验证结果**：`get-api-modules-shop-v1-admin-orders` → 200，detail 接口仍返回完整字段（Restish 端到端）。
- **完成标准**：保持——其他 list 接口若发现同样问题，按相同模式新增轻量 schema。

### ADMIN-ARCH-003：Admin 全局初始化和路由补丁使用大量 `any` 与模块级可变状态

- **优先级**：P2
- **状态**：确认存在
- **证据**：`apps/yishan-admin/src/app.tsx:116` `let extraRoutes: API.menuTreeList = [];`；`:117` `const clickableRoutePaths = new Set<string>();`；`:259-263` `resolveFirstPath((nodes: any[] = []) => ...)`、`pickFirst((list: any[] = []) => ...)`；`:277` `export function patchClientRoutes({ routes }: { routes: any[] })`。
- **推荐修复方案**：extraRoutes 与 clickableRoutePaths 移到 `useRef` 或 store；`patchClientRoutes` 改为不可变映射函数；类型用 `API.menuTreeList` 与 `MenuItem[]`。
- **完成标准**：app.tsx 中无 `any`；模块级可变状态仅用于配置常量。

### ADMIN-PERF-002：缺少 bundle 预算和重型能力按需加载治理

- **优先级**：P2
- **状态**：潜在风险
- **现状**：已有 `analyze`，但 CI 没有 bundle size budget；Admin 依赖 TipTap、Swagger UI、Ant Design/Pro 等重型包，是否按路由切分没有门禁。
- **推荐修复方案**：记录当前产物基线，对主入口和各异步 chunk 设置预算；富文本、Swagger、图表等按页面动态加载；避免不必要的 barrel import。对性能优化先测量再实施。
- **完成标准**：PR 可看到 bundle 差异，超预算需要显式批准。

### DOC-001：根 README 与现行架构严重漂移

- **优先级**：P2
- **状态**：确认存在
- **证据**：`README.md:17` "Fastify + Prisma + TypeBox + JWT"；`:59` "pnpm --filter yishan-api db:generate  # 生成 Prisma 客户端"；`:86` "ORM：Prisma 7"；`:118-121` 仍写 `prisma/schema/`、`src/core/models/ # Prisma 访问封装`。本轮唯一文档 commit 是 `e5abe70`（CLI 文档），未触及 README。
- **修复方案**：以 AGENTS、实际 package scripts、`drizzle/*.sql` 和 API README 为真源重写根 README；把"当前能力"和"路线图"分开。
- **注意事项**：不要在本次审计提交中顺手修 README，应独立提交，便于审阅事实变化。
- **完成标准**：新贡献者只按 README 可完成安装、迁移、启动、测试和部署前构建。

### DOC-002：ADR 与插件状态文档仍描述已经不存在的守卫

- **优先级**：P2
- **状态**：确认存在
- **证据**：`docs/architecture/adr/ADR-0001-core-plugin-boundary.md:11` "Fastify + Prisma"；`:46` `apps/yishan-api/prisma/**`；`:72` "禁止在插件内修改 Prisma 主 schema"。无 superseding ADR。插件状态文档 plugin-implementation-status.md 引用 Prisma 文件。
- **修复方案**：ADR 不覆盖历史决定，新增 superseding ADR 说明 Drizzle DDL 真源、编译时插件边界和 schema 扩展政策；插件状态文档重新按代码验证并标注日期/commit。
- **完成标准**：文档中的每个"已实现/强制"都能指向实际代码或 CI 检查。

### DOC-003：旧迁移修复指南会误导当前维护者

- **优先级**：P3
- **状态**：确认存在
- **证据**：根目录 `shop-migration-review-fixes.md`、`admin-shop-fix-guide.md`、`shop-plugin-migration-plan.md` 三个文件仍在仓库根目录，无 `archive/` 标记。
- **修复方案**：移动到 `docs/archive/` 或在文件顶部添加过期声明、适用 commit 和替代文档链接。不要直接删除仍有历史价值的决策记录。
- **完成标准**：根目录只保留当前入口文档，历史指南不会被误当作现行操作手册。

### DOC-004：API 文档宣称"完整验证/权限控制"，但缺少达成标准

- **优先级**：P2
- **状态**：确认存在
- **证据**：`apps/yishan-api/README.md:3` "使用 Prisma ORM"；`:9` "MySQL + Prisma ORM"；`:25-27` "prisma/" 目录；`:199` "Prisma ORM 类型安全"；`:275` 仍引用 prisma.io 文档。`AGENTS.md:61` 已改写为 Drizzle，但 README 与 AGENTS 不一致。
- **修复方案**：文档区分"能力存在""覆盖范围""强制门禁"；在路由/API 规范中明确 public/authenticated/permission 三类访问级别及 schema 最低要求。
- **完成标准**：文档不使用无法自动验证的"完整"表述，规范均有检查器对应。

### N7. CLI 文档迁移到 Restish（仅文档）

- **优先级**：P3
- **状态**：本轮新发现（仅文档变更）
- **现状**：commit `e5abe70 docs(api): CLI 文档迁移到 Restish OpenAPI CLI` 替换 `apps/yishan-api/docs/CLI使用说明.md`，移除所有 `pnpm --filter yishan-api cli` 引用，统一推荐 Restish + OpenAPI。未引入代码问题。
- **完成标准**：保持——后续如 CLI 工具变更需同步更新该文档。

## 6. 文档一致性清单

| 文档 | 当前不一致 | 建议处理 |
|---|---|---|
| 根 `README.md` | 后端 ORM、schema 路径和生成命令说明仍为 Prisma | 按 Drizzle 真源重写相关章节；独立 PR |
| `apps/yishan-api/README.md` | ORM 与目录结构仍写 Prisma；`完整权限/验证` 描述过满 | 按 Drizzle 重写；区分"能力存在""覆盖范围""强制门禁" |
| `ADR-0001` | Core/Plugin 边界仍以 Prisma 和理想化动态插件描述 | 新增 superseding ADR，不篡改历史决定 |
| `ADR-0002` | 兼容范围要求存在，但 runtime 尚未严格阻止不兼容插件 | 在文档中标注未达成并补运行时/CI 验证 |
| `ADR-0003` | 声称 hook 超时、重试、幂等和关键业务事件要求，需逐项复核实际覆盖 | 增加实现矩阵和缺口测试 |
| `plugin-implementation-status.md` | 引用 Prisma 文件和曾经的严格架构脚本；同文前后对冲突治理结论也有重复/矛盾 | 以 commit 为基线重新生成状态报告 |
| Shop 三份根目录指南 | 面向旧 Prisma 迁移阶段且部分问题已失效 | 归档并标注 superseded |
| `AGENTS.md` | 当前最接近真实实现，但 CI 列表与 workflow 仍需保持同步 | 由 CI 变更 PR 同步维护 |
| `YISHAN_API_ADMIN_AUDIT.md`（本文） | 任何修改须同步更新修复索引与摘要 | 由本文维护者保证 |

## 7. 建议修复顺序与依赖

1. 先处理 `API-SEC-001`、`API-SEC-002`、`API-DATA-001`，避免可直接利用的会话 DoS、日志泄密与升级失败。
2. 同一批完成 `API-SEC-003/004/005` 的最小安全闭环：资源权限、去角色 ID、生产配置 fail-fast。
3. 处理 `API-PLUGIN-001/002/003`：插件停用阻断路由、permission 真正执行、菜单同步不硬编码角色 1。
4. 实现真实架构检查（`QUALITY-002` + `API-ARCH-001` 收口），把 Core/Plugin 边界、`ARCH-003` service 收敛、`DATA-005` schema 生成器、`QUALITY-008` test-generator、`CONTRACT-003` schema 构造 `any` 一并由 arch:check 拦截。
5. 统一 HTTP/OpenAPI 契约并重新生成 Admin client，处理 `API-CONTRACT-001/002`、`ADMIN-ARCH-001/002`、`N5`（保持）、`N6`（保持）。
6. 修 Admin Token 存储与 refresh 并发、补 Admin 关键测试（`ADMIN-AUTH-001/002/003` + `QUALITY-005`）。
7. 增加真实 MySQL 集成测试、冻结 lockfile 和部署 required checks（`QUALITY-003/004` + `API-OPS-001`）。
8. 最后整理版本基线、性能预算及文档（`QUALITY-006/007`、`ADMIN-PERF-002`、`DOC-001/002/003/004`）；文档修订必须引用已经落地的代码和检查器。

## 8. 修复索引

> 状态列说明：`确认存在` = 当前代码可直接证明；`潜在风险` = 需结合实际网关/生产配置复核；`本轮新增` = 仅在 2026-07-13 基线首次列入台账。

| 编号 | 摘要 | 优先级 | 主要前置项 | 状态 |
|---|---|---:|---|---|
| API-SEC-001 | logout 信任未验签载荷并注销全部会话 | P0 | 无 | 确认存在 |
| API-SEC-002 | 错误日志泄漏请求体秘密 | P0 | 无 | 确认存在 |
| API-SEC-003 | Admin API 缺资源级授权 | P0 | 权限清单 | 确认存在 |
| API-SEC-004 | 管理员角色 ID 硬编码 | P0 | 角色 code/permission 设计 | 确认存在 |
| API-SEC-005 | 生产配置存在不安全兜底 | P0 | FC 环境变量清单 | 确认存在 |
| QUALITY-002 | 架构检查为空实现 | P0 | 边界规则确认 | 确认存在 |
| API-DATA-001 | 历史 0000 migration 包含 88a345e 的 API Token 表 | P0 | 确认已发布基线 | 确认存在 |
| API-SEC-006 | 用户 JWT 明文存库 | P1 | session/jti 设计 | 确认存在 |
| API-SEC-007 | 登录锁定未落地且无限流 | P1 | Redis 降级策略 | 确认存在 |
| API-SEC-008 | PAT 无 scope 且未真正节流 | P1 | API-SEC-003 | 部分解决（每请求写库） |
| API-SEC-009 | HTTP 安全基线不完整 | P1 | 网关/FC 行为确认 | 确认存在 |
| API-CONTRACT-001 | 契约被 `any` 绕过 | P1 | QUALITY-002 | 确认存在 |
| API-CONTRACT-002 | 错误 details 泄漏且无 requestId | P1 | API-SEC-002 | 确认存在 |
| API-PLUGIN-001 | 插件停用不阻断路由 | P1 | 插件启停语义确认 | 确认存在 |
| API-PLUGIN-002 | manifest 权限未执行 | P1 | API-SEC-003 | 确认存在 |
| API-PLUGIN-003 | 冷启动写菜单且硬编码角色 | P1 | API-SEC-004 | 确认存在 |
| API-ARCH-001 | Core/Plugin 边界与 ADR 不一致 | P1 | QUALITY-002 | 确认存在 |
| API-DATA-002 | DDL 无外键、关系靠启发式 | P1 | 孤儿数据审计 | 确认存在 |
| API-DATA-003 | DB 探测重复、状态虚假 | P1 | FC 连接预算 | 确认存在 |
| API-DATA-005 | schema 生成器正则启发式推断关系 | P1 | API-DATA-002 | 本轮新增 |
| QUALITY-009 | Ajv useDefaults 把字段默认值注入 update 请求 | P1 | — | 本轮新增（已修复） |
| ADMIN-AUTH-001 | 长期 Token 存 localStorage | P1 | cookie/CSRF 方案 | 确认存在 |
| ADMIN-AUTH-002 | 并发 401 重复 refresh | P1 | 服务端 rotation 语义 | 确认存在 |
| ADMIN-AUTH-003 | 菜单路径代替动作权限 | P1 | API-SEC-003 | 确认存在 |
| ADMIN-ARCH-001 | 路由/菜单多事实源 | P1 | QUALITY-002 | 确认存在 |
| ADMIN-ARCH-002 | 手写与生成 service 混用 | P1 | API-CONTRACT-001 | 部分变化（5ca1465 新增手写 api-token） |
| ADMIN-PERF-001 | 初始化请求瀑布 | P1 | bootstrap 数据依赖确认 | 确认存在 |
| QUALITY-003 | CI 不可复现且部署未硬依赖验证 | P1 | 无 | 确认存在 |
| QUALITY-004 | API 无真实数据库集成测试 | P1 | 测试 MySQL 环境 | 确认存在 |
| QUALITY-005 | Admin 无关键业务测试 | P1 | ADMIN-AUTH-002/003 | 确认存在 |
| API-OPS-001 | 发布产物/配置/回滚契约不完整 | P1 | FC 实际约束确认 | 潜在风险 |
| QUALITY-006 | Node/TS/类型版本基线分裂 | P2 | 当前构建稳定 | 确认存在 |
| QUALITY-007 | 临时生成目录污染源码树 | P2 | 生成物提交政策 | 确认存在 |
| QUALITY-008 | test-generator 硬编码 0000-0002，CI 缺门禁 | P2 | — | 本轮新增 |
| API-ARCH-003 | service 仍直接 drizzleDb 访问表（事务边界保留 Service） | P2 | API-ARCH-001 | 本轮新增 |
| API-CONTRACT-003 | `any` 仍集中于 jwt-auth/swagger/schema 构造 | P2 | API-CONTRACT-001 | 本轮新增 |
| ShopOrderList 500 | ShopOrderListItemSchema 修复 | P2 | — | 本轮新增（已修复） |
| ADMIN-ARCH-003 | 路由补丁 any 与模块可变状态 | P2 | ADMIN-ARCH-001 | 确认存在 |
| ADMIN-PERF-002 | 无 bundle 预算 | P2 | 性能基线 | 潜在风险 |
| DOC-001 | 根 README ORM 漂移 | P2 | 架构修复结果 | 确认存在 |
| DOC-002 | ADR/插件状态与代码漂移 | P2 | API-ARCH-001 | 确认存在 |
| DOC-003 | 旧迁移指南未归档 | P3 | 无 | 确认存在 |
| DOC-004 | API 能力描述缺少可验证边界 | P2 | 权限/契约检查落地 | 确认存在 |
| CLI 文档迁移 Restish | e5abe70 仅文档变更 | P3 | — | 本轮新增（已合入） |

## 9. 审计边界与待实测项

- 本次没有连接生产数据库、Redis、七牛、FC3 或实际域名，因此 CORS、可信代理、WAF、日志采集、备份恢复和告警只能根据仓库配置判断；修复相关问题前必须在目标环境复核。
- 没有执行会改动源码的 OpenAPI 生成、Drizzle schema 生成、formatter 或 migration。
- 当前工作区除本文档自身（`YISHAN_API_ADMIN_AUDIT.md`）外为干净（HEAD = e5abe70 与 origin/drizzle 一致）；本文所有结论可直接在主分支代码上验证。
- App、Docs 应用本身、TipTap 内部实现和业务正确性不在本次范围；仅在它们直接影响 API/Admin 构建或安全边界时提及。
- 本文不是渗透测试报告，也未覆盖供应链中所有 CVE；依赖安全需另行运行 SCA、secret scanning 和动态安全测试。
