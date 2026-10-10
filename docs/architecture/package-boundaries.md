# Package 边界

| Package | 职责 | 允许的 Yishan 依赖 |
|---|---|---|
| @yishan/core-contracts | 模块、身份、生命周期、扩展纯契约 | 无 |
| @yishan/core-database | 实例连接、通用数据库工具、迁移执行 | contracts 的必要类型 |
| @yishan/core-api | Fastify、错误/响应、公共插件、模块装配 | contracts |
| @yishan/core-system-api | sys_* 数据、身份认证、RBAC、系统业务/seed | api、database、contracts |
| @yishan/demo-api | 环境配置、资源实例、产品模块和扩展 | 四个 Core 包 |
| @yishan/core-admin | Admin 运行时、模块装配、Umi 构建插件 | contracts 的必要类型、公共前端共享包 |
| @yishan/core-system-admin | 系统管理页面与模块贡献 | core-admin、contracts 的必要类型、公共前端共享包 |
| @yishan/demo-admin | 产品配置、显式安装清单、业务页面和 API 客户端 | 两个 Admin Core 包、公共前端共享包 |
| @yishan/core-app | 私有 Source-First 请求/认证/Storage/env/hooks 实例工厂 | 无产品/API/Admin 依赖 |
| @yishan/ui | 公共移动 atoms/feedback 与原 Token/SCSS | Core 必要前端能力；无产品/API/Admin 依赖 |
| @yishan/demo-app | 产品 Taro 配置、页面、服务、模块与导航 | core-app、ui、demo-config |
| @yishan/demo-config | Demo 产品环境覆盖与配置 | 无 Core 反向依赖 |
| @yishan/tiptap | 独立 Rollup 可发布编辑器 | React/ReactDOM peers；无产品依赖 |

跨包仅使用 package.json exports；不能通过 ../ 或 private/src 访问。公开用户服务/目录、受控 seed 和 schema 类型不是私有仓储接口。System 的 `./schema` 用于应用组合数据库 schema，不授权业务模块读写系统表。模块通过自己的 repository 和公开用户目录完成身份展示。

禁止 Core 依赖 apps、System 反向进入产品、contracts 依赖框架或数据库运行时、产品间内部导入、模块间私有表/Service/Repository 导入及路由直接 SQL。System 自身保留 routes → services → repositories → db/schema，权限定义集中。

Admin Core 包直接通过公开 exports 提供源码，产品通过 Umi 编译它们；无需增加独立预构建层。`core-admin` 不反向依赖 `core-system-admin`，两个包均不依赖产品。Admin 不导入 API、System API 或数据库运行时。系统公共客户端归 System Admin，产品业务客户端归产品，生成入口按公开契约分区。共享配置只解析调用方默认值与环境覆盖，不拥有产品默认地址。业务 UI 继续位于 `apps/<product>/admin/src/modules/`，不为迁移而抽成空业务包。

`pnpm check:boundaries` 使用 TypeScript AST 识别 import/export/require/dynamic import，并结合 Workspace package manifest 和 exports 解析边界。`check-api-architecture.cjs` 保留后端规则，`check-admin-boundaries.mjs` 检查 Admin 源码、构建配置及 dependencies/devDependencies/peerDependencies/optionalDependencies；拒绝私有子路径、跨包相对路径、Core 反向产品依赖和跨产品依赖。Umi 生成目录和构建产物不参与源码检查，提交的生成客户端仍检查。`pnpm test:scripts` 包含故意违规的负面夹具；不使用新 baseline 排除项掩盖违规。其他命名与安装清单检查仍运行。

App checker 扫描 Core App/UI/TipTap 和 apps/<product>/app，检测产品反向依赖、跨产品、服务端/Admin 运行时、相对/绝对路径及公开 exports；覆盖字面量 TS/JS import/export/import type/import-equals、动态 import、require/require.resolve，以及 Sass/CSS use/forward/import（包括 url 字符串）。exports 条件/通配与 null 排除有正反向测试。计算式参数和变量/插值不解析，不能证明所有动态依赖安全；源码别名仅识别当前 `@/`，任意自定义 tsconfig alias 需要另行审查。源码 source exports 是公开契约，不允许绕过 exports 导入 src。

Core App 的注入与命名空间契约见 [Core App README](../../packages/core/app/README.md)。独立 npm 分发仅适用于 TipTap；Core App/UI 均 private，不要求 npm 发布。Taro installed-version 检查与实际 Windows 构建不能代替 Linux CI/微信真机验收。
