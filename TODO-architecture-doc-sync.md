# TODO: ARCHITECTURE.md 与现状同步

> 父文档：[TODO.md](./TODO.md) · 优先级：🟡 中 · 估算：半小时

## 现状

`ARCHITECTURE.md`（仓库根目录）部分段落描述已经过时，主要是 §10 "Admin 路由机制"：

### 明确过时

| 段落 | 描述 | 实际 |
|---|---|---|
| §10 | "Core admin 路由集中在 `apps/yishan-admin/src/core/routes.ts`" | **该文件不存在**。实际路由声明在 `apps/yishan-admin/config/routes.ts`（框架路由），业务路由在 `src/app.tsx` 的 `patchClientRoutes` 动态注入（由后端 `sys_menu.component` 驱动） |
| §10 | 路由文件结构描述 | 当前 admin 没有 src/core/routes.ts，路由分散在 config/routes.ts、src/app.tsx、src/utils/menuRoutes.ts |
| §14 | 请求流图提及 `core/routes/* (preHandlers + handlers)` | preHandlers 在 route-registrar + middleware 层（`src/core/routes/route-registrar.ts` 是后端，前端 preHandlers 由 umi config 处理） |
| §9/§10 | "Admin 业务代码只 import 稳定类型（`@/types/sdk`），不直接依赖 generated `API.*` namespace" | 现在 `src/services/generated/` 目录存在且被直接 import（`auth.ts`、`attachments.ts`、`sysMenus.ts` 等）；generated service 是真实 API 层而非 stub |

### 描述不清晰

- §10 没说清"业务路由由后端 sys_menu 表驱动"这条核心机制
- §10 没说清 `config/routes.ts` 与 `src/app.tsx` 的分工（前者框架级、后者动态注入）
- §10 提到 `globals.d.ts` 缺失（这次补了 `apps/yishan-admin/src/globals.d.ts`）

### 未涉及但应新增

- 菜单改造成单一真相源后的"前后端契约"：前端不再硬编码组件路径，由后端 `sys_menu.component` 字段驱动
- `auth:logout` 不在 `BYPASS_CODES` 中（之前在，已移除）

## 目标

把 ARCHITECTURE.md §10 重写为"路由机制"现状描述；其他过时段落逐句修正。

## 步骤

### Step 1：先读 ARCHITECTURE.md 全文

`/home/dfy/workspace/products/yishan/ARCHITECTURE.md` 全文通读，定位所有过时/不准确的描述。关注的章节：
- §9 模块边界
- §10 路由机制
- §14 请求流图
- §5 admin 前端栈描述

### Step 2：重写 §10

新的 §10 应该描述：

```
Admin 路由机制

1. 框架路由（必须存在于 config/routes.ts）：
   - 登录页、首页容器、404、外链 redirect
   - 这些页面不在菜单数据中

2. 业务路由（由后端 sys_menu.component 动态注入）：
   - 用户登录后，前端调用 GET /api/v1/admin/menus/tree/authorized
   - 后端根据用户角色返回 sys_menu 树（含 component 字段）
   - 前端 src/app.tsx 的 patchClientRoutes 把每个非目录非外链菜单节点的
     component 字段转为 umi 路由并注入
   - 新增业务菜单只需要在 sys_menu 表加一行，零前端代码改动

3. 关键文件：
   - apps/yishan-admin/config/routes.ts（框架路由）
   - apps/yishan-admin/src/app.tsx（patchClientRoutes + 菜单数据获取）
   - apps/yishan-admin/src/utils/menuRoutes.ts（菜单树 → umi 路由 转换器）
   - apps/yishan-admin/src/access.ts（基于 currentUser.accessPath 的路由级访问控制）
   - apps/yishan-admin/src/globals.d.ts（Umi define 全局变量声明）
```

### Step 3：修正 §9/§14 等其他过时段落

- §14 请求流图：根据实际 preHandler 分布修正
- §9：补一句"admin 前端 services 来自后端 OpenAPI 自动生成（`npm run openapi`），目录 `src/services/generated/`，与 `src/types/sdk/` 的稳定类型并存"
- §10：提到 `auth:logout` 鉴权由 `route-registrar` 的标准链完成（参考后端 `catalog.ts`）

### Step 4：交叉对照 AGENTS.md

`AGENTS.md` 可能有类似的过时描述，统一修正。

### Step 5：跑 docs:check

如果项目有文档检查脚本（见 `pnpm lint` 中的 `docs:check`），跑一遍确认通过：

```bash
pnpm lint
```

## 验收

- [ ] ARCHITECTURE.md §10 重写，描述"框架路由 + 后端菜单动态注入"两条路径
- [ ] 没有提到不存在的 `apps/yishan-admin/src/core/routes.ts`
- [ ] 描述 services/generated 是真实 API 层而非 stub
- [ ] AGENTS.md 同步更新（如有过时描述）
- [ ] `pnpm lint` 通过（含 docs:check）

## 风险

- **改太多**：文档改多了 review 难 → 改之前先 review PR 范围，本任务只修"明确过时"的段落，不擅自改风格
- **文档与实现漂移**：刚改完的文档很快又会过时 → 在代码变更 PR 模板里加一句"如有架构变更，需同步 ARCHITECTURE.md"（见 Step 5 后续动作）

## 相关文件

- `/home/dfy/workspace/products/yishan/ARCHITECTURE.md`（主目标）
- `/home/dfy/workspace/products/yishan/AGENTS.md`（可能也有过时描述）
- `/home/dfy/workspace/products/yishan/MODULE-SYSTEM.md`（模块系统描述，与本任务正交但建议一并核对）
- `/home/dfy/workspace/products/yishan/apps/yishan-admin/src/app.tsx`（动态路由实现位置）