# Implementation Plan: Mobile User Management for Workbench

**Branch**: `main` | **Date**: 2026-06-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-mobile-user-mgmt/spec.md`

## Summary

在工作台（应用页面）添加可展开的用户管理面板，用户点击"用户管理"入口后展开显示用户列表，支持搜索、筛选、分页和快速操作。功能对齐 PC 端用户管理，同时做好移动端适配。

## Technical Context

**Language/Version**: TypeScript 5.x, React 18.3, Taro 4.0

**Primary Dependencies**:
- `@tarojs/components` - 跨端 UI 组件库
- `@tarojs/taro` - 跨端框架核心
- `react` 18.x - UI 框架

**Storage**: N/A（纯前端展示，数据来自现有 API）

**Testing**: 暂无强制测试要求（App: 暂无强制测试要求 per constitution）

**Target Platform**: 微信小程序 + H5（移动端优先）

**Project Type**: Mobile App (yishan-app)

**Performance Goals**:
- 列表展开动画 300ms
- 搜索防抖 300ms
- 首屏加载 20 条用户

**Constraints**:
- 移动端屏幕适配（375px - 430px）
- 保持与 PC 端功能对齐

**Scale/Scope**: 单页面组件改动，约 5-8 个组件文件

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Yishan 章程检查项（基于 `.specify/memory/constitution.md`）：

- [x] Monorepo 工作空间：yishan-app 已在 workspace 中，无需新增包
- [x] 构建顺序：本次仅为前端改动，不影响构建顺序
- [x] 类型安全：`tsc --noEmit` 必须通过（使用 Biome lint）
- [x] 测试覆盖：App 暂无强制测试要求
- [x] API 契约：使用现有 `adminUserApi`，无需修改
- [x] 技术栈一致性：使用 Taro 4 + React 18，符合 AGENTS.md 定义

所有检查项通过。

## Project Structure

### Documentation (this feature)

```text
specs/001-mobile-user-mgmt/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── checklists/
    └── requirements.md  # Spec quality checklist
```

### Source Code (repository root)

```text
apps/yishan-app/src/
├── pages/
│   ├── apps/
│   │   └── index.tsx              # 工作台/应用页面（修改：添加用户管理面板）
│   └── system/user/
│       ├── index.tsx              # 用户管理列表页（已有）
│       ├── detail/index.tsx        # 用户详情页（已有）
│       └── edit/index.tsx          # 用户编辑页（已有）
├── components/
│   ├── organisms/
│   │   └── WorkbenchUserPanel/    # 新增：工作台用户面板组件
│   └── ...
├── api/admin/
│   ├── user.ts                    # 用户管理 API（已有，直接使用）
│   └── types.ts                   # AdminUser 类型（已有）
└── hooks/
    └── useListPagination.ts        # 分页 Hook（已有，复用）
```

**Structure Decision**: 纯前端扩展，不涉及新目录创建。主要改动点在 `pages/apps/index.tsx` 添加展开面板，以及新增 `components/organisms/WorkbenchUserPanel/` 组件。

## Phase 0: Research Findings

### Decision: 使用可展开面板而非跳转页面

**Rationale**: 用户描述要求"点击按钮，展开用户列表"，这是轻量化操作，无需跳转到独立页面。展开面板更适合移动端快速查看。

**Alternatives considered**:
- 跳转独立页面（需要返回操作，效率较低）
- Modal 弹窗（遮挡背景，不适合长列表）

### Decision: 复用现有 useListPagination Hook

**Rationale**:
- `pages/system/user/index.tsx` 已实现完整的分页列表逻辑
- Hook 提供 `list`, `total`, `loading`, `refreshing`, `refresh` 等状态
- 复用减少代码重复，保持一致性

### Decision: 长按弹出操作菜单

**Rationale**:
- PC 端点击操作列，移动端空间有限
- iOS/Android 惯例使用长按触发上下文菜单
- `Taro.showActionSheet` 提供原生体验

### Decision: 300ms 防抖搜索

**Rationale**:
- 用户输入时避免频繁 API 调用
- 300ms 是常见最佳实践
- 平衡响应速度和 API 调用次数

## Phase 1: Design Output

### Data Model

基于 `api/admin/types.ts` 中已有的 `AdminUser` 类型：

```typescript
interface AdminUser {
  id: number
  username: string
  realName?: string
  nickname?: string
  phone?: string
  email?: string
  avatar?: string
  status: '0' | '1' | '2'  // 禁用/启用/锁定
  roleIds?: number[]
  deptIds?: number[]
  lastLoginTime?: string
  lastLoginIp?: string
  createdAt: string
  updatedAt: string
  creatorName?: string
  updaterName?: string
  loginCount?: number
}
```

### Component Design

**New Component**: `WorkbenchUserPanel`
- 位置: `components/organisms/WorkbenchUserPanel/`
- 功能: 可展开的用户管理面板
- Props:
  - `expanded: boolean` - 展开/收起状态
  - `onToggle: () => void` - 切换展开状态

**Existing Components to Reuse**:
- `ListFilter` - 搜索和筛选
- `ListItem` - 用户列表项
- `Avatar` - 用户头像
- `Tag` - 状态标签
- `StateView` - 加载/空/错误状态
- `useListPagination` - 分页逻辑

### API Usage

直接使用现有 `adminUserApi`:
- `listAdminUsers(query)` - 获取用户列表
- `updateAdminUser(id, data)` - 更新用户状态
- `resetAdminUserPassword(id, newPassword)` - 重置密码
- `deleteAdminUser(id)` - 删除用户

无需修改 API 契约。

## Implementation Notes

### 展开动画

使用 CSS transition 或 Taro 动画 API 实现展开/收起动画，时长 300ms。

### 权限控制

操作菜单根据权限显示：
- `userWrite`: 启用/禁用、重置密码
- `userDelete`: 删除

使用 `useCanWrite(PERMS.userWrite)` 和 `useCanWrite(PERMS.userDelete)` 判断。

### 移动端适配

- 使用 rpx 单位（自动转换）
- 列表每行高度固定，内容超长省略
- 状态标签使用 Tag 组件自适应大小

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

无违规项。
