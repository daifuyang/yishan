# TODO

当前待办。已完成或失去目标的 TODO 统一归档到 [`docs/engineering/archive/todos/`](./docs/engineering/archive/todos/)。

## 抽取「作用域详情」的生命周期守卫

- **涉及**：8 个详情页 —— `apps/demo/app/src/pages/profile/login-log/detail/index.tsx`、
  `apps/demo/app/src/pages/system/login-log/detail/index.tsx`、`apps/demo/app/src/pages/system/attachments/detail/index.tsx`、
  `apps/demo/app/src/pages/demo/todos/detail/index.tsx`、`apps/demo/app/src/pages/system/position/detail/index.tsx`、
  `apps/demo/app/src/pages/system/user/detail/index.tsx`、`apps/demo/app/src/pages/system/role/detail/index.tsx`、
  `apps/demo/app/src/pages/system/dept/detail/index.tsx`；另有一份在
  `apps/demo/app/src/pages/system/_shared/MenuDetailScaffold.tsx`（业务命名的策略，已被两个页面消费，与上面八份不同层）。
- **问题**：`load() + active() + sequence + session + useDidHide/useDidShow` 这段守卫被逐页复制，改一处要改九处。
- **下一步**：从真正相同的只读三件套（两个 login-log detail + attachments detail）开始，再回答那个未决的设计问题：
  抽一个 `useScopedDetail` hook 垫在 scaffold 之下，还是把全部页面迁到 scaffold 上？带写操作的页面（todos / position /
  attachments）入口守卫要多判 `|| locked.current`，并且各自带 `active()` 供提交时复用；`system/module-management/detail`
  的形状确实不同，不适合并入。

## 用户列表的 summary 也要按状态收口

- **涉及**：`apps/demo/app/src/pages/system/user/index.tsx:241`。
- **问题**：`summary={list.length ? `共 ${total} 位成员` : undefined}` 与刚在个人登录日志列表修掉的是同一个模式：
  错误态已经把行藏起来了，底部还在报一个总数。
- **下一步**：改用 `kind === 'ready'` 守卫，与 profile 登录日志列表保持一致。

## 把登录日志的浏览器场景收进 `apps/demo/app/tests/browser/`

- **涉及**：`apps/demo/app/tests/browser/`。
- **问题**：登录日志列表 / 详情没有提交过的浏览器脚本；质量门当时写通的那份放在 gitignore 的 `tmp/` 里，用完就删了，
  下一个人得从零再写一遍。该 harness 没有统一端口，每个脚本各自硬编码来源（`21003` / `21803` / `21813` / `21823` /
  `21824`），而 `apps/demo/app/README.md:103` 只写 `21803`，已经过时。
- **下一步**：把登录日志列表（含客户端筛选）与详情的场景补成提交过的脚本，并顺带修正 README 的端口说明。

## 架构基线的 OpenAPI 检查口径不一致

- **涉及**：`docs/architecture/api-v1-runtime-openapi.json`（runtime 基线）、`docs/architecture/api-v1-openapi.json`（旧版
  基线）、`apps/demo/api/test/integration/product.test.ts`。
- **问题**：两条基线的检查力度差了一整档。runtime 基线恰恰是被**最严格**检查的那一条 —— `product.test.ts:187-198`
  读取它，断言没有基线路径从运行中的应用里消失、应用相对基线只多出 `['/api/demo/v1/me/profile']`、**每一个** operation
  都与实时结果深比较（仅 `module-management` 与 app 登录/刷新的 `security` 三处有明确豁免），component schema 也整体
  deep-equal；CI 通过 `pnpm test:integration` 跑到它（`yishan-fullstack-ci` 的 api job，步骤 `API isolated MySQL integration tests`），本地实测 1/1 通过。
  真正的缺口是**另一条旧版基线** `api-v1-openapi.json`：`product.test.ts:202` 读取它、`:203-207` 算出增删的 operation、
  `:208` 把 diff 写进 `tmpdir()`、`:209-210` 打出四个计数
  （`OpenAPI comparison: {"baselinePaths":166,"currentPaths":110,"removedOperations":103,"addedOperations":12}`），
  然后**没有任何断言**，测试照样绿。166 对 110 也不是漂移：`api-migration-report.md:14` 说明旧版基线来自原始仓库、
  **包含默认未安装的 CRM**，两份文档本就在描述不同安装。另注：`scripts/check-openapi-drift.mjs` 回答的是另一个问题 ——
  它只收一个路径参数，比对**工作副本**与 `HEAD:<该路径>`（即「重新生成 dump 后忘了提交」），`package.json:20` 只用它
  检查 `apps/demo/api/openapi.json`，与上面两条基线都无关，所以「给基线加同一条 canonical 漂移检查」这句话本身也是错的。
- **下一步**：先定旧版基线的意图，再动手 —— 要么明确并断言真正成立的不变量（例如「被移除的 operation 必须能归因到 CRM
  模块」这种可表达的约束），要么删掉那份没有读者的 diff 计算与 `tmpdir()` 写入，只留 log 行并注明它**有意**仅作信息输出。
  不要直接断言原始增删列表：那会在任何人加接口时红 CI，因为两份文档描述的安装本就不同。

## `packages/core-contracts` 的 minimatch 类型错误（TS2688）

- **涉及**：`packages/core-contracts` 及其它声明了 tsconfig 却没写 `"types"` 数组的包。
- **问题**：无 index 的 `@types/minimatch@6.0.0` stub 被隐式包含，报 `TS2688: Cannot find type definition file for
  'minimatch'`，连带 `pnpm build:api`、`pnpm test:api`、`pnpm test:integration`、`pnpm typecheck:api`、
  `pnpm typecheck:mobile` 和两个 docs typecheck 一起失败。
- **下一步**：按已裁定的绕过办法在包内跑 `pnpm --filter <pkg> exec tsc --noEmit --types node`（必须在包内跑：
  根 `node_modules/.bin/tsc` 是 TypeScript 6.0.3）；根治要补 `"types"` 声明或换掉这个 stub。

## 新登录日志路由没有 403 覆盖

- **涉及**：`packages/core/system-api/test/my-login-log.routes.test.ts:41`。
- **问题**：`requirePermission` 被 stub 成 no-op，因此没有任何用例断言「缺少 `app:user:my-logins` 的调用方拿 403」。
- **下一步**：补一个 403 用例。风险低（`access` 对象与列表路由逐字相同），但这是新路由唯一留给推断的安全面。

## 客户端筛选续拉封顶后仍是「无出口」空态

- **涉及**：`apps/demo/app/src/pages/profile/login-log/index.tsx`。
- **问题**：客户端筛选叠加有上限的自动续拉（`AUTO_CONTINUE_LIMIT = 5`）后，当唯一命中项落在已加载窗口之外（大致第 6 页
  起）时，仍会停在一个**没有出口**的空态：配额耗尽，`kind` 落回 `'empty'`，文案断言「未找到符合条件的登录日志」。
  底部的「上拉加载更多」**不是逃生口** —— 空态在 `min-height: 100vh` 页面上约 220px，页面根本不滚动，`useReachBottom`
  永远不会触发，尽管提示现在会渲染出来。下拉刷新也**不会补回配额** —— `refresh()` 只重拉第 1 页、不重置任何计数，同样的空态
  文案会再次出现，用户唯一的出口是改筛选。这个上限本身是**刻意**设的界（让筛不出任何结果的筛选不至于变成无限请求循环），
  且严格窄于修复前「每个页数都坏」的行为；要收口的是*封顶之后*的状态，而不是这个上限。
- **下一步**：刷新完成时重置计数（例如监听 `list.refreshing` 的 true→false 跳变），并让封顶之后的状态诚实起来：要么换一套
  更准确的文案（例如「已加载 N 条仍无匹配」），要么给一个真正可用的手动入口。一行代码加一个文案决定，不涉及设计问题。

## 三个设置分子失去调用方

- **涉及**：`apps/demo/app/src/components/molecules/{SettingCell,SettingGroup,DangerAction}/`；三者仍从
  `src/components/molecules/index.ts:9-11,21-23` 再导出（值导出与类型导出各一组）。
- **问题**：`mine` / `security` 迁到共享 `ManagementList` / `ManagementCell` / `ActionSheet` 之后，这三个组件的调用方归零。
  全仓已核对：除各自的模块与 molecules barrel 外，源码、测试、浏览器脚本里都没有引用；本次新增的回归断言只覆盖
  `mine` / `security` 两个页面不再引用它们，不构成新的调用方。barrel 对其它分子仍在服役，所以它们现在是「还导出着、
  但没人用」的状态。
- **下一步**：二选一并写清理由 —— 删掉这三个组件并同步去掉 barrel 的导出，或者保留（若仓库外的产品在消费这个 barrel，
  它算是半个公开面）。选择本身还没定，属于一次独立判断，不该顺手在页面迁移里做掉。

## `FormError` 缺少尺寸/缩进变体

- **涉及**：`apps/demo/app/src/components/management/FormLayout.tsx`（`FormError`）与其 `FormLayout.module.scss`。
- **问题**：`FormError` 的 `padding: var(--space-3) var(--space-4) 0` 叠加登录页 body 的 24px 横向内边距，把错误文案推到
  40px，而它所描述的输入框起点在 24px —— 比它所属的字段多缩进 16px；`padding-top: 12px` 又压在登录表单 `gap: 20px` 之上，
  形成「上 32px / 下 20px」的不对称。页面侧没有可用的补丁：`FormError` 既不收 `className` 也不提供尺寸变体（因此
  `docs/superpowers/specs/2026-10-13-mobile-page-alignment-design.md` 里「错误文字 12px、右对齐」的登录页写法无法表达，
  已在同一次提交中改为陈述原子的真实行为）。
- **下一步**：在**基础层**给 `FormError` 加一个可选 `className` 或尺寸/缩进变体，并在 §7.1 的其它基础契约旁补一个契约测试。
  不在页面迁移里就地修。

## `SecretField` 的眼睛切换不理会 `disabled`

- **涉及**：`apps/demo/app/src/components/management/FormLayout.tsx`（`SecretField`）与其 `FormLayout.module.scss`。
- **问题**：`SecretField` 的明/密切换 `View` 只有 `onClick={() => setVisible(!visible)}`，**从不读 `disabled`**
  （`FormLayout.tsx:288-318`）。后果发生在本次刚迁移的密码页上：本应禁用的那行仍可点眼睛图标、把已输入的值**显示出来**
  —— 禁用就是禁用。对照一下其它封装都把 `disabled` 透传到控件本身（`TextField`→`Input` 在 `:116`，`TextAreaField`→`Textarea`
  在 `:139`，`SwitchField`→`Switch` 在 `:204`，`EnumField`→`Picker` 在 `:244`），所以字段的灰色禁用态是对的、只有眼睛
  还活着。这是一个**很窄**但确实存在的缺陷，与 Task 5 修的 `system/position/form` 中 `FormField.disabled` 不向控件透传是
  同一族 —— **两者都在基础线，不归任何页面线**。
- **下一步**：在**基础线**让明/密切换读 `disabled`（与其它 management-form 的 disabled 契约改动放在一起），并补一个
  契约测试归到 §7.1 的其它基础契约旁。不在页面迁移里就地修。

## 两套 `LineIcon` 词汇未统一

- **涉及**：`apps/demo/app/src/components/management/LineIcon.tsx`（`ICONS` 表 41 个名字，`LineIconName = keyof typeof ICONS`
  在 `:66`）与 `apps/demo/app/src/components/icons/LineIcon/LineIcon.tsx`（`:5` 直接列出 11 个名字：`user` | `shield` |
  `bell` | `settings` | `info` | `logOut` | `chevronRight` | `lock` | `history` | `eye` | `eyeOff`），以及它们的消费方。
- **问题**：两套图标词汇并存，谁也没去并掉另一套。management 这套缺 `user` / `bell` / `settings` / `info` / `logOut` /
  `history` 共六个语义，**legacy 那套六个都已经在那里实现了**；缺它们的页面只能取最近的名字糊上，于是 mine 退出登录
  行被画成「上传」箭头，messages/about/个人资料同样借了不对应的形状 —— 用户看到的是个「妥协」，不是设计。复验消费方：
  全仓 `from '@/components/icons'` 导入 `LineIcon` 的只有 `components/molecules/SettingCell.tsx:3` 与
  `components/molecules/DangerAction.tsx:3` 两个文件（`components/organisms/StatCard/index.tsx:2` 走的是同一 barrel
  但导入的是 `IconFont`，不是 `LineIcon`）。**这两个组件本身也是本次 1ad3b793 提交里被 orphan 掉的（见上一条 TODO）**，
  将来若按那条把它们删掉，legacy 这套 `LineIcon` 很可能**完全没人用了**，到时候「删一套、把七个名字并进另一套」就是
  顺理成章的下一步。
- **下一步**：在**基础线**里挑一套作为规范，把缺的六个名字并过去、把另一套退役 —— 起手就是上面那个事实：legacy 的最后
  两个 `LineIcon` 消费者本身也是待删分子。**这里不加图标，也不改两个组件。**

## apps 工作台样式表的清理

- **涉及**：`apps/demo/app/src/pages/apps/index.module.scss`、`apps/demo/app/src/pages/apps/pinned/index.module.scss`。
- **问题**：（1）未 token 化的字面量（BASE 就有，非本次引入）：`background: #F5F7FA`（`apps/index.module.scss:5`）、
  `border-radius: 6px`（`:52`）、`border-radius: 16px`（`:79`）、`box-shadow: 0 2px 8px rgba(17, 24, 39, 0.025)`（`:80`）、
  `color: #374151`（`:109`）、`color: #111827`（`:117`），外加一批裸 px 尺寸；有 token 等价物的应改用 token。
  （2）八个死类，全仓无人引用（无 TSX、无测试、无浏览器脚本），行号在 `apps/index.module.scss`：`apps__title`（`:36`）、
  `apps__sectionHeader`（`:16`）、`apps__group`（`:121`，写作 `.apps__group + .apps__group`）、`apps__hint`（`:125`）、
  `apps__editRow`（`:133`）、`apps__editName`（`:140`）、`apps__editor`（`:77`、`:150`）、`apps__saveError`（`:154`）。
  其中两个藏在「另一个成员还活着」的选择器串里，**整行删掉会带走活着的规则**：`:16` 是
  `.apps__header, .apps__sectionHeader { … }`（`.apps__header` 活着，`WorkbenchHeader.tsx` 在用），只摘掉
  `, .apps__sectionHeader`；`:77` 是 `.apps__section, .apps__editor { … }`（`.apps__section` 活着且被浏览器用例断言，
  `tests/browser/workbench.js:168`），只摘掉 `, .apps__editor`；`:150` 的 `.apps__editor > .apps__category` 是随
  `.apps__editor` 一起死的复合规则，跟 `:77` 一并删除（`.apps__category` 自己是活的）。另外别以为这个文件里只有
  `apps__pageTitle` 是活的 —— 还有十一个活类必须留着：`apps__action`、`apps__category`（`:112`）、`apps__grid`、
  `apps__item`、`apps__label`、`apps__pressed`（`ApplicationGrid.tsx`）、`apps__header`（`WorkbenchHeader.tsx`）、
  `apps__pageTitle`、`apps__refreshError`（`index.tsx`）、`apps__section`（`:77`）、`apps__top`（`WorkbenchHeader.tsx`）；
  浏览器用例断言 `apps__pageTitle`（`workbench.js:166,209`）、`apps__section`（`:168`）、`apps__category`（`:169,174`）与
  `apps__grid`/`apps__label`，`tests/workbench.test.cjs:27` 断言 `apps__top`。
  （3）未定义的类：`apps/pinned/index.tsx:112` 用了 `styles['order__button--disabled']`，而 `pinned/index.module.scss`
  根本没定义它 —— 禁用态没有样式，class 属性里带着字符串 `undefined`；全仓仅此一处引用。
  （4）`.apps` 丢掉了自己容器提供的底部安全区：`.apps` 声明 `padding: 0 0 var(--space-4)`，而同一元素上有三条同优先级规则
  （`src/styles/common.scss:198-201` 的 `.page-container`、`PageContainer.module.scss:2`、`.apps`），最后一条的扁平 `16px`
  胜出；`PageContainer` 自己的规则是 `padding-bottom: calc(var(--space-4) + var(--safe-area-bottom))`，于是**每个**
  PageContainer 消费者都拿到安全区，只有这页 opt out。H5 上两者数值相同（浏览器里 `--safe-area-bottom` 为 0，看不出来，
  浏览器用例也测不到），但项目要发小程序包，在带 home indicator 的 iPhone 上最后一行内容会比预期低约 34px，可能压到
  tab bar 之下。这条是**既有问题**（BASE 就是扁平底），**不由本次计划的工作引入或触及**，因此只记录、不修。
- **下一步**：删掉死类（`:16` 与 `:77` 要**拆列表**而不是删整行），把字面量换成 token，禁用态要么定义样式要么删掉引用，
  最后一条则去掉 `.apps` 的 bottom 声明，让页面像其它消费者一样继承 `PageContainer` 的安全区（保留横向全出血的最小写法，
  是把左右内边距改成 left/right 一对 longhand、不声明 bottom）。**不要**把卡片之间那 20px 的间距当成偏差 —— 另一轮修复
  正把它收成 16px。

