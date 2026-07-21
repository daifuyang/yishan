# Feature Specification: Mobile User Management for Workbench

**Feature Branch**: `[001-mobile-user-mgmt]`

**Created**: 2026-06-03

**Status**: Draft

**Input**: User description: "我的yishan-app，我希望工作台的用户管理可以正常工作。点击按钮，展开用户列表，对齐pc端的功能，做好移动端友好"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Quick User List Access from Workbench (Priority: P1)

管理员在移动端工作台点击「用户管理」按钮，工作台展开显示用户列表，无需跳转到独立页面即可快速浏览用户信息。

**Why this priority**: 这是核心场景，管理员需要在移动端快速查看用户列表，跟 PC 端体验对齐。

**Independent Test**: 可以通过点击工作台用户管理入口，验证列表是否正常展开显示，不依赖其他功能。

**Acceptance Scenarios**:

1. **Given** 管理员已登录且有用户管理权限，**When** 点击工作台「用户管理」入口，**Then** 展开显示用户列表，包含头像、用户名、姓名、手机号、状态标签
2. **Given** 管理员已登录但无用户管理权限，**When** 点击工作台「用户管理」入口，**Then** 提示「无权限访问」
3. **Given** 用户列表为空，**When** 展开用户列表，**Then** 显示「暂无用户」空状态

---

### User Story 2 - User List Navigation and Search (Priority: P2)

管理员可以在展开的用户列表中进行搜索和筛选，快速定位目标用户。

**Why this priority**: PC 端有搜索和状态筛选功能，移动端必须提供同等能力才能对齐。

**Independent Test**: 可以通过输入搜索词或点击状态筛选标签，验证列表是否正确过滤显示。

**Acceptance Scenarios**:

1. **Given** 用户列表已展开，**When** 在搜索框输入关键词（用户名/姓名/手机号），**Then** 列表实时过滤显示匹配用户
2. **Given** 用户列表已展开，**When** 点击状态标签（全部/启用/禁用/锁定），**Then** 列表仅显示对应状态用户
3. **Given** 搜索或筛选无结果，**Then** 显示「未找到匹配用户」空状态

---

### User Story 3 - View User Details (Priority: P2)

管理员可以点击展开列表中的用户，查看完整用户详情。

**Why this priority**: 查看用户详情是基本操作，需要跳转到详情页或展开详情面板。

**Independent Test**: 可以通过点击用户列表项，验证是否显示用户详情。

**Acceptance Scenarios**:

1. **Given** 用户列表已展开，**When** 点击某用户行，**Then** 跳转到用户详情页面，显示完整信息（ID、用户名、姓名、昵称、邮箱、手机、状态、角色、部门、创建时间等）
2. **Given** 用户详情页面，**Then** 显示用户的最后登录时间和登录 IP（如果有）

---

### User Story 4 - Quick User Actions (Priority: P2)

管理员可以在展开的列表中快速执行启用/禁用、重置密码等操作。

**Why this priority**: PC 端可以快速切换用户状态，移动端需要提供同等效率。

**Independent Test**: 可以通过长按或操作按钮验证操作菜单是否正常弹出和执行。

**Acceptance Scenarios**:

1. **Given** 用户列表已展开，**When** 长按某用户行，**Then** 弹出操作菜单（启用/禁用、重置密码、删除，权限范围内）
2. **Given** 管理员点击「启用/禁用」，**Then** 弹出确认框，确认后执行状态切换并显示成功提示
3. **Given** 管理员点击「重置密码」，**Then** 弹出输入框要求输入新密码，确认后执行并显示成功提示
4. **Given** 管理员点击「删除」，**Then** 弹出二次确认框，确认后执行删除并刷新列表

---

### User Story 5 - Paginated User List (Priority: P3)

用户列表支持分页加载更多，便于查看大量用户。

**Why this priority**: 当用户数量较多时，一次性加载会影响性能，分页是标准做法。

**Independent Test**: 可以通过上拉加载更多验证分页功能是否正常。

**Acceptance Scenarios**:

1. **Given** 用户列表已展开且有多页数据，**When** 上拉到底部，**Then** 加载更多用户并追加到列表
2. **Given** 已加载全部用户，**Then** 上拉不触发加载，显示「没有更多了」

---

### Edge Cases

- 网络请求失败时显示错误状态，提供重试按钮
- 用户数据在列表展开后发生变化（如被删除），显示最新状态，不报错
- 大量用户（>1000）时首页仅加载 20 条，避免首次加载过慢
- 无网络连接时显示缓存数据（如果有）或提示网络异常

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系统必须在工作台提供用户管理入口按钮
- **FR-002**: 点击入口按钮后，展开显示用户列表（下拉展开动画），再次点击收起
- **FR-003**: 用户列表必须显示：头像、显示名称（优先realName其次username再次phone）、状态标签、用户名、手机号
- **FR-004**: 用户列表必须支持关键词搜索（用户名/姓名/手机号），300ms 防抖
- **FR-005**: 用户列表必须支持状态筛选（全部/启用/禁用/锁定）
- **FR-006**: 点击用户行必须跳转到用户详情页
- **FR-007**: 长按用户行必须弹出操作菜单（启用/禁用、重置密码、删除）
- **FR-008**: 操作菜单必须根据权限控制显示项目（无 userWrite 权限不显示启用/禁用和重置密码，无 userDelete 权限不显示删除）
- **FR-009**: 用户详情页必须显示完整用户信息
- **FR-010**: 用户列表必须支持分页加载（上拉加载更多）
- **FR-011**: 网络错误时必须显示错误提示和重试按钮
- **FR-012**: 列表为空时必须显示空状态插画和提示文案

### Key Entities

- **AdminUser**: 系统管理员用户，包含 id、username、realName、nickname、phone、email、avatar、status（0禁用/1启用/2锁定）、roleIds、deptIds、lastLoginTime、lastLoginIp、createdAt、updatedAt
- **UserStatus**: 用户状态枚举，'0'（禁用）、'1'（启用）、'2'（锁定）

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 管理员点击用户管理入口后，列表在 300ms 内展开显示
- **SC-002**: 搜索输入到结果呈现延迟不超过 300ms（防抖后）
- **SC-003**: 用户可以顺利完成启用/禁用操作，成功率 100%
- **SC-004**: 用户可以顺利查看任意用户详情，无信息遗漏
- **SC-005**: 分页加载每页 20 条用户数据
- **SC-006**: 移动端布局适配良好，在 iPhone SE（375px）到 iPhone 15 Pro Max（430px）屏幕宽度下均可正常浏览
- **SC-007**: 所有操作有明确的成功/失败反馈（Toast 提示）

## Assumptions

- 管理员已在 PC 端配置好用户角色和权限，移动端权限继承 PC 端设置
- 用户头像可能为空，为空时显示默认头像（首字母）
- 用户列表不会超过 10000 条，单次筛选结果也不会超过这个数量
- 移动端与 PC 端共用同一套 API，API 契约已稳定
- 默认每页加载 20 条用户数据是合理的移动端分页大小
