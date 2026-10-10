# Demo 模块

`apps/demo/api/src/modules/demo` 是真实模块参考：Todo CRUD、运行状态、菜单声明和模块独立迁移。用户扩展位于产品 `src/extensions`，使用 `demo_user_profile` 独立表、受控校验和系统领域事件。

`module.ts` 默认导出 `ApiModule<SystemRuntime>`，明确 contractVersion 2、元数据、System 依赖、路由注册、迁移资源和 seed。应用 `src/manifest.ts` 决定安装；数据库 `sys_module.enabled` 只控制已安装模块流量。

模块保留 routes → services → repositories → db/schema 分层。Repository 使用明确应用作用域内的数据库 facade；没有默认全局连接。权限 registrar 注册显式权限 schema 和认证 guard。菜单通过 System 公开 seed 贡献 API 写入，地区页面对既有 System region 权限使用显式受控引用。

| HTTP 路径 | 功能 |
|---|---|
| GET /api/demo/v1/info | 运行状态 |
| GET /api/demo/v1/todos | Todo 列表 |
| GET /api/demo/v1/todos/:id | Todo 详情 |
| POST /api/demo/v1/todos | 创建 Todo |
| PATCH /api/demo/v1/todos/:id | 更新 Todo |
| DELETE /api/demo/v1/todos/:id | 删除 Todo |
| GET /api/demo/v1/me/profile | 产品扩展资料与公开用户身份 |

接口保留 TypeBox 校验、业务响应 envelope 和权限规则。Swagger `/api/docs` 根据已注册路由生成，不要求 Core 硬编码具体产品 tag。

```bash
pnpm build:api
pnpm --filter @yishan/demo-api test src/modules/demo/tests
pnpm --filter @yishan/demo-api db:migrate --check
pnpm --filter @yishan/demo-api db:migrate --dry-run
pnpm --filter @yishan/demo-api db:migrate --apply
pnpm db:seed
pnpm dev:api
```

添加模块步骤和数据库安全约束见仓库 `apps/docs/content/modules/onboarding.md`。不修改历史 SQL，不使用 boot-time seed/reset。
