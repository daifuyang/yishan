# 移动端主题基础层

本次升级面向企业移动应用的信息层级、克制配色、触控尺寸和系统主题适配。保留现有蓝色品牌；不改变 API、权限、登录态、导航路径和表单提交。基础层完成后，按用户追加授权迁移工作台样式并调整 H5 全 App 导航与操作位置。它是项目自己的基础设计系统，不代表微信、企业微信或飞书的官方认证。

## Theme 架构

| 位置 | 职责 |
| --- | --- |
| `packages/ui/mobile/theme/palette.ts` | 唯一颜色值源，两套键一致的语义色板和主题阴影。区分文字主色、填充主色、填充危险色、反色文字、基础背景、普通表面、浮层表面、遮罩和状态色。 |
| `packages/ui/mobile/theme/controller.ts` | 与平台无关的实例控制器，接受缓存、系统主题读取和监听适配器。支持 `light` / `dark` / `system`、订阅、启动/停止、异常降级与实例隔离。 |
| `packages/ui/mobile/theme/colors.scss`、`tokens.scss` | 从色板生成颜色 mixin；集中定义 spacing、typography、radius、shadow、touch target 与安全区。保留旧 CSS 变量名称，方便现有页面渐进迁移。 |
| `packages/ui/mobile/theme/ThemeProvider.tsx` | React Context 与 `useSyncExternalStore` 接口，仅使需要读取主题状态的组件订阅控制器。普通组件依赖 CSS Token，无需新增主题状态。 |
| `apps/demo/app/src/theme/` | 产品缓存 key、H5 根节点、微信页面栈与原生导航配色。产品拥有适配器，共享 UI 不导入 Demo 或 Core 后端/Admin。 |
| `apps/demo/app/config/theme-assets.ts` | 微信构建插件：生成 `theme.json`，给每个页面模板注入唯一的 `page-meta`，无需修改页面组件或配置源码。 |

默认模式为 `system`。模式与解析结果分开：例如 `{ mode: 'system', resolved: 'dark' }`。手动模式优先于系统；返回 `system` 时重新读取最新系统主题。缓存 key 为 `yishan:app:theme`，不改变现有会话 key。缓存损坏、禁用或写入失败不阻断主题切换；启动前的显式选择不会被旧缓存覆盖。启动引用计数确保不会重复监听，停止和取消订阅均可安全调用。

H5 使用 `matchMedia('(prefers-color-scheme: dark)')` 监听，并向 `html` 写入 `data-theme` 和 `data-theme-mode`。CSS 媒体查询负责未初始化时的系统主题，显式 `data-theme` 优先。弹出到 body 的 Taro Modal、ActionSheet 和 WeUI Picker 使用根节点 Token；WeUI 的滚轮尺寸、惯性和手势逻辑保留。

微信启用 `darkmode` 和 `themeLocation`；原生配置引用同一色板生成的主题变量。`modifyPageObject` 同步已创建页面、保留原生命周期回调，并在销毁时移除页面；手动切换同时更新页面样式和原生导航/TabBar。构建插件在 Taro 生成模板后注入 `page-meta`，若未来页面自己声明 `page-meta`，构建会明确报冲突，避免静默覆盖页面行为。此接入按仓库当前 Taro 4.2.0 验证。

```ts
import { appTheme } from '@/theme'
appTheme.setMode('light')
appTheme.setMode('dark')
appTheme.setMode('system')
```

```tsx
import { useTheme } from '@yishan/ui/mobile/theme/react'
const { mode, resolved, setMode } = useTheme()
```

本次没有新增业务设置页或主题开关页面。后续设置页面直接调用以上接口。

修改色板后运行 `pnpm --filter @yishan/ui theme:generate`，将 `palette.ts` 与生成的源码 `colors.scss` 一同提交；`theme:check` 和 App 测试检测漂移。`dist`、原生 `theme.json` 等构建产物不提交。

## 尺寸与安全区

| 项目 | 规范 |
| --- | --- |
| Spacing | 4px 基础步长；常用 8 / 12 / 16 / 24 / 32；页面 gutter 为 16。 |
| Typography | 系统字体；caption 12、body 15、title 18、heading 24；字重 400 / 500 / 600 / 700。旧数字字号继续可用。 |
| Radius | button 6、card 8、modal 12、sheet 16；保留旧 radius 刻度。 |
| Shadow | sm / md / lg / xl / tabbar 两套主题定义，组件不自行拼接颜色。 |
| Touch target | 最小 44 CSS px，Token 使用 `44PX` 避免 Taro 缩放；Button 各尺寸至少 44，lg 为 48，关闭/移除控制使用最小触控 Token。 |
| Safe area | H5 使用 `env(safe-area-inset-top/bottom, 0px)`，现有 `viewport-fit=cover` 保留；微信从 `getWindowInfo().safeArea` 读取，并响应窗口变化。 |

`--safe-area-device-top/bottom` 表示设备安全区；`--safe-area-top/bottom` 表示当前页面还需要处理的安全区。微信默认原生导航已经消耗顶部 inset，因此该页 top 为 0；自绘导航保留设备 top。原生 Tab 页已由宿主 TabBar 承担底部 inset，因此页面 bottom 为 0；其他页保留设备 bottom。Sheet/Footer 只由最底部容器承担一次 inset。日期筛选 Sheet 固定 header/footer，由正文压缩并滚动，防止小视口裁切按钮。

Button、Badge、Card、PromptDialog、ActionSheet、选择 Sheet、日期 Sheet、列表、表单基础样式、加载/空状态与图标均使用语义 Token。填充按钮使用 solid 色和反色文字；正文主/次文字与表面、主/危险填充按钮与文字的 4.5:1 对比度有测试。SVG 图标复用项目已有的 mask 模式，颜色来自 CSS，不把 CSS 变量塞进 SVG 字符串。

**兼容边界：** 微信原生 `showModal` 的背景由宿主系统主题决定，不能通过该 API 强制为 App 手动主题。确认 Hook 按宿主主题解析按钮文字以保证可读性；H5 Taro Modal 与项目自绘 PromptDialog/Sheet 按 App 主题显示。业务页面主动传入的旧原始色值仍保持兼容，后续应改为语义色。小程序和 H5 构建通过不替代微信真机、iOS 微信/企业微信 WebView 的 Safe Area 验收；其他小程序平台不在本次验收范围内。

## 后续授权的 H5 页面调整

工作台背景、标题、应用名与分组卡片改用语义 Token，卡片减少圆角和阴影。工作台搜索区补回底部 12px 内边距，卡片继续保留 16px 外边距。

整个 H5 App 使用宿主导航：隐藏 Taro 默认导航与共享自绘导航，首页移除品牌头、数据概览标题和刷新图标，消息入口移到首页正文末尾。H5 页面容器统一承担一次顶部 Safe Area；小程序自绘/原生导航保持原行为。

内页新建、上传、管理和刷新等操作移到底部，沿用原权限、禁用状态与回调。共享 ManagementPage 的 bottomActions 同时渲染底栏并预留正文空间；媒体库批量选择与普通操作栏互斥，分组编辑的更多与保存共用 FormSubmitBar。内容分组标题、弹层标题和表单字段保留。

浏览器回归覆盖工作台深浅色与窄屏、浏览器历史返回、搜索/权限/刷新；管理及个人区域共 27 个页面，含 3 次隔离 API fixture 写入、底栏定位与上下安全区检查。

## 后续页面迁移方案

1. 先审计 `apps/demo/app/src/pages/` 的 CSS/TS 颜色字面量、内联配色和固定背景。按“登录/首页/工作台/我的 → 系统列表与详情 → 表单及复杂业务”分批迁移；工作台已在后续授权中迁移；其余页面配色继续逐批处理。
2. 对每个颜色确定业务语义再替换：页面底色 `color-bg-base`，普通内容 `color-bg-surface`，弹层 `color-bg-elevated`，主要/次要/提示文字对应 text Token，填充按钮使用 `color-primary-solid` 或 `color-danger-solid`。不要用固定浅色色板或把相近数值机械当成同一业务语义。
3. 页面间距、字号、圆角与阴影直接消费已有 Token；优先复用 ManagementPage、Card、FormLayout、DetailLayout 和 Sheet。原生导航页不再自行叠加 top inset；Footer 与 Sheet 不重复处理 bottom inset。
4. 将旧 `confirmColor: '#…'` 改为 `confirmColor: 'var(--color-danger)'` 等语义色。图标保留原形状、含义与路径，使用 mask + CSS Token；品牌图片和素材不做反色滤镜处理。
5. 主题设置入口作为后续业务任务单独实现：三个选项调用 `setMode`，展示 mode，必要时展示 resolved；不再引入第二份 store 或自行写缓存。
6. 每批迁移检查 system/live、手动浅色+系统深色、手动深色+系统浅色、刷新恢复、44px 触控、长文案、输入失败保留、固定操作栏与弹层。运行相关既有测试、移动类型检查和两端构建，再做浏览器与 iOS/微信真机验收。

## 验证记录

最终验证：App 651/651、Core App 13/13 测试通过；浏览器 13 项检查通过且无运行时错误；UI/App 严格类型检查、源码 lint、Token 漂移、Taro 版本与仓库边界检查通过；weapp/H5 构建通过，68/68 微信页面含主题 page-meta，theme.json 已生成。独立代码审查反馈已修复。可重跑：

```sh
pnpm --filter @yishan/ui theme:check
pnpm --filter @yishan/ui typecheck
pnpm --filter @yishan/demo-app tsc
pnpm --filter @yishan/demo-app exec biome lint src config
pnpm --filter @yishan/demo-app test
pnpm --filter @yishan/core-app test
pnpm check:taro
pnpm check:boundaries
pnpm build:app
pnpm --filter @yishan/demo-app build:h5
```

`tests/browser/theme.js` 对本地 H5 构建做浏览器回归，包含隔离的 API fixture；服务端口为 21833，不使用真实账号或写入真实 API。覆盖三种主题、系统变化、缓存恢复、WeUI 主题与实心按钮、小视口上下 inset、触控尺寸和 H5 原生 Modal。

当前环境的完整 `pnpm typecheck:mobile` 被 Core App 的既有 `@types/minimatch` 隐式类型定义缺失阻断；Core App 使用 `tsc --noEmit --types node` 验证，UI/App 的严格类型检查分别正常。完整 App `lint` 会扫描生成的 dist 而失败，本轮使用上述源码 lint，未修改无关工程配置。

2026-10-15 发布：应用提交 8ed6bb57 已推送 dev，通过既有 FC3 配置部署至 <https://h5.zerocmf.com>。148 个线上 HTML/JS/CSS 资源的 SHA-256 与发布包一致，未登录 API 返回 401；线上隔离 API fixture 验证的主题 13 项、工作台与 27 页面回归通过。构建产物及部署临时配置未提交。

## 修改文件清单

下方清单包含主题基础层及后续授权的页面调整，不含构建产物。

- `apps/demo/app/config/index.ts`
- `apps/demo/app/config/theme-assets.ts`
- `apps/demo/app/src/app.config.ts`
- `apps/demo/app/src/app.ts`
- `apps/demo/app/src/components/ApplicationIcon/app-icons.ts`
- `apps/demo/app/src/components/ApplicationIcon/index.module.scss`
- `apps/demo/app/src/components/ApplicationIcon/index.tsx`
- `apps/demo/app/src/components/feedback/DashboardSkeleton/DashboardSkeleton.module.scss`
- `apps/demo/app/src/components/management/ActionBar.module.scss`
- `apps/demo/app/src/components/management/ActionBar.tsx`
- `apps/demo/app/src/components/management/Breadcrumbs.tsx`
- `apps/demo/app/src/components/management/DateRangeSheet.module.scss`
- `apps/demo/app/src/components/management/DepartmentTreeNavigator.tsx`
- `apps/demo/app/src/components/management/DetailLayout.tsx`
- `apps/demo/app/src/components/management/FormLayout.module.scss`
- `apps/demo/app/src/components/management/FormLayout.tsx`
- `apps/demo/app/src/components/management/LineIcon.tsx`
- `apps/demo/app/src/components/management/ManagementList.module.scss`
- `apps/demo/app/src/components/management/ManagementList.tsx`
- `apps/demo/app/src/components/management/ManagementPage.module.scss`
- `apps/demo/app/src/components/management/ManagementPage.tsx`
- `apps/demo/app/src/components/management/ManagementSearch.module.scss`
- `apps/demo/app/src/components/management/ManagementSearch.tsx`
- `apps/demo/app/src/components/management/MenuTree.module.scss`
- `apps/demo/app/src/components/management/MenuTree.tsx`
- `apps/demo/app/src/components/management/OrganizationPicker.tsx`
- `apps/demo/app/src/components/management/PickerRow.tsx`
- `apps/demo/app/src/components/management/RegionPicker.module.scss`
- `apps/demo/app/src/components/management/RegionPicker.tsx`
- `apps/demo/app/src/components/management/SelectionFooter.module.scss`
- `apps/demo/app/src/components/management/SelectionFooter.tsx`
- `apps/demo/app/src/components/management/TimeField.h5.scss`
- `apps/demo/app/src/components/management/WeuiDateTimeField.h5.tsx`
- `apps/demo/app/src/components/management/WeuiPicker.h5.css`
- `apps/demo/app/src/components/management/menuResourceTypes.ts`
- `apps/demo/app/src/components/molecules/Card/Card.module.scss`
- `apps/demo/app/src/components/molecules/FormField/FormField.module.scss`
- `apps/demo/app/src/components/molecules/GridItem/GridItem.module.scss`
- `apps/demo/app/src/components/molecules/ListItem/ListItem.module.scss`
- `apps/demo/app/src/components/molecules/SearchBar/SearchBar.module.scss`
- `apps/demo/app/src/components/molecules/SectionHeader/SectionHeader.module.scss`
- `apps/demo/app/src/components/organisms/DashboardGrid/DashboardGrid.module.scss`
- `apps/demo/app/src/components/organisms/DashboardHero/DashboardHero.module.scss`
- `apps/demo/app/src/components/organisms/LoginBrand/LoginBrand.module.scss`
- `apps/demo/app/src/components/organisms/StatCard/StatCard.module.scss`
- `apps/demo/app/src/constants/index.ts`
- `apps/demo/app/src/hooks/useConfirm.ts`
- `apps/demo/app/src/pages/apps/WorkbenchHeader.tsx`
- `apps/demo/app/src/pages/apps/index.module.scss`
- `apps/demo/app/src/pages/apps/index.tsx`
- `apps/demo/app/src/pages/demo/health/index.tsx`
- `apps/demo/app/src/pages/demo/todos/index.tsx`
- `apps/demo/app/src/pages/index/components/HomeSection.tsx`
- `apps/demo/app/src/pages/index/index.tsx`
- `apps/demo/app/src/pages/system/_shared/MenuTreeListPage.tsx`
- `apps/demo/app/src/pages/system/attachments/folder-form/index.tsx`
- `apps/demo/app/src/pages/system/attachments/folders/index.tsx`
- `apps/demo/app/src/pages/system/attachments/index.module.scss`
- `apps/demo/app/src/pages/system/attachments/index.tsx`
- `apps/demo/app/src/pages/system/dept/index.tsx`
- `apps/demo/app/src/pages/system/dict/DictionaryList.tsx`
- `apps/demo/app/src/pages/system/module-management/detail/index.config.ts`
- `apps/demo/app/src/pages/system/position/index.tsx`
- `apps/demo/app/src/pages/system/role/index.tsx`
- `apps/demo/app/src/pages/system/user/departments/index.tsx`
- `apps/demo/app/src/pages/system/user/index.tsx`
- `apps/demo/app/src/pages/system/user/roles/index.tsx`
- `apps/demo/app/src/styles/common.scss`
- `apps/demo/app/src/styles/components.scss`
- `apps/demo/app/src/theme/index.ts`
- `apps/demo/app/src/theme/platform.ts`
- `apps/demo/app/src/theme/theme.ts`
- `apps/demo/app/tests/browser/management-first-batch.js`
- `apps/demo/app/tests/browser/theme.js`
- `apps/demo/app/tests/browser/workbench.js`
- `apps/demo/app/tests/confirm.test.cjs`
- `apps/demo/app/tests/menu-tree-components.test.cjs`
- `apps/demo/app/tests/theme-platform.test.cjs`
- `apps/demo/app/tests/theme.test.cjs`
- `docs/design/mobile-theme-system.md`
- `docs/superpowers/plans/2026-10-14-mobile-theme.md`
- `packages/ui/mobile/atoms/Badge/Badge.module.scss`
- `packages/ui/mobile/atoms/Button/Button.module.scss`
- `packages/ui/mobile/feedback/EmptyState.module.scss`
- `packages/ui/mobile/feedback/Loading.module.scss`
- `packages/ui/mobile/feedback/StateView.module.scss`
- `packages/ui/mobile/theme/ThemeProvider.tsx`
- `packages/ui/mobile/theme/colors.scss`
- `packages/ui/mobile/theme/controller.ts`
- `packages/ui/mobile/theme/index.ts`
- `packages/ui/mobile/theme/palette.ts`
- `packages/ui/mobile/tokens.scss`
- `packages/ui/package.json`
- `packages/ui/scripts/theme-css.cjs`

