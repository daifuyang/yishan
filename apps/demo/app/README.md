# Yishan Taro 产品应用

保留 Taro 4、React、TypeScript、Zustand；使用现有 Design Tokens、组件及服务端认证能力。没有新增业务模块、数据库表或生产 Mock。

## 运行

```bash
pnpm --filter @yishan/demo-app dev:h5
pnpm --filter @yishan/demo-app dev:weapp
pnpm --filter @yishan/demo-app tsc
pnpm --filter @yishan/demo-app lint
pnpm --filter @yishan/demo-app test
pnpm --filter @yishan/demo-app build:h5
pnpm --filter @yishan/demo-app build:weapp
```

H5 开发端口为 `21003`，`/api` 通过产品配置调用 `resolveApiTarget` 解析代理地址。本应用保留本地默认 `http://localhost:3100`；覆盖优先级为 `API_TARGET` → `YISHAN_API_TARGET` → `YISHAN_API_PORT` → 本地默认，共享包不拥有默认地址。构建产物分别位于 `dist/h5` 和 `dist/weapp`；微信开发者工具打开本应用目录，`project.config.json` 已指向 `dist/weapp/`。

H5 开发服务器默认绑定 `127.0.0.1`，允许 localhost、回环 IP 和现有反向代理 `debug.daifuyang.com`。其他代理域名通过 `YISHAN_H5_ALLOWED_HOSTS` 指定，使用逗号分隔的完整主机名，不包含协议、端口、路径或通配符；`all`、`auto` 和点号前缀域名不接受。需从其他网卡访问时显式设置 `YISHAN_H5_HOST`，例如 `0.0.0.0`。外层反向代理若自行处理 `/api`，仍需配置到目标 API 的转发。devServer 只参与开发配置，生产构建不包含该配置。webpack-dev-server 4 自身还接受字面量 IPv4/IPv6 和 `*.localhost`；该配置限制额外域名，不是严格 IP 白名单，默认回环绑定仍是本地访问边界。

```powershell
$env:YISHAN_H5_ALLOWED_HOSTS = 'preview.example.com,tunnel.example.com'
pnpm --filter @yishan/demo-app dev:h5
```

修改 `config/` 中的构建配置、路径别名或 API 环境变量后，重启 `dev:h5` / `dev:weapp`。源码热更新不会重新加载这些启动配置；旧开发进程可能出现常量未定义或新别名无法解析。

生产 H5 默认使用同源 `/api`，需在部署层转发 API；跨域部署时设置 `YISHAN_APP_API_BASE_URL`。微信小程序生产构建必须设置真实 HTTPS API 地址，并在微信后台登记合法请求域名。环境变量在构建阶段注入，不在客户端读取 Node 环境。

PowerShell 示例：

```powershell
$env:YISHAN_APP_API_BASE_URL = 'https://your-api.example.com'
pnpm --filter @yishan/demo-app build:weapp
```

## 导航与页面

固定三个原生 Tab：首页、工作台、我的。Tab 使用 `switchTab`，设置、消息、个人资料等二级页使用正常导航栈；登录和二级页不显示 TabBar。登录失效使用 `reLaunch` 清理旧栈，登录成功可恢复本地白名单内的二级目的地；显式退出不保留目的地。

首页展示用户问候、授权快捷应用、消息入口及可关闭的真实登录活动；工作台支持分类、搜索和按用户保存的常用入口；我的提供现有资料修改、改密、登录日志、偏好设置及关于。消息页明确显示待接入，没有虚构消息或统计。

共用 `PageContainer` 管理会话恢复、加载、错误重试和权限拒绝，复用已有 `PageHeader`、`EmptyState`、`Loading`、`StateView` 与原生确认弹窗 `confirmAction`，补充 `ErrorState`、`PermissionDenied`、`ListSkeleton`。颜色、字号、间距和安全区沿用 `src/styles/tokens.scss`。

## 认证与服务端兼容

复用 `/api/v1/app/auth/login`、`refresh`、`logout`、`me`、用户资料和菜单接口。请求统一注入身份凭证；并发 401 合并刷新并重试一次，旧请求不能恢复已退出的会话。刷新凭据被拒绝时清理会话并跳转登录；普通请求或刷新网络错误保留会话并提供重试。退出优先使用 refresh token 撤销服务器会话，避免已过期 access token 阻止退出。

新增只读、向后兼容的 `GET /api/v1/app/auth/capabilities`，返回真实权限码与已挂载且启用的模块 ID，复用原 `app:auth:profile` 权限。原 `me` 和授权菜单只提供路径/关联权限，不能作为用户实际权限来源。API、OpenAPI 和 admin 生成客户端已同步；无数据库迁移，PC 功能不变。新版移动端要求服务端提供此接口；缺失时默认拒绝访问并展示恢复错误。

## 模块扩展

`src/modules/registry.ts` 是移动端静态实现注册表，声明 ID、名称、图标、页面入口、对应后端菜单路径、权限、分类和排序，不维护第二套菜单树。工作台展示服务端返回的有效功能菜单，分类、名称及顺序来自菜单接口；未适配的入口可搜索、加入常用，点击后提示建设中，不生成虚构路由。

已实现页面的访问校验要求：

- 后端菜单可见且启用；上级菜单也必须可见且启用。
- 当前用户具有所需的全部真实权限，未取得权限时拒绝。
- 对业务模块填写 `backendModuleId`，必须出现在服务端启用模块快照中。
- 入口必须已实现且已注册；已有占位页的 `implemented: false` 拒绝直接访问。

当前只复用已存在的通讯录和用户管理。CRM/客户旧页面源码保留，但已从应用构建注册中移除。服务端始终执行最终授权。

新增模块时更新静态注册表，并在 `src/app.config.ts` 构建注册页面；需要分包时使用 Taro 的静态分包配置。模块子页访问关系在 `SECONDARY_MODULE_PAGES` 中声明，不把 PC 动态路由搬到小程序。

## 用户详情

用户详情使用摘要、基本信息、组织信息和账号记录分组，保留创建及更新记录。部门、角色名称通过已有详情接口按关联 ID 查询，遵循对应读取权限；名称无法获取时显示「名称暂不可用」，不直接显示关联 ID。

底部编辑、启用／禁用、更多操作按权限等宽排列，内容高度 50px，安全区单独预留。重置密码和删除位于底部操作面板，写操作防重复提交，删除保留不可恢复确认及系统管理员保护。微信使用原生导航和密码输入确认，H5 保留现有导航并补充密码输入弹窗，重置失败保留输入；两端复用原编辑路由和用户操作 API。

## 验证范围

`tests/*.test.cjs` 使用仓库已有 TypeScript 编译器执行真实实现，仅替换平台请求、存储和导航边界；覆盖并发刷新、会话清理、恢复错误、权限交集、账号间状态隔离、静态路由、分页竞态及确认弹窗。没有新增测试依赖。

`tests/browser/workbench.js` 是使用测试接口响应的 H5 手动回归脚本：先在 `http://127.0.0.1:21803` 提供 H5 静态构建，再打开独立 Playwright 会话并通过 `playwright-cli run-code --filename=apps/demo/app/tests/browser/workbench.js` 执行。它不属于上述 Node 测试命令，也不代表真实服务端联调。

微信产物构建通过不等于真机验收；发布前仍需开发者工具和真实 HTTPS 域名联调。消息服务、微信快捷登录和头像上传作为后续独立能力，不伪装成已提供的服务器功能。

## 公共能力与产品所有权

产品入口为 `apps/demo/app`（`@yishan/demo-app`），同级 `../api`、`../admin`、`../config` 属于 Demo 产品。

本应用保持完整产品：页面、业务 API、导航、模块注册、用户模型和配置不变。`@yishan/core-app` 位于 `packages/core/app`，提供注入式请求、登录、缓存、环境、分页 hook 与小型权限/路径工具。URL、Token key、认证 API 和失效跳转由本应用传入，每个产品实例互相隔离。

通用 atoms/feedback 移至 `@yishan/ui/mobile`，原本地 barrels 仅转出公共实现；产品专属组合组件保留本地。`src/styles/tokens.scss` 转出公开样式入口，原视觉与交互保持一致。Taro 官方 `compile.include` 编译外部源码包；消费应用提供 React/Taro/platform 插件。Storage 使用调用时适配，避免捕获初始化前的 Taro API。

当前锁定安装组合为 Taro `4.2.0`、React/ReactDOM `18.3.1`，配置沿用 `framework: 'react'`、Webpack 5 和关闭 prebundle。`scripts/tarojs-react-shim` 是通过 `file:` 安装的本地 `@tarojs/react` 包，其 JavaScript 和声明仅转出应用的 `react-dom`，用于现有 framework-react 插件的别名解析；shim 的 `4.2.0` 是本地兼容标记，不代表安装了上游同名渲染器。保留该适配前提，微信真机验收仍独立于构建检查。只有官方 runner 不再要求这一别名、直接消费应用 ReactDOM，并在无 shim 的 H5/WeApp 构建与浏览器/设备回归均通过后，才可移除；本轮不升级 Taro 或移除 shim。

从根目录运行 `pnpm check:taro` 可核对应用、Core App 和移动 UI 实际解析到的 Taro 包及 Babel preset，要求与已安装 CLI 的 Taro 4 版本一致，也核对本地 shim。检查实际安装版本，不仅检查 manifest 中的 `^4.0.0` 声明；不会修改依赖或锁文件。两种构建目标都通过公开 package exports 定位 Core App/UI 源码，再交给 `compile.include` 编译。

根 `pnpm typecheck:mobile` 覆盖公共包和完整应用；根 test/build 现在覆盖 App 单元测试和 weapp。新产品在 `apps/<product>/app` 创建自己的 Taro 工程并消费公共 exports，不复制 Core/UI，不将业务放入 Core。
