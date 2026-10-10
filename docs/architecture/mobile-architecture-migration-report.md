# Yishan App 与组件包架构迁移报告

日期：2026-10-10。状态：**PASS WITH RESTRICTIONS**。

## Summary

按最新命名要求，共享移动能力位于 `packages/core/app`，包名为 `@yishan/core-app`。完整 Taro 产品仍在 `apps/yishan-app`，没有拆成共享 App，也没有创建空的 Demo/CRM/AXIS App。公共移动 UI 使用 `@yishan/ui/mobile`；独立编辑器迁至 `packages/yishan-tiptap`，包名 `@yishan/tiptap`。

本次没有修改移动业务页面、功能流程、设计样式或 API 源码。Admin 只修改编辑器包名的必要消费引用、CSS 声明和对应依赖。React/Taro 版本未升级。

## Changed Structure

迁移前：

```text
apps/
  yishan-app/src/
    api/client.ts
    stores/auth.ts
    utils/storage.ts
    hooks/useListPagination.ts
    components/atoms/
    components/feedback/
    styles/tokens.scss
  yishan-components/yishan-tiptap/
```

迁移后：

```text
apps/
  demo/api/                     配套产品 API（未重构）
  demo/admin/                   产品 Admin（仅编辑器消费引用调整）
  demo/config/                  产品配置（上一提交已归位）
  yishan-app/                   完整 Taro 产品
    src/pages/                  原页面与业务不变
    src/api/                    业务 API、模型、请求客户端装配
    src/stores/auth.ts          产品认证 API 与跳转装配
    src/utils/storage.ts        Taro 适配、产品 Storage key
    src/modules/                产品模块注册
    src/components/             产品组合组件与公共导出入口
packages/
  core/app/                     @yishan/core-app
    src/request/
    src/auth/
    src/storage/
    src/env/
    src/hooks/
    src/router/
    src/permissions/
    tests/
  ui/                           @yishan/ui
    mobile/atoms/
    mobile/feedback/
    mobile/tokens.scss
  yishan-tiptap/                 @yishan/tiptap
    src/
    scripts/
    example/
    package.json
    rollup.config.js
    tsconfig.json
```

编辑器和移动 UI 使用 Git 移动；多数源码和样式被 Git 识别为 100% 重命名。原 App 的请求/认证/存储路径成为真正的产品装配入口，公共实现只有一份。原编辑器目录不再有受版本管理的源码或活跃 Package。

Workspace 支持 apps/*、apps/*/*、packages/*、packages/*/*、modules/*。example、dist、build 排除；独立 example 使用自己的 pnpm lock，不重复成为 Workspace 项目。没有制造空目录或永久第二产品夹具。

## Packages 与所有权

| Package | 实际提取能力 | 消费方式 |
| --- | --- | --- |
| @yishan/core-app | 请求/分页、Token 注入、并发刷新、取消、实例认证状态、Storage、不可变环境、useListPagination、权限与路径小工具 | 源码 Workspace exports；提供 build/typecheck/test，产品 Taro 编译源码 |
| @yishan/ui | Button、Avatar、Badge、Tag、AppText、EmptyState、Loading、StateView、ErrorState、ListSkeleton、原 SCSS/Token | @yishan/ui/mobile 和公开 tokens.scss；源码包、类型检查 |
| @yishan/tiptap | 原独立编辑器、Rollup、CSS、声明、ESM/CJS、example | 独立 npm 发布配置、prepack 验证、外部 tarball 消费 |

Core App 工厂接受产品 baseUrl、Storage、keys、refreshPath、业务认证 API、用户模型和失效跳转。不同产品各自创建 client/store，Token、回调、refresh/bootstrap flight 和取消版本不共享。业务路径、产品名、模块菜单、默认 API 地址和页面不进入 Core。公共包没有到 apps、Admin 或服务端运行时的反向依赖。

实际仍属于产品的能力：全部页面、业务 API/模型、登录后目的地导航、模块装配、权限页面、DashboardSkeleton、业务 molecules/organisms、设置与产品配置。保留原本地组织方式，没有为了形式把业务 api 目录批量改名。

Taro 使用官方 mini/h5 compile.include 编译公开导出对应的外部源码。Webpack 优先解析消费 App 的平台插件，同时保留默认 node_modules 搜索；未另建前端框架。Taro 平台 API 延迟初始化，因此产品 Storage 用回调调用当前 API，避免提前捕获 Taro default 对象。这个问题先通过失败测试复现，修复后通过单元与真实登录测试。

TipTap 保留原 ESM/CJS/CSS/声明接口，公开 npm 名称是 Breaking Change，没有旧包名兼容层。将实际打包进 JS 的依赖归入 devDependencies，发布消费者只需 React/ReactDOM peers。TipTap 家族固定既有 3.11.0，修复间接 core/extension 版本漂移；修正真实类型错误并打开 Rollup noEmitOnError。没有升级 React/Taro。

example 使用 file:.. 安装构建后的发布包、单独冻结锁和 hoisted node linker；后者解决 Windows 深目录下 React Router imports-map 解析问题。重建编辑器后需刷新本地 file 依赖，说明已写入 example README。外部消费者验证编辑器与 example 使用同一 React 实例。

## 工程与 CI

根新增 build:mobile、typecheck:mobile、typecheck；root test 纳入 Core App/App 测试，root build 纳入 Core App/UI 与 weapp。H5 和独立 example 明确另行构建，README 列出实际覆盖。

新增 check-app-boundaries.mjs 和四个正反向夹具，校验产品反向依赖、服务端/Admin 依赖、公开 exports、跨 Workspace 相对导入，覆盖 TS、require.resolve 与 SCSS。并接入 check:boundaries。

fullstack CI 更新编辑器名称/路径，增加 App/UI 路径过滤与移动包类型检查、测试、lint、weapp/H5 构建。CD 源码仅调整编辑器构建路径/名称。fc-migrate 没有相关编辑器路径，无需修改。YAML 解析通过；未运行远端 GitHub CI、未触发 CD，线上 URL/环境/数据未改动。

## Validation

使用 Node 22.22.1、pnpm 8.15.9，在独立 integration worktree 执行：

| 检查 | 结果 |
| --- | --- |
| pnpm install、最终 install --frozen-lockfile | PASS，15 个 Workspace 项目 |
| Core App typecheck/build/test | PASS，3 项实例/Storage/环境测试 |
| UI typecheck、共享移动源码 Biome lint | PASS |
| App lint/tsc/test | PASS，76 项测试，0 失败/跳过 |
| App build:weapp 和 build:h5 | PASS，真实 Taro/Webpack 生产编译 |
| TipTap typecheck/build/verify:package/pack | PASS，独立 Rollup 与 prepack |
| example 冻结安装/typecheck/build | PASS，实际工作区和仓库外均验证 |
| root typecheck | PASS，TipTap、移动端、API、Admin、Docs |
| root lint | PASS；既有 Admin/System lint 警告分别 21/11 项，未忽略错误 |
| root test | PASS；Core App 3、App 76、Core Admin 5、Admin Jest 29 suites/211 tests、Core API 17、System API 322、Demo API 294、Database 43 |
| root build | PASS，Core App/UI、weapp、API、TipTap/Admin、Docs |
| pnpm test:scripts | PASS，33 项，其中新 App 边界夹具 4 项 |
| pnpm check:boundaries、YAML 语法、git diff --check | PASS，无新边界违规 |

root test 的 Database 13 项 MySQL 测试和 Demo 的 1 项 CRM 数据库集成测试按原配置跳过，共 14 项；没有宣称这些测试通过，也没有在本轮修复 CRM 历史迁移。

H5 真实 Chrome/Playwright：匿名二级链接跳转登录；隔离 API 管理员登录；身份、capabilities、授权菜单、首页指标、用户列表；刷新恢复会话；退出登录接口和再次匿名访问，均通过，pageerror 为 0。相关 API 返回 200，没有以 HTML 200 替代 UI 验证。

工作台已有 browser/workbench.js 使用 API fixture，覆盖应用目录、占位菜单 Modal、320px 布局、搜索、收藏排序/增删/刷新、账号隔离、导航返回、失败重试、权限撤销、禁用菜单和二级 URL 拒绝访问，全部通过。夹具改为在应用初始化前一次性注入会话，避免匿名跳转时序干扰；未放宽业务断言。

联调使用本机隔离 MySQL schema、专用账号和隔离 Redis 缓存；仅安装 System、Demo、Portal、Shop。没有启用 CRM，没有写生产数据。本地临时 .env、凭据、日志、产物和辅助脚本未提交。

TipTap 实际浏览器 /form 验证输入、加粗、撤销，console 无错误/警告。独立外部 tarball 安装仅 8 个依赖，无 TipTap 依赖漂移警告；ESM/CJS/CSS 与严格 TypeScript（skipLibCheck:false）消费通过。另将 parent manifest/dist/example 复制到仓库外，不带父级 node_modules 或源码，验证安装、types/build、同一 React 实例及生产浏览器。

Admin 本地预览登录、菜单、用户表与刷新均成功，登录后无 pageerror。首次匿名加载有 AxiosError：授权菜单/capabilities 401 后触发缺少 refresh token 的 refresh 400。相关 Admin 认证实现本轮未修改，作为独立问题记录，未冒充零错误的完整 Admin 重新验收。

## 独立产物与安全

TipTap tarball 只含 dist/README/LICENSE/package.json，公开 exports 完整，无 example、源码、环境文件、凭据或失效 Workspace 链接。没有实际 npm 发布。Core App/UI 是公开源码 Workspace 包，已通过真实消费 App 的 weapp/H5 构建，不宣称它们是独立 Node 服务产物。

App 产物不提交。API 与 Admin 源码迁移在前一任务完成，本轮未重新实施 API、修改 OpenAPI 契约或执行生产部署。未 force push、未推送 all、未合并 main、未覆盖原工作区用户修改。

## Risks 与验收限制

1. 微信开发者工具/真机未执行；weapp 构建成功和 H5 联调不能代替微信平台验收。发布前仍需合法 HTTPS 域名、微信开发者工具与真机验证。
2. example Docker build 尝试被本机配置的 docker.mirrors.ustc.edu.cn 拉取 node:22.22.1-alpine 的 HEAD EOF 阻断，尚未进入 Dockerfile build steps；仓库外等价 Node 运行/构建已通过。
3. GitHub Linux CI 未远端执行。现有 Sass/Browserslist 弃用/数据陈旧及 example Vite 大 chunk 警告保留，没有顺手改样式或升级依赖。
4. 本机 Windows 的 dev:api 预览曾重复重建；本轮稳定联调使用已构建的 dist/main.js，不宣称 dev:api 热更新通过，未扩大范围修改 API 工具脚本。
5. Admin 匿名初始化的 AxiosError 见上文，本轮移动/编辑器迁移未扩大范围处理。
6. @yishan/tiptap 尚未发布到 npm。包名迁移需要其他外部消费者同步改名；本轮已证明独立打包/安装能力。

因此源码、工程、移动端浏览器与独立编辑器消费目标通过；设备、Docker 镜像拉取、远端 CI 与现有 Admin 预览异常有明确限制，状态为 PASS WITH RESTRICTIONS。

## Future Ready 与提交

可以在 apps/crm/app、apps/axis/app 创建各自独立 Taro 工程，拥有自己的配置、业务服务、模块表和页面；注入各自 API/Storage/auth，公开消费 Core App/UI。无需复制公共请求、登录、缓存、hooks 和移动基础组件。新增产品仍需编写自己的业务和产品装配，本轮没有虚构这些业务应用。

工作分支：tmp/api-admin-v2-integration。主工作区保留在 refactor/api-v2-product-first，已有用户修改不动。

- 1198cb6：refactor(demo): localize product configuration（先前完成）
- f91c874：refactor(app): extract Core App and UI and relocate TipTap
- e29013f：build(app): align CI and document product package ownership

交付时保留本地预览：H5 http://127.0.0.1:21803/、Admin http://127.0.0.1:8000/admin/、API Swagger http://127.0.0.1:3100/api/docs。预览使用隔离数据，启动不代表部署。

本报告作为 docs(app): record mobile migration validation 独立提交；实际提交可由该路径 git log 查询。没有推送或创建 PR，也没有部署。
