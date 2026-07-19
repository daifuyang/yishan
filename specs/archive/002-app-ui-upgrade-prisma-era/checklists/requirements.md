# Specification Quality Checklist: yishan-app 品牌基线与驾驶舱 MVP

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-06-03
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

### Validation Summary

All quality checklist items pass. The specification has been **iteratively clarified and extended** to capture all user feedback on visual design.

### Clarifications Applied (7 total, 2 sessions)

**Session 2026-06-03 (Round 1):**
| # | Question | Answer | Impact |
|---|----------|--------|--------|
| 1 | 主色选择 | `#1677FF` | FR-003, FR-006, FR-011 |
| 2 | 品牌名 | 移山 | FR-001, FR-007 |
| 3 | Logo 策略 | `⛰` 字符标占位 | FR-002, FR-007, FR-009 |
| 4 | 范围收敛 | 按 PC 端有的来，多余的删掉 | 全文重写 |
| 5 | 数据源 | 新增聚合接口 `/api/v1/app/dashboard/stats` | FR-010 |

**Session 2026-06-03 (Round 2 — 视觉升级):**
| # | Question | Answer | Impact |
|---|----------|--------|--------|
| 6 | TabBar 形态 | 圆角悬浮胶囊 | 新增 US6、FR-019~023、SC-021~024 |
| 7 | 首页"大气"方向 | A+B+C 组合 | US3 升级、FR-015~018、SC-016~020 |

**Session 2026-06-03 (Round 3 — 全局规范):**
| # | Question | Answer | Impact |
|---|----------|--------|--------|
| 8 | 子页标题栏形态 | 系统默认（白底黑字 + 返回箭头 + 标题居中） | US7、FR-030、SC-025 |
| 9 | 表单垂直居中 | 视口严格垂直居中（≤ 3 字段） | US7、FR-031~032、SC-026~027 |
| 10 | Icon 风格 | 圆角线性 1.5-2px stroke + 24×24 淡色背景 | US7、FR-033~034、SC-028~029 |

### Scope Evolution

| 阶段 | US | FR | SC |
|------|----|----|-----|
| Spec 初版（原始 002） | 10 | 29 | 17 |
| Round 1 收敛（MVP） | 5 | 19 | 15 |
| Round 2 视觉升级 | 6 | 28 | 24 |
| **Round 3 全局规范（当前）** | **7** | **35** | **30** |

### Round 2 新增内容

1. **User Story 6** — 底部 TabBar 圆角悬浮胶囊
   - 6 个 Acceptance Scenarios（间距/圆角/激活态/未激活/过渡/Home Indicator/固定）
2. **User Story 3 升级** — 首页"大气体感"
   - 从 7 个 AS 扩展到 11 个 AS
   - 新增品牌渐变带 / 大号欢迎语 / 加粗统计卡 / 三段式层次 / 区块间距
3. **Functional Requirements 新增 9 条**
   - 首页驾驶舱：FR-015~018（品牌渐变带、大号欢迎语、间距、三段式卡片）
   - 底部 TabBar：FR-019~023（圆角悬浮、激活态、安全区、过渡、固定）
4. **Success Criteria 新增 9 条**
   - 首页"大气"：SC-016~020（渐变带、字号、卡片、层次、间距）
   - TabBar：SC-021~024（间距、激活态、安全区、过渡）

### Round 3 新增内容

1. **User Story 7** — 全局视觉与交互规范（微信小程序 + 标题栏 + 表单 + Icon）
   - 9 个 Acceptance Scenarios（标题栏/滚动/登录居中/复杂表单顶部对齐/Icon 风格/Icon 容器/跨页面一致/spacing/配色）
2. **Functional Requirements 新增 7 条（FR-029~035）**
   - FR-029 微信小程序官方设计规范
   - FR-030 系统默认导航栏（不自定义 navigationStyle）
   - FR-031 轻表单视口垂直居中
   - FR-032 复杂表单顶部对齐
   - FR-033 Icon 圆角线性 1.5-2px stroke
   - FR-034 Icon 24×24 主色淡色背景容器
   - FR-035 跨页面样式 100% 一致 + 禁止裸写
3. **Success Criteria 新增 6 条（SC-025~030）**
   - SC-025 子页系统默认导航栏
   - SC-026 轻表单垂直居中
   - SC-027 复杂表单顶部对齐
   - SC-028 Icon 圆角线性统一
   - SC-029 Icon 主色淡色背景容器
   - SC-030 跨页面样式 100% 一致 + token 化

### Ready for Next Phase

The specification is ready for `/speckit.plan` to design the implementation approach. The plan should cover:

1. **Step 1: 品牌基线文档化** — 创建 `docs/BRAND.md` 或 `.specify/memory/brand.md`
2. **Step 2: 跨端对齐实施** — admin 改 token + ProLayout；app 引入字体 + 登录页改版
3. **Step 3: 聚合接口** — 后端 `GET /api/v1/app/dashboard/stats`
4. **Step 4: TabBar 圆角悬浮胶囊重做** — 现有 TabBar 组件升级
5. **Step 5: 首页驾驶舱"大气体感"** — 管理员/普通用户两种视图 + 品牌渐变 + 加粗统计卡
6. **Step 6: 我的页面** — 收敛到 3 项 + 管理员系统管理入口
7. **Step 7: 应用 Tab 验证** — 确认现有逻辑不受影响
