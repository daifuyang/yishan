# Package 边界

| Package | 职责 | 允许的 Yishan 依赖 |
|---|---|---|
| @yishan/core-contracts | 模块、身份、生命周期、扩展纯契约 | 无 |
| @yishan/core-database | 实例连接、通用数据库工具、迁移执行 | contracts 的必要类型 |
| @yishan/core-api | Fastify、错误/响应、公共插件、模块装配 | contracts |
| @yishan/core-system-api | sys_* 数据、身份认证、RBAC、系统业务/seed | api、database、contracts |
| @yishan/demo-api | 环境配置、资源实例、产品模块和扩展 | 四个 Core 包 |

跨包仅使用 package.json exports；不能通过 ../ 或 private/src 访问。公开用户服务/目录、受控 seed 和 schema 类型不是私有仓储接口。System 的 `./schema` 用于应用组合数据库 schema，不授权业务模块读写系统表。模块通过自己的 repository 和公开用户目录完成身份展示。

禁止 Core 依赖 apps、System 反向进入产品、contracts 依赖框架或数据库运行时、产品间内部导入、模块间私有表/Service/Repository 导入及路由直接 SQL。System 自身保留 routes → services → repositories → db/schema，权限定义集中。

`pnpm check:boundaries` 使用 TypeScript AST 识别 import/export/require/dynamic import，并结合 Workspace package manifest 和 exports 解析边界。`pnpm test:scripts` 包含故意违规的负面夹具；不使用新 baseline 排除项掩盖违规。其他命名与安装清单检查仍运行。
