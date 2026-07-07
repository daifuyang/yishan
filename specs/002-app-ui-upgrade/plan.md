# Implementation Plan: yishan-app 品牌基线与驾驶舱 MVP

**Branch**: `002-app-ui-upgrade` | **Date**: 2026-06-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-app-ui-upgrade/spec.md`

## Summary

本期实现 yishan-app **品牌基线建立 + 跨端对齐 + 首页驾驶舱 + TabBar 圆角悬浮 + 全局规范落地**。核心是为"内部管理系统"定位的 yishan-app 注入"企业级"视觉体感，不重塑品牌、不堆砌功能。

## Technical Context

**Language/Version**:
- 后端：TypeScript 5.x, Node.js 22.14.0
- 前端-移动：TypeScript 5.x, React 18.3, Taro 4.0
- 前端-PC：TypeScript 5.x, React 19, Umi 4, Ant Design 6

**Primary Dependencies**:
- `@tarojs/components` ^4.0.0 - 跨端 UI 组件库
- `@tarojs/taro` ^4.0.0 - 跨端框架核心
- `react` 18.3.1 - UI 框架
- `@umijs/max` ^4.6.51 - PC 端框架
- `antd` ^6.4.3 - PC 端组件库
- `fastify` ^5.0.0 - 后端框架
- `prisma` ^7.6.0 - ORM
- `ioredis`（如启用缓存）

**Storage**: Redis（聚合接口缓存，30s TTL，可选）

**Testing**:
- Admin: Jest
- API: Vitest
- App: 暂无强制测试要求

**Target Platform**: 微信小程序 + H5（移动端优先），Admin（H5）

**Project Type**: Mobile App (yishan-app) + Admin (yishan-admin) + API (yishan-api) 三端协同

**Performance Goals**:
- 首页首屏可见 ≤ 2 秒（中端设备 4G）
- 聚合接口 P95 ≤ 500ms（缓存命中时 ≤ 100ms）
- TabBar 切换 200ms 过渡

**Constraints**:
- 移动端屏幕适配 320px - 430px
- 跨端视觉一致（小程序 + H5，差异限于平台限制）
- 不引入新的 npm 依赖（字体子集、SVG icon 自建）

**Scale/Scope**:
- 后端：1 个新接口、1 个新中间件、1 个新 service
- 移动端：约 8-10 个新组件/页面、5-6 个修改
- PC 端：2 个文件小改（token + title）
- 文档：1 个文件小改

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Yishan 章程检查项（基于 `.specify/memory/constitution.md`）：

- [x] **Monorepo 工作空间**：本期无新增包，仅修改现有包
- [x] **构建顺序**：无构建顺序影响（不涉及 yishan-tiptap）
- [x] **类型安全**：`tsc --noEmit` 必须通过（admin + app + api 全部）
- [x] **测试覆盖**：API 新接口必须有 Vitest 单元测试（聚合查询 + 权限校验）
- [x] **API 契约**：新增接口必须在 OpenAPI spec 中体现（tag: `app-dashboard`）
- [x] **技术栈一致性**：使用 Taro 4 + React 18 + SCSS + TypeBox，不引入新依赖
- [x] **插件系统规范**：本期不涉及插件
- [x] **数据库规范**：本期不修改 Prisma schema（仅查询现有表）

所有检查项通过。

## Project Structure

### Documentation (this feature)

```text
specs/002-app-ui-upgrade/
├── plan.md                # This file
├── spec.md                # Feature specification
├── research.md            # Phase 0 output
├── data-model.md          # Phase 1 output
├── quickstart.md          # Phase 1 output
├── contracts/
│   └── dashboard-api.md   # API 契约
└── checklists/
    └── requirements.md    # Spec quality checklist
```

### Source Code Changes (repository root)

```text
# 后端 (yishan-api)
apps/yishan-api/src/
├── core/
│   ├── middleware/
│   │   └── require-admin.ts           # 新增：管理员权限中间件
│   └── routes/api/v1/app/
│       ├── dashboard/                  # 新增：聚合接口
│       │   └── index.ts
│       └── index.ts                    # 修改：注册 dashboard 路由
└── services/
    └── dashboard.service.ts            # 新增：聚合查询服务

# 前端-移动端 (yishan-app)
apps/yishan-app/src/
├── api/
│   ├── dashboard.ts                    # 新增：API 封装
│   ├── types.ts                        # 修改：新增类型
│   └── index.ts                        # 修改：导出
├── components/
│   ├── organisms/
│   │   ├── DashboardHero/              # 新增：品牌渐变 + 大号欢迎
│   │   ├── StatCard/                   # 新增：统计卡
│   │   ├── DashboardGrid/              # 新增：4 卡栅格
│   │   └── TabBar/                     # 修改：圆角悬浮胶囊
│   ├── feedback/
│   │   └── DashboardSkeleton/          # 新增：聚合接口 skeleton
│   └── icons/
│       ├── svg/                        # 新增：圆角线性 SVG 库
│       └── icons.ts                    # 修改：替换字符
├── pages/
│   ├── index/
│   │   └── index.tsx                   # 重写：首页驾驶舱
│   ├── login/
│   │   └── index.tsx                   # 修改：表单垂直居中
│   └── mine/
│       └── index.tsx                   # 修改：收敛到 3 项
└── styles/
    ├── tokens.scss                     # 修改：gradient token（字体改用系统默认）

# 前端-PC 端 (yishan-admin)
apps/yishan-admin/
├── config/
│   ├── config.ts                       # 修改：antd colorPrimary
│   └── defaultSettings.ts              # 修改：colorPrimary + title
└── src/
    └── layouts/                        # 修改：title 区域

# 文档 (yishan-docs)
apps/yishan-docs/
└── docusaurus.config.ts                # 修改：品牌名 + tagline
```

## Phase 0: Research Findings

详见 [research.md](./research.md)。关键决策：

1. **主色落地**：antd Pro theme token `colorPrimary: '#1677FF'`
2. **字体**：使用系统默认字体（无需下载字体子集，包体更小）
3. **导航栏**：不设置 `navigationStyle: 'custom'`，使用微信原生
4. **TabBar**：自定义组件，不使用 Taro 自带 tabBar
5. **聚合接口**：Redis 缓存 30s + `Promise.all` 并行查询
6. **渐变带**：linear-gradient 135deg + 兼容写法
7. **垂直居中**：flex column + 视口高度计算
8. **Icon 来源**：自建 SVG 库（圆角线性 1.5-2px stroke）

## Phase 1: Design

### Data Model

详见 [data-model.md](./data-model.md)。仅 1 个新实体 `DashboardStats`（API 响应），无新表、无新字段。

### API Contracts

详见 [contracts/dashboard-api.md](./contracts/dashboard-api.md)。仅新增 1 个接口 `GET /api/v1/app/dashboard/stats`，权限为管理员。

### Components (新增)

| 组件 | 职责 | Props |
|------|------|-------|
| `DashboardHero` | 品牌渐变带 + 大号欢迎 | `{ user: User, dateText: string }` |
| `StatCard` | 三段式统计卡 | `{ icon, value, label, onClick? }` |
| `DashboardGrid` | 4 卡栅格 + 加载/错误三态 | `{ stats, loading, error, onRetry }` |
| `DashboardSkeleton` | 4 卡 skeleton 占位 | - |

### Pages (重写/修改)

| 页面 | 改动 |
|------|------|
| `pages/index/index.tsx` | **重写**为驾驶舱：管理员 + 普通用户双视图 |
| `pages/login/index.tsx` | 表单视口垂直居中 |
| `pages/mine/index.tsx` | 收敛到 3 项 + 管理员系统管理入口 |
| `pages/apps/index.tsx` | **不动**（应用 Tab 复用） |

### Token Updates

```scss
// tokens.scss 新增
--color-primary-gradient-from: #1677FF;
--color-primary-gradient-to: #0958D9;
--shadow-tabbar: 0 -2px 8px rgba(0, 0, 0, 0.04);
--tab-bar-floating-height: 56px;
--tab-bar-floating-bottom: 8px;
```

## Implementation Phases

### Phase 2.1 — 品牌基线（Day 1，0.5 天）

1. **Step 1: 跨端主色统一**
   - [ ] admin: `config/config.ts` `colorPrimary: '#1677FF'`
   - [ ] admin: `config/defaultSettings.ts` 同上
   - [ ] app: `tokens.scss` 确认 `#1677FF`（已存在，无需改）
   - [ ] docs: `docusaurus.config.ts` 主色 token

2. **Step 2: 跨端品牌名统一**
   - [ ] admin: title「移山后台管理系统」→「移山」
   - [ ] admin: ProLayout title 区显示 ⛰ +「移山」
   - [ ] app: `app.config.ts` `navigationBarTitleText: '移山'`
   - [ ] docs: `docusaurus.config.ts` `title: '移山'`

3. **Step 3: 字体（使用系统默认）**
   - [ ] app: `tokens.scss` 确认使用系统默认字体（无需额外配置）
   - [ ] admin: 确认 antd `fontFamily` 配置（已存在，无需修改）

### Phase 2.2 — 聚合接口（Day 1-2，1 天）

1. **Step 4: 后端实现**
   - [ ] `require-admin.ts` 中间件（角色校验）
   - [ ] `dashboard.service.ts` 服务（4 个查询 + Redis 缓存）
   - [ ] `dashboard/index.ts` 路由（GET /stats + TypeBox schema）
   - [ ] `app/index.ts` 注册 dashboard 路由
   - [ ] Vitest 单元测试：聚合查询 + 权限校验

2. **Step 5: 客户端封装**
   - [ ] `api/dashboard.ts` 封装
   - [ ] `api/types.ts` 新增 `DashboardStats` 类型
   - [ ] `api/index.ts` 导出

### Phase 2.3 — TabBar 圆角悬浮（Day 2-3，1.5 天）

1. **Step 6: TabBar 重做**
   - [ ] `TabBar.module.scss` 重写样式（圆角悬浮、阴影、间距）
   - [ ] `TabBar.tsx` 激活态逻辑（chip + 主色）
   - [ ] iPhone Home Indicator 适配（底部内边距）
   - [ ] 切换过渡动画（200ms transition）
   - [ ] 验证 3 个 Tab 页面挂载正常

### Phase 2.4 — 首页驾驶舱（Day 3-5，3 天）

1. **Step 7: 视觉组件**
   - [ ] `DashboardHero` 组件（渐变带 + ⛰ + 欢迎语）
   - [ ] `StatCard` 组件（三段式）
   - [ ] `DashboardGrid` 组件（4 卡 + 三态）
   - [ ] `DashboardSkeleton` 组件

2. **Step 8: 首页重写**
   - [ ] `pages/index/index.tsx` 重写为双视图
   - [ ] 角色判断逻辑（useAuthStore.user.roles）
   - [ ] 加载/错误/空三态
   - [ ] 下拉刷新
   - [ ] 4 张卡片点击下钻路由

3. **Step 9: 视觉打磨**
   - [ ] 区块间距验证（16-20px）
   - [ ] 数字字号验证（32-40px）
   - [ ] 卡片圆角验证（12-16px）
   - [ ] 跨平台对比（小程序 vs H5）

### Phase 2.5 — 我的页面 + 子页规范（Day 5-6，1.5 天）

1. **Step 10: 我的页面收敛**
   - [ ] `pages/mine/index.tsx` 改写为 3 项
   - [ ] 管理员系统管理入口卡片
   - [ ] 退出登录卡片样式

2. **Step 11: 子页规范**
   - [ ] 所有子页 `index.config.ts` 设置 `navigationBarTitleText`
   - [ ] 登录页表单视口垂直居中
   - [ ] 复杂表单（新增用户）顶部对齐验证

3. **Step 12: Icon 库替换**
   - [ ] 圆角线性 SVG 设计稿（8-10 个核心 icon）
   - [ ] `components/icons/svg/` 引入
   - [ ] `icons.ts` 替换为 SVG 引用

### Phase 2.6 — 验证与回归（Day 6-7，0.5 天）

1. **Step 13: Lint & Typecheck**
   - [ ] `pnpm --filter yishan-app lint`
   - [ ] `pnpm --filter yishan-admin lint`
   - [ ] `pnpm --filter yishan-api test`

2. **Step 14: 跨端截图对比**
   - [ ] admin / app / docs 三端截图
   - [ ] 品牌名/主色/字体/Logo 4 项一致
   - [ ] TabBar 形态验证
   - [ ] 首页"大气体感"验证

3. **Step 15: 数据验证**
   - [ ] 管理员首页 4 张卡片显示正确数据
   - [ ] 普通用户首页 4 张卡片隐藏
   - [ ] 聚合接口 403 校验正确
   - [ ] 聚合接口失败重试正常

## Risks & Mitigations

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| antd Pro 主色变更视觉回归 | 中 | 中 | 截图对比 5 个核心页面 |
| 聚合接口性能不达标 | 低 | 高 | Redis 缓存 + 客户端 30s 缓存 |
| 自定义 TabBar 跨端差异 | 中 | 中 | SCSS 平台分支 |
| Icon SVG 在小尺寸下模糊 | 低 | 低 | 12px 以下用填充形 |
| 渐变带在低端机不兼容 | 低 | 低 | 单色 fallback |

## Definition of Done

- [ ] 所有 7 个 User Story 的 Acceptance Scenarios 100% 通过
- [ ] 所有 30 个 Success Criteria 可验收
- [ ] `pnpm --filter yishan-app lint` 通过
- [ ] `pnpm --filter yishan-admin lint` 通过
- [ ] `pnpm --filter yishan-api test` 通过
- [ ] 跨端 3 项品牌一致（名称/主色/Logo）；app 端使用系统默认字体
- [ ] Admin / App / Docs 三端截图对比通过
- [ ] 验收清单（quickstart.md 中）全部勾选

## Estimated Timeline

| Phase | 工期 |
|-------|------|
| Phase 2.1 品牌基线 | 0.5 天 |
| Phase 2.2 聚合接口 | 1 天 |
| Phase 2.3 TabBar | 1.5 天 |
| Phase 2.4 首页驾驶舱 | 3 天 |
| Phase 2.5 我的 + 子页规范 | 1.5 天 |
| Phase 2.6 验证回归 | 0.5 天 |
| **总计** | **约 8 天 / 1.5 周** |

## Next Step

进入 `/speckit.tasks` 拆解为可勾选的具体开发任务。
