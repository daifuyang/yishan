# P1-A4 集成测试恢复

## 1. 修复前的问题（P0 R-05，及本轮在 main 上确认的装置缺陷）

旧 `test/integration/_setup.ts`：
1. 执行 `drizzle/` 下**全部** `*.sql`（不看 journal）——在 all 上因未登记的 `0010_create-sys-enum.sql` 重复建索引导致 3 个文件 0 用例执行（P0 实测）；
2. 吞掉 `already exists` 错误，掩盖重复或不完整的建表；
3. 所有测试文件共用 `YISHAN_TEST_MYSQL_URL` 指向的同一个库，vitest 并行时互相竞争（P0 观察到 `Duplicate key name 'idx_api_token_user_id'`）；
4. `resetSchema` 只删除硬编码的 15 张表；
5. 默认不在 CI 运行。

## 2. 修复内容（只改测试装置，不改产品代码、SQL、journal）

| 文件 | 变化 |
|---|---|
| `apps/yishan-api/test/integration/_migrations.ts`（新） | `resolveMigrationPlan`：有 journal 只取登记条目（缺 SQL 报错）；无 journal 时目录必须恰好 1 个 SQL（main 的 Core），多个则报“历史不明确”。`applyMigrations` 使用 drizzle-orm 官方 migrator（与 `drizzle-kit migrate` 同一实现）。无 journal 时仅在系统临时目录合成 journal，`when` 取当前时间，与 main CI 运行时 `db:generate` 的行为一致 |
| `apps/yishan-api/test/integration/_setup.ts` | 每个测试文件新建随机命名的库 `<库名>_<8位hex>`，结束只删除该库；不吞任何错误；`resetSchema` 清空本库全部表后重新迁移 |
| `apps/yishan-api/test/integration/app.e2e.test.ts`（新） | 以原生 `require` 启动构建产物 `dist/app.js`（autoload 以原生 `import()` 加载路由，无法在 Vitest 内启动 `src/app.ts`）；数据只来自 Core 迁移 + 种子中的管理员/系统角色/默认权限绑定（调用 `dist/scripts/seed/modules/*` 的真实函数），其余经 API 写入 |
| `apps/yishan-api/test/integration/module-migration.r01.test.ts`（新） | R-01 特征化测试，见 §4 |
| `apps/yishan-api/test/migration-plan.test.ts`（新，非 DB） | 证明装置不执行未登记 SQL、journal 缺文件报错、无 journal 时拒绝猜测顺序；仓库 Core/demo 历史可解析 |
| `apps/yishan-api/test/integration/README.md` | 更新启用方式、隔离方式与覆盖范围 |
| `.github/workflows/yishan-fullstack-ci.yml` | 新增 “API Integration Tests (disposable MySQL/Redis)” 步骤 |

`app.e2e` 中的测试专用配置（均有注释说明）：`LOGIN_RATELIMIT_PER_MIN=1000`（该文件多次登录；限流不在测试范围）；加载 dist 期间隐藏 `VITEST`/`VITEST_WORKER_ID`（否则 autoload 切换为 TS/ESM 加载模式，报 `missing secret`）；模拟重启时清空 dist 模块缓存（连接池为模块单例，`app.close()` 会关闭它）；启动后删除 Redis 键 `yishan:modules:enabled` 并在 `finally` 恢复 demo 启用（见 known-issues N-06——首次实现时一次失败运行遗留的禁用状态让下一次运行误报 404）。

## 3. 结果

环境：一次性容器 `mysql:8.4`（tmpfs）+ `redis:7.4-alpine`，标签 `purpose=yishan-p0-temp`，只绑定 127.0.0.1，`--rm`。

命令：
```bash
YISHAN_RUN_INTEGRATION=1 YISHAN_TEST_MYSQL_URL=mysql://root:<temp>@127.0.0.1:33797/yishan_it \
YISHAN_TEST_REDIS_URL=redis://127.0.0.1:36797/1 pnpm --filter yishan-api test:integration
```

| 文件 | 修复前（main，P0 装置） | 修复后 |
|---|---|---|
| `rbac.test.ts` | 未在 CI 运行；P0 在 all 上 setup 失败 | 2/2 通过 |
| `pat-lifecycle.test.ts` | 同上 | 16/16 通过 |
| `user.lifecycle.test.ts` | 同上 | 2/2 通过 |
| `app.e2e.test.ts` | 不存在 | 7/7 通过 |
| `module-migration.r01.test.ts` | 不存在 | 3/3（其中 1 条为 `it.fails`，即 R-01 按预期复现） |
| **合计** | 0 执行 | **5 文件 / 30 用例全部执行** |

稳定性：同一组临时容器上连续运行 2 次全量（`27 passed`，加入 R-01 文件后 `30 passed`），结束后 `SHOW DATABASES` 无残留 `yishan_it_*` 库。

### 覆盖到的行为（app.e2e，真实装配）

| 行为 | 断言 |
|---|---|
| 登录 | 错误密码 401/22007；正确密码 200，含 access + refresh token |
| JWT 会话 | `me` 200 → `refresh` 200 → 新 token `me` 200 → `logout` 200 → 再用 401/22003 |
| 未登录 | `/api/v1/auth/me`、`/api/v1/admin/users`、`/api/demo/v1/info` 均 401/22001 |
| PAT | `system:user:list` scope：`admin/users` 200、`auth/me` 403/22002；`scopes: []` → 403；撤销后 401/22010 |
| RBAC | 经 API 新建、无角色用户可登录，访问 `admin/users` 403/22002 |
| 用户禁用 / 锁定 | 已登录用户被置为 status `0` → `me` 返回 HTTP 200 + `{success:false, code:30003}`（现状，R-11）；status `2` → 403 |
| 模块启停 | dev toggle 禁用 demo → 404/40400，Core 健康检查不受影响；重新启动 app 后仍 40400；重新启用 → 200 |

## 4. R-01：BLOCKED BY R-01（未删除、未绕过）

`module-migration.r01.test.ts`：

- “core first, then demo”：第一步用官方 migrator 依次迁移 Core 与 demo，**必须无异常**且 `sys_user` 存在（普通断言）；第二步 `it.fails('BLOCKED BY R-01: demo_todos exists')` 只包含“demo 表存在”这一条断言——当前失败即通过；P4 修复后它会变红，提醒去掉 `it.fails`。
- 对照组：demo 先于 Core → `sys_user` 与 `demo_todos` 都存在。

因此集成测试中**没有任何依赖模块表的用例**被移除；`app.e2e` 的模块启停用 `GET /api/demo/v1/info`（不读数据库），与 R-01 无关。
