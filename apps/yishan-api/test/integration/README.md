# 集成测试（MySQL / Redis）

本目录保存需要真实 MySQL（以及 `app.e2e` 需要的 Redis）的集成测试。**只能指向一次性的测试实例**，不得指向开发、测试环境或生产数据库。

## 启用方式

CI（`yishan-fullstack-ci.yml`）使用工作流内的临时 MySQL/Redis 服务运行本目录。本地：

```bash
# 1. 启动一次性容器（tmpfs，停止即删除）
docker run -d --rm --name yishan-it-mysql --tmpfs /var/lib/mysql -e MYSQL_ROOT_PASSWORD=root -p 127.0.0.1:33306:3306 mysql:8.4
docker run -d --rm --name yishan-it-redis -p 127.0.0.1:36379:6379 redis:7-alpine

# 2. 运行（app.e2e 加载 dist/，因此 test:integration 会先 build:ts）
YISHAN_RUN_INTEGRATION=1 \
YISHAN_TEST_MYSQL_URL='mysql://root:root@127.0.0.1:33306/yishan_it' \
YISHAN_TEST_REDIS_URL='redis://127.0.0.1:36379/1' \
  pnpm test:integration          # 仓库根目录；等价于 build:ts + vitest run test/integration
```

未设置 `YISHAN_RUN_INTEGRATION=1` 时全部跳过（普通 `pnpm test` 不需要数据库）。

## 数据库隔离与迁移历史

- `YISHAN_TEST_MYSQL_URL` 只用于定位实例；每个测试文件新建一个随机命名的库 `<库名>_<随机后缀>`，结束时只删除该库（`_setup.ts#createTempDatabase`）。文件之间不共享库，可并行运行。
- 建表只按仓库记录的迁移历史（`_migrations.ts`）：只执行 journal 登记的条目（Core 的 `drizzle/meta` 已提交）。不会执行未登记的 SQL，也不吞掉任何建表错误。
- 执行使用 drizzle-orm 官方 migrator。`_migrations.ts#applyMigrations` 默认写共享的 `__drizzle_migrations`（用于复现旧机制与构造“已部署库”）；生产路径（每个模块独立历史表 + 核对）由 `src/scripts/lib/migration-streams.ts` 提供，`migration-streams.test.ts` 直接测试它。

## 当前覆盖范围

| 文件 | 场景 |
| --- | --- |
| `rbac.test.ts` | `PermissionService.loadForRoleIds`：未知 role 返回空集；`invalidate()` 后重新加载 |
| `pat-lifecycle.test.ts` | PAT 仓库：创建、scopes JSON、过期、撤销、touch、按用户列出 |
| `user.lifecycle.test.ts` | 用户字段持久化、部门/角色关联去重、软删除并撤销令牌 |
| `app.e2e.test.ts` | 启动 `dist/app.js` 全量装配：登录、JWT 会话（me/refresh/logout）、未登录 401、PAT scope 交集与撤销、无角色用户 403、禁用/锁定用户、模块启停 gate（40400）与重启后保持 |
| `module-migration.r01.test.ts` | P0 R-01 已修复：经生产迁移流（独立历史表）Core 先迁移后 demo 表存在；同时保留根因复现（共享历史表时 demo 仍被跳过）与对照组 |
| `migration-streams.test.ts` | Goal D：空库初始化与幂等、多模块任意顺序、失败不污染、静默跳过检测、结构核对、已部署库前置守卫、`sys_module_migration` 按模块记账、衔接（copy / repair / adopt / CRLF hash / needs-review）、CLI 退出码 |

## 设计原则

- **真实**：使用生产 `mysql2` driver；`rbac`/`pat-lifecycle`/`user.lifecycle` 通过 `vi.doMock('@/db', ...)` 注入测试库；`app.e2e` 以原生 `require` 加载构建产物，不经过 mock。
- **不改行为**：测试只通过 API 与只读查询验证；仅为构造前置状态直接更新测试库数据（如把用户置为禁用）。
- **已知缺陷不删除**：无法通过的场景以 `it.fails` 写出正确断言并注明阻断原因，而不是删掉测试。
