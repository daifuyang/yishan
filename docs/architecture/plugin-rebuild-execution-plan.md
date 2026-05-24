# 插件化破坏性升级执行蓝图（按 PR 切分）

## 1. 目标与约束

- 目标：在 `yishan` monorepo 内完成一次插件化架构的破坏性升级，使 Core 与 Plugin 解耦，支持可控扩展、版本治理与可回滚发布。
- 范围：`apps/yishan-api`（Fastify + Prisma）为插件运行主引擎；`apps/yishan-admin`（Umi + React）提供插件配置和可视化管理入口；`apps/yishan-components/yishan-tiptap` 作为可被插件复用的组件能力。
- 约束：保持 pnpm workspace 构建顺序（`yishan-tiptap -> yishan-admin -> yishan-api`），不改变当前部署主链路（API 承载 admin 静态资源）。

## 2. PR 切分实施计划

### PR-01: 架构基线与契约冻结

- 目标：冻结 Core/Plugin 边界、生命周期、版本规则，避免后续并行开发偏移。
- 改动范围：
  - 新增 ADR：`docs/architecture/adr/ADR-0001-core-plugin-boundary.md`
  - 新增 ADR：`docs/architecture/adr/ADR-0002-versioning-and-breaking-policy.md`
  - 新增 ADR：`docs/architecture/adr/ADR-0003-plugin-lifecycle-and-hooks.md`
  - 在 API 与 Admin 的 README 或 docs 增加链接入口（若已有架构导航页则挂载到导航）。
- 验证标准：
  - ADR 可回答“什么属于 Core、什么属于 Plugin、何时触发 breaking、插件如何执行与失败处理”。
  - 至少 2 名核心维护者评审通过并达成一致。
- 回滚点：删除新文档，不触及运行时代码。
- 风险：文档定义与现状实现不一致，导致后续返工。

### PR-02: API 插件 Runtime 骨架落地

- 目标：在 `apps/yishan-api` 建立插件注册、加载、生命周期调度的最小可运行骨架。
- 改动范围：
  - 新增目录建议：`apps/yishan-api/src/plugins-runtime/`
  - 核心模块建议：
    - `manifest.ts`（插件清单 schema，建议 TypeBox）
    - `registry.ts`（注册中心）
    - `loader.ts`（加载器）
    - `lifecycle.ts`（onLoad/onEnable/onDisable/onUnload）
    - `hooks.ts`（hook 分发器）
  - 在 Fastify 启动路径挂载 runtime 初始化（不强行启用业务插件）。
- 验证标准：
  - `pnpm --filter yishan-api build:ts` 通过。
  - `pnpm --filter yishan-api test` 新增最小单测：注册、启用、禁用、卸载流程。
  - 启动日志可见 runtime 初始化成功。
- 回滚点：删除 `plugins-runtime` 与启动挂载代码，恢复原启动流程。
- 风险：启动阶段引入时序问题，影响 Fastify 启动稳定性。

### PR-03: 插件元数据与持久化模型

- 目标：为插件状态、版本和配置建立可追踪持久化模型（Prisma）。
- 改动范围：
  - 修改 `apps/yishan-api/prisma/schema.prisma`，新增 Plugin 相关模型（例如 `Plugin`, `PluginVersion`, `PluginInstall`, `PluginConfigSnapshot`）。
  - 新增迁移脚本与数据访问层。
  - API 内新增插件管理 service（只做内部调用，不急于对外开放完整接口）。
- 验证标准：
  - `pnpm --filter yishan-api db:generate` 通过。
  - 本地迁移可执行，插件状态可 CRUD。
  - 新模型字段能支撑 ADR-0002 的兼容矩阵与回滚记录。
- 回滚点：回退 Prisma migration；保留 runtime 骨架但切换为内存存储。
- 风险：迁移脚本不兼容现网数据；回滚时数据一致性处理复杂。

### PR-04: 插件 Hook 总线与执行保障

- 目标：实现统一 hook 总线，支持顺序控制、超时、重试与失败隔离。
- 改动范围：
  - 在 API runtime 中实现 hook pipeline：`pre:* -> main:* -> post:*`。
  - 增加超时控制（默认值、最大值）、失败策略（fail-open/fail-close）和幂等键。
  - 引入插件执行日志与观测字段（traceId、pluginName、hookName、duration、status）。
- 验证标准：
  - 单测覆盖：超时、异常、部分失败、重入幂等。
  - `pnpm --filter yishan-api test` 通过，新增失败注入场景。
  - 关键日志可用于定位某个 hook 链路失败点。
- 回滚点：关闭新 hook 总线开关，回退到核心直连流程。
- 风险：hook 链过长造成性能抖动；超时值设置不当影响可用性。

### PR-05: Admin 侧插件管理 UI 与 API 接入

- 目标：提供可操作的插件管理界面（安装、启停、版本切换、配置编辑、回滚）。
- 改动范围：
  - `apps/yishan-admin/src/` 新增插件管理页面与 service。
  - `apps/yishan-api/src/routes` 新增/扩展插件管理路由（鉴权复用现有 JWT 机制）。
  - 增加配置 JSON schema 驱动表单（可复用 `@json-render/*`）。
- 验证标准：
  - `pnpm --filter yishan-admin lint` 与 `pnpm --filter yishan-admin test` 通过。
  - UI 可完成插件启停与配置保存，且与 API 状态一致。
  - 基本权限校验生效（非授权用户不可变更插件）。
- 回滚点：隐藏插件管理菜单并禁用 API 路由挂载。
- 风险：UI 状态与后端真实状态不一致；并发操作导致“最后写入覆盖”。

### PR-06: 向后兼容适配层与旧接口迁移

- 目标：对历史扩展点提供兼容层，降低一次性切换风险。
- 改动范围：
  - 在 API 建立 legacy adapter，将旧扩展机制映射到新生命周期/Hook。
  - 为 admin 老页面或老配置格式提供读取兼容与迁移提示。
  - 新增 deprecation warning（明确移除时间窗）。
- 验证标准：
  - 旧配置可读，关键历史流程可运行。
  - 日志明确提示使用了兼容层。
  - 升级后无关键业务中断。
- 回滚点：保留旧机制入口并关闭新 runtime 强制接管。
- 风险：兼容层长期滞留，增加维护成本与行为歧义。

### PR-07: 发布闸门、灰度与回滚演练

- 目标：将插件化升级纳入可发布、可灰度、可回滚的工程流程。
- 改动范围：
  - CI 增加插件相关检查（契约校验、兼容矩阵校验、关键 e2e）。
  - 部署流程中增加灰度开关与回滚脚本（FC3 环境按现有 `yishan-api/deploy/fc3` 流程接入）。
  - 发布文档补充“升级步骤 + 失败回滚 Runbook”。
- 验证标准：
  - 在测试环境完成一次“升级 -> 失败注入 -> 回滚 -> 恢复”全流程演练。
  - 回滚耗时与数据恢复步骤有可量化结果。
- 回滚点：关闭灰度开关并恢复上一稳定版本镜像/构建产物。
- 风险：回滚脚本未经演练即上生产；灰度范围配置错误导致影响扩大。

## 3. 统一验收门槛（跨 PR）

- 构建：`pnpm --filter yishan-tiptap build`、`pnpm --filter yishan-admin build`、`pnpm --filter yishan-api build:ts` 全通过。
- 质量：Admin lint/test 与 API test 按 CI 顺序全通过。
- 可观测性：插件生命周期与 hook 执行日志可关联到一次请求或任务。
- 可回滚性：任一 PR 合并后均可在 30 分钟内恢复到上一稳定状态。

## 4. 风险总览与处置

- 技术风险：生命周期与旧流程耦合深，分层不彻底。
  - 处置：每个 PR 保留 feature flag，默认关闭新路径。
- 进度风险：跨 API/Admin/DB 变更多，评审链路长。
  - 处置：先文档后代码，先骨架后业务，严格按 PR 尺度控制。
- 质量风险：缺乏故障注入测试，回滚策略纸面化。
  - 处置：PR-07 必须包含失败演练记录，不满足不得发布。
