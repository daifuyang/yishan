# 工作台应用核对与交付

## 本轮调整：先展示菜单入口

按后续确认的分步实施要求，工作台现在展示后台已返回的有效功能菜单，包括尚未完成移动端适配的应用；不再因未适配或缺少额外的前端权限码而隐藏图标。分类、名称、顺序和可用菜单仍复用现有接口，不新增后台菜单体系。

未适配或未打包的功能点击后弹出「移动端功能正在建设中，敬请期待。」；不存在虚构移动端路由。占位入口可以搜索、加入常用、移除、排序和按账号保存。已实现业务页面继续使用现有访问校验。工作台增加局部线性图标适配 app-icons.ts，首页 UI 不变。

以下原始核对表的页面实现状态仍有效；后文「未适配入口不展示」及默认只显示用户管理的说明属于上一阶段策略，本轮以本节为准。实际入口数量由当前后台菜单返回决定，不会在前端伪造后台未返回的菜单。

本轮验证：Lint 与 TypeScript 通过，60/60 单元及回归测试通过，H5／微信小程序构建通过，10 组 H5 浏览器场景通过（新增占位图标与弹窗覆盖）。构建仍有现有包体积、浏览器数据和小程序缓存警告；未做微信真机验证。

## 核对来源

此清单来自仓库菜单种子、模块 meta、页面源码和 app.config.ts，不代表某个生产租户的数据库快照。运行时以已授权菜单与 capabilities 为准。

Core 常驻；demo、portal、shop 的 meta.enabled=true，数据库 sys_module.enabled 仍决定实时可用状态；crm 的 meta.enabled=false，不挂载。无租户字段或租户切换机制，当前是单租户部署。

| 模块 ID | 菜单名称 | 一级分类 | 页面权限 | 启用状态 | 移动端路由 | 实现／访问 |
|---|---|---|---|---|---|---|
| core<br>/ | 仪表盘（隐藏） | 系统管理 | system:dashboard:read | Core 常驻 | — | 移动首页已有指标展示；隐藏 PC 菜单，不另生成工作台入口 |
| core<br>/system/user | 用户管理 | 系统管理 | system:user:list | Core 常驻 | pages/system/user/index | 已实现；需授权菜单及权限，含详情、新建、编辑 |
| core<br>/system/role | 角色管理 | 系统管理 | system:role:list | Core 常驻 | — | 无移动端页面 |
| core<br>/system/department | 部门管理 | 系统管理 | system:department:list | Core 常驻 | pages/system/dept/index | 仅占位页，禁止入口与直达 |
| core<br>/system/position | 岗位管理 | 系统管理 | system:position:list | Core 常驻 | — | 无移动端页面 |
| core<br>/system/menu | 菜单管理 | 系统管理 | system:menu:list | Core 常驻 | — | 无移动端页面 |
| core<br>/system/dict | 字典管理 | 系统管理 | system:dict:list | Core 常驻 | pages/system/dict/index | 仅占位页，禁止入口与直达 |
| core<br>/system/region | 地区管理 | 系统管理 | region:list<br>region:tree<br>region:path<br>region:read | Core 常驻 | — | 无移动端页面 |
| core<br>/system/site | 站点配置 | 系统管理 | system:option:list | Core 常驻 | — | 无移动端页面 |
| core<br>/system/storage | 云存储 | 系统管理 | system:storage:list | Core 常驻 | — | 无移动端页面 |
| core<br>/system/attachments | 媒体库 | 系统管理 | system:attachment:list | Core 常驻 | — | 无移动端页面 |
| core<br>/system/login-log | 登录日志 | 系统管理 | system:login-log:list | Core 常驻 | pages/system/login-log/index | 仅占位页，禁止入口与直达 |
| core<br>/account/api-tokens | API Token（隐藏） | 我的账户 | system:api-token:manage | Core 常驻 | — | 无移动端页面 |
| core<br>/account/center | 个人中心（隐藏） | 我的账户 | — | Core 常驻 | — | 已有个人中心 Tab／资料页；隐藏 PC 菜单，不另生成入口 |
| crm<br>/crm/dashboard | 首页 | CRM | crm:dashboard:view | 装载关闭 | — | 无移动端页面 |
| crm<br>/crm/customers | 客户 | CRM | crm:customer:list | 装载关闭 | — | 无移动端页面 |
| crm<br>/crm/pool | 客户公海 | CRM | crm:pool:list | 装载关闭 | — | 无移动端页面 |
| crm<br>/crm/customer-detail | 客户详情（隐藏） | CRM | crm:customer:detail | 装载关闭 | — | 无移动端页面 |
| crm<br>/crm/contacts | 联系人 | CRM | crm:contact:list | 装载关闭 | — | 无移动端页面 |
| crm<br>/crm/opportunities | 商机 | CRM | crm:opportunity:list | 装载关闭 | — | 无移动端页面 |
| crm<br>/crm/quotations | 报价单 | CRM | crm:quotation:list | 装载关闭 | — | 无移动端页面 |
| crm<br>/crm/contracts | 合同 | CRM | crm:contract:list | 装载关闭 | — | 无移动端页面 |
| crm<br>/crm/payments | 回款 | CRM | crm:contract:payment | 装载关闭 | — | 无移动端页面 |
| crm<br>/crm/tasks | 任务 | CRM | crm:task:list | 装载关闭 | — | 无移动端页面 |
| crm<br>/crm/products | 产品/服务 | CRM | crm:product:list | 装载关闭 | — | 无移动端页面 |
| demo<br>/demo/quickstart | 快速入门 | 示例插件 | demo:quickstart:read | 装载开启；流量开关待运行时确认 | — | 无移动端页面 |
| demo<br>/demo/health | 健康检查 | 示例插件 | demo:health:read | 装载开启；流量开关待运行时确认 | — | 无移动端页面 |
| demo<br>/demo/todos | Todo 示例 | 示例插件 | demo:todos:list | 装载开启；流量开关待运行时确认 | — | 无移动端页面 |
| demo<br>/demo/region | 省市级联 | 示例插件 | region:list<br>region:tree<br>region:path<br>region:read | 装载开启；流量开关待运行时确认 | — | 无移动端页面 |
| portal<br>/portal/categories | 分类管理 | 门户管理 | portal:category:list | 装载开启；流量开关待运行时确认 | — | 无移动端页面 |
| portal<br>/portal/articles | 文章管理 | 门户管理 | portal:article:list | 装载开启；流量开关待运行时确认 | — | 无移动端页面 |
| portal<br>/portal/pages | 页面管理 | 门户管理 | portal:page:list | 装载开启；流量开关待运行时确认 | — | 无移动端页面 |
| portal<br>/portal/article-templates | 文章模板 | 门户管理 | portal:article-template:list | 装载开启；流量开关待运行时确认 | — | 无移动端页面 |
| portal<br>/portal/page-templates | 页面模板 | 门户管理 | portal:page-template:list | 装载开启；流量开关待运行时确认 | — | 无移动端页面 |
| shop<br>/shop/categories | 分类管理 | 商城管理 | shop:category:list | 装载开启；流量开关待运行时确认 | — | 无移动端页面 |
| shop<br>/shop/attributes | 属性管理 | 商城管理 | shop:attribute:list | 装载开启；流量开关待运行时确认 | — | 无移动端页面 |
| shop<br>/shop/products | 商品管理 | 商城管理 | shop:product:list | 装载开启；流量开关待运行时确认 | — | 无移动端页面 |
| shop<br>/shop/skus | SKU 管理 | 商城管理 | shop:sku:list | 装载开启；流量开关待运行时确认 | — | 无移动端页面 |
| shop<br>/shop/orders | 订单管理 | 商城管理 | shop:order:list | 装载开启；流量开关待运行时确认 | — | 无移动端页面 |
| core<br>/contacts | 通讯录 | 运行时一级菜单；无目录时使用注册分类 | app:contacts:dept-tree<br>成员页另需 app:contacts:dept-users | Core 常驻 | pages/contacts/index/index | 已实现及注册，但仓库种子没有该菜单；仅真实授权菜单存在时可展示 |

CRM customers/action 文件是未注册的说明页；消息中心为待接入空态，均不作为应用。个人资料、密码、安全、设置、关于、本人登录记录是账户／基础导航页面，无对应可显示的后台功能菜单，保留现有个人中心访问方式。

## 实际展示与实现

仓库有 Core（系统管理、我的账户）以及 crm、demo、portal、shop 四个扩展模块，共 39 个功能菜单种子；完整清单见上表。通讯录是已实现的移动端能力，但默认种子没有 `/contacts`。

- 系统管理：用户管理、角色管理、部门管理、岗位管理、菜单管理、字典管理、地区管理、站点配置、云存储、媒体库、登录日志，以及隐藏仪表盘。
- 我的账户：隐藏的 API Token、个人中心。
- CRM：首页、客户、客户公海、隐藏客户详情、联系人、商机、报价单、合同、回款、任务、产品/服务。
- 示例插件：快速入门、健康检查、Todo 示例、省市级联。
- 门户管理：分类管理、文章管理、页面管理、文章模板、页面模板。
- 商城管理：分类管理、属性管理、商品管理、SKU 管理、订单管理。

默认菜单下，拥有 `system:user:list` 且获授权的用户展示「用户管理」。若真实菜单中启用并授权 `/contacts`，同时拥有 `app:contacts:dept-tree`，再展示「通讯录」。普通用户展示二者的授权交集；没有可用交集时显示空状态。已注册的占位页不代表已完成适配。没有新增业务页面或伪造默认菜单。

## 接入方式与交互

- 一级目录、目录顺序和应用顺序来自真实授权菜单 `sort_order`；菜单名称及图标可以复用现有字段。以稳定路径 + 显式权限关联注册项，不通过中文名称推断页面。无目录时才使用注册项 category。
- 注册项必须声明 backendModuleId：Core 使用 `core`；扩展应用必须使用服务端实际模块 ID。缺失模块归属默认拒绝；扩展模块只有 capabilities 的 enabledModuleIds 包含该 ID 才可用。
- 未实现、未打包、隐藏、禁用、外链、无权限、目录节点、按钮节点和重复入口均过滤。祖先目录失效会过滤其整个分支。
- 搜索在可访问目录内匹配当前菜单名、注册名及少量声明关键词，忽略大小写与空格，不调用搜索接口。不匹配时显示「未找到相关应用」。
- 常用最多八项，未配置时按菜单顺序初始化；编辑界面支持添加、移除、上移、下移、取消和完成。保存失败保留草稿，明确保存空列表不会重新自动填充。
- 使用现有 Taro storage 保存，无服务器常用接口、无新增数据库表。v2 key 按 API 部署和用户 ID 隔离；H5 同源存储天然按 origin 隔离。旧的仅用户 ID 缓存不自动迁移到新部署作用域，首次使用回到默认常用；之后保存的设置可恢复。当前系统无租户模型，未来增加租户切换时必须把服务端可信 tenantId 加入 key 和请求 owner/generation 校验，不能只沿用用户 ID。
- 首页只调整共享常用数据读取，尊重顺序和明确空配置，没有改变首页 UI。
- 每次工作台重新显示、手动刷新、下拉刷新及点击应用都会按需要重新校验；强制刷新同步菜单及共享身份请求（me/capabilities），服务端继续决定数据访问权限。
- 复用原路由工具，TabBar 使用 switchTab，其他页面使用 navigateTo；导航期间阻止重复点击。搜索和必要页面状态在正常返回后保留。
- 初次加载使用骨架；首次失败展示重试；刷新失败保留已有应用并提供重试。请求合并、缓存和 generation 校验防止重复与旧响应覆盖；已退出账号的响应不能恢复数据。
- 图标复用当前首页的 Lucide SVG data URI View 实现，不引入 DOM 图标库、Emoji 或额外依赖；未知图标回退统一应用图标。四列网格、50px 图标容器、24px 图标、12px 内容圆角、44px 操作触控区域。

## 本次文件

| 文件 | 调整 |
|---|---|
| src/pages/apps/index.tsx、index.module.scss、index.config.ts | 工作台构成、四列布局、搜索、骨架、状态、刷新与编辑入口 |
| src/pages/apps/ApplicationGrid.tsx | 工作台局部应用宫格 |
| src/pages/apps/FavoritesEditor.tsx | 自包含常用编辑草稿与保存反馈 |
| src/pages/apps/navigation.ts | 最新权限校验与重复导航保护 |
| src/modules/registry.ts | 真实一级菜单分组、去重、关键词、静态注册与模块启用检查 |
| src/constants/page-config.ts、src/app.config.ts | 单一静态主包／分包注册清单，当前仍无分包 |
| src/constants/menu-routes.ts | 路由适配过滤失效节点和未注册页面 |
| src/stores/modules.ts | 共享常用顺序、作用域存储、请求合并、刷新与并发保护 |
| src/stores/auth.ts | 仅导出现有 loadIdentity 供工作台复用，避免独立刷新覆盖权限 |
| src/pages/index/index.tsx | 三处常用读取兼容调整，UI 不变 |
| tests/workbench.test.cjs、tests/modules.test.cjs | 工作台与已有模块回归测试 |
| tests/browser/workbench.js | 可重跑 H5 浏览器场景；接口测试夹具仅存在于测试代码 |
| WORKBENCH-DELIVERY.md | 模块核对与交付报告 |

没有修改 PC、后端、数据库、登录页面、个人中心页面或 TabBar。工作区原有改动保留，未提交或推送代码。

## 验证结果

2026-10-08：

| 检查 | 结果 |
|---|---|
| pnpm --filter yishan-app lint（Biome + tsc --noEmit） | 通过 |
| pnpm --filter yishan-app test | 58/58 通过，含 11 项新增工作台测试和原有回归 |
| pnpm --filter yishan-app build:h5 | 通过；Webpack H5 主包与入口体积警告 |
| pnpm --filter yishan-app build:weapp | 通过；app.json 注册 21 页、3 个原生 Tab；构建有缓存警告 |
| Playwright H5，320px 视口 | 10 组场景通过：管理员目录、占位过滤、小屏、搜索、常用编辑恢复、账号隔离、导航返回、刷新重试、撤权与禁用菜单、无权直达不请求业务数据 |
| 独立代码审查 | 发现并修复跨 Store 身份刷新竞争；生产 auth + modules 集成回归通过 |
| H5 开发服务及配置热更新 | 重启失效的 esbuild 所属 App 开发进程，并移走引用旧依赖路径的 development-h5 缓存后通过；实际 21003 地址正常进入登录页，app.config.ts 和 page-config.ts 热编译通过 |
| 微信开发者工具／真机／真实账号联调 | 未进行；编译和接口夹具验证不代表真机或真实部署验收 |

构建日志包含 baseline-browser-mapping/caniuse 数据过期、Webpack 缓存无法解析 taro-loader、H5 包体积警告；没有升级依赖或清理既有构建配置。浏览器预期的 500 错误来自异常测试夹具，不是构建错误。

浏览器测试使用本地构建产物与隔离接口夹具，既没有连接生产系统、也没有创建测试业务数据。重跑方式：在 localhost:21803 启动 dist/h5 静态服务，打开 Playwright 会话，再执行 `playwright-cli -s=<session> run-code --filename=apps/yishan-app/tests/browser/workbench.js`。测试仅对该本地 origin 清理测试会话存储。

## 后续最小扩展

本期无需新增「移动端应用管理」。新增可用模块只需后端已有菜单／权限注册、实现并登记 PAGE_CONFIG 的主包或分包页面、在 MOBILE_MODULES 声明真实 backendModuleId／稳定菜单路径／权限／入口，工作台 JSX 无需修改；详情页继续接入现有页面权限守卫。

如果未来管理员必须单独配置移动端展示：在现有菜单模型添加一组可选 mobile 配置（visible、sort、icon、category），沿既有 TypeBox → OpenAPI → 客户端链路传递，在现有菜单编辑表单增加轻量字段；仍以注册表为打包白名单，不新增菜单表、独立权限或运行时页面插件。

### 现有 H5 路由限制

Taro 4.2.0 的页面过渡未结束时立刻点击返回，可使上一页保留 `taro_page_shade` 并隐藏。该行为同样在首页 → 用户管理 → 立即返回复现；首页导航、PageHeader 返回和公共 router 未由本任务修改。正常过渡完成后的返回和工作台搜索状态恢复已通过。浏览器回归等待 600ms 的 Taro 过渡完成后操作返回；本期没有通过改全局路由配置或强制显示隐藏页来掩盖该问题。后续建议单独针对公共 H5 路由过渡修复并回归三个 Tab 和所有详情页面。
