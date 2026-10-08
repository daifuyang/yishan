# 将 all 中的基础能力合入 main：Core 边界与实施建议

分析日期：2026-10-08。分析基于本地及已存在的远端引用，未 fetch、checkout、merge、修改业务代码或执行部署。

| 引用 | 提交 |
| --- | --- |
| `main` / `origin/main` | `0dc03c7` |
| `all` / `origin/all` | `b0764f4` |
| 公共祖先 | `1f55608` |

## 1. 推荐结论

把 `main` 定位为可独立运行的 Yishan Core monorepo，保留 API、管理后台、移动端基础壳、文档和现有共享组件。业务模块仅保留 `demo` 作为开发及验收样例。CRM、portal、shop 的实体、流程、页面、菜单、种子、接口和迁移不进入 Core。

这次优先做 **基础修复与已形成闭环的 Core 重构回迁**。从 `main` 建隔离工作分支，按能力组审查 `main → all` 的最终差异；独立提交可以选取，混合提交只移植必要文件或代码片段。数据库历史、静态资源兼容与 CI 必须在合入前修正。当前不需要先拆成一批 `@yishan/core-*` npm 包，也不需要新建抽屉框架、通用工作流或插件市场。

CRM 已在 `codecloud-platform/apps/crm` 独立运行，当前使用基础代码快照。将内容合入 Yishan `main` 不会自动更新 CRM；后续应按明确 Core 版本向 CRM 同步基础修复，不把原 `all` 的整套代码再次覆盖到 CRM。

| 做法 | 判断 |
| --- | --- |
| 按能力组回迁最终差异，保留 main 的历史与边界 | 推荐；容易审查、验证和回滚 |
| 直接 merge all，再删除业务目录 | 不采用；生成客户端、认证旁路、全局样式、移动入口、schema 与部署配置仍可能携带业务，删除目录不能解决这些依赖 |
| 先把全部 Core 拆成可发布包，再合入 | 延后；现有代码依赖 app 装配、相对路径、构建产物和运行目录，当前会同时改变大量接口 |

## 2. 分支实际状态：主要工作是回迁增量

`git rev-list --left-right --count main...all` 返回 `1 / 194`。main 独有的是忽略本地 worktree 的提交。两个分支之间有 **603 个文件差异，113,141 行新增、13,838 行删除**，其中包括大量业务源码、文档、截图、生成代码和工具技能。

但是 API 的 `core/` 目录实际只有 **17 个文件**发生变化；加上 config、db/schema 和 API 根 test，共 **28 个文件**。不能按 194 个提交的标题判断全部都需要合并：部分提交的最终内容已经被 main 的其他历史包含。

已核对以下能力在 main 中已有，相关实现与 all 相同：

- 用户、部门、岗位、角色、菜单、字典、附件、登录日志、JWT/Cookie、PAT、RBAC。
- `sys_module` / `sys_module_migration`、模块扫描与启停、模块组件注册和动态页面解析。
- `sys_region`、地区种子与管理页、`RegionCascader`、demo 的地区示例。
- TipTap / FormEditor 的组件源码；all 新增的主要是发布包装。
- OpenAPI 的 operationId/security 基础机制；前端基础 envelope 错误提示、401 刷新单飞、ProTable 请求适配。

main 初始 SQL 与当前 `all/drizzle/meta/0000_snapshot.json` 都包含相同的 **31 张 Core 表名**；all schema 增加的唯一 Core 表是 `sys_enum`。本次仅比较了该 snapshot 与初始 SQL 的表集合，不能据此声称全部字段、索引或真实数据库已经一致。

main 已有 `scripts/check-main-baseline.mjs`，允许的 API 业务模块只有 `demo`，这说明分支原本就有 Core 基线方向。需要完善守卫，而不是重新发明 Core 目录体系。

## 3. Core 的取舍标准

一个改动进入 main，应同时满足：

1. CRM、portal、shop 被移除后，仍有确定用途或修复 Core 本身的错误。
2. 不需要 Core 知道客户、商机、报价、合同、工单或销售状态。
3. 请求、类型、权限、种子、迁移、前端消费与测试形成闭环。
4. 能说明已有部署和调用方的兼容影响。
5. 现有能力不能已经直接解决同一问题；没有真实复用时，工具与组件可继续留在产品内。

因此，身份与权限检查属于 Core，客户的数据范围策略属于 CRM；附件存储属于 Core，报价附件的关联关系属于 CRM；菜单到路由的解析属于 Core，公开报价路径与其免登录策略属于 CRM；通用字典存取属于 Core，商机阶段与允许转换属于 CRM。

## 4. 优先回迁的能力及文件

下面路径相对仓库根目录。提交是来源证据，不代表可以不经审查直接执行整组 cherry-pick。

| 能力 | 主要文件 | 来源与决定 |
| --- | --- | --- |
| Windows/Linux 开发脚本兼容 | API/app/docs `package.json`，`pnpm-workspace.yaml` | `25b67dc`、`58c97ab`；合入 cross-env/rimraf 和 example workspace 排除，按需要更新锁文件 |
| 开发代理配置共享 | `packages/shared-config/`、admin `config/proxy.ts`、app `config/dev.ts` / `index.ts` | `021016c → f0819ca → 7a5fd5c`；有 admin/app 两个真实消费者，适合保留源代码 workspace 包，不把它误当可直接安装的外部 Core 包 |
| 模块装载简化 | API `src/core/module-loader/module-loader.ts`、`src/scripts/onboard-modules.ts` | `f635c96`、`5a4f0a9`；采用编译产物优先，调用签名同步，保留既有 enabled 状态与 dist-only 行为 |
| Windows 开发路由重复注册修复 | API `src/app.ts:140` | `6aa3867` 中的独立 hunk；ignoreFilter 使用 autoload 已归一化的 `/_dev/`，不跟取 OpenAPI 与 CD 改动 |
| App 匿名登录/刷新 | API `src/core/permissions/catalog.ts:64`、`test/app.auth.routes.test.ts` | 从 `b0764f4` 拆取 `app:auth:login` / `app:auth:refresh`；不带 `crm:public-quote:view` |
| 模块业务错误 HTTP 语义 | API `src/constants/business-codes/index.ts`、`test/business-error-response.test.ts` | 从 `b0764f4` 拆取；33xxx 识别为模块业务错误并使用 HTTP 400，避免成功 schema 二次序列化错误 |
| 多层无路径菜单目录 | admin `src/utils/dynamicRoutes.ts`、对应测试、`src/app.tsx` 的调用片段 | 来源 `722d4f2` 及后续修正；采用 all 最终版本，不带 CRM lead 页面与公开报价旁路 |
| 登录失败与会话失效分流 | admin `src/requestErrorConfig.ts`、登录页、对应测试 | `e07ae5c`；错误密码的 401 不应刷新会话；需要同时修正重复提示问题 |
| 通用菜单 icon 别名 | admin `src/app.tsx` 的 IconMap | `d0a6089` 及最终差异；按需要只取映射，不引入 portal/shop 页面 |
| dev/build 产物隔离 | admin `config/config.ts` 的 outputPath | 从 `b0764f4` 拆取；单独验证 dev 进程与生产 build 不覆盖同一目录 |
| Core seed 去除不用的业务数据 | API `src/scripts/seed/config.ts` 及四份 portal JSON 删除 | `c020c6b`；先确认 main 的 seed 调用无消费者，再去除失效的类型和导入 |
| 系统 CRUD 统一实现 | API `src/core/routes/admin-crud.ts`，六个管理路由，三个测试文件 | 见下节；必须包含权限目录注册的后续修复 |

HTTP 语义改动有可见兼容影响：33xxx 从未识别/HTTP 500 改为 HTTP 400，30xxx–32xxx 的既有 HTTP 200 保持。模块错误编号段应在 Core 文档中明确；前端同时验证响应失败时保留业务 message，不能只改后端状态码。

共享代理的旧注释仍提到已经删除的 `YISHAN_API_PORT`；回迁时应同步修正。保持当前 Node `22.22.1`、pnpm `8.15.9` 与项目依赖约束，迁移本身不顺带升级工具链。

### CRUD 必须作为完整能力组回迁

来源顺序：

```text
6e01aa7  工厂 + positions
de9655b  departments
81fa484  users
85a93a2  menus
1e5c363  roles
cd55282  dicts
51bdc0c  字典真实处理器测试
c2d9e30  恢复 import 时权限目录声明
6444469  positions alias 修正
```

最终形态使用 `declareCrudPermissions` 在导入路由时注册权限，再把 `predeclaredPermissions` 传给工厂。若只取最早几个提交，权限注册会被推迟到 Fastify 插件执行，seed 和权限目录读取可能缺项。

工厂只承担重复的路由/响应装配。roles 创建和更新仍保留 `system:role:grant` 检查，menus 的授权树、特殊 ID 校验仍在对应路由文件内。这是值得保留的“适度抽象”，不用进一步统一所有业务动作。

## 5. 静态资源能力可以合入，但要先修配置兼容

候选组：API `src/config/admin.ts` / `storage.ts` / `index.ts`、`core/plugins/external/static.ts`、attachments 路由和服务、`test/static-plugin.test.ts`。来源主要是 `09bb962`、`9263f77`。

Admin SPA 的 `/admin/` trailing slash、深路径 fallback、避免重复 sendFile decorator 等修复可以采用。但 all 最终实现有两处不适合原样合入：

| 问题 | 证据 | 合入条件 |
| --- | --- | --- |
| 启动时 uploads 不存在就不注册路由，首次上传后仍然 404 | `static.ts:29` 与附件服务稍后 mkdir 行为 | 可写部署在 boot 创建目录并注册；只读 FC 环境明确真实可写路径和服务方式，不能无条件在 `/code` mkdir |
| 非默认 UPLOAD_DIR 的磁盘位置和公开语义改变 | `storage.ts:25,37` | 明确兼容旧配置或提供显式迁移说明，覆盖 `public/uploads`、`uploads`、自定义公开/私有目录 |

例如，旧 `UPLOAD_DIR=uploads` 写 `<cwd>/uploads` 并返回 `/uploads/...`；新实现写 `<cwd>/public/uploads`，却判为非公开、urlPrefix 为空。它不是纯整理代码。

独立 CRM 已修复默认可写 uploads 的 boot mkdir，并有“缺目录启动 → 新建文件 → 同进程 GET”的回归测试。这项经验可以回迁；不能直接将它等同于所有 FC 存储配置都已支持。

验收还应覆盖 root/subpath 挂载、`/api` 未知路由保持 API 404、静态资源失败不能返回 SPA HTML、重启后文件 URL 兼容。

登录修复也有类似闭环问题：all 的登录请求未设置 `skipErrorHandler`，全局 handler toast 与登录 catch Alert 仍可能同时出现。应明确登录表单拥有登录失败反馈，并补一项真实交互测试。当前登录 URL 判断基于相对路径，绝对 URL 是否需要支持应按调用契约决定。

## 6. 需要延后或留在 CRM 的“看似 Core”内容

### sys_enum：当前实现仍是 CRM 字典

Core 中的 schema、repository、service、route 和 `sysEnum` 表增量暂不合入。

- `core/schemas/enum.schema.ts:18` 的 13 个允许 type 全是 `crm_*`，service 拒绝其他类型。增加另一个业务枚举还需要修改 Core，违背模块独立原则。
- main 已有 `sys_dict_type` / `sys_dict_data`，包括 value/label、启停、排序、审计、精简 map 与缓存。先确认稳定 code、不可修改身份等要求是否真需要第二套字典模型。
- `EnumRepository.findActiveByType` 没有过滤 enabled，批量版本却过滤，且两者共用缓存。`EnumService` 的 `1_000_001/2 as never` 不在有效业务码范围。新增路由大量 any，没有配套的新枚举测试闭环。
- `0010_create-sys-enum.sql` 未注册到 journal，已注册的 `0002_init.sql` 同样创建 sys_enum。不能机械复制两份 SQL 并声称迁移完整。

独立 CRM 已携带 sys_enum，暂时保留其契约。未来若确定 Core 需要这项能力，再选择复用现有字典，或将“通用存取”与“业务允许类型/种子”分离，业务声明不反向写进 Core。

### 按钮权限：方向正确，API 契约未接通

all 的 admin `utils/permission.ts:29` 在 permissions 缺失时返回 true。API `core/schemas/auth.ts` 没有 permissions 字段，`auth/index.ts:142` 只取 roleCodes，已查询的权限集合没有下发。因此真实用户的按钮权限没有被这项 hook 收敛。

它不能作为成熟权限能力直接回迁。若后续实施，最小闭环为：现有 PermissionService 结果 → `/me` schema/response → OpenAPI/generated/SDK → UI hook → 未登录、无权限、未知/加载、超管、权限更新后的测试。加载或缺字段的策略应明确；后端授权检查持续作为实际安全边界。

### CRM drawer、日期和金额工具

`modules/crm/components/drawer/_shared/` 仍有 CRM 状态映射、1100px 最小宽度、CRM 对话框层级和活动轨道布局。仅因有 `_shared` 名称，不应把它升格为 Core 抽屉系统。Ant Design 已提供基础 Drawer/Modal，等待第二个真实消费者再抽必要行为。

`utils/money.ts` 现有业务消费者是报价；折扣、税率、数量精度公式仍属于产品。`date-range.ts` 带公海时长语义且当前没有业务调用。安全日期格式化虽可复用，但当前 Core 尚无确定消费者，也可以延后，避免 main 变成没有用途的工具集合。

### TipTap 发布完善与全局 Modal 政策

TipTap 源码在两个分支间相同。`da3cb14` / `d19f38f` 主要带来 React 19 类型、scoped 包名、README/LICENSE、清理、prepack 和产物检查；可以后续独立回迁，不必阻塞当前 Core 修复。

`d19f38f` 修改了 main 不存在的 portal/shop 消费者，不能整提交照搬。按包目录、admin dependency/CSS import/声明和锁文件定向移植。已实际验证 `pnpm --filter yishan-tiptap list --depth -1` 可以匹配 scoped 包，所以现有短 filter 不能被误报为改名后的确定构建故障。

`b0764f4` 的 centered modal、global.less、AttachmentLibraryModal top 删除会改变全部模态窗，应当独立评估长表单、确认框、嵌套抽屉与小高度视口，不作为报价 UI 修复的附赠合入。

## 7. 数据库历史：优先于“代码能编译”

main 只提交了 `drizzle/0000_init.sql`，没有提交 `meta/_journal.json`。该目录在 main 的 ignore 中，CI 通过生成元数据补齐，但生成发生在验收期间并不等于迁移历史已经成为版本化契约。

推荐保留 main 既有 `0000_init.sql`，验证与它对应的 snapshot/journal 后提交。若当前不合入 sys_enum，journal 不带 all 的 `0002_init`，也不带孤立 `0010_create-sys-enum`。不能将独立 CRM 的新 baseline 覆盖到已有 Yishan 数据库。

另一个继承问题是 Core 与 demo 都未指定独立 `migrations.table`，默认共用 `__drizzle_migrations`。Drizzle 用最新 created_at 决定待执行迁移，Core 时间戳可能使更早的 demo 初始迁移被跳过；随后 onboard 又把 journal tag 记录成完成，形成虚假的成功状态。

处理方式：

1. Core 保持自己的迁移表；demo 使用独立表，例如 `demo_drizzle_migrations`，模块模板也遵守此约定。
2. 空数据库验证完整 Core + demo 初始化、重复执行与不同时间戳顺序。
3. 既有数据库先只读核对 SQL hash、created_at、表/索引和模块标记，再设计历史衔接；模块表名改变不能让已执行的 DDL 重新运行。
4. 新 schema 变化通过前向迁移，历史 SQL 已上线后不覆盖、不通过改 journal 时间戳强制重放。
5. `sys_module_migration` 按 `(module_id, hash)` 记录展示状态，只有迁移确实成功才同步，不能按所有模块的相同 tag 做全局去重。

本次没有查询真实数据库，不假定线上属于空库或哪条历史已执行。新库初始化与已有库升级是两个不同验收场景。

## 8. CI 与部署：采用质量门禁，部署方式单独处理

值得回迁：MySQL/Redis 临时测试服务、生成契约的漂移检查、同 commit CI 成功后才允许 CD、smoke check。不能直接复制 all 的完整 workflow。

已确认的修正项：

- `yishan-fullstack-ci.yml:78` 调用未配置的 `gen:plugin-routes`；实际执行时 pnpm 打印“None of the selected packages has a script”并以 0 退出，不能把该步骤绿色当作生成成功，也不能误报为必然导致 CI 红灯。现有 Umi plugin 在后续 `max setup` 期间生成组件注册表，应删除冗余步骤并保留实际生成流程。
- CI 的 paths 没有覆盖 `packages/**`、`scripts/**`、`.tool-versions`，也没有覆盖 app/docs 的基础改动；这些改动可能不触发对应验证。
- 当前 CI 安装使用 `--no-frozen-lockfile --force`，会掩盖锁文件未同步；Core 合入后应验证冻结安装。
- CI 不应先生成新迁移再把它当作成功验收。以已提交 journal/SQL migrate 临时数据库，再对 schema 生成结果做无漂移检查。
- main 的 root build 只串联 TipTap/admin/docs，不包含 API build。完整验收需要显式 `pnpm --filter yishan-api build:ts`。
- `profiles/core.yaml` 仍声明 `yishan/hello` 和不存在的 `pnpm verify --profile`，实际基线是 demo。先修说明与实际流程的一致性，不把这些 YAML 当成已有按 profile 装配发行物的实现。

all 的 CD 当前只自动部署 `all`，并使用具体账号、OIDC provider 与 `YISHAN_API` environment。合入 Core 时保持部署目标与 Core 发布解耦，不能顺手把触发分支改成 main，从而沿用业务部署环境。

新 FC migration runner 暂不采用：它查询不存在的历史表 name 列，用 SQL hash 比较 journal tag；平铺 dist 后仍用向上三层定位根目录；复制过时模块目录；仅搬运依赖安装目录的 drizzle-kit wrapper；缺 Core config 和真实 CLI 依赖。apply 前 inspect 对空库也不成立。虽然目录名是 infrastructure，它还不是可交付的 Core 基础能力。

现有 SSH tunnel migration workflow 也不能作为已经可靠的替代直接照搬：`PASSWORD_RAW` 写在 node 命令之后，进入 argv 而不是环境变量；dry-run 只生成/列出 SQL，没有比较数据库已执行状态。优先把本地显式迁移链做正确，随后单独选择并验证一个部署迁移入口。

## 9. 明确排除的交付内容

- API/admin `modules/crm`、`portal`、`shop`，CRM 手写 service、其种子和全部业务 SQL。
- admin `/q/:token`、`pages/q`、app.tsx 的公开报价认证旁路；Core BYPASS_CODES 中的 CRM 权限和 Swagger CRM tag。
- 移动端 CRM tabs/workbench/actions/customer 占位页；当前 apps 页面无条件插入 CRM 菜单，并非可复用的动态模块消费能力。
- `all/openapi.json` 和 generated 整目录：main 有 71 paths，all 有 165；Core `/api/v1` 为 67→72，其中新增 5 个 enum path。其他业务 paths 与 schema 不进入 Core。
- `compare-crm-schema-vs-db.mjs`、`fix-crm-schema-drift.sql`、`onboard-missing-crm-migrations.mjs`、`repair-crm-demo.mjs`。
- 已无使用的 CRM Excel 导入依赖 xlsx、认证 JWT fixture、产品验收截图/PDF、个人配置和执行记录。

也不随动态路由修复携带 `avatarFallback = '/icons/avatar.png'`：它绕过 PUBLIC_PATH 的子路径部署前缀，是混合提交里的另一项行为变化。

Core 最终 OpenAPI 应由精简后的 Core + demo 运行时生成，再生成 admin client。仅删业务 path 不能保证 components 中不残留业务类型，也不能修复 main 旧契约本身的漂移。

## 10. 建议合入批次与验收

| 批次 | 交付边界 | 主要验收 |
| --- | --- | --- |
| 1. Core 基线与开发环境 | 明确 main Core/demo；完善两端边界守卫；跨平台脚本/代理/loader；修 CI 无效命令与触发范围 | 冻结安装；模块发现测试；Windows/Linux 基础命令；admin/app 代理；无业务 import/页面/契约泄漏 |
| 2. Core 初始化与静态资源 | 固定原有 SQL 的 journal；Core/demo 历史隔离及兼容；修好的 STORAGE/Admin 组；seed 清理 | 临时 MySQL 的首次初始化、重复执行、已存在数据升级；上传首文件及路径配置；API 404 与 SPA fallback |
| 3. 登录、错误和菜单路由修复 | App login/refresh；33xxx 语义；登录错误反馈；pathless 路由；开发产物隔离 | 匿名登录/刷新、受保护 me/logout、业务 HTTP 400；无重复提示；嵌套路由去重和布局保持 |
| 4. 系统 CRUD 闭环与 Core 契约 | 九个来源提交的最终实现；保留特殊授权；导出/提交 Core OpenAPI 和生成客户端；漂移门禁 | CRUD 权限目录、grant、菜单授权；API/admin test/build；运行时与提交契约一致 |
| 5. 可选发布完善 | TipTap 包发布准备；独立 Core release/tag/说明；部署迁移入口单独修复 | 包 build/verify/外部最小安装；变更日志；真实打包布局；有目标环境的部署 smoke |

第 1–4 批结束后，main 应是可独立初始化、运行和验证的基础系统。按钮权限与 sys_enum 若要推进，作为新的需求闭环评审，不通过本次回迁顺带引入。

边界守卫不只检查 API modules：还需检查 admin modules/静态业务路由、Core 导入业务路径、业务认证旁路、业务 schema/client、种子与移动端入口。生产代码/API 产物做有针对性的检查，文档提及 CRM 或业务错误测试使用示例码不应被简单字符串扫描误报。

## 11. Git 操作策略

从 main 创建隔离 worktree，保留当前 all 工作区及用户本地 SQL 备份。下面是后续执行示例，本次未执行：

```powershell
git worktree add -b core/backport-all ../yishan-core-backport main
git diff main all -- apps/yishan-api/src/core/routes/admin-crud.ts
git show --stat 6e01aa7
```

纯 Core 提交经过确认后可 `cherry-pick -x` 保留来源。混合提交用最终文件差异或 hunk 构成新的 Core 提交，在提交说明记录 all 来源。`34c45ef` 涉及 81 个文件、`b0764f4` 涉及 149 个文件，不应整体选取；TipTap 改名提交也修改了 main 不存在的业务消费者。

锁文件按实际回迁的依赖变更重新整理，不直接使用 all 的整份 lock。每批提交应包含该能力的代码、类型/契约、迁移（若有）和测试，合入期间保持 main 基线守卫通过。不要以假合并、squash 整个 all 或 ours merge 标记所有业务提交已经进入 main。

后续通用修复优先在 main 开发，业务在独立产品开发；all 可暂作集成历史参照。Core 通过 `core-v<version>` 等明确版本/tag 和变更日志交付，CRM 记录所采用的 Core 版本或 commit，再选择性同步基础修复。先稳定这条依赖方向，再决定是否将确有外部消费者的组件拆成 npm 包。

## 12. 本次实际验证与限制

以下检查在 **all 当前代码**上执行，不代表已经验证合入后的 main：

| 命令范围 | 结果 |
| --- | --- |
| API admin-crud、dicts、menus、static、app.auth、business-error-response 六个 focused Vitest 文件 | 6 suites，39 tests 通过 |
| admin dynamicRoutes、formatDate、requestErrorConfig 三个 focused Jest 文件 | 3 suites，47 tests 通过 |
| `node --test scripts/check-openapi-drift.test.mjs` | 2 tests 通过 |
| 解析 main/all OpenAPI、初始 SQL/snapshot 表集合、分支与最终 diff | 得到本文统计与边界证据 |
| TipTap 短 filter 读取 | 成功匹配 scoped 包 |
| 未配置的 `gen:plugin-routes` 执行 | 提示无 script、exit 0；没有执行路由生成 |

没有跑 main 新组合的完整 lint/test/build；没有查询线上库、应用迁移、打包发布或改变部署。现有 focused 测试不覆盖已指出的上传首次访问、权限 API 缺字段、登录双提示、runner 打包和迁移历史问题，因此这些问题仍是具体合入前置条件。

完整合入验收应在新 worktree 运行 API `test/build:ts`、admin `lint/test/build/openapi`，再运行根 `lint/test/build`；根 build 不含 API，需要显式补上。涉及 app 的改动运行其 lint、H5/weapp build；app 没有独立 test script，不能将其报告为已通过单元测试。数据库使用隔离临时实例分别验证空库与已有库升级。
