# P0-3 API 契约基线

## 1. 快照来源

运行时 `GET /api/docs/json`（与 CI 的 `openapi:dump` 同源），由真实构建产物 + 临时 MySQL/Redis 启动后导出；**未覆盖仓库中的 `apps/yishan-api/openapi.json`**。

| 快照 | 运行模式 | paths | operations | 无 operationId | security：bearer / public / 未声明（继承全局） |
|---|---|---|---|---|---|
| [`openapi/all-e4a08d3-development.json`](evidence/openapi/all-e4a08d3-development.json) | `NODE_ENV=development`（与 CI 一致，CI 未设 NODE_ENV） | 99 | 167 | 54（portal 26、shop 28） | 162 / 3 / 2 |
| [`openapi/all-e4a08d3-production.json`](evidence/openapi/all-e4a08d3-production.json) | `production` | 97 | 165 | 54 | 160 / 3 / 2 |
| [`openapi/main-6a5c62a-development.json`](evidence/openapi/main-6a5c62a-development.json) | development | 71 | 106 | 0 | 101 / 3 / 2 |
| [`openapi/main-6a5c62a-production.json`](evidence/openapi/main-6a5c62a-production.json) | production | 69 | 104 | 0 | 99 / 3 / 2 |

逐操作契约表（方法+路径、operationId、tag、security、响应码、参数/请求体/响应 Schema 指纹）：[`evidence/contract/*.tsv`](evidence/contract/)。dev 与 prod 的差异恰好是 `_dev` 的 2 个路径（`/api/v1/admin/system/module-management/list/`、`…/toggle/{id}/toggle`）。

## 2. 前后对比方法（P1–P3 使用）

```bash
# 1) 构建并在隔离库启动后导出
node docs/verification/yishan-source-first-p0/scripts/api-baseline-probe.mjs <apiRoot> <tmpDbUrl> <tmpRedisUrl> <outDir> <label>
# 2) 契约对比（按 方法+路径 比较 operationId/tag/security/响应码/Schema 指纹）
node docs/verification/yishan-source-first-p0/scripts/p0-compare.mjs openapi \
  docs/verification/yishan-source-first-p0/evidence/openapi/all-e4a08d3-development.json <outDir>/openapi-runtime-<label>-development.json
# 3) 行为对比（按探针 id 比较 HTTP 状态 / 业务码 / 响应键）
node docs/verification/yishan-source-first-p0/scripts/p0-compare.mjs smoke \
  docs/verification/yishan-source-first-p0/evidence/smoke/all-e4a08d3.json <outDir>/smoke-<label>.json
```
差异即退出码 1。P1 预期会出现的差异（例如 PAT 分组、Swagger tag）应在 P1 报告中逐项列为“允许差异”。

## 3. 路径与模块前缀

| 前缀 | all ops | main ops |
|---|---|---|
| `/api/v1`（Core/System） | 106（dev） | 99（dev） |
| `/api/health` | 1 | 1 |
| `/api/demo` | 6 | 6 |
| `/api/portal` | 26 | — |
| `/api/shop` | 28 | — |

- 所有模块操作都位于 `/api/<moduleId>/…`，与 `moduleRoutePrefix` 一致；无模块使用 `/api/v1` 或其他前缀。
- Core 契约 main vs all：`p0-compare openapi` 显示 all 仅比 main **多 7 个 `/api/v1/admin/enums` 操作**（sys_enum，CRM 遗留），其余 Core 操作的 operationId、security、参数、响应 Schema 指纹一致。
- 模块响应形态不统一：demo/portal 列表直接返回 `{items,total}` / `{items,page,pageSize,total}`，**不使用** Core 的 `{success,code,message,data,timestamp}` 信封（探针 `demo-todos-admin`、`portal-categories-admin`）。

## 4. 公开与受保护接口

全局 `security: [{bearerAuth: []}]`。显式 `security: []`（公开）：`GET /api/health`、`POST /api/v1/auth/login`、`POST /api/v1/auth/refresh`。

**契约与运行时不一致**：`POST /api/v1/app/auth/login`、`POST /api/v1/app/auth/refresh` 未声明 security → 按 OpenAPI 规则继承全局 bearer；但运行时为匿名可用（探针 `app-login` 无 token 返回 200）。原因：`app.ts` 的 `onRoute` 只为带 `authenticate` preHandler 的路由注入 security，公开路由是否写 `security: []` 依赖各路由手写。

其余操作均为 bearer；运行时未携带 token → 401/22001（含模块路由）。

## 5. 统一响应与错误码（运行时观测）

信封：`{success, code, message, data, timestamp}`（Core 路由、404、模块禁用 gate、错误处理器）。HTTP 映射（`constants/business-codes/index.ts:130-155`）：10000→200；20xxx→500；21xxx→400；22xxx→401（显式映射优先，如 22002→403）；30000–32999→200；33xxx→400；其他→500。

| 场景 | HTTP | code | 探针 |
|---|---|---|---|
| 成功 | 200 | 10000 | `login-admin` 等 |
| 未知路由（含模块前缀下的未知路由） | 404 | 25005 | `unknown-route`、`unknown-module-route` |
| 模块被禁用（gate，先于鉴权执行） | 404 | 40400 | `demo-todos-when-disabled`、`demo-info-when-disabled`（无 token 亦为 40400） |
| 未登录 / token 无效 | 401 | 22001 | `me-no-token`、`me-bad-token` |
| 已登出的 access token | 401 | 22003 | `me-after-logout` |
| 用户名或密码错误 | 401 | 22007 | `login-bad-password` |
| PAT 不存在/已撤销 | 401 | 22010 | `pat-*-after-revoke` |
| 权限不足 | 403 | 22002 | `pat-empty-admin-users` |
| 参数校验失败 | 400 | 21001 | `pat-revoke`（`params/id must be integer`） |
| 响应序列化失败 | 500 | 20001 | `pat-available-scopes`（见 risks.md R-04） |

## 6. 仓库内 OpenAPI 文件与源码的一致性

| 对比 | 结果 |
|---|---|
| all 已提交 `apps/yishan-api/openapi.json` vs all 运行时（dev） | **不一致**：已提交文件含 **66 个 `/api/crm/*` 路径（103 个操作）**，运行时不存在（HEAD `e4a08d3` 将 crm `meta.enabled` 设为 false，但未重新 dump）；其余操作完全一致。CI “Verify OpenAPI spec is in sync” 在该提交上应失败（本地按相同比较逻辑得出；未在 GitHub Actions 上观察） |
| main 已提交 `openapi.json` vs main 运行时（dev） | **不一致**：26 处差异——缺少 demo 的 3 个操作；`/api/v1/auth/login|refresh` security 由继承变为 public；`GET /api/v1/app/dashboard/stats` operationId `appDashboardStatsDetail`→`appDashboardStats`；5 个列表接口参数指纹变化等。main CI 没有漂移检查 |
| Swagger 全局 tags（all，prod） | 已声明但无操作使用：`sysPosts`、`sysApps`、`sysAppResources`、`sysAppMenus`、`sysForms`、`crm`（硬编码于 `core/plugins/external/swagger.ts:34`）；已使用但未声明：`portal`、`shop`、`sysEnum`、`sysMenus`、`sysPositions`、`me-api-tokens`、`app-*` 等 18 个 |
