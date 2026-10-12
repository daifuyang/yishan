# Yishan V2 Engineering Hardening 验收报告

## 1. Overall Status

**PASS WITH RESTRICTIONS**。2026-10-10 在 Windows 隔离 Worktree、Node 22.22.1、pnpm 8.15.9 下完成本地工程验收。根类型检查、lint、测试、构建、架构检查、脚本测试和移动端双目标构建通过；H5 真实 API 联调、隔离 MySQL 集成与 TipTap 仓库外消费通过。新提交的 GitHub Linux CI 与微信开发者工具/真机尚未验收，不能宣布全平台 PASS。

开始分支为 tmp/api-admin-v2-integration，基线 HEAD 为 3a23494cc8e86e1a50a0552c5f8e2fcd6c36f466，没有回退或覆盖该基线。实施目录为 .worktrees/api-admin-v2-integration，初始工作区干净。原工作区 refactor/api-v2-product-first 的用户修改和未跟踪资料保持原状。

## 2. Actual Changes

### Core App 与认证

- packages/core/app/src/request/index.ts：新增可选 isUnauthorized(status, body)。不传策略时保留原十个 Yishan 业务码；自定义策略只替换业务码判断，HTTP 401 始终执行认证处理。
- 修复刷新接口网络中断导致凭据被清空的问题：无响应的传输错误保留会话并返回原网络错误，后续可以重试；凭据明确拒绝、无效刷新响应仍清理当前实例。刷新请求仍为 { refreshToken }，不携带旧 access Authorization。
- packages/core/app/src/storage/index.ts：新增 createSessionStorageKeys(productId)，校验小写字母开头、数字和单连字符，返回冻结的 yishan:<productId>:accessToken / refreshToken / user。Demo 现有 yishan:app:* 完全保留，不做迁移、不主动退出用户。
- 新增 packages/core/app/tests/session.test.cjs：十项策略、命名空间、真实 client/store 和竞态测试；连同已有三项，共 13 项。覆盖同源三产品缓存、独立刷新 flight/回调、bootstrap/identity 缓存、迟到 401、旧身份覆盖、退出后旧刷新、刷新网络失败和实例局部清理。
- 没有改为全局单例。request sessionVersion、refreshFlight、回调以及 Zustand/identity/bootstrap flight 仍归每个工厂实例。

### 边界与构建

- scripts/check-app-boundaries.mjs 在原检查器上补充 Windows/绝对/相对/file URL、当前 @/ 别名、import type/import-equals、字面量 dynamic import/require/require.resolve、Sass/CSS 和 exports 条件/通配/null 排除。测试源码同样受边界检查。
- scripts/test/app-boundaries.test.mjs 共 53 个正反例，覆盖 Core 反向产品、跨产品、非公开 export、跨包相对路径、移动端导入服务端，以及合法公开导入。
- 新增 scripts/check-taro-versions.mjs 和八项测试，检查实际解析的 22 个 Taro 包及本地 shim，均为 4.2.0；没有升级 Taro、React 或依赖锁文件。
- apps/demo/app/config/index.ts 移除通用生产配置中的 devServer；config/dev.ts 默认回环绑定、保留 debug.daifuyang.com，额外域名使用 YISHAN_H5_ALLOWED_HOSTS，外网绑定使用 YISHAN_H5_HOST。禁止 all/auto/通配、协议、路径和端口。五项新增配置测试后 Demo App 共 81 项。
- 官方 mini/h5 compile.include 和公开源码 exports 保留；Core App、UI 仍是 private Source-First Workspace Package。没有改为 dist 消费，没有移动代码。
- package.json 增加 check:taro、verify:tiptap，并将已安装版本检查接入 typecheck:mobile。

### TipTap 与 CI

- 新增 scripts/verify-tiptap-consumer.mjs，复用现有 pack/prepack/Rollup/verify:package，不建立第二套包构建。两项脚本测试检查外部目录约束。
- 在仓库外安装 tarball，分别消费 React 18.3.1/19.2.0；验证 ESM、CJS、CSS、严格 TypeScript、无 workspace 依赖与发布文件白名单。宿主 ReactDOM/server 分别渲染两个导出的 Locale Provider/Hook，实际执行 Hook，避免仅凭 require 解析就宣称没有重复 React。
- 版本保持 0.0.1-dev.0，React peer >=16.8.0 保持不变；文档明确 16/17 没有本轮验证证据。不发布 npm，不修改 Toolbar、交互或样式。
- .github/workflows/yishan-fullstack-ci.yml 增加已安装版本、外部 tarball、严格 Admin types 和 Docs 检查及相关路径触发条件。现有等价步骤覆盖根 typecheck/lint/test/build、WeApp/H5、API、Admin、隔离数据库、OpenAPI、产物和包复用。29 个步骤 YAML 解析通过，不增加吞掉失败的测试命令。
- 直接依赖例外：apps/demo/admin/src/modules/crm/components/quotation/QuoteDetailModal.test.tsx 的单个日期夹具由带时区时间改为日历日期。原 CI 在 UTC 下把 10 月 20 日显示为 19 日，本轮先复现再修复；保留所有断言，不修改组件、API 契约或服务端安全行为。

### 工程规范

更新 README.md、AGENTS.md、CLAUDE.md、docs/architecture/package-boundaries.md、Core App/App/TipTap README。已有文档承载 Source-First、公开 exports、独立 client/store、存储命名空间、公共 UI、构建命令、shim 用途与移除条件、发布流程及验证限制，不重复创建空契约文档。

所有权保持 apps/demo/{api,admin,app,config}、packages/core/*、packages/ui/mobile、packages/yishan-tiptap。无业务页面、UI 视觉、数据库 SQL、服务端认证或 HTTP 契约改动；没有新产品空工程、第二套框架或共享实现副本。

## 3. Validation

下面均是本轮实际命令/测试，成功项已核对终端退出码 0。详细本地日志保存在忽略目录 artifacts/preview/hardening-*.log，不提交构建产物或凭据。

| Check | Status | Evidence |
| --- | --- | --- |
| Frozen Workspace Install | PASS | pnpm install --frozen-lockfile；基线和最终各一次，15 个 Workspace 项目 |
| Core App Typecheck | PASS | pnpm --filter @yishan/core-app typecheck；亦由根 pnpm typecheck 覆盖 |
| Core App Tests | PASS | pnpm --filter @yishan/core-app test：13/13，0 skip；新增问题先红后绿 |
| Multi-Product Isolation | PASS | session.test.cjs：两组真实工厂、独立 adapter/URL/回调/store/flight，三产品共享底层缓存；不创建正式产品 |
| Demo App Tests | PASS | pnpm --filter @yishan/demo-app test：81/81；根 pnpm test 再次运行 |
| Demo App Lint/Types | PASS | 包 lint/tsc、根 lint/typecheck 均通过 |
| WeApp Build | PASS | 根 pnpm build 中 pnpm build:app → @yishan/demo-app build:weapp 成功 |
| H5 Build | PASS | pnpm --filter @yishan/demo-app build:h5；最终重建与浏览器静态产物验证通过 |
| H5 API/browser | PASS | Chrome headless；开发 21003 和生产静态 21803，各覆盖匿名深链、真实登录、me/capabilities、用户列表、刷新恢复、退出/保护跳转，pageerror 为 0 |
| H5 permissions/browser | PASS | 现有工作台响应夹具十场景：目录、占位、320px、搜索、常用项、账号隔离、导航、刷新重试、禁用菜单/撤权、深链拒绝；明确属于接口 fixture |
| DevServer Hosts | PASS | 本地 HTTP 请求：localhost/debug.daifuyang.com 返回页面；evil.example.com 返回 Invalid Host header，WDS4 该响应状态仍为 200，未把仅 HTTP200 当成通过 |
| Installed Taro | PASS | pnpm check:taro：22 个实际解析结果/本地 shim 均 4.2.0；八项检查器测试 |
| TipTap Package | PASS | 独立 typecheck/build/verify:package，pnpm verify:tiptap 打包并在外部两组消费，ESM/CJS/Hook/CSS/严格类型全部通过 |
| TipTap Example | PASS | example 内 pnpm install --frozen-lockfile --ignore-workspace、pnpm typecheck、pnpm build；/form 浏览器挂载、输入、粗体序列化和撤销通过，0 pageerror |
| Architecture Boundaries | PASS | pnpm check:boundaries：API/manifest/naming/Admin/App 全部通过，demo/portal/shop 安装清单不变 |
| Root Typecheck | PASS | pnpm typecheck，含移动端、API、Admin、TipTap、Docs |
| Root Lint | PASS WITH WARNINGS | pnpm lint，0 errors；原 Admin/System ESLint 警告保留，未添加忽略规则 |
| Root Build | PASS | pnpm build：mobile/weapp/API/TipTap/Admin/Docs，退出码 0 |
| Root Tests | PASS WITH HISTORICAL SKIPS | TZ=UTC pnpm test：Core App 13、Demo App 81、Core Admin 5、Admin 211、Core API 17、System API 322、Database 43、Demo API 294；合计 986 passed、14 skipped |
| Script Tests | PASS | pnpm test:scripts：92/92，0 skipped，含 53 个 App 边界和八个版本检查用例 |
| MySQL Integration | PASS | pnpm test:integration：Database 13、System 20、Demo 1；只用本地 Docker 和随机临时 schema，执行清理，不读取生产配置 |
| Published Migrations | PASS | pnpm check:migrations：50 个已发布 SQL 哈希、五个 journal 不变；当前安装模块 dry check 通过 |
| Admin UTC regression | PASS | QuoteDetailModal 先在 UTC 复现；修复后 UTC/Asia-Shanghai 各 24/24，根 UTC Admin 全部 29 suites/211 tests 通过 |
| CI Configuration | PASS | YAML 解析一个 verify job、29 steps；覆盖清单审查和负面脚本测试通过 |
| GitHub CI | FAILED BASELINE / PENDING NEW COMMITS | gh run view 38016091216：3a23494 的 verify 在 Admin Test 失败；本地修复已验证，本轮不推送，不能宣称新 Linux CI 成功 |
| WeChat Device | NOT VERIFIED | 没有执行微信开发者工具或真机；WeApp 编译不代替设备/HTTPS 合法域名验收 |

Root test 的 13 个 Database 历史跳过项已在显式 test:mysql 集成命令真实执行。剩余 CRM quotation-revision 数据库用例仍未启用；没有为了 PASS 删除 skip 或修复 CRM 历史迁移。Database 集成还验证了既有 CRM 空库失败不会被误报完成。

TipTap 最终仓库外输出为系统临时目录 yishan-tiptap-consumer-iYaw17；tarball 只包含 dist/README/LICENSE/package.json，无源码、map、.env、node_modules 或跨 Workspace 链接。独立消费目录不在仓库内。未进行 npm 发布。

开发 watch 启动会清空 H5 dist，生产浏览器首次尝试因此未获得静态服务；停止 watch、重新 build:h5、启动静态服务后完整回归通过。示例的第一次入口/按钮定位不匹配现有 /form、粗体标签，校正测试定位后通过，未修改示例或编辑器实现。以上调查失败没有伪装为最终成功。

## 4. Architecture Readiness

可以建立 apps/crm/app 和 apps/axis/app，无需侵入或复制 packages/core/app：每个产品创建自己的 Taro composition root，注入 API base URL、刷新路径、业务认证方法、StorageAdapter/产品 key、Auth Store、导航回调和 capabilities。公共 UI 从 @yishan/ui/mobile 消费；业务模块注册、页面和配置归产品。

每个 client/store 一一配对，不能让两个 Store 覆盖同一个 Client 回调。产品登出使用 auth clear/logout，只清除该产品 Session；底层 storage.clear() 仍是全局清空 API，不能用于同源产品登出。新产品必须选不同 productId；Demo 保留历史 app 命名空间。

认证扩展保持 ApiResponse/TokenData 结构。如果未来服务端使用不同响应体或 refresh 协议，需要单独适配和契约验证；本轮没有创建大型认证插件系统。当前 check:taro 检查默认 Demo 消费链，新产品接入时应把自身平台版本纳入工程检查。公开 Source-First 能力已经验证实际 Taro 编译，不要求私有 Core 支持独立 npm 发布。

## 5. Remaining Risks

- **外部环境**：新提交尚未推送，GitHub Linux CI 为待执行；旧失败运行见 [38016091216](https://github.com/daifuyang/yishan/actions/runs/38016091216)。推送用户选定分支后查看 Fullstack verify job，不以其他站点部署状态代替。
- **外部环境**：微信开发者工具、真机和真实 HTTPS 请求域名未验证；没有 npm 正式发布、生产数据库操作或生产部署。
- **历史债务**：CRM 一项数据库集成仍跳过，CRM 空库历史迁移限制保持；既有 ESLint、Browserslist、Rollup 指令/循环与 H5 体积警告保留，没有无关升级或页面优化。
- **发布兼容性**：React 16/17 peer 保持原声明但本轮未经测试，当前新增证据仅覆盖 18.3.1/19.2.0。不能将两个版本烟测扩展成所有浏览器/编辑器功能的全面兼容声明。
- **静态检测范围**：App checker 扫描 Core App/UI/TipTap、apps/<product>/app；其他工程由各自 checker 负责。字面量导入和当前 @/ 可解析，计算式参数、变量插值、任意自定义 tsconfig alias 不解析，不能证明所有动态依赖安全。
- **开发访问边界**：WDS4 自身接受字面量 IP 和 *.localhost；额外域名白名单不是严格 IP 防火墙。默认回环绑定保留，远程绑定必须显式配置。代理域名 Host 已本地验证，但未从实际外网反向代理发起请求。
- 本轮未发现尚未修复的范围内阻断代码缺陷。后续发布前完成上述外部验收。

## 6. Git Result

Branch：tmp/api-admin-v2-integration。基线：3a23494。经过验证的实现 HEAD：4b5b006。

| Commit | 内容 |
| --- | --- |
| bbcd2cd | fix(core-app): harden auth and session isolation |
| dddfa59 | test(app): enforce product package boundaries |
| 9ad9fb8 | build(mobile): harden Taro configuration and CI checks |
| 4b5b006 | chore(tiptap): verify independent package consumers |

报告与规范作为后续 docs(architecture): finalize V2 hardening acceptance 本地提交；其实际提交可用 git log -1 -- docs/architecture/v2-engineering-hardening-report.md 查询，最终交付消息列出最终 HEAD，避免在提交自身内容中记录无法稳定的自身哈希。

总计 23 个任务文件（四个实现提交和本次文档提交），无锁文件、业务页面、dist、node_modules、本地 .env 或真实凭据提交。最终任务 Worktree 干净（提交后以 git status --short 再次核对）；原工作区用户修改保留。没有 push、PR、merge、force push、npm publish 或部署。
