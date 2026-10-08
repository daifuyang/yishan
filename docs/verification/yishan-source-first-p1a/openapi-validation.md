# P1-A3 OpenAPI 对比基线

## 1. 三类产物的区分

| 产物 | 位置 | 来源 | 在 P1-A 中的角色 |
|---|---|---|---|
| 实际运行路由 | `GET /api/docs/json`（运行中的 `dist/app.js`） | 运行时 | **真相**。由 `apps/yishan-api/scripts/dump-openapi-from-build.mjs` 以 CI 相同方式启动并导出（不设 NODE_ENV，因此含 2 个 `_dev` 路由） |
| 静态导出文件 | `apps/yishan-api/openapi.json` | 人工执行 dump 后提交 | Admin 客户端生成的输入；CI 要求与运行时一致 |
| 历史生成产物 | `apps/yishan-admin/src/services/generated/*` | `max openapi` 读取上面的静态文件 | CI 要求与静态文件重新生成的结果一致 |
| 行为基线 | `docs/verification/yishan-source-first-p0/evidence/openapi/main-6a5c62a-development.json` | P0 在 main 上的运行时导出 | 重构契约门禁的参照 |

main 原先没有 dump 脚本、没有漂移检查；`openapi.json` 与运行时有 27 处差异，而生成客户端又来自另一份更新的 spec（例如同时含 `appDashboardStatsDetail` 与 `appDashboardStats`，后者在已提交 spec 中不存在）。

## 2. 工具

`scripts/openapi-diff.mjs`（测试 `scripts/openapi-diff.test.mjs`，5 条）。按 `方法 + 路径` 比较，Schema 先展开本地 `$ref`（组件 Schema 的变化也会被发现），输出稳定排序的分类报告：

| 类别 | 含义 |
|---|---|
| `path-added` / `path-removed` | 路径整体增删 |
| `method-added` / `method-removed` | 既有路径上的 HTTP 方法增删 |
| `request-changed` | parameters / requestBody |
| `response-changed` | 状态码集合或任一响应 Schema（逐状态码给出指纹） |
| `security-changed` / `global-security-changed` | 操作级 / 文档级认证声明 |
| `operation-id-changed` | 会改变生成客户端函数名 |
| `metadata-changed` | tags / summary / description |
| `duplicate-operation-id` | 新出现的重复 operationId |

任何差异都以退出码 1 结束，除非在 `--allow` 文件中**逐项**列出（key + reason）；allow 文件中未被使用的条目同样失败，防止过期批准长期存在。没有“接受全部变化”的开关。

## 3. 执行结果

| 对比 | 命令 | 结果 |
|---|---|---|
| 工具自检 | `node scripts/openapi-diff.mjs <P0 main dev> <P0 main dev>` | 0 changes，退出码 0 |
| main 已提交 vs P0 运行时（修复前） | `node scripts/openapi-diff.mjs <修复前的 openapi.json> <P0 main dev>`（`evidence/openapi-committed-before-vs-after.txt`） | **28 changes，退出码 1**：`path-added`/`path-removed` 各 3（demo 路径缺少运行时实际注册的尾部斜杠）、`request-changed` 11（列表接口参数）、`security-changed` 8（health/login/refresh 应为 public 等）、`response-changed` 1（`/api/v1/system/token-stats`）、`operation-id-changed` 1（`appDashboardStatsDetail → appDashboardStats`）、`duplicate-operation-id` 1（运行时 `appDashboardStats` 被两个操作共用，N-04）。重复检测加入前的首次运行为 27 项 |
| P1-A 分支运行时 vs P0 main 运行时 | `node scripts/openapi-diff.mjs <P0 main dev> tmp/p1a/openapi/runtime-p1a-dev.json` | **0 changes / 106 ops，退出码 0** —— P1-A 未改变任何 API |
| 更新后的 `openapi.json` vs 运行时 | `pnpm check:openapi <runtime.json>` | 0 changes，退出码 0 |
| 更新后的 `openapi.json` vs P0 基线（带 allow） | `node scripts/openapi-diff.mjs <P0> apps/yishan-api/openapi.json --allow scripts/baselines/openapi-allowed-changes.json` | 0 changes，allow 为空，退出码 0 |
| main vs all（`--prefix api/v1`，参考） | `node scripts/openapi-diff.mjs <P0 main dev> <P0 all dev> --prefix api/v1` | 7 × `path-added`（`/api/v1/admin/enums*`），与 P0 结论一致 |
| 负向验证 | 删除 `openapi.json` 中 `/api/health` 后执行 `check:openapi` | `1 change(s) … 1 unapproved`，退出码 1（`tmp/p1a/logs/mutation-check.log`） |

## 4. 生成产物的更新（main）

依据：运行时导出与 P0 运行时基线完全一致（0 changes），且 main 运行时只有 Core 与 demo，不会引入任何业务路由。

- `apps/yishan-api/openapi.json`：替换为运行时导出内容，保持 main 原有的 2 空格缩进格式（diff 118+/13−）。注意：从 all 迁入的 `dump-openapi.mjs` 写出紧凑单行 JSON（all 的约定）；CI 只用它写临时文件并做语义比较，不受影响。
- `apps/yishan-admin/src/services/generated/*`：`pnpm --filter yishan-admin openapi` 重新生成。内容变化只有 3 个文件（其余文件仅为 Windows 工作区行尾差异，提交时由 git 归一）：
  - `demo.ts`：3 个 URL 增加尾部斜杠，与运行时注册的路由一致（`/api/demo/v1/todos/` 等）；
  - `typings.d.ts`：新增 `tokenCategoryStats`，`/system/token-stats` 响应类型与运行时一致；
  - `appDashboard.ts`：`appDashboardStatsDetail` 变为 `appDashboardStats2`——源于运行时存在重复 operationId（known-issues N-04）。Admin 源码中无任何调用（`grep` 确认），Admin lint/tsc/jest/build 在重新生成后全部通过。
- 未修改 API 实现、URL 或响应；未触碰 all 的 `openapi.json`。

## 5. CI 门禁

`yishan-fullstack-ci.yml` 中依次：迁移临时库 → `dump-openapi-from-build.mjs` → `pnpm check:openapi`（已提交 vs 运行时）→ “Runtime contract matches P0 baseline”（allow 文件逐项批准）→ “Generated admin client matches openapi.json”（重新生成后 `git diff --exit-code`）。任何一步失败都会使 CI 失败。

后续阶段（P1-B 起）若有意改变契约，必须把每一项变化写入 `scripts/baselines/openapi-allowed-changes.json` 并说明原因。
