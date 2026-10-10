# 业务模块接入

业务代码位于 `apps/<product>/api/src/modules/<id>/`。参考 Demo 中现有 demo、portal、shop、crm；只添加当前功能所需的文件。System 表与身份规则由 System API 所有，模块只操作自己的 `<id>_` 表。

## 定义与安装

```ts
import type { ApiModule } from '@yishan/core-api'
import type { SystemRuntime } from '@yishan/core-system-api'

const reportsModule: ApiModule<SystemRuntime> = {
  contractVersion: 2,
  id: 'reports', name: 'Reports', version: '1.0.0', tablePrefix: 'reports_',
  dependencies: [{ id: 'system', version: '^2.0.0' }],
  async register(router, runtime) {
    // 在模块自己的插件上下文注册路由；可以 AutoLoad 自己的 routes/。
    // 认证与权限使用平台 registrar 和 runtime 的公开能力。
  },
}
export default reportsModule
```

应用 `manifest.ts` 显式导入并导出安装清单，`app.ts` 使用 `createYishanApi({ modules: [systemModule, ...modules], ... })`。Core 不扫描应用目录。模块可以来自当前应用或另一个 Workspace Package，跨包仅允许正式 export。

ID 为小写字母、数字、下划线且不超过 24 字符；默认前缀 `/api/<id>`，可显式指定唯一前缀。启动检查定义、重复 ID/前缀、依赖缺失、循环、契约版本和 semver，按确定性拓扑排序装配。

## HTTP 与权限

使用 `@yishan/core-api/routes/route-registrar` 声明接口权限，沿用模块 `permissions.ts`。公开接口显式 `access: { public: true }`；受保护接口缺少认证/权限装饰器时拒绝注册。不要通过函数名推断认证。保留 TypeBox 请求、响应 envelope、状态码和业务码。

路由只负责校验和 HTTP 响应；Service 编排业务；Repository 查询模块自己的表。可通过 `@yishan/core-system-api` 的 `userDirectory` 获取公开身份资料，不能导入系统表、私有仓储或认证实现。

## 迁移、seed 和启停

模块的 `migrations` 声明唯一 ID、SQL/journal 资源目录及独立 `__drizzle_migrations_<id>` 表。目录定位基于模块自己的 `__dirname`，生产构建复制资源。历史 SQL/journal 不因移动改写。

生成新的迁移使用模块自己的 drizzle 配置；应用协调已安装清单的迁移与 seed：

```bash
pnpm --filter @yishan/demo-api db:migrate --check
pnpm --filter @yishan/demo-api db:migrate --dry-run
pnpm --filter @yishan/demo-api db:migrate --apply
pnpm db:seed
```

仅 `--apply` 允许写入迁移。缺少/未知参数失败，不默认执行。API 启动不迁移、不运行 seed。Seed 插入缺失记录，保留管理员已有密码和真实业务数据，菜单/枚举通过公开、校验 moduleId 所有权的贡献 API 注册。

安装清单是第一层开关，修改需重新构建部署。`sys_module.enabled` 是第二层流量开关；禁用返回 HTTP404 / code40400，普通未知路由为 code25005。未安装模块不注册路由、同步记录、seed、迁移或 OpenAPI。

## 扩展用户

参考 `apps/demo/api/src/extensions/`：通过公开用户目录取得基本资料，在 `demo_user_profile` 独立表存储产品资料；`UserExtension.validate` 在系统写入前验证，`onEvent` 接收创建/更新生命周期事件。系统事件失败处理由 runtime 配置，不能用扩展替换 JWT/RBAC。

编写必要单元/Inject 测试，运行 `pnpm test:api`、`pnpm check:boundaries`、`pnpm check:migrations` 和 `pnpm build:api`。真实数据库测试只在隔离 schema 中运行。

## Admin 页面接入

业务页面位于 `apps/<product>/admin/src/modules/<id>/pages/<page>/index.tsx`，菜单组件值沿用 `./modules/<id>/<page>`。产品 Admin 的显式安装清单声明模块与页面贡献；构建插件只生成已安装页面的组件映射。后端 `sys_menu.component` 选择该映射中的组件，不能安装前端代码。系统管理贡献来自 `@yishan/core-system-admin` 的公开 exports，通用装配来自 `@yishan/core-admin`。

产品业务客户端留在 `apps/<product>/admin/src/services/generated/`（`API`），系统公共客户端归 `packages/core/system-admin/src/services/generated/`（`SystemAPI`）。OpenAPI 变化时先 dump 并审查，再运行 `pnpm --filter @yishan/demo-admin openapi`；产品 Node 入口使用官方生成器，按当前同产品 API schema 与安装清单生成两类客户端，客户端与 typings 一起提交。未安装 CRM 的历史快照留在产品模块自己的 `src/modules/crm/services/generated/`（`CrmAPI`），保留源码不注册页面。保留已有权限、公开报价页面和菜单路径。先运行 `pnpm build:tiptap` 与 `pnpm --filter @yishan/demo-admin exec max setup`，再执行 `pnpm typecheck:admin`、`pnpm --filter @yishan/demo-admin lint`、`pnpm --filter @yishan/demo-admin test`、`pnpm build:admin` 和 `pnpm check:boundaries`。
