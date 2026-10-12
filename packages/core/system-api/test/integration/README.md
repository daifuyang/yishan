# 集成测试（MySQL）

本目录保留用户生命周期、PAT 生命周期和 RBAC 查询共 20 个真实 MySQL 测试。每个测试文件创建随机 schema，迁移完成后在自己的 SystemRuntime 中执行，结束时只删除该 schema。

## 启用方式

先启动仓库的本地开发 MySQL，构建 API 包，再执行独立集成命令：

```bash
docker compose -f infra/local-dev-stack.yml up -d mysql
pnpm build:api
pnpm --filter @yishan/core-system-api test:integration
```

运行全部数据库和产品集成验证：

```bash
pnpm test:integration
```

## 当前覆盖范围

| 文件 | 场景 |
| --- | --- |
| `user.lifecycle.test.ts` | 用户字段、关联去重和替换、软删除及令牌撤销 |
| `pat-lifecycle.test.ts` | 创建、读取、JSON scope、过期、撤销、使用记录、列表 |
| `rbac.test.ts` | 未知角色空权限；权限缓存失效后重新读取 |

Demo 产品的迁移、重复种子、Fastify Inject 认证和权限、用户扩展事件、模块开关及 OpenAPI 对比位于 `apps/demo/api/test/integration/product.test.ts`。

## 设计原则

- 连接只允许固定 loopback MySQL；密码从 `infra/local-dev-stack.yml` 读取，可由 `YISHAN_TEST_MYSQL_PASSWORD` 覆盖。
- 不接受 `YISHAN_TEST_MYSQL_URL`，不连接调用者指定的现有数据库。
- 使用公开迁移 API；DDL 出错直接失败，不吞掉已存在表等异常。
- 独立配置不加载单测 mock。普通单测命令排除本目录；`test:integration` 显式启用真实测试，连接失败会报错。
