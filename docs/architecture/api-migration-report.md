# API V2 迁移报告

## 结论

**PASS WITH RESTRICTIONS**。四个 Core Package 与 Demo 产品已完成真实迁移，旧 API 实现移除。已安装的 demo、portal、shop 与 System 完成编译、认证/RBAC、模块启停、隔离 MySQL、OpenAPI、双实例和独立生产产物验证。CRM 保留代码与测试，默认不安装，与迁移前相同；其既有历史迁移不能在空库完整执行，因此不能报告所有业务模块的数据库安装验收通过。FC3 云端验证未执行。

## 基线与架构

基线 commit：`46b151b134b46cf039388b6bb51a18391d8624ab`。工作分支：`refactor/api-v2-product-first`。初始工作区只有本任务之外的未跟踪文档、SQL 备份和图片，均保留且不提交。基线实际 API 测试为 572 passed / 21 skipped，原构建成功但默认排除 CRM。

三个基线文件各有不同用途：

- `api-v1-baseline.json`：模块、源码路由、权限、包信息、50 份原 SQL 的 SHA256 与五份原 journal。
- `api-v1-openapi.json`：原仓库提交的文档，166 paths，含默认未安装的 CRM，不能直接作为实际启动契约。
- `api-v1-runtime-openapi.json`：原 commit 的编译应用在随机临时 MySQL 中真实启动/inject 得到的文档，100 paths / 130 schemas。

新目录、公开 API 和依赖方向见 [api-v2.md](api-v2.md) 与 [package-boundaries.md](package-boundaries.md)。主要所有者为：

| 目录 | 所有权 |
| --- | --- |
| `packages/core/contracts` | 平台无关模块、身份、用户扩展、资源契约 |
| `packages/core/database` | 注入式连接、Drizzle context、连接释放、安全迁移执行 |
| `packages/core/api` | Fastify 工厂、模块验证/拓扑、权限目录、模块流量 gate、生命周期 |
| `packages/core/system-api` | 系统表、服务/仓储、认证/JWT/PAT/RBAC、系统路由/seed |
| `apps/demo/api` | main/config/app、显式 manifest、原业务模块、用户资料扩展、部署 |

不保留旧路径入口、目录发现 loader、过渡兼容实现或重复 System。业务 service/schema/repository 以迁移适配为主；CRM 跨 System 用户表查询改用公开用户目录，路由直接 SQL 移入相应仓储。System 静态服务使用明确 runtime 的 AsyncLocalStorage scope，作用域外拒绝访问，不存在默认共享连接。Demo 的独立 `demo_user_profile` 表证明公开用户读取、受控创建/更新校验、领域事件和业务接口可运行。

## 验证记录

本地使用 Node 22.22.1 / pnpm 8.15.9。PowerShell 的命令前缀为 `fnm exec --using 22.22.1 cmd /c`。真实数据库测试只连接 loopback MySQL 并创建随机临时 schema，测试结束删除自身 schema；没有操作产品或生产数据库。

| Check | Result | Evidence |
| --- | --- | --- |
| Workspace install | PASS | `pnpm install --frozen-lockfile`，12 个工作区；既有锁文件 package snapshots 保持不变 |
| TypeScript | PASS | `pnpm typecheck:api`，四个 Core + Demo；严格程度未降低 |
| API build | PASS | `pnpm build:api`，拓扑构建 CommonJS / declaration，复制 JSON/SQL/journal |
| API unit/regression | PASS | `pnpm test:api`：655 passed；Database 43、Core API 17、System 322、Demo 273；Contracts 执行类型检查 |
| Real integration | PASS | `pnpm test:integration`：34 passed（Database 13 / System 20 / Demo 1），随机隔离 MySQL |
| Boundaries | PASS | `pnpm check:boundaries`，AST 导入/require/reexport/dynamic import、exports、依赖方向、40 张模块/扩展表 |
| Negative fixtures | PASS | `pnpm test:scripts`：18 passed，包含跨产品/反向/private 导入、SQL 改写/缺失、产物泄漏与 OpenAPI 漂移的失败夹具 |
| Migration history | PASS | `pnpm check:migrations`，50 个已发布 SQL hash、五份 journal 历史保持；System/demo/portal/shop manifests 完整 |
| Installed migrations/seed | PASS | 空库、重复迁移、独立 ledger、旧共享历史核对/复制、失败不记完成、重复 seed 和管理员密码保留由真实测试验证 |
| CRM fresh install | FAIL (pre-existing) | `0006_lead-conversion-links` 第 1 条重复添加 `converted_customer_id`，详见下文 |
| OpenAPI compatibility | PASS | 编译 Demo 集成测试逐项比较旧实际运行的全部 operation 和 130 schemas，仅允许下述明确差异；首次重构提交后 `pnpm check:openapi` 无漂移 |
| Production artifact | PASS | `node scripts/package-api.mjs --output <external-temp-directory>`，独立 production 依赖闭包、迁移/JSON、exports，无源码/.env/逃逸链接；真实 production main HTTP 烟测 |
| Full repository lint | PASS with existing warnings | `pnpm lint`；Admin 保留 31 warning / 1 info，未自动修改 UI |
| Admin regression | PASS | `pnpm --filter yishan-admin run test --runInBand`：26 suites / 199 tests |
| Mini-program regression | PASS | `pnpm --filter yishan-app test`：68 passed；lint/typecheck 成功 |
| Full repository build | PASS with existing warnings | `pnpm build`，包括 API、TipTap、Admin、Docusaurus；TipTap 保留既有 Rollup/TypeScript warning，未修改前端工程 |
| Cloud deployment | BLOCKED / not executed | 未使用云端密钥、部署、推送或生产迁移；仅完成本地等价构建与实际 Node 运行验证 |

单元命令中的十三个 Database 集成用例在专用 `test:mysql` 命令中真实执行，并非以 skip 作为集成通过证据。CRM 既有 quotation revision 并发数据库用例仍有一个 skip，因历史基线不支持安全空库安装；不将该用例计为通过。

双实例夹具使用同一套编译 Core，装配不同模块、JWT、权限目录/缓存和数据库实现。并行请求不能互用身份或模块状态，各自关闭资源。生产产物的实际 main 在仓库之外通过 `node scripts/verify-api-main.cjs --artifact <external-temp-directory>` 启动，health（数据库正常）、login、JWT me、Swagger 与 `/admin/` 均返回 200，静态首页内容与编译后的 Admin 一致；development-only 模块控制路由返回 404，四个已安装 owner 的迁移清单和发布 hash 元数据完整；实际 SIGINT 处理退出码为 0，无未关闭资源。生产文档为 99 paths，开发文档为 101 paths。

生产依赖闭包保留一个既有第三方限制：`qiniu@7.14.0` 将 `typescript@4.9.5` 声明为生产依赖，旧 API 与原锁文件已有同一关系，目录约 63.8 MiB。自有 Core 的 TypeScript 5.8 与测试工具只属于开发依赖；七牛编译器仍进入完整生产闭包。只读源码审查未发现 SDK 调用编译器，Node 22 下实际 Mac/PutPolicy/uploadToken 签名通过且未加载 TypeScript。本次不篡改 SDK 清单或删除其声明依赖；不能无条件声称整个第三方闭包不含开发工具。后续需要独立评估上游依赖修订版本并回归上传能力。

## 公开契约差异

旧实际运行的 100 paths 全部保留，新增 `/api/demo/v1/me/profile`。130 个已有 schemas 完全一致。两个原本运行时匿名可用的 App login/refresh 操作明确声明 `security: []`，修正原文档错误继承全局 bearer 的问题；两个开发模块管理接口的描述改为显式清单语义。没有改变已有请求/响应结构、HTTP 状态码、JWT/RBAC/PAT 撤销语义。模块禁用仍为 HTTP 404 / code 40400，普通未找到仍为 HTTP 404 / code 25005。

按本次安全要求收紧启动配置：`JWT_ALLOW_WEAK_SECRET=1` 仅在非生产环境生效，生产始终拒绝默认/短密钥；旧版本曾允许显式 override 绕过。拒绝测试先复现旧行为失败，再修复通过。System 移除无引用的默认数据库 URL 配置，数据库连接完全由产品注入。显式 Seed 改为保留已有配置和授权，不重置真实数据。

`pnpm check:openapi` 检查 dump 与已提交新路径的漂移，首次重构提交后实际执行通过。真实开发运行 dump 与新文档完整规范化比较一致，共 101 paths；不能用旧的静态 166-path 文档冒充运行契约。CI 启动编译应用、重新 dump 后检查。

## 数据库限制

原 SQL、hash、journal 索引/时间均未改写。System 保留 `__drizzle_migrations`，模块使用独立历史表。旧版本可能实际共用 ledger，迁移提供显式 SELECT-only 核对和仅复制已证实记录的 reconciliation；不删原历史、不自动重放 SQL、不隐式执行生产迁移。

跨平台复查以原 Git commit 的 SQL blob 为发布字节来源：50 份均为 LF，搬迁后的源码与 index 全部逐字节一致，并通过 Linux 暂存区检出验证。原 Windows 审计的 37 份 CRLF 和一份混合换行哈希仍保留在 baseline 的 `sha256` 字段；另增 `publishedSha256` 记录原 Git blob，而非覆盖原审计证据。窄范围 `.gitattributes -text` 防止 Git 再转换迁移 SQL；owner 的 `_published-hashes.json` 只声明这些经过验证的旧变体，runner 从发布 SQL 重建、校验，未知第三种哈希仍拒绝。旧账本不改写，拆分复制原哈希，新执行记录发布哈希。详见 [数据库所有权](database-ownership.md)。

CRM 44 份 SQL 中只有 34 份入 journal；System 三份 SQL 中两份入 journal。保留孤立 SQL，不自动补入。真实 CRM 空库执行记录前七份迁移后，在 journal idx 7 的 `0006_lead-conversion-links` 失败：`0001_add-leads.sql` 第 16–18 行已创建 conversion 字段，该迁移再次添加。后续还存在 customer_member / activity.deleted_at 重复 DDL。未入 journal 的 System `0010_create-sys-enum.sql` 同样与原 enum DDL 重复。

在禁止改写已发布历史、伪造迁移完成记录和吞掉 DDL 错误的限制下，不能通过追加末尾 SQL 越过更早的冲突。需要另一个经过审查的历史基线修复方案及相应 CRM 临时库集成夹具；本次不对真实历史做猜测性修复。当前已正确迁移的既有 CRM 数据库不在本次写入/验收范围内，因此未宣称生产 CRM 已验证。

## 范围与未来产品

Admin 仅调整后端 manifest/OpenAPI 路径工程配置和文档；组件、页面、布局、样式、生成客户端均未改。小程序业务源码未改，其他前端技术栈未改。未执行生产数据库迁移、reset、密码覆盖或危险删除。初始用户未跟踪内容保留。

有效后端脚本、CI、构建/部署、工作区和活跃文档使用新路径；历史基线保留旧路径证据，禁止修改的 UI 内旧指引文本未改，不能声称全仓旧字符串零出现。

可以通过新增自己的 config/app/main/manifest 和四个公开 Core 依赖创建 `apps/crm/api` 或 `apps/axis/api`，使用独立数据库/JWT/cache namespace，无需侵入 Core。尚未创建这些正式应用，也未提供自动云资源配置；安装现有 CRM 模块前必须先解决上述历史基线问题。
