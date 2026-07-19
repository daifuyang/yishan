# Phase 0 Research: yishan-app 品牌基线与驾驶舱 MVP

**Feature**: 002-app-ui-upgrade
**Date**: 2026-06-03

本文件汇总从 spec 中提取出的技术决策、依赖调研、最佳实践，作为 plan.md 的输入。

## Research Tasks Completed

| # | 调研项 | 决策 |
|---|--------|------|
| R1 | 主色 #1677FF 在 admin 端如何落地 | antd Pro token 改 colorPrimary |
| R2 | 移动端引入 AlibabaSans 字体的最佳实践 | 字体子集 + Woff2 + 按需加载 |
| R3 | 微信小程序系统默认导航栏的 Taro 配置方式 | 不设 navigationStyle='custom'，使用默认 |
| R4 | Taro 4 中实现圆角悬浮 TabBar 的方案 | 不用 Taro 自带 tabBar，自定义组件 |
| R5 | 聚合接口的权限校验位置 | 在 fastify preHandler 中校验角色 |
| R6 | 渐变带在 Taro + SCSS 中的实现 | linear-gradient + 跨小程序兼容 |
| R7 | 大号欢迎语垂直居中布局方案 | flex + 视口高度计算 |
| R8 | Icon 圆角线性 1.5-2px stroke 资源来源 | Iconify / 自建 SVG 库 |

## R1: 主色 #1677FF 在 admin 端落地

**Decision**: 在 `apps/yishan-admin/config/config.ts` 的 antd plugin 中配置 theme token：

```ts
antd: {
  appConfig: {},
  configProvider: {
    theme: {
      token: {
        colorPrimary: '#1677FF',
        fontFamily: 'AlibabaSans, sans-serif',
      },
    },
  },
},
```

同时更新 `apps/yishan-admin/config/defaultSettings.ts` 的 `colorPrimary: '#1890ff'` → `'#1677FF'`。

**Rationale**: antd Pro 通过 ConfigProvider 的 theme token 统一覆盖所有组件主色，零侵入、覆盖最全。

**Alternatives considered**:
- 全局 less 变量覆盖（更深入但 antd 6 不推荐）
- ProLayout 单独配置（覆盖面不全）

## R2: 移动端 AlibabaSans 字体引入

**Decision**: 引入 AlibabaSans 字体子集（Otf / Woff2），体积控制在 30-50KB，按需加载（不阻塞首屏渲染）。

```scss
// src/styles/tokens.scss
--font-family-base: 'AlibabaSans', -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif;
```

字体文件放置：
```
src/styles/fonts-subset/
├── AlibabaSans-Regular.woff2
├── AlibabaSans-Medium.woff2
└── AlibabaSans-Semibold.woff2
```

`@font-face` 在 `common.scss` 中定义，仅 400/500/600 三个字重（其他字重按需 fallback 到系统字体）。

**Rationale**: 字体子集避免包体膨胀；只保留常用字重降低首屏 CSS 体积。

**Alternatives considered**:
- 全量字体（150KB+）：包体过大，不值得
- 用系统字体（不引入）：跨端体验不一致

## R3: 微信小程序系统默认导航栏

**Decision**: 不在 `app.config.ts` 中设置 `navigationStyle: 'custom'`，使用微信小程序原生导航栏。

```ts
window: {
  backgroundTextStyle: 'dark',
  navigationBarBackgroundColor: '#FFFFFF',
  navigationBarTitleText: '移山',
  navigationBarTextStyle: 'black',
}
```

各子页面在 `index.config.ts` 中单独设置 `navigationBarTitleText`：
```ts
export default definePageConfig({
  navigationBarTitleText: '个人资料',
})
```

**Rationale**: 默认导航栏就是微信生态的"最熟悉"形态，用户零学习成本；自定义导航栏会与微信手势/胶囊冲突。

**Alternatives considered**:
- 自定义导航栏（主色 + ⛰ logo）：品牌化更强但与微信原生体验脱节
- 隐藏导航栏（全屏沉浸）：适合内容型页面，不适合工具型

## R4: Taro 4 圆角悬浮 TabBar 实现

**Decision**: **不用 Taro 自带 tabBar**，用自定义组件 `TabBar`（已有但形态需升级）。在每个 Tab 页面手动挂载 `<TabBar currentPath={...} />`。

样式关键点：
- 距底部 8-12px 留白（flex + 视口高度计算）
- 左右贴边圆角 12-16px
- 背景 `#FFFFFF`
- 阴影 `--shadow-md`
- 适配 iPhone Home Indicator（底部内边距 +12-16px）

**Rationale**: 微信小程序原生 tabBar 不支持圆角/悬浮/自定义激活态；自定义组件灵活度最高，与 Taro 设计一致。

**Alternatives considered**:
- Taro 自带 tabBar + CSS hack：能力受限，圆角无法实现
- 第三方组件库（如 Taro UI）：增加依赖，定制成本高

## R5: 聚合接口权限校验

**Decision**: 在 fastify preHandler 中校验 `currentUser.roles` 是否包含管理员角色。

```ts
// src/core/middleware/admin-only.ts
export const requireAdmin = async (request, reply) => {
  const user = request.currentUser;
  if (!user.roles?.some(r => r.code === 'admin' || r.code === 'super_admin')) {
    throw new BusinessError(403, '需要管理员权限');
  }
};
```

路由声明：
```ts
fastify.get('/dashboard/stats', {
  preHandler: [fastify.authenticate, requireAdmin],
  schema: { ... }
}, handler);
```

**Rationale**: 复用现有 `fastify.authenticate` 中间件，admin 校验独立可复用，权限码与 PC 端对齐（`admin` / `super_admin`）。

**Alternatives considered**:
- 路由内部手动校验：散落各处，易遗漏
- 基于 menu perm 校验：粒度太细，本场景只需要"是不是管理员"

## R6: 渐变带在 SCSS 中的实现

**Decision**:
```scss
.brand-gradient {
  background: linear-gradient(135deg, #1677FF 0%, #0958D9 100%);
  // 微信小程序兼容（避免部分老机型不支持 135deg）
  background: -webkit-linear-gradient(45deg, #1677FF 0%, #0958D9 100%);
}
```

**Rationale**: 135deg 视觉上"从左上到右下"最自然；兼容写法覆盖 iOS Safari 老版本。

**Alternatives considered**:
- 单色（无渐变）：简单但缺少"质感"
- 径向渐变：太花哨，不适合企业级

## R7: 大号欢迎语垂直居中

**Decision**: 使用 flex 布局 + 视口高度计算。

```scss
.dashboard {
  min-height: calc(100vh - var(--tab-bar-height) - env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  padding-top: var(--space-6);
}
```

**Rationale**: flex column 让内部区块自适应；min-height 保证内容不足时也能占满视口。

## R8: Icon 圆角线性资源来源

**Decision**: 使用 **自建 SVG icon 库**（与 admin 端风格对齐），不引入 Iconify 等第三方。

资源位置：
```
src/components/icons/
├── svg/                # 源 SVG（1.5-2px stroke，圆角端点）
│   ├── home.svg
│   ├── apps.svg
│   ├── user.svg
│   ├── bell.svg
│   └── ...
├── IconFont.tsx        # 包装组件
└── icons.ts            # 图标名映射
```

**Rationale**:
- 自建可控性强（圆角线性风格严格统一）
- 不增加外部依赖
- 包体小（每个 SVG 1-2KB）
- 与 yishan 设计语言保持一致

**Alternatives considered**:
- Iconify：图标丰富但风格不统一（混了多源）
- 阿里 iconfont：可但需要网络请求
- emoji/unicode 字符（如当前 `♪` `⚙`）：风格不可控、不够"友好"

## Risk Register

| 风险 | 影响 | 缓解 |
|------|------|------|
| 字体加载阻塞首屏 | 用户感知延迟 | 字体子集 + `font-display: swap` |
| 渐变带在小程序低端机不兼容 | 视觉降级 | 准备单色 fallback |
| 聚合接口响应慢 | 首页卡顿 | 客户端缓存 30s + 骨架屏 |
| 自定义 TabBar 跨端差异（H5 vs 小程序） | 体验不一致 | 在 SCSS 中按 platform 分支处理 |
| Icon 资源 1.5-2px stroke 在小尺寸下模糊 | 视觉降级 | 12px 以下用填充形（borderline） |

## Open Decisions Deferred to Implementation

1. 字体子集生成工具（fontmin vs subset-font）
2. Icon SVG 设计的具体视觉细节（交付设计师确认）
3. 聚合接口超时阈值（建议 3s 客户端 + 5s 服务端）
4. 统计卡点击下钻的路由参数（userId? deptId?）
