# Tasks: Mobile User Management for Workbench

**Input**: Design documents from `/specs/001-mobile-user-mgmt/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, quickstart.md

**Tests**: Tests NOT required per constitution (App: 暂无强制测试要求)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Mobile app: `apps/yishan-app/src/`
- Components: `apps/yishan-app/src/components/organisms/WorkbenchUserPanel/`
- Pages: `apps/yishan-app/src/pages/`
- API: `apps/yishan-app/src/api/admin/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Check existing project structure in apps/yishan-app/src/
- [X] T002 [P] Verify existing API types in apps/yishan-app/src/api/admin/types.ts (AdminUser)
- [X] T003 [P] Verify existing adminUserApi in apps/yishan-app/src/api/admin/user.ts
- [X] T004 [P] Verify existing useListPagination hook in apps/yishan-app/src/hooks/useListPagination.ts
- [X] T005 [P] Verify existing user pages in apps/yishan-app/src/pages/system/user/

**Checkpoint**: Project structure verified, all dependencies identified

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T006 Create WorkbenchUserPanel component directory structure in apps/yishan-app/src/components/organisms/WorkbenchUserPanel/
- [X] T007 [P] Define WorkbenchUserPanel Props interface in apps/yishan-app/src/components/organisms/WorkbenchUserPanel/types.ts
- [X] T008 [P] Define UserStatus enum in apps/yishan-app/src/components/organisms/WorkbenchUserPanel/constants.ts
- [X] T009 Create main component entry in apps/yishan-app/src/components/organisms/WorkbenchUserPanel/index.tsx

**Checkpoint**: Foundational structure ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Quick User List Access from Workbench (Priority: P1) 🎯 MVP

**Goal**: 管理员点击用户管理入口后，展开显示用户列表，包含头像、用户名、姓名、手机号、状态标签

**Independent Test**: 点击工作台用户管理入口，验证列表是否正常展开显示，不依赖其他功能

### Implementation for User Story 1

- [X] T010 [P] [US1] Create UserPanelHeader component in apps/yishan-app/src/components/organisms/WorkbenchUserPanel/UserPanelHeader.tsx
- [X] T011 [P] [US1] Create UserListItem component in apps/yishan-app/src/components/organisms/WorkbenchUserPanel/UserListItem.tsx
- [X] T012 [P] [US1] Create UserAvatar component in apps/yishan-app/src/components/organisms/WorkbenchUserPanel/UserAvatar.tsx
- [X] T013 [US1] Implement expandable panel with 300ms animation in apps/yishan-app/src/components/organisms/WorkbenchUserPanel/index.tsx
- [X] T014 [US1] Integrate WorkbenchUserPanel into apps/yishan-app/src/pages/apps/index.tsx
- [X] T015 [US1] Connect panel to adminUserApi.listAdminUsers() for initial user list
- [X] T016 [US1] Implement display logic: avatar, display name (realName > username > phone), status tag, username, phone
- [X] T017 [US1] Add permission check for user management access (FR-001, FR-002)

**Checkpoint**: At this point, User Story 1 should be fully functional - clicking user management shows expandable list

---

## Phase 4: User Story 2 - User List Navigation and Search (Priority: P2)

**Goal**: 管理员可以在展开的用户列表中进行搜索和筛选，快速定位目标用户

**Independent Test**: 输入搜索词或点击状态筛选标签，验证列表是否正确过滤显示

### Implementation for User Story 2

- [X] T018 [P] [US2] Create SearchInput component with 300ms debounce in apps/yishan-app/src/components/organisms/WorkbenchUserPanel/SearchInput.tsx
- [X] T019 [P] [US2] Create StatusFilter component in apps/yishan-app/src/components/organisms/WorkbenchUserPanel/StatusFilter.tsx
- [X] T020 [US2] Implement keyword search (username/realName/phone) with 300ms debounce (FR-004)
- [X] T021 [US2] Implement status filter (全部/启用/禁用/锁定) (FR-005)
- [X] T022 [US2] Handle empty state when no users match search/filter (FR-012)
- [X] T023 [US2] Connect search and filter to adminUserApi.listAdminUsers() query params

**Checkpoint**: User Story 2 complete - search and filter functionality working

---

## Phase 5: User Story 3 - View User Details (Priority: P2)

**Goal**: 管理员可以点击展开列表中的用户，查看完整用户详情

**Independent Test**: 点击用户列表项，验证是否显示用户详情或跳转

### Implementation for User Story 3

- [X] T024 [US3] Implement onClick handler on UserListItem to navigate to user detail (FR-006)
- [X] T025 [US3] Verify existing user detail page in apps/yishan-app/src/pages/system/user/detail/index.tsx shows all fields
- [X] T026 [US3] Test navigation from workbench panel to detail page preserves user context

**Checkpoint**: User Story 3 complete - clicking user navigates to detail page

---

## Phase 6: User Story 4 - Quick User Actions (Priority: P2)

**Goal**: 管理员可以长按列表用户执行启用/禁用、重置密码、删除操作

**Independent Test**: 长按或操作按钮验证操作菜单是否正常弹出和执行

### Implementation for User Story 4

- [X] T027 [P] [US4] Create ActionMenu component using Taro.showActionSheet in apps/yishan-app/src/components/organisms/WorkbenchUserPanel/ActionMenu.tsx
- [X] T028 [P] [US4] Define action menu items based on permissions (userWrite, userDelete)
- [X] T029 [US4] Implement long press handler (onLongPress) on UserListItem to show action menu (FR-007)
- [X] T030 [US4] Implement enable/disable action with confirmation dialog using adminUserApi.updateAdminUser() (FR-008)
- [X] T031 [US4] Implement reset password action with password input dialog (FR-008)
- [X] T032 [US4] Implement delete action with double confirmation using adminUserApi.deleteAdminUser() (FR-008)
- [X] T033 [US4] Add success/failure Toast feedback for all actions (SC-007)
- [X] T034 [US4] Refresh user list after any action completes

**Checkpoint**: User Story 4 complete - all quick actions working with proper feedback

---

## Phase 7: User Story 5 - Paginated User List (Priority: P3)

**Goal**: 用户列表支持分页加载更多，便于查看大量用户

**Independent Test**: 上拉加载更多验证分页功能是否正常

### Implementation for User Story 5

- [X] T035 [US5] Integrate useListPagination hook for pagination state management
- [X] T036 [US5] Implement pull-to-refresh functionality (FR-010)
- [X] T037 [US5] Implement load-more on scroll to bottom (FR-010)
- [X] T038 [US5] Show "没有更多了" when all pages loaded
- [X] T039 [US5] Configure page size to 20 users per load (SC-005, SC-009)

**Checkpoint**: User Story 5 complete - pagination working smoothly

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T040 [P] Error state view with retry button when API fails (FR-011)
- [X] T041 [P] Empty state illustrations and copy for no users / no results
- [X] T042 [P] Performance optimization: ensure 300ms expand animation (SC-001)
- [X] T043 [P] Mobile layout adaptation for 375px-430px screens (SC-006)
- [X] T044 Run biome lint and tsc --noEmit on apps/yishan-app
- [X] T045 Test all quickstart.md validation steps

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - US1 (P1) → US2 (P2) → US3 (P2) → US4 (P2) → US5 (P3)
  - Stories can proceed sequentially or in parallel if capacity allows
- **Polish (Final Phase)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: MVP - Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Depends on US1 (needs panel structure) - Can test independently once US1 done
- **User Story 3 (P3)**: Depends on US1 (needs list to click) - Can test independently once US1 done
- **User Story 4 (P4)**: Depends on US1 (needs list to long-press) - Can test independently once US1 done
- **User Story 5 (P5)**: Depends on US1 (needs list to paginate) - Can test independently once US1 done

### Within Each User Story

- Components before integration
- Core implementation before error handling
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Components within US1 marked [P] can run in parallel (T010, T011, T012)
- Components within US4 marked [P] can run in parallel (T027, T028)
- Polish tasks marked [P] can run in parallel (T040, T041, T042, T043)

---

## Parallel Example: User Story 1

```bash
# Launch all UI components for User Story 1 together:
Task: "Create UserPanelHeader component in apps/yishan-app/src/components/organisms/WorkbenchUserPanel/UserPanelHeader.tsx"
Task: "Create UserListItem component in apps/yishan-app/src/components/organisms/WorkbenchUserPanel/UserListItem.tsx"
Task: "Create UserAvatar component in apps/yishan-app/src/components/organisms/WorkbenchUserPanel/UserAvatar.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test expanding user list independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Add User Story 4 → Test independently → Deploy/Demo
6. Add User Story 5 → Test independently → Deploy/Demo
7. Polish Phase → Final Release

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 + US5 (panel + pagination)
   - Developer B: User Story 2 (search/filter)
   - Developer C: User Story 3 + US4 (details + actions)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
