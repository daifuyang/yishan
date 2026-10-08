# P0-4 模块生命周期基线

实现：`apps/yishan-api/src/app.ts:54-108`（构造 loader → scan → sync → gate → onRoute → mount → notFound）与 `src/core/module-loader/module-loader.ts`。证据来源：单测 = `test/module-lifecycle.baseline.test.ts`（本次新增）、`test/module-loader.pack.test.ts`、`test/module-pack.test.ts`；探针 = `evidence/smoke/*.json`（真实启动、临时库）；DB = `evidence/db/*.log`。

| # | 行为 | 结果（all） | 证据 |
|---|---|---|---|
| 1 | 扫描模块 | PASS。扫 `src/modules/*`（存在时）或 `dist/modules/*`；每个模块优先 `dist/.../module.js`，否则回退导入 `module.ts`；结果按 id 排序 | 单测“mounts packed module routes…”；启动日志 `disk modules scanned` |
| 2 | 读取 meta | PASS。`id` 必需；`name` 缺省=id；`tablePrefix` 缺省=`<id>_`；`version` 缺省=`0.0.0`（现有模块均未声明 version）。**`meta.id` 格式未校验**，`Bad-Id` 会被接受 | 单测“current baseline: meta.id…”；`sys_module` 行 `version: 0.0.0` |
| 3 | 同步 `sys_module` | PASS。新模块 insert 且 `enabled=1`；已存在只 update `name/tablePrefix/version/updatedAt` | 单测 2 条；smoke 库 `sys_module` 3 行 |
| 4 | 挂载 `/api/<id>` | PASS。`@fastify/autoload` 以 `prefix=/api/<id>` 挂载 `routes/`；OpenAPI 中模块操作全部位于 `/api/<id>/` | 单测；探针 `demo-todos-admin` 200；api-contract.md §3 |
| 5 | `meta.enabled` 控制打包 | PASS。`gen-module-tsconfig.mjs` 不编译 crm；scan 跳过；onboard 跳过（`[onboard] 跳过 crm`）；Admin `plugin.ts` 跳过（未单独验证 Admin 侧） | `build:ts` 日志 `跳过 meta.enabled=false: crm`；单测；`s2b-seed-shim.log`。注意运行时 crm 实际是因 `module.ts` 在 CJS 下导入失败而被跳过（environment.md §6） |
| 6 | `sys_module.enabled` 控制运行时访问 | PASS。dev 路由 toggle 后立即生效（清 Redis + 进程内 memo） | 探针 `module-toggle-demo-off` → `demo-todos-when-disabled` |
| 7 | 禁用模块返回 404/40400 | PASS。`404 {success:false, code:40400, message:"模块未启用：demo", data:null, timestamp}`；gate 在 `onRequest`，**先于鉴权**，未登录请求同样得到 40400；Core 路由不受影响 | 探针 `demo-todos-when-disabled`、`demo-info-when-disabled`、`core-health-when-demo-disabled` |
| 8 | 重启不覆盖运行时开关 | PASS。禁用 demo → 停止 → 重新启动（再次 sync）→ 仍为 40400；重新启用后 200 | 探针 `demo-todos-after-restart (still disabled?)`；单测“sync never writes enabled” |
| 9 | 开发专用接口不出现在生产 | PASS。`NODE_ENV=production`：module-management list/toggle → 404/25005；OpenAPI 少 2 个 `_dev` 路径。开发模式（含 CI，CI 未设置 NODE_ENV）会暴露这两个接口，并进入已提交的 `openapi.json` | 探针 `dev-module-list (prod)`、`dev-module-toggle (prod)`；api-contract.md §1 |
| 10 | 模块移除后 Core 正常启动 | PASS（API 侧）。无模块安装可启动；main（仅 demo）可完整启动与通过同一组探针。**Admin 侧未验证**：`services/generated/index.ts` 静态引用全部模块客户端（V2 §4.2），删除模块目录后的 Admin 构建未测试 | 单测“an install with no modules…”；`evidence/smoke/main-6a5c62a.json` |

## 其它观测

- 模块路由下的未知路径返回 404/25005（不是 40400），即 gate 只认“模块 id 是否已挂载”。
- 运行时扫描、同步、挂载都不依赖模块迁移是否执行：模块表缺失时模块仍被挂载、`sys_module` 仍显示启用（见 database-migration-audit.md S2b），请求会在查询时失败。
- 模块入驻的唯一编排入口 `db:seed` → `onboard-modules` 当前不可用（O1）；模块迁移、模块菜单 seed 和首次 `sys_module` 同步需要依赖 API 启动时的 sync 或人工执行。

## P1–P3 回归要求

`test/module-lifecycle.baseline.test.ts` 与探针中 `module-*`、`demo-*`、`dev-module-*`、`*-after-restart` 的结果须保持不变；P1 若引入 `meta.id` 校验，只允许“meta.id format is not validated”一条按设计改变。
