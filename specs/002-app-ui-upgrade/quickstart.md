# Quickstart: yishan-app 品牌基线与驾驶舱 MVP

**Feature**: 002-app-ui-upgrade
**Date**: 2026-06-03

5 分钟了解本 feature 的开发入口、关键文件、运行命令、验收方式。

## TL;DR

本期要交付：
- **跨端品牌一致**：主色 #1677FF、品牌名"移山"、⛰ 字符标
- **首页驾驶舱**：管理员看 4 张统计卡 + 品牌渐变带；普通用户看欢迎区
- **底部 TabBar**：圆角悬浮胶囊
- **我的页面**：收敛到 3 项核心
- **应用 Tab**：完全不动

## 关键文件清单

### 后端（apps/yishan-api）

| 文件 | 类型 | 说明 |
|------|------|------|
| `src/core/routes/api/v1/app/dashboard/index.ts` | **新增** | 聚合接口路由 |
| `src/core/middleware/require-admin.ts` | **新增** | 管理员权限校验 |
| `src/services/dashboard.service.ts` | **新增** | 聚合查询服务（含 Redis 缓存） |
| `src/core/routes/api/v1/app/index.ts` | 修改 | 注册 dashboard 路由 |

### 前端-移动端（apps/yishan-app）

| 文件 | 类型 | 说明 |
|------|------|------|
| `src/api/dashboard.ts` | **新增** | 聚合接口 API 封装 |
| `src/api/types.ts` | 修改 | 新增 `DashboardStats` 类型 |
| `src/api/index.ts` | 修改 | 导出 `dashboardApi` |
| `src/components/organisms/DashboardHero/` | **新增** | 首页品牌渐变带 + 大号欢迎 |
| `src/components/organisms/StatCard/` | **新增** | 统计卡（三段式） |
| `src/components/organisms/DashboardGrid/` | **新增** | 4 张统计卡栅格 |
| `src/components/organisms/TabBar/` | 修改 | 圆角悬浮胶囊形态重做 |
| `src/pages/index/index.tsx` | **重写** | 首页驾驶舱（管理员/普通用户两种视图） |
| `src/pages/login/index.tsx` | 修改 | 表单视口垂直居中 |
| `src/pages/mine/index.tsx` | 修改 | 收敛到 3 项 + 管理员系统管理入口 |
| `src/styles/tokens.scss` | 修改 | 新增 `--color-primary-gradient` |
| `src/components/icons/svg/` | **新增** | 圆角线性 SVG icon 库 |
| `src/components/icons/icons.ts` | 修改 | 用 SVG 替换现有 unicode 字符 |

### 前端-PC 端（apps/yishan-admin）

| 文件 | 类型 | 说明 |
|------|------|------|
| `config/config.ts` | 修改 | antd `colorPrimary: '#1677FF'` |
| `config/defaultSettings.ts` | 修改 | `colorPrimary: '#1890ff'` → `'#1677FF'`、title `'移山'` |
| `src/layouts/` | 修改 | 标题区显示 ⛰ +「移山」 |

### 文档（apps/yishan-docs）

| 文件 | 类型 | 说明 |
|------|------|------|
| `docusaurus.config.ts` | 修改 | 品牌名、tagline 统一为「移山」+「简单可依赖的后台基座」 |

## 开发命令

```bash
# 1. 安装依赖
pnpm install

# 2. 数据库 schema 生成（如有改动）
pnpm --filter yishan-api db:generate

# 3. 启动 API（开发模式）
pnpm --filter yishan-api dev

# 4. 启动 App（微信小程序）
pnpm --filter yishan-app dev:weapp

# 5. 启动 App（H5）
pnpm --filter yishan-app dev:h5

# 6. 启动 Admin
pnpm --filter yishan-admin dev
```

## 验收清单（自测）

### 品牌识别

- [ ] 三端打开后品牌名都是「移山」
- [ ] 三端主色按钮色值 = `#1677FF`（截图取色验证）
- [ ] admin 字体 = AlibabaSans，app 字体 = 系统默认字体（无需下载）
- [ ] 三端都有 ⛰ 字符标

### 首页驾驶舱（管理员）

- [ ] 顶部 80-120px 主色渐变带
- [ ] 大号欢迎语 `Hi, 姓名` ≥ 32px
- [ ] 4 张统计卡数字 32-40px 主色加粗
- [ ] 4 张卡片支持点击下钻
- [ ] 聚合接口失败时显示「点击重试」

### 首页驾驶舱（普通用户）

- [ ] 不显示 4 张统计卡
- [ ] 保留主色渐变带 + 大号欢迎语
- [ ] 看到「最近登录」列表

### 底部 TabBar

- [ ] 距底部 8-12px 留白
- [ ] 左右圆角 12-16px
- [ ] 激活态有 36×36 主色 chip
- [ ] iPhone 不与 Home Indicator 重叠

### 我的页面

- [ ] 顶部个人卡片
- [ ] 3 项菜单（个人资料/修改密码/登录日志）
- [ ] 底部退出登录卡片按钮
- [ ] 管理员额外显示「系统管理」入口

### 子页面规范

- [ ] 所有子页面系统默认导航栏（白底黑字+返回箭头+标题居中）
- [ ] 登录页表单视口垂直居中
- [ ] 复杂表单（新增用户）顶部对齐
- [ ] 所有 Icon 圆角线性风格

### 应用 Tab

- [ ] 现有 WorkbenchGrid 渲染不受影响
- [ ] 菜单可正常点击跳转
- [ ] StateView 三态正常

## Lint & Typecheck

```bash
pnpm --filter yishan-app lint       # biome:lint + tsc --noEmit
pnpm --filter yishan-admin lint
pnpm --filter yishan-api test
```

## 测试数据

聚合接口需要数据才能展示，开发时可手动造数据：

```sql
-- 插入测试用户
INSERT INTO sys_user (username, password_hash, real_name, status, created_at) VALUES
  ('test1', '$2b$10$...', '张三', '1', NOW()),
  ('test2', '$2b$10$...', '李四', '1', NOW());

-- 插入测试登录日志
INSERT INTO sys_login_log (user_id, ip_address, status, created_at) VALUES
  (1, '127.0.0.1', '1', NOW());
```

## 部署顺序

1. 后端：先部署 API（新接口 + 主色无影响）
2. 移动端：部署 App 新版本
3. PC 端：部署 Admin 新版本（主色变更）
4. 文档站：触发 docs 重新构建

## 常见问题

**Q: 主色 #1677FF 改了，admin 端会有视觉回归吗？**
A: 会有。少数 antd Pro 默认色（如蓝色链接）会一起切换。验收时需对比 5 个核心页面截图。

**Q: 聚合接口 Redis 缓存键是什么？**
A: `dashboard:stats`，TTL 30s。建议在 `apps/yishan-api/.env` 配置 `REDIS_HOST` 启用。

**Q: 渐变带在低端机会不会卡？**
A: 不会。CSS 渐变由 GPU 渲染，不影响 CPU。但需准备单色 fallback（极老机型）。

## 下一步

执行 `pnpm --filter yishan-app lint` 通过后，进入 `/speckit.tasks` 拆解开发任务。
