# Yishan AI-Native Scaffold 设计文档（v1）

## 1. 背景与目标

当前项目已具备完整中后台能力（admin + api + docs + components），但随着模块增长，出现以下问题：

1. 目录与命名边界逐步漂移（system/portal 混用）
2. 新模块开发重复劳动多（路由、schema、service、页面、权限、菜单）
3. AI 生成代码质量不稳定，缺乏架构护栏
4. 开源扩展时，贡献者难以快速生成“符合项目规范”的代码

目标：

- 先用 CLI 生成规范化骨架（架构代码）
- 再由 AI/开发者只关注业务逻辑
- 最终保证目录、命名、接口、权限、菜单、测试的一致性

## 2. 设计原则（借鉴 go-zero 的大道至简）

1. 约定优于配置：默认目录和命名固定，参数越少越好
2. 单一事实源：一个资源只定义一次（API schema -> 类型 -> 服务）
3. 边界清晰：core 与 plugin、模块间责任严格隔离
4. 生成即可运行：生成后可直接 `pnpm dev` + `pnpm test`
5. 可回放可审计：CLI 生成行为有 manifest 和日志
6. AI 可控：AI 只在 business 区域工作，禁止改 core 契约

## 3. 总体架构

### 3.1 三层模型

1. Core（稳定内核）
   - auth / rbac / menu / config / audit / plugin lifecycle / event bus
   - 原则：低频变更，高稳定性

2. Plugin（业务模块）
   - 每个业务模块独立（如 portal、crm、inventory）
   - 自带 route / schema / service / model / migration / policy / ui

3. AI Layer（业务实现层）
   - 基于模板生成业务 TODO
   - AI 只补 `service` 业务规则、`validator`、`workflow`

### 3.2 目录规范（目标）

```text
apps/yishan-api/src/
  core/
    auth/
    rbac/
    menu/
    config/
    audit/
    events/
    plugin/
  plugins/
    modules/
      <module>/
        manifest.ts
        routes/
          v1/admin/
        schemas/
        services/
        models/
        policies/
        events/
        tests/
```

admin 端对应：

```text
apps/yishan-admin/src/
  modules/
    <module>/
      pages/
      services/
      components/
      hooks/
      constants/
```

## 4. CLI 规格（ys）

### 4.1 命令总览

```bash
ys init
ys module new <name> [--domain system|portal|custom]
ys resource new <module> <resource> [--crud] [--tree] [--status]
ys page new <module> <page> [--table] [--form] [--detail]
ys menu sync [--module <name>]
ys gen types
ys gen test
ys doctor
ys lint-arch
```

### 4.2 命令定义

#### `ys init`

初始化项目脚手架元配置，生成：

- `yishan.scaffold.json`
- 模板版本锁
- 架构规则（命名、目录、依赖边界）

#### `ys module new`

生成一个完整插件模块骨架：

- api: routes/schemas/services/models/policies/tests
- admin: pages/services/components
- docs: module docs stub
- seed: menu + role permission stub

#### `ys resource new`

生成资源型业务（用户、订单、仓库等）：

- RESTful route（list/detail/create/update/delete）
- TypeBox schema
- service/model stub
- admin 列表+表单页
- OpenAPI tag + typings 更新入口

#### `ys menu sync`

根据模块 manifest 与路由声明自动同步菜单种子（避免手写漂移）。

#### `ys lint-arch`

架构规则检查（CI 必跑）：

- system 页面是否调用 portal 服务（禁止）
- route path 与页面 component 是否一致
- permission 前缀是否符合模块规范
- dead menu key / dead route 检测

## 5. 插件契约（manifest）

每个模块必须提供 `manifest.ts`：

```ts
export default {
  name: 'portal',
  version: '1.0.0',
  domain: 'portal',
  dependencies: [],
  permissions: ['portal:article:list', 'portal:article:create'],
  menus: [
    { path: '/portal/articles', name: '文章管理', type: 1, component: './portal/articles' }
  ],
  routes: {
    apiBase: '/api/modules/portal/v1/admin',
    webBase: '/portal'
  },
  migrations: ['20260601_init_portal'],
};
```

约束：

1. `domain` 决定 permission 与 path 前缀
2. `menus` 和 `routes` 必须可静态分析
3. manifest 变更需要版本升级（semver）

## 6. 代码生成模板规范

### 6.1 API 模板输出

- `routes/v1/admin/<resource>/index.ts`
- `schemas/<resource>.ts`
- `services/<resource>.service.ts`
- `models/<resource>.model.ts`
- `tests/<resource>.test.ts`

默认带：

- 分页查询
- 状态字段
- 软删除
- 审计字段（creatorId/updaterId）

### 6.2 Admin 模板输出

- `pages/<resource>/index.tsx`（ProTable）
- `pages/<resource>/components/<Resource>Form.tsx`
- `services/<module><Resource>.ts`

默认带：

- keyword/status 查询
- 新建/编辑/删除/批量删除
- 权限按钮位（`perm`）

## 7. AI 协作边界（核心）

### 7.1 AI 允许修改区域

1. `plugins/modules/*/services/**`
2. `plugins/modules/*/validators/**`
3. `plugins/modules/*/workflows/**`
4. `apps/yishan-admin/src/modules/*/pages/**`（业务展示逻辑）

### 7.2 AI 禁止修改区域

1. `core/**`
2. `manifest.ts` 的结构字段
3. 生成器输出的契约字段（route method/path、schema id）
4. migration 历史文件（只可新增，不可改旧）

### 7.3 AI 产出标准

每次 AI 任务必须产出：

- 业务规则说明（3-5条）
- 变更文件清单
- 回归用例（最少 3 条）
- 风险点与回滚方案

## 8. 命名与边界规范（关键）

1. system 域只处理“平台能力”：用户、角色、菜单、组织、配置、审计
2. portal 域只处理“内容能力”：文章、页面、分类、模板
3. `system/*` 页面禁止直接调用 `portal*` service
4. permission 命名：`<domain>:<resource>:<action>`
5. route 命名：`/api/modules/<domain>/v1/admin/<resource>`

## 8.1 路由规范（多端统一，定稿）

为支持后台、App、Web 等多入口，路由按“通道（channel）”统一建模。

### A. 统一路径格式

- Core（内置能力）：`/api/v<major>/<channel>/<resource>`
- Plugin（扩展能力）：`/api/modules/<plugin>/v<major>/<channel>/<resource>`

其中：

- `<major>`：主版本号，如 `v1`
- `<channel>`：固定枚举 `admin | app | web | public`

### B. channel 语义

- `admin`：后台管理端（运营/配置）
- `app`：移动端/小程序端（业务用户）
- `web`：官网/H5/门户端（游客或会员）
- `public`：跨端公共能力（回调、探活、公开字典等）

### C. 当前项目的标准化结果

保留（符合规范）：

- Core：admin 路由 ` /api/v1/admin/* `
- Plugin：portal 路由 ` /api/modules/portal/v1/admin/* `

需收敛（不符合规范）：

- `hello` 模块现有路径包含 `api/v1` 目录嵌套，形成 ` /api/modules/hello/api/v1/* `
- 目标改为：
  - ` /api/modules/hello/v1/admin/* `
  - ` /api/modules/hello/v1/public/* `（如为公开接口）

### D. 强约束（必须执行）

1. 禁止出现：`/api/modules/<plugin>/api/v1/*`
2. 禁止同一插件混用两套路由目录：`routes/api/v1/*` 与 `routes/v1/*`
3. 版本号只出现一次（`/v1/`），破坏性变更才升主版本
4. `admin` 通道默认必须鉴权；`public` 通道默认最小暴露并开启限流/签名策略

### E. 目录约定（与 AutoLoad 对齐）

插件路由目录固定：

```text
plugins/modules/<plugin>/routes/
  v1/
    admin/
    app/
    web/
    public/
```

### F. CLI 生成规则（ys）

新增资源时必须显式或默认落在某个 channel：

```bash
ys resource new <plugin> <resource> --channel admin
ys resource new <plugin> <resource> --channel app
ys resource new <plugin> <resource> --channel web
ys resource new <plugin> <resource> --channel public
```

若未指定 `--channel`，默认 `admin`。

### G. 验收标准

1. 任一路径可直接识别：core/plugin、版本、通道、资源
2. 仓库内不存在任何 `/api/modules/*/api/v1/*`
3. 任一插件仅允许 `routes/v1/{admin|app|web|public}`
4. CI 校验未声明 channel 的路由目录为违规

## 9. 质量门禁（CI）

CI 新增阶段：

1. `ys lint-arch`（边界检查）
2. `ys menu sync --check`（菜单漂移检查）
3. `pnpm --filter yishan-admin lint`
4. `pnpm --filter yishan-api test`
5. OpenAPI diff 检查（破坏性变更阻断）

## 10. 渐进式落地路线（90天）

### Phase 1（Day 1-14）— CLI MVP

- 实现 `ys module new`、`ys resource new`
- 输出最小可运行骨架
- 引入 `ys lint-arch` 基础规则

### Phase 2（Day 15-35）— 契约收敛

- 全部现有模块补 manifest
- 修复命名漂移（system/portal 边界）
- 建立菜单自动同步机制

### Phase 3（Day 36-60）— AI 开发模式

- 定义 AI 安全改动边界
- 加入“业务 TODO 模板”生成
- 增加一键生成测试骨架

### Phase 4（Day 61-90）— 开源生态化

- 发布 CLI 文档与示例插件仓库
- 上线插件评分标准（质量、测试、文档）
- 发布 3 个官方示例插件（CRM/工单/库存）

## 11. 风险与控制

1. 模板过度复杂 -> 保持命令简短，参数少
2. 生成代码不实用 -> 官方模板先覆盖 80% 常见场景
3. AI 改坏架构 -> 严格边界 + CI 架构检查
4. 插件质量参差 -> 插件验收标准 + 版本兼容策略

## 12. 成功指标（可量化）

1. 新模块从 2-3 天降到 2-4 小时可运行
2. 模块命名/路径不一致问题下降 80%
3. AI 生成代码一次通过率 > 70%
4. 外部贡献者首个 PR 周期缩短 50%
5. 90 天内形成 10+ 可复用业务插件

## 13. 下一步执行清单（建议）

1. 确认 CLI 名称：`ys` 或 `yishan`
2. 确认 manifest 字段最小集（先别追求大而全）
3. 先实现 `ys module new` 和 `ys resource new` 两个命令
4. 同步建立 `ys lint-arch`，防止新代码继续漂移
5. 选一个试点模块（建议 portal/article）全链路跑通
