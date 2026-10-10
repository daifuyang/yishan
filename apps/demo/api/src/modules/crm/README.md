# CRM 业务模块

CRM 保留客户、线索、联系人、跟进、公海、商机、产品、报价/分享/修订、合同、回款、拜访、工单与任务等既有后端实现。本次仅迁移与适配公共包边界，不改变销售业务规则；请求/响应以 `schemas/` 和 `routes/v1/` 为准。

`module.ts` 默认导出 `ApiModule<SystemRuntime>`：ID `crm`、前缀 `/api/crm`、表前缀 `crm_`、contractVersion 2，声明 System 版本依赖、路由注册、迁移与 seed。Demo 的 `src/manifest.ts` 默认不安装 CRM，与迁移前一致。运行时 `sys_module.enabled` 只控制已装配模块的流量。

## 目录与边界

```text
module.ts              公开模块定义
config/system-menu.json 模块菜单与权限引用
routes/v1/             请求校验、权限与 HTTP 响应
schemas/               TypeBox 请求/响应契约、集中权限定义
services/              业务编排
repositories/          本模块数据库查询
db/schema.ts           crm_* 表
domain/                业务状态
seed.ts                受控菜单与枚举贡献
drizzle/               已发布 SQL、journal、哈希兼容元数据
tests/                 业务回归与隔离集成用例
```

用户姓名与历史身份通过 System 公开 `userDirectory` 获取，不能导入 System 私有仓储或跨模块表。事务协调继续沿用注入/实例作用域能力；SQL 只在仓储执行。路由通过公开 registrar 声明权限与匿名策略，Core 不扫描函数名判断认证。

普通 seed 只补缺失声明，保留既有菜单、枚举、授权及软删除状态，不执行退役声明清理。产品在同一实例作用域中协调 System 与已安装业务 seed；首次创建的默认角色在业务贡献之后完成默认授权，重复执行不重置现有授权。

## 开发与测试

从仓库根目录运行：

```bash
pnpm build:api
pnpm --filter @yishan/demo-api exec vitest run src/modules/crm/tests
pnpm check:boundaries
pnpm check:migrations
```

新增迁移由对应 `drizzle.config.ts` 生成追加 SQL/journal；禁止改写 `0000_init.sql` 或其他已发布迁移。不要使用手工灌表或 `drizzle-kit migrate` 绕过应用的独立迁移账本调度。

**CRM 空库安装目前有既有历史冲突**：`0001_add-leads.sql` 已创建 conversion 字段，`0006_lead-conversion-links` 再次添加而失败，后续还有重复 DDL。44 份 SQL 中只有 34 份入 journal。不能在未解决历史基线前把 CRM 加入新产品的空库安装清单；不会自动改写 SQL、吞错或伪造已执行记录。quotation revision 并发数据库夹具仍有一个 skip，不计为通过。

具体证据与限制见根目录 `docs/architecture/api-migration-report.md`、`database-ownership.md`；模块注册方式见 `apps/docs/content/modules/onboarding.md`。Admin 页面/组件未随本次后端拆分迁移。
