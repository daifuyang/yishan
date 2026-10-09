# API V2 架构

## Composition Root

`apps/demo/api/src/main.ts` 读取运行配置、构建应用、监听和处理退出。`app.ts` 创建 Database 与 System runtime，将显式 `manifest.ts` 清单交给 `createYishanApi`。所有资源归应用实例所有；import 不连接数据库、不校验部署环境、不启动服务。

```text
apps/demo/api
 ├─ core-api → core-contracts
 ├─ core-system-api → core-api / core-database / core-contracts
 ├─ core-database（连接与迁移，不拥有表）
 └─ core-contracts（纯类型，无平台运行时）
```

Fastify Core 拥有工厂、模块验证/排序/生命周期、权限目录、流量 gate 和公共插件。System 拥有用户、角色、部门、菜单、字典、权限、配置、日志、JWT/PAT 与 RBAC。产品拥有业务模块和扩展。没有空 CRM / Axis 应用、兼容旧入口或第二套 loader。

## 实例与上下文

Database、配置快照、权限目录、模块缓存、扩展监听均为实例对象。保留旧静态服务调用方式的 scoped facade 使用 AsyncLocalStorage，在装配、请求和关闭回调中传播明确 runtime；作用域之外访问失败，不存在默认数据库连接或全局可变应用实例。运行时公开目录只返回无密码的身份资料。

Core 先连接资源、初始化装饰器/插件，再同步已安装模块、挂载模块路由、ready、执行初始化。根请求 scope 与 gate 继承到模块路由；受保护路由预处理依次认证、权限校验。启动异常及正常关闭按逆序释放资源，即使某项关闭失败仍继续关闭其余项。

## 新产品

新增 `apps/crm/api` 或 `apps/axis/api`，声明四个 `workspace:*` Core 依赖和独立 tsconfig/package exports，建立自己的 main/config/app/manifest。配置自己的 MySQL 连接、Redis 命名空间、JWT 密钥和资源根目录。使用 `createDatabase`、`createSystemConfig`、`createSystemRuntime` 与 `createYishanApi` 组合；无需复制或修改 Core。

产品按需安装业务模块；不存在应用间内部源码依赖。公开模块契约不绑定磁盘位置，发布包可提供同样的 `ApiModule` 定义。两个真实编译 Fastify 实例的测试验证独立权限、缓存、认证密钥及关闭行为。

## 开发与部署

根命令 `pnpm dev:api` 支持 Core + Demo 源码变更后构建/重启。`pnpm build:api` 拓扑构建 CommonJS + declaration，正式 Node imports 由 package exports 解析，Demo 的包内 `@/` 由 tsc-alias 改写。生产包复制 JSON/SQL/journal，使用 pnpm production deploy 收集全部运行时依赖，不依赖开发机路径或 TypeScript paths。

使用 `pnpm typecheck:api`、`pnpm test:api`、`pnpm test:integration`、`pnpm check:boundaries`、`pnpm check:migrations`、`pnpm check:openapi`。FC3 不需要运行开发工具，不随启动迁移。数据库执行约束见 [数据库所有权](database-ownership.md)，实际验证与限制见 [迁移报告](api-migration-report.md)。

独立产物验证先运行 `pnpm build:api` 和 `pnpm build:admin`，再执行 `node scripts/package-api.mjs --output <external-temp-directory>`。`node scripts/verify-api-main.cjs --artifact <external-temp-directory>` 在 Node 22 下使用 loopback MySQL 随机隔离 schema 启动产物的真实 main，验证 HTTP、认证、文档、静态首页及优雅退出，并清理自身测试 schema。该验证需要本机测试 MySQL；不能指向产品或生产数据库。七牛 SDK 既有生产依赖包含 TypeScript 4.9，详见迁移报告的第三方限制。
