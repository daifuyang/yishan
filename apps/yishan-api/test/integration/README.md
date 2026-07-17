# 集成测试（MySQL）

本目录保存需要真实 MySQL 数据库的端到端测试（Section 5）。每个测试使用独立 schema 隔离，避免与开发/生产数据库互相污染。

## 启用方式

集成测试默认 **不参与 CI**（避免 CI 没有 MySQL 时崩溃）。开发者本地使用时：

```bash
# 1. 启动本地 MySQL（可参考 docker-compose.mysql.yml 或初始化脚本）
# 2. 设置环境变量
export YISHAN_TEST_MYSQL_URL='mysql://root:root@localhost:3306/yishan_test'
export YISHAN_RUN_INTEGRATION=1

# 3. 跑测试
pnpm --filter yishan-api test:integration
```

或一次性环境变量前缀：

```bash
YISHAN_RUN_INTEGRATION=1 YISHAN_TEST_MYSQL_URL='mysql://root:root@localhost:3306/yishan_test' \
  pnpm --filter yishan-api test:integration
```

## 当前覆盖范围

| 文件 | 场景 |
| --- | --- |
| `rbac.test.ts` | 真实 DB 上的 `PermissionService.loadForRoleIds`：未知 role 返回空集；`invalidate()` 清空缓存后再次加载仍生效 |

> 其他 Section 5 计划中的场景（migration 启动、cookie 登录链路、密码变更事务、shop 订单事务、分页）尚未落地；`test:integration` 当前仅 `rbac.test.ts`，其余入口将随各自 PR 增补。

## 设计原则

- **隔离**：每个测试运行前 drop + recreate schema（`resetSchema()` 在测试体内显式调用）。
- **真实**：使用生产环境的 `mysql2` driver，而不是 mock；测试通过 `vi.doMock('@/db', ...)` 注入测试 DB client，使 `PermissionService` 等模块走真实库。
- **速率**：单测仍走 mock 路径，避免 CI 时延。
- **Skip 行为**：未设置 `YISHAN_RUN_INTEGRATION=1` 时 `setupIntegration()` 返回 `{ skip: true }`，`it.runIf(!ctx.skip)` 整体跳过。

> 配套脚本 `scripts/setup-test-mysql.sh`（待补）用于拉起临时 MySQL 容器。