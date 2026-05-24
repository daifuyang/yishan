# ADR-0001: Core 与 Plugin 严格边界

- 状态：Accepted
- 日期：2026-05-23
- 决策人：Yishan Core Team

## 背景

当前仓库为 pnpm workspace，核心应用包括：

- `apps/yishan-api`：Fastify + Prisma，承担服务端主流程与部署入口。
- `apps/yishan-admin`：Umi + React，承担管理界面。
- `apps/yishan-components/yishan-tiptap`：编辑器组件能力。
- `apps/yishan-docs`：文档站点。

为支持插件化破坏性升级，必须定义严格边界，防止 Plugin 反向污染 Core。

## 决策

### 1) Core 定义

Core 指平台不可替代、必须稳定的能力：

- API Core（`apps/yishan-api/src`）
  - Fastify app bootstrapping
  - 鉴权、权限、配置、日志、错误模型
  - Prisma schema 与数据访问主模型
  - 插件 runtime 引擎本身（注册、生命周期、hook 总线）
- Admin Core（`apps/yishan-admin/src`）
  - 登录与权限框架
  - 全局布局、路由框架
  - 插件管理控制台容器（非插件业务实现）

### 2) Plugin 定义

Plugin 指通过稳定契约挂载的可替换能力：

- API 插件：按 manifest + lifecycle 接入 runtime，为 Core 提供扩展逻辑。
- Admin 插件：按 UI 扩展点注入页面片段、表单 schema 或操作面板。
- 组件插件：复用 `yishan-tiptap` 或其他共享组件，但不修改 Core 组件内部契约。

### 3) 当前项目路径映射

- Core 代码区（受严格保护）：
  - `apps/yishan-api/src/**`
  - `apps/yishan-api/prisma/**`
  - `apps/yishan-admin/src/**`
  - `apps/yishan-components/yishan-tiptap/src/**`
- Plugin 代码区（建议新增并收敛）：
  - `apps/yishan-api/src/plugins/**`（服务端插件实现）
  - `apps/yishan-admin/src/plugins/**`（前端插件实现）
  - `apps/yishan-admin/src/plugin-host/**`（前端插件宿主）

### 4) 依赖方向规则

允许依赖：

- Plugin -> Core 公共契约（types/interfaces/hook API）
- Plugin -> 第三方库（需符合安全和许可证策略）
- Admin Plugin -> Admin Core 提供的 UI 扩展点接口

禁止依赖：

- Core -> 具体 Plugin 实现
- Plugin -> Core 私有模块（未导出的内部 util、内部 repository）
- Plugin A -> Plugin B 的内部实现（仅允许通过公开契约或事件）
- Admin 插件直接访问 API 数据库层（必须经 API 接口）

### 5) 变更控制

- Core 公共契约变更必须走 ADR 或 RFC，并遵循 ADR-0002 的版本策略。
- 禁止在插件内修改 Prisma 主 schema；如需扩展，走插件独立配置表或 JSON 扩展字段。
- 插件仅通过 runtime 注册，不允许“绕过 runtime 直接挂载 Fastify 实例”。

## 结果与影响

- 正向影响：
  - 明确维护边界，降低耦合和升级冲突。
  - 插件升级可独立演进，核心稳定性更高。
- 代价：
  - 初期需要补齐契约层和适配层。
  - 开发效率会短期下降（更多校验和评审）。

## 合规检查清单

- 新增代码是否位于 `plugins/**` 或 core 公开扩展目录。
- 是否存在 `../../core/private/*` 之类私有路径引用。
- 是否引入了 Core 对具体插件实现的 import。
- 是否更新了契约文档并标记版本。
