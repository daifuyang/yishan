# Yishan Mobile 交付记录

本次完善应用基座，保留现有 Taro、React、TypeScript、Zustand 与目录组织。没有新增业务模块、数据库表、业务 Mock 或依赖；没有提交生成的构建产物。

## 实现与复用

- 原生首页 / 工作台 / 我的三个 Tab，安全区及二级导航，统一登录失效跳转；修复原图标完全透明问题。
- 复用登录、续期、用户和菜单 API；请求刷新合并、一次重试、会话代际隔离、取消支持及网络错误反馈。退出优先用 refresh token 撤销。
- 真实权限、启用模块、服务端菜单和移动静态注册表求交集；未取得权限默认拒绝；未实现模块隐藏并拒绝直接访问。
- 首页真实问候 / 快捷应用 / 消息入口；工作台分类 / 搜索 / 按账号常用应用；我的复用个人资料、密码和登录日志，增加真实本地偏好及关于页。
- 复用 PageHeader、状态组件、Design Tokens 和 Taro 原生确认能力；补齐 PageContainer、错误、拒绝访问和列表骨架。修复 H5 确认参数校验导致无法退出的问题。
- 分页首次单请求、同步加载锁、过期响应保护、权限启用开关、失败重试。

## 兼容性

新增只读 `GET /api/v1/app/auth/capabilities`，复用已有 profile 权限与模块加载器，返回有效权限和已挂载启用模块。旧 API 契约不变；OpenAPI 与 admin 生成客户端同步，无 PC 功能修改及数据库迁移。新版移动端依赖服务端提供该接口，缺失时保持拒绝访问。

现有通讯录、用户管理被复用；旧 CRM/客户源码保留但移出构建页面。已有系统占位页不展示入口且不可直接访问。

## 实际验证

| 检查 | 结果 |
| --- | --- |
| 移动端严格类型检查与 Biome lint | 通过 |
| 修改的 70 个 TS / TSX / CJS 文件 Format | 通过 |
| 移动端认证、权限、路由、分页、确认、图标行为测试 | 37 通过 |
| H5 生产构建 | 通过；webpack 包体积建议警告 |
| H5 开发服务 | 重启旧配置进程后编译通过；浏览器登录页正常，API 常量已替换为同源地址，无常量未定义异常 |
| 微信小程序构建 | 通过；Browserslist 数据、webpack 缓存警告 |
| 微信生成 app.json / 六图标 | 三个 Tab 均注册、资源存在；主包文件合计 417652 字节 |
| API build:ts | 通过 |
| admin OpenAPI 客户端生成 | 通过；保留无关 shop 历史类型，避免生成器漂移 |
| 仓库 pnpm lint | 通过；admin 存量 31 个警告、1 个提示 |
| 仓库 pnpm test | admin 199 通过；API 572 通过、21 跳过 |
| 仓库 pnpm build | TipTap、admin、docs 全通过 |
| git diff --check | 通过 |
| H5 移动浏览器 | 登录失败保留输入、登录成功、Tab 切换、二级页无 Tab、无权限直达、会话恢复、断网重试、确认退出、续期失效跳登录均通过；分类入口、搜索、触摸长按常用持久化通过 |

浏览器只在测试边界拦截认证和空列表/菜单响应，没有连接真实账号或修改服务器数据。图标的可见像素通过浏览器 canvas 和截图再次验证。

## 未完成与下一阶段

- 微信开发者工具 / 真机 / 生产 HTTPS 域名联调尚未执行，当前环境验证到构建、静态配置及 H5 交互。
- API 集成测试中原有 21 项需要外部环境，保持仓库默认跳过；未启动会同步数据库的完整后端服务。
- 消息页明确显示待接入；消息服务、微信快捷登录、头像上传与具体业务模块不在本次范围。

下一阶段先配置真实 HTTPS 请求域名，使用专用测试账号完成微信真机及 API 联调，再逐项接入已获授权的移动模块和消息能力。

## 完整修改文件清单

- `apps/yishan-admin/src/services/generated/appAuth.ts`
- `apps/yishan-admin/src/services/generated/typings.d.ts`
- `apps/yishan-api/openapi.json`
- `apps/yishan-api/src/core/routes/api/v1/app/auth/index.ts`
- `apps/yishan-api/src/core/schemas/auth.ts`
- `apps/yishan-api/src/core/services/permission.service.ts`
- `apps/yishan-api/src/types/fastify-extensions.d.ts`
- `apps/yishan-api/test/app.auth.routes.test.ts`
- `apps/yishan-app/biome.json`
- `apps/yishan-app/config/dev.ts`
- `apps/yishan-app/config/index.ts`
- `apps/yishan-app/config/prod.ts`
- `apps/yishan-app/DELIVERY.md`
- `apps/yishan-app/package.json`
- `apps/yishan-app/project.config.json`
- `apps/yishan-app/README.md`
- `apps/yishan-app/src/api/auth.ts`
- `apps/yishan-app/src/api/client.ts`
- `apps/yishan-app/src/api/types.ts`
- `apps/yishan-app/src/app.config.ts`
- `apps/yishan-app/src/assets/tabbar/apps-active.png`
- `apps/yishan-app/src/assets/tabbar/apps.png`
- `apps/yishan-app/src/assets/tabbar/home-active.png`
- `apps/yishan-app/src/assets/tabbar/home.png`
- `apps/yishan-app/src/assets/tabbar/README.md`
- `apps/yishan-app/src/assets/tabbar/user-active.png`
- `apps/yishan-app/src/assets/tabbar/user.png`
- `apps/yishan-app/src/components/feedback/ErrorState.tsx`
- `apps/yishan-app/src/components/feedback/index.ts`
- `apps/yishan-app/src/components/feedback/ListSkeleton.module.scss`
- `apps/yishan-app/src/components/feedback/ListSkeleton.tsx`
- `apps/yishan-app/src/components/feedback/PermissionDenied.tsx`
- `apps/yishan-app/src/components/layout/index.ts`
- `apps/yishan-app/src/components/layout/PageContainer.module.scss`
- `apps/yishan-app/src/components/layout/PageContainer.tsx`
- `apps/yishan-app/src/components/molecules/GridItem/GridItem.tsx`
- `apps/yishan-app/src/components/organisms/DashboardHero/DashboardHero.module.scss`
- `apps/yishan-app/src/components/organisms/DashboardHero/index.tsx`
- `apps/yishan-app/src/components/organisms/LoginBrand/index.tsx`
- `apps/yishan-app/src/components/organisms/TabBar/TabBar.module.scss`
- `apps/yishan-app/src/components/organisms/TabBar/TabBar.tsx`
- `apps/yishan-app/src/components/organisms/WorkbenchGrid/WorkbenchGrid.tsx`
- `apps/yishan-app/src/components/organisms/WorkbenchUserPanel/index.tsx`
- `apps/yishan-app/src/config.ts`
- `apps/yishan-app/src/constants/index.ts`
- `apps/yishan-app/src/constants/menu-routes.ts`
- `apps/yishan-app/src/constants/routes.ts`
- `apps/yishan-app/src/hooks/useCanWrite.ts`
- `apps/yishan-app/src/hooks/useConfirm.ts`
- `apps/yishan-app/src/hooks/useListPagination.ts`
- `apps/yishan-app/src/modules/registry.ts`
- `apps/yishan-app/src/pages/about/index.config.ts`
- `apps/yishan-app/src/pages/about/index.tsx`
- `apps/yishan-app/src/pages/apps/index.config.ts`
- `apps/yishan-app/src/pages/apps/index.module.scss`
- `apps/yishan-app/src/pages/apps/index.tsx`
- `apps/yishan-app/src/pages/contacts/dept/index.tsx`
- `apps/yishan-app/src/pages/contacts/index/index.tsx`
- `apps/yishan-app/src/pages/index/index.config.ts`
- `apps/yishan-app/src/pages/index/index.module.scss`
- `apps/yishan-app/src/pages/index/index.tsx`
- `apps/yishan-app/src/pages/login/index.module.scss`
- `apps/yishan-app/src/pages/login/index.tsx`
- `apps/yishan-app/src/pages/messages/index.config.ts`
- `apps/yishan-app/src/pages/messages/index.tsx`
- `apps/yishan-app/src/pages/mine/index.config.ts`
- `apps/yishan-app/src/pages/mine/index.tsx`
- `apps/yishan-app/src/pages/profile/edit/index.module.scss`
- `apps/yishan-app/src/pages/profile/edit/index.tsx`
- `apps/yishan-app/src/pages/profile/login-log/index.tsx`
- `apps/yishan-app/src/pages/profile/password/index.module.scss`
- `apps/yishan-app/src/pages/profile/password/index.tsx`
- `apps/yishan-app/src/pages/security/index.config.ts`
- `apps/yishan-app/src/pages/security/index.tsx`
- `apps/yishan-app/src/pages/settings/index.config.ts`
- `apps/yishan-app/src/pages/settings/index.tsx`
- `apps/yishan-app/src/pages/system/dept/detail/index.tsx`
- `apps/yishan-app/src/pages/system/dept/index.tsx`
- `apps/yishan-app/src/pages/system/dict/index.tsx`
- `apps/yishan-app/src/pages/system/dict/items/index.tsx`
- `apps/yishan-app/src/pages/system/login-log/index.tsx`
- `apps/yishan-app/src/pages/system/user/detail/index.tsx`
- `apps/yishan-app/src/pages/system/user/edit/hooks/useUserEditForm.ts`
- `apps/yishan-app/src/pages/system/user/edit/index.tsx`
- `apps/yishan-app/src/pages/system/user/index.tsx`
- `apps/yishan-app/src/stores/auth.ts`
- `apps/yishan-app/src/stores/modules.ts`
- `apps/yishan-app/src/utils/auth-guard.ts`
- `apps/yishan-app/src/utils/router.ts`
- `apps/yishan-app/tests/auth-client.test.cjs`
- `apps/yishan-app/tests/auth-store.test.cjs`
- `apps/yishan-app/tests/confirm.test.cjs`
- `apps/yishan-app/tests/helpers/load-ts.cjs`
- `apps/yishan-app/tests/modules.test.cjs`
- `apps/yishan-app/tests/pagination.test.cjs`
- `apps/yishan-app/tests/router.test.cjs`
- `apps/yishan-app/tests/tab-icons.test.cjs`
- `apps/yishan-app/tests/user-actions.test.cjs`
- `apps/yishan-app/types/global.d.ts`

