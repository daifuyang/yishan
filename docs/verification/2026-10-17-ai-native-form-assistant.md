# AI 原生建号助手 —— 交付验证记录（2026-10-17）

范围：Task 10a（真实数据库集成测试、OpenAPI 与生成客户端、仓库级门禁、工程文档）。
Task 10b（**真实浏览器验收 A–H 与真实模型联调**）在本环境 **NOT RUN**，原因见第 3 节，
逐项「人必须观察到什么」列在第 3 节表格里。**本文件不含任何未经实测的浏览器结论。**

---

## 1. 真实数据库验证（已执行）

数据库：本机 MySQL 8.4.11（`infra/local-dev-stack.yml` 的本地实例）。每个测试运行一个
一次性库 `yishan_demo_test_<20 位随机十六进制>`，fixture 里带 `assertDisposable()` 拒绝
任何不匹配的库名；结束时 `DROP DATABASE`。**没有对任何业务库执行过迁移。**

| 命令 | 结果 |
|---|---|
| `pnpm build:api` | PASS |
| `pnpm --filter @yishan/demo-api test:integration` | **PASS — 2 files / 9 tests**（`ai-user-creation.test.ts` 8 项 + `product.test.ts` 1 项） |
| `pnpm --filter @yishan/core-system-api test:integration` | PASS — 5 files / 23 tests |
| `pnpm check:migrations` | PASS（需先 `pnpm build:api`；账本 `__drizzle_migrations_ai` 3 条迁移已登记） |

`ai-user-creation.test.ts` 实际覆盖（全部真打真实 HTTP 路由与真实 SQL，无内存锁替代数据库约束）：

1. 迁移连续跑两次仍成功（新迁移幂等），并断言模型工具链没有任何可写业务表的写能力。
2. 聊天文本里的「直接创建」和客户端伪造的 `confirmed: true` 都不产生用户；草稿 `form_data`
   的键集合严格等于 `['phone','realName','username']`——**密码从未落库**。
3. 并发：两个**独立 app 实例 / 独立数据库连接**同时提交同一草稿 →
   `Promise.all([submitFromAppA(), submitFromAppB()])`，两个请求都 200，
   `countUsersByTestPhone() === 1`、`completedResultId() === createdUserId()`、
   `successfulDraftAuditCount() === 1`；随后模拟响应丢失的重放仍返回**既有用户**，不是 409。
4. 回滚：注入会抛出的 `complete`，用户与草稿成功状态一并回滚（草稿非 `completed`、
   `result_ref` 为空）；再用裸连接 `START TRANSACTION` + INSERT 后 `destroy()` 证明连接
   中断时 InnoDB 回滚。
5. 版本冲突、已过期、已取消、`submitting` 中不可编辑。
6. 跨 owner 不可见；会话删除与提交竞争。
7. 提交时**重新校验**被授予角色的权限：草稿授权后把该角色**放宽**（不是清空），
   创建被拒绝（30011），无新用户，草稿转 `failed`。
8. 数据范围为「仅本人」的操作者被拒绝（工具侧与直接调用创建 API 两条路径都测）。

每一条失败路径都同时断言「没有新增用户」。

### 交付门禁发现并修复的三个真实缺陷

| 缺陷 | 现象 | 修复 |
|---|---|---|
| Drizzle JSON 列名 camelCase，迁移里是 snake_case | 每次草稿读写 SQL 报错 | 改 schema（`db/schema.ts`），不改迁移 |
| `@fastify/autoload` 把文件名也算进路由前缀 | 草稿端点全部 404 | `ignoreFilter` 跳过 `drafts.ts` + 显式 `prefix: '/v1'` |
| 重放读取用的是快照读 | 并发重放返回「已完成，用户已被删除」 | 事务内当前读 `FOR UPDATE`（`fetchUserDetail` 三处查询全部加锁） |

---

## 2. 生成契约与仓库门禁（已执行）

`pnpm --filter @yishan/demo-api openapi:dump` → `apps/demo/api/openapi.json`
（+2452/−44，含 `/api/ai/v1/conversations/{id}/drafts`、`/api/ai/v1/drafts/{draftId}`、
`/api/ai/v1/drafts/{draftId}/cancel`、`/api/v1/admin/users/create-form`、
`/api/v1/admin/users/create-options`，以及 `createUserReq.draftSubmission`）。

> 注意：`openapi:dump` 是向**运行中的**本地服务（:3100）拉取 spec，不是构建本地代码。
> 因此 dump 的内容取决于当时运行的服务是否已重启到当前代码。

`pnpm --filter @yishan/demo-admin openapi` 重新生成 System Admin 与 Demo Admin 客户端
（`getUserCreateForm` / `getUserCreateOptions` / `draftSubmission` / `userCreateFormResp` /
`userCreateOptionsResp` / `services/generated/ai.ts`）。**没有任何手工修补生成类型。**
临时的手写服务 `packages/core/system-admin/src/services/user-create-form.ts` 已删除，
`UserForm.tsx` 改用生成客户端（同一个端点不再有两份字段真相）。
`apps/demo/admin/src/modules/ai/services/actionDraftService.ts` 同样收缩为**生成客户端之上的薄适配**
（只拆信封 + 不含字段值的错误文案），草稿路径与响应结构不再手写第二遍；它依然**不导出任何创建方法**。
新增 `apps/demo/admin/tests/user-form-fallback-fields.test.ts`：直接读源码比对
`UserForm.fallbackEditableFields` 与服务端 `USER_CREATE_DRAFT_FIELD_KEYS`，防止兜底列表悄悄腐坏。

| 门禁命令 | 结果 |
|---|---|
| `pnpm --filter @yishan/demo-admin lint` | PASS（19 条既有 warning，0 error） |
| `pnpm typecheck:admin` | PASS |
| `pnpm --filter @yishan/demo-admin test` | PASS — 17 suites / 187 tests |
| `pnpm build:admin` | PASS |
| `pnpm test:api` | PASS — core/database 43、core/system-api 502、demo/api 266 |
| `pnpm check:boundaries` | PASS（api / product-manifest / module-naming / admin / app） |
| `pnpm check:migrations` | PASS |
| `pnpm lint` | PASS（exit 0；9 条既有 info 在 e2e 脚本里，非本次改动） |
| `pnpm test` | PASS（exit 0；此前记录的 TS2688 本次未复现） |
| `pnpm check:openapi` | PASS（**提交后**复跑：`openapi.json is in sync`） |
| `pnpm build` | 根全量构建：未运行（时间预算外）；本次触及的 `build:api`、`build:admin` 均 PASS |

**`pnpm check:openapi` 在提交前必然报红**：该脚本比较的是 `HEAD:` 里的 `openapi.json` 与
工作区版本，因此它对本任务自己的产物（新增 8 条路径）在提交前必然报「out of sync」。
提交 `ca53171` 之后复跑已通过（`openapi.json is in sync`）。

---

## 3. 真实浏览器验收 A–H —— **NOT RUN**

**原因**：本环境没有可驱动的真实浏览器，也没有可用的真实模型轮次（无 `AI_CHAT_API_KEY`
的真实对话）。计划明确禁止用测试替身冒充真实模型，因此这里不做任何推断，也不勾选。

标签 A–H 按设计文档；下列「必须观察」逐条对应设计的行为承诺，人按此执行并把结论补进本节。

| # | 场景 | 必须观察到什么 |
|---|---|---|
| A | 对话里说「帮我建一个用户 xxx」，助手回填**原生** `UserForm` | 点「继续填写」/自动打开的是系统原生的「新建用户」弹窗（不是聊天气泡里的表单）；字段值来自助手预填；**密码框为空** |
| B | 在聊天里说「直接创建吧」/「我确认了」 | **不产生任何用户**；助手最多更新草稿并再次请求人工确认 |
| C | 表单里手改字段后再回到对话 | 改动按字段合并 PATCH 回草稿；助手后续回复不会把手改覆盖回去；来源冲突时弹窗展示**旧值/新值**差异，由人点「确认覆盖」 |
| D | 同一个草稿双击「确定」/ 断网后重试 | 本地锁挡住第二次点击；网络异常只**读取**草稿状态并提示，**不自动重发**创建请求；重复提交不会建出第二个用户 |
| E | 关闭助手浮窗时表单正开着 | 表单内容保留、浮窗关闭不影响草稿；刷新页面后助手能**主动恢复**未完成的草稿并提示继续 |
| F | 浮窗与业务弹窗共存 | 浮层在 `ModalForm` 之上可用；焦点在关闭助手后归还给打开它的按钮；下拉/选择器不被浮层遮挡；键盘 Esc 与子弹层正常 |
| G | 页面切换 / 迟到结果 | 切到别的页面后，本轮迟到的自动导航/自动预填**不发生**；只有当前页面 + 当前实例的草稿才被自动套用 |
| H | 提交时权限已被回收 / 数据范围收窄为「仅本人」 | 「确定」被拒绝，**不产生用户**，界面明确说明是权限/范围问题而不是网络错误 |

附加手工场景（同样 NOT RUN）：手动先开弹窗后再唤起助手；助手常驻可唤起；焦点与下拉；
手改覆盖冲突；页面切换迟到结果；刷新主动恢复；关闭助手保留表单。

**记录要求**：每条都要记下真实的请求次数（尤其创建接口必须**恰好 1 次**）与真实用户 ID，
证据（截图/录屏）路径写在第 4 节。

---

## 4. 证据路径

- 集成测试：`apps/demo/api/test/integration/ai-user-creation.test.ts`、
  `apps/demo/api/test/integration/disposable-database.ts`（共享 fixture，无业务断言）
- OpenAPI 比对产物（测试运行时写入系统临时目录）：
  `%TEMP%/yishan-demo-runtime-openapi.json`、`%TEMP%/yishan-demo-openapi-diff.json`
- 浏览器证据：**暂无**（第 3 节未执行）

---

## 5. 未完成项与已知限制

1. **真实浏览器验收 A–H 与真实模型联调未执行**（第 3 节）——交付前必须由人补做。
2. `pnpm build`（根全量，含 docs / weapp / H5）本次未运行。
3. 错误码映射观察：草稿路由的业务错误经系统全局处理器映射后，
   `AiChatError(409)` 落到 `21001/400`，404 落到 `20001/500`（`ResourceErrorCode.NOT_FOUND`
   25005 并未注册成合法码）。语义正确但状态码不够干净，值得后续单独立项。
4. MySQL 会话时区与应用进程相差 8 小时，过期判断必须相对**已存储的**时间做比较，
   不能用 `NOW(3)` 推导（测试里据此设计）。
