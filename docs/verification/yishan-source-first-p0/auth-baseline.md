# P0-5 认证与权限行为基线

本次未修改任何鉴权代码，未抽取 AuthProvider。

## 1. 机制层对 System 实现的依赖（P3 解耦基线）

| 文件 | 依赖 | 用途 |
|---|---|---|
| `core/plugins/external/jwt-auth.ts` | `UserService.getUserById`（`core/services/user.service.ts`） | JWT 会话与 PAT 两条路径都用它加载当前用户（`:123`、`:169`、`:225`、`:264`） |
| | `UserTokenRepository.findByAccessToken` / `findByRefreshToken`（`core/repositories/user-token.repository.ts`） | JWT 验签后校验会话是否仍有效（`:161`、`:255-256`）→ 登出即失效 |
| | `ApiTokenRepository.findByRawToken` / `touch` | PAT 识别（前缀 `yishan_pat_`）与最近使用记录（`:115`、`:143`、`:218`、`:241`） |
| | `SysUserResp`（`core/schemas/user.ts`） | `request.currentUser` 的类型（模块也读取该类型） |
| | `JWT_CONFIG`（`config/index.ts`）、`@fastify/jwt` | 验签配置 |
| | 业务码 `AuthErrorCode`/`UserErrorCode`/`ValidationErrorCode`、`BusinessError` | 错误语义 |
| `core/plugins/external/rbac.ts` | `PermissionService.loadForRoleIds`、`computeEffectivePerms`、`PermissionService.has`（`core/services/permission.service.ts`） | “权限来自角色” + PAT scope 交集 + `__super_admin__` 旁路 |
| | → `PermissionRepository`（`@/db` 的 `drizzleDb`；表 `sys_role`、`sys_role_permission`、`sys_user_role`） | 角色权限查询 |
| | `isBypassCode`、`PERMISSION_CODES`（`core/permissions/catalog.ts`） | 免登录码（含业务码 `crm:public-quote:view`）、权限目录 |

装饰器：`authenticate`、`softAuthenticate`（jwt-auth）、`requirePermission`（rbac）。`app.ts:97-105` 的 `onRoute` 按 **preHandler 函数名** `authenticate`/`softAuthenticate` 注入 OpenAPI `security`——替换实现时函数名必须保持，或先把 security 注入改到 route-registrar。

`BYPASS_CODES`：`auth:login`、`auth:refresh`、`app:auth:login`、`app:auth:refresh`、`system:cron`、`system:health`、`system:options:public`、`crm:public-quote:view`。

## 2. 运行时行为（真实启动 + 临时库，all 与 main 结果一致）

来源：`evidence/smoke/all-e4a08d3.json`（dev/pat/prod 阶段），`evidence/smoke/main-6a5c62a.json`。

| 行为 | 观测 |
|---|---|
| 登录成功 | `POST /api/v1/auth/login` → 200/10000，`data.token` + `refreshToken` |
| 密码错误 | 401/22007 |
| 未携带 token（Core 与模块路由） | 401/22001 |
| 非法 token | 401/22001（“访问令牌无效”） |
| `GET /api/v1/auth/me` | 200/10000；PAT 访问时还需要 scope 包含 `auth:profile` |
| Refresh | `POST /api/v1/auth/refresh`（body `refreshToken`）→ 200/10000，新 token 可用 |
| Logout | 200/10000；随后同一 access token → 401/22003（会话表校验） |
| App 端登录 | `POST /api/v1/app/auth/login` 匿名 200/10000（OpenAPI 未标为公开，见 api-contract.md §4） |
| 超管 | 种子用户 `admin` 拥有 `super_admin` 角色，可访问 Core 管理接口与模块接口 |
| PAT `scopes: []` | 创建成功；访问任何受保护接口 → 403/22002（含 `/auth/me`） |
| PAT `scopes: ['*']` / `['__super_admin__']`（超管） | 与超管 JWT 等价 |
| PAT `scopes: ['system:user:list']`（超管） | `admin/users` 200；`demo/todos` 与 `auth/me` 403/22002 → 超管旁路在受限 scope 下被剥离（与 `rbac.pat` 单测一致） |
| PAT 撤销 | 撤销后 → 401/22010 |
| PAT 授予模块权限 | 超管申请 `demo:todos:list` → 400/21001“不在您的授权范围内”。可授予范围 = 该用户角色在 `sys_role_permission` 中的权限 ∩ 活动目录；模块 seed 只写菜单与 `sys_menu_permission`，不给角色绑定权限，因此种子库中超管无法签发模块 scope 的 PAT（成因为源码推断，行为已实测） |
| `GET /api/v1/me/api-tokens/available-scopes` | **500/20001**（dev 与 prod、all 与 main 均如此）：`The value of 'availableScopeGroup#/properties/system' does not match schema definition.` 响应 Schema 把 `system` 限定为 `system|shop|portal|special`，而服务对其他 group（如模块、`module-management`）原样输出 group 名 |
| JWT 会话路径判定顺序（本次新增单测 `test/auth.jwt-session.baseline.test.ts`，7 条） | 无 token → 401/22001；cookie `yishan_at` 可替代 header；`refresh_token` 类型 → 401 TOKEN_INVALID；签名有效但 `sys_user_token` 无会话 → 401 TOKEN_INVALID；用户 status `"0"`（禁用）→ **HTTP 200**、`success:false`、code 30003；status `"2"`（锁定）→ 403 ACCOUNT_LOCKED（risks.md R-11） |
| JWT secret 门禁 | 单测 `jwt-secret-validator`（8）覆盖；探针使用强随机临时 secret，生产模式可启动 |

## 3. 已有测试覆盖（全部通过，见 test-results.md）

`auth.routes`（登录/登出/me/refresh）、`app.auth.routes`（App 匿名登录/刷新 + 受保护 me/logout）、`rbac.pat`（25 条 effective 权限组合，含超管旁路剥离、活动目录过滤）、`pat.lifecycle`（13，含“关联用户被禁用 → API_TOKEN_REVOKED”）、`me.api-tokens.routes`（12）、`api-token.service`（30）、`user.service`（20）、`auth.password-upgrade`、`jwt-secret-validator`。

缺口（P0 不补，记录供 P3 前处理）：
1. 以上测试均替换了 Service/Repository；“真实 DB + 完整插件链”的认证回归目前只有本次的启动探针。仓库已有的 `test/integration/{rbac,pat-lifecycle,user.lifecycle}` 因 M8 无法运行。
2. 用户状态检查（`jwt-auth.ts:80-131`）：PAT 路径由 `pat.lifecycle` 覆盖；JWT 会话路径此前无测试，本次以 `auth.jwt-session.baseline.test.ts` 补齐（真实 jwt-auth 插件与错误处理器，仅替换两个查询）。真实启动下未探测（需写入测试用户）。
3. 系统菜单权限关系（`sys_menu_permission` → 授权菜单树）只在 `admin.menus.routes` 单测中以 mock 覆盖。

## 4. P3 更换认证实现时的验收

- 单测：上述 9 个文件与 `auth.jwt-session.baseline.test.ts` 全部通过，不修改断言（R-11 若经人工决定修改，属于允许差异）。
- 探针：`node scripts/p0-compare.mjs smoke evidence/smoke/all-e4a08d3.json <new>.json` 中与 `login*`、`me-*`、`refresh`、`logout`、`pat-*`、`app-login`、`*-no-token` 有关的条目无差异（`available-scopes` 若在 P1 修复，属于允许差异）。
- OpenAPI：`p0-compare openapi` 中 security 列无变化。
