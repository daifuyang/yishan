# Admin V2 产品化迁移报告

状态：**PASS WITH RESTRICTIONS**

分支：`refactor/admin-v2-product-first`，基于 `refactor/api-v2-product-first` 的 `684e4f3`。本次未部署、未上传七牛、未写生产数据库、未推送或创建 PR。

## 目录与迁移

迁移前的 `apps/yishan-admin` 已完整移动为唯一 Demo Admin：

```text
apps/demo/
├── api/
└── admin/
    ├── config/
    ├── e2e/
    ├── mock/
    ├── public/
    ├── scripts/
    ├── src/
    ├── tests/
    └── package.json          # @yishan/demo-admin
packages/core/
├── admin/                    # @yishan/core-admin
└── system-admin/             # @yishan/core-system-admin
```

配置、Umi 插件、静态资源、国际化、测试、OpenAPI 客户端、CRM 公开报价入口和隐藏配置均已迁移；旧目录不再存在于工作树。Workspace 现在只识别 `@yishan/demo-admin`。

## 所有权边界

`@yishan/core-admin` 提供菜单树转换、无 path 目录展开、组件解析缓存、公共路径、token、权限纯函数、请求信封工具、Manifest 静态解析、OpenAPI 分区和 Umi 构建插件。

`@yishan/core-system-admin` 提供 12 个 System 页面、System 生成客户端、上传和附件控件、Region/Dept 等共享控件、稳定的认证与附件类型，以及 `SystemAdminProvider`。页面不读取 Demo 私有 alias 或 Umi model；运行时依赖由产品 Provider 注入。

`apps/demo/admin` 保留产品运行时组合、登录、布局、Header、主题、System runtime bridge、产品页面和 Demo/Portal/Shop 客户端。CRM 源码及生成客户端保留，但因 API Manifest 未安装 CRM，不进入 Demo 构建或运行时菜单。

本轮没有把仍依赖产品上下文的完整登录/布局强行下沉到公共包，也没有引入微前端、Module Federation 或第二套路由框架。公共包使用公开 exports，边界检查拒绝私有子路径、相对跨包导入、Core 反向依赖产品和跨产品依赖。

## 动态模块装配

`apps/demo/admin/plugin.ts` 通过 `@yishan/core-admin/umi-plugin` 解析同级 `../api/src/manifest.ts`。解析只读取静态模块描述，不执行 API 源码、不连接数据库。插件生成明确的 `import()` registry：框架页、`@yishan/core-system-admin` 的 `./system/*` 页面和 API Manifest 中已安装模块的 `./modules/<id>/*` 页面。

后端 `sys_menu.component` 协议保持不变。运行时同时应用三道门：编译期安装模块、`app/auth/capabilities` 返回的启用模块、当前用户授权菜单。未安装或未启用模块的菜单会被过滤并清理空目录；解析不到组件的内部菜单也不会注册；外链和已授权 System 页面仍保留。按钮权限来自 capabilities，保存个人资料时会保留权限集合。

## OpenAPI 与生成客户端

`apps/demo/admin/scripts/generate-openapi.cjs` 仍复用 `@umijs/openapi`。同一个 `apps/demo/api/openapi.json` 被分区为：`/api/v1/` → System Admin 的 `SystemAPI`，Manifest 中已安装的 `/api/<module>/` → Demo 的 `API`；CRM 生成文件留在其产品目录。分区保留 inline schemas、传递引用、根级和 operation-level security schemes。

生成命令为：

```bash
pnpm --filter @yishan/demo-admin openapi
```

重复生成后 31 个客户端文件字节稳定；CI 会重新生成并拒绝 tracked/untracked drift。生成客户端不把 API 服务端源码带入浏览器。

## 命令、代理与部署

根脚本已对称指向 Demo：`dev:api`、`dev:admin`、`build:api`、`build:admin`、`typecheck:admin`、`test:api` 和 `check:boundaries`。Demo Admin 通过 `apps/demo/config` 的公开包 `@yishan/demo-config` 解析 `API_TARGET`、`YISHAN_API_TARGET`、`YISHAN_API_PORT` 配置代理，产品自己拥有 localhost 默认值。此包供 Demo Admin 与配套小程序使用，其他产品拥有自己的配置，Core 不依赖产品配置。

`PUBLIC_PATH=/admin/` 保持支持。CI/CD 的路径过滤、FC Admin 源目录和包产物均改为 `apps/demo/admin/dist`；线上 `/admin/`、API 路径、七牛 key 和站点 URL 没有改变。开发启动器支持 `ADMIN_PORT` 优先于 `PORT`。Workflow 只修改源码和验证步骤，本次没有触发部署。

## 验证结果

在 Node `22.22.1`、pnpm `8.15.9` 下执行：

- `pnpm install --frozen-lockfile`：通过；依赖 snapshot 未重解析，只增加公共包 Biome importer。
- `pnpm --filter @yishan/demo-admin lint`、`pnpm typecheck:admin`：通过。Biome 保留迁移前已有告警（System 11、Demo 21），没有新增错误。
- Demo Admin Jest：29 suites / 211 tests 通过；Core Admin Node tests：5/5 通过。
- `pnpm test:scripts`：29/29 通过；`pnpm check:boundaries`、`git diff --check` 通过。
- `pnpm test`：通过；Core Database 单元测试 43、Core API 17、System API 322、Demo API 294。默认单元命令跳过的 13 个数据库集成用例已由隔离集成命令实际执行；CRM 1 个需独立业务数据库的集成用例继续按原基线跳过。
- `pnpm typecheck:api`、API build、`pnpm build`：通过；Docs build 通过。
- 最终串行 `pnpm test:integration`：通过，Core Database MySQL 13/13、System 20/20、Demo 1/1。测试只使用 loopback MySQL、随机 schema/user 和 Redis namespace，并审计确认无残留。
- 共享配置的两个小程序消费者仅调整默认 API 地址归属，页面架构未改；`pnpm --filter yishan-app test` 74/74 与 `pnpm build:app` 通过。Taro 保留既有 Browserslist/webpack 缓存告警。
- Playwright 实际页面：7/7 通过，覆盖登录、11 个 System 页面及用户弹窗、Demo/Portal/Shop 菜单和直接 URL/刷新、匿名跳转、无权限 404/403、模块禁用/恢复、Portal 分类真实 CRUD、媒体上传和下载。7 个用例结束后数据库、账号、Redis key、临时上传目录均为 0。
- 独立复用验证：[scripts/verify-admin-reuse.mjs](../../scripts/verify-admin-reuse.mjs) 在 OS 临时目录构建两个独立产品消费者；Mako、TypeScript、React singleton、`/reuse/` JS/CSS、未安装模块排除、Catalog HMR 和复制的 System 包 Region HMR 均通过。实际 Demo-only 与 Demo+Portal+Shop 两种构建分别通过，System 12 页面始终存在；`ADMIN_PORT` 优先级和 `/admin/` 资产均通过。证据位于 `C:/Users/dfy/AppData/Local/Temp/yishan-admin-reuse-IMv70u/report.json`。
- 独立产物命令：

  ```bash
  node scripts/package-api.mjs --api apps/demo/api --admin apps/demo/admin/dist --output <external-temp-directory>
  node scripts/verify-api-main.cjs --artifact <external-temp-directory>
  ```

  产物在仓库外运行，健康检查、登录、`/api/docs/json`、`/admin/`、42 个入口及懒加载 JS/CSS、嵌套路由刷新、无源码地图/环境文件/仓库绝对路径泄漏、SIGINT 优雅退出均通过；最近一次摘要为 health/login/docs/admin `200`、生产开发接口 `404`。独立目录为 `C:/Users/dfy/AppData/Local/Temp/yishan-admin-v2-final-0f298329`。

中途 `pnpm test:integration` 一次重跑曾出现 Core Database 测试超时，随后产生异步清理断言失败；另一次与独立打包并行触发 API dist 的 Windows EBUSY 文件锁。没有为此放宽检查或修改数据库实现。停止共享构建操作后最终串行运行整条命令通过；13 个数据库集成、20 个 System 集成和 Demo 集成全部通过。历史 CRM 空库迁移失败是其中明确断言的原有已知限制，仍未修复。

## 提交与限制

本地提交：

1. `b8bcc6a refactor(admin): move demo admin into product workspace`
2. `8943180 refactor(admin): decouple shared kernel and system capabilities`

报告提交为 `6324ff1 docs(admin): record v2 product migration`，后续报告补充只记录最终验证证据；完整列表可执行 `git log 684e4f3..HEAD --oneline`。

没有推送或 PR；本轮以本地提交交付。原工作区仍在 `refactor/api-v2-product-first` 的 `684e4f3`，已有修改、删除和未跟踪文件均保留；本轮只写独立 worktree。CI Workflow 已增加 Linux Chromium、浏览器隔离验收、复用验证和客户端 drift gate，但 GitHub runner 尚未实际执行；这是本报告保留 `PASS WITH RESTRICTIONS` 的主要原因。Biome 的既有未使用导入告警仍可在后续独立清理。CRM 历史迁移冲突保持 API V2 已知基线，没有在本任务中改写。

后续人工操作：推送评审分支并运行 GitHub CI；评审后单独授权部署 Workflow、七牛上传和线上迁移。本轮本地工程验收已经满足目录、公共边界、装配、功能与独立产物目标，但不宣称已验证真实线上环境或 GitHub runner。
