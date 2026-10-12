# 首页常用应用（用户固定 + 使用习惯推荐）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 小程序首页「常用应用」改为「用户固定在前 + 按使用习惯推荐补位」，数据存后端，与工作台菜单配置解耦。

**Architecture:** Core System API 新增两张按用户的表（固定、使用计数）和三个 `/api/v1/app/menus/*` 接口；后端只返回已授权入口 id 的两个有序列表（`pinned` / `ranked`），前端按 registry 过滤掉没有移动端页面的入口后截取 8 个。打开应用统一走 `openWorkbenchApp` 并异步上报使用记录；新增编辑页用现成管理组件维护固定列表。

**Tech Stack:** Fastify 5 + TypeBox + Drizzle（MySQL）+ Vitest；Taro 4 + React 18 + zustand + `node --test`。

**Spec:** `docs/superpowers/specs/2026-10-12-home-common-apps-design.md`

## Global Constraints

- 工作台入口 = `sys_workbench_menu` 中 `type = 1` 的节点；一律以其 `id`（前端 `WorkbenchApp.menuId`）为键。
- 首页最多 **8** 个；固定最多 **8** 个（后端 schema `maxItems: 8`，前端 `MAX_HOME_APPS = 8`）。
- 推荐分 `score = open_count × 0.5^(Δdays / 14)`；`last_opened_at` 早于 **90** 天计 0；同分按工作台树先序。
- 三个接口复用权限点 `app:menu:authorized-tree`（`PERMS.TREE_AUTHORIZED`），不新增权限码。
- 分层 routes → service → repository；SQL 只在 repository；表名带 `sys_` 前缀；项目不使用外键。
- 已发布迁移（`_published-hashes.json` 中的条目）不可修改；新迁移只新增文件 + journal 条目。
- 移动端遵守 `docs/design/mobile-form-spec.md` 与根 `CLAUDE.md`「Mobile form & list conventions」：只用 `components/management` 现成组件，`Checkbox` 不传 `onClick`，导航用 `@/utils/router`，页面默认导出包 `withAccountScope`。
- 提交遵循 Conventional Commits，结尾加 `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`。
- 在独立 worktree 中实施（另一会话可能在主工作区改 `apps/demo/app`）。

## Review Focus

1. **首页接口失败**（老后端未部署新接口 / 网络错误）：首页仍按菜单顺序显示 8 个，`menus` 不受影响 → Task 4 store 测试覆盖。
2. **固定后被撤权 / 入口被删 / 模块被禁用**：首页与编辑页都不再显示该入口，保存时被后端丢弃 → Task 1 service 测试 + Task 4 `getHomeApps` 测试。
3. **保存过程中切换账号**：返回结果不能写进新账号的 store → Task 4 store 测试。
4. **使用记录上报失败或接口缺失**：跳转照常成功，不弹错 → Task 5 navigation 测试。
5. **已固定满 8 个时再勾选**：未勾选行整行置灰且点击无效，草稿不超过 8 → Task 6 model 测试 + cell 测试。

---

## File Structure

后端 `packages/core/system-api/`：

| 文件 | 动作 | 职责 |
|---|---|---|
| `src/db/schema/tables.ts` | 修改 | 新增 `sysUserWorkbenchPin`、`sysUserWorkbenchUsage` |
| `drizzle/0004_user-workbench-preference.sql` | 新建 | 建表迁移 |
| `drizzle/meta/_journal.json` | 修改 | 登记 0004 |
| `src/core/repositories/app-home.repository.ts` | 新建 | pins / usage 的 SQL |
| `src/core/services/app-home.service.ts` | 新建 | 排序算法 + 授权过滤 + 保存/上报 |
| `src/core/schemas/app-home.ts` | 新建 | TypeBox schema |
| `src/core/schemas/index.ts` | 修改 | 注册 app-home schema |
| `src/core/routes/api/v1/app/menus/index.ts` | 修改 | 新增 `/home`、`/pins`、`/usage` |
| `src/scripts/seed/config/app-menus.json` | 修改 | 「常用」分组改名「协同办公」 |
| `test/app-home.service.test.ts` | 新建 | 排序与服务测试 |
| `test/app.menus.home.routes.test.ts` | 新建 | 路由测试 |
| `test/migrations.user-workbench.test.ts` | 新建 | 迁移登记静态测试 |

前端 `apps/demo/app/`：

| 文件 | 动作 | 职责 |
|---|---|---|
| `src/api/types.ts` | 修改 | `HomeAppIds` |
| `src/api/menu.ts` | 修改 | `getHomeApps` / `saveHomePins` / `reportAppUsage` |
| `src/modules/registry.ts` | 修改 | `MAX_HOME_APPS`、`getHomeApps` |
| `src/stores/modules.ts` | 修改 | 去掉本地常用存储，加 `home` / `savePins` |
| `src/pages/apps/navigation.ts` | 修改 | 跳转成功后上报使用 |
| `src/pages/index/index.tsx` | 修改 | 用 `getHomeApps` 渲染、「编辑」入口、统一打开 |
| `src/components/management/ManagementList.tsx` + `.module.scss` | 修改 | `ManagementCell` 增加 `leading` / `disabled` |
| `src/pages/apps/pinned/{index.tsx,index.config.ts,model.ts}` | 新建 | 编辑页 |
| `src/constants/routes.ts`、`src/constants/page-config.ts` | 修改 | 登记编辑页 |
| `src/pages/apps/index.tsx` | 修改 | 删掉「常用」分组特殊过滤 |
| `src/pages/apps/FavoritesEditor.tsx` | 删除 | 无引用的旧编辑器 |
| `tests/workbench.test.cjs`、`tests/modules.test.cjs`、`tests/home.test.cjs`、`tests/browser/workbench.js` | 修改 | 适配新行为 |
| `tests/home-apps.test.cjs` | 新建 | `getHomeApps`、编辑页 model/结构、cell 新属性 |

文档：`apps/demo/app/README.md`、根 `CLAUDE.md`「App workbench menu」一节。

---

### Task 0: 建立 worktree

- [ ] **Step 1: 创建隔离工作区**

使用 `superpowers:using-git-worktrees` 技能，基于当前分支 `feat/app-attachments-redesign` 的 HEAD 创建 worktree（分支名 `feat/home-common-apps`），然后在 worktree 根目录执行：

```bash
pnpm install
pnpm --filter @yishan/core-system-api test
pnpm --filter @yishan/demo-app test
```

Expected: 安装成功；两个测试命令都 PASS（作为基线）。若基线失败，停止并报告。

---

### Task 1: 后端数据表、迁移、repository 与服务

**Files:**
- Modify: `packages/core/system-api/src/db/schema/tables.ts`（在 `sysRoleWorkbenchMenu` 定义之后插入）
- Create: `packages/core/system-api/drizzle/0004_user-workbench-preference.sql`
- Modify: `packages/core/system-api/drizzle/meta/_journal.json`
- Create: `packages/core/system-api/src/core/repositories/app-home.repository.ts`
- Create: `packages/core/system-api/src/core/services/app-home.service.ts`
- Test: `packages/core/system-api/test/app-home.service.test.ts`
- Test: `packages/core/system-api/test/migrations.user-workbench.test.ts`

**Interfaces:**
- Consumes: `AppMenuService.getAuthorizedTree(roleIds: number[], scope?: AppMenuModuleScope): Promise<AppMenuNode[]>`（已有）
- Produces:
  - `type HomeApps = { pinned: number[]; ranked: number[] }`
  - `MAX_HOME_PINS = 8`
  - `usageScore(row: WorkbenchUsageRow, now: Date): number`
  - `rankHomeApps(entryIds: readonly number[], pinnedIds: readonly number[], usage: readonly WorkbenchUsageRow[], now: Date): HomeApps`
  - `authorizedEntryIds(tree: readonly AppMenuNode[]): number[]`
  - `AppHomeService.getHome(userId: number, roleIds: number[], scope?: AppMenuModuleScope, now?: Date): Promise<HomeApps>`
  - `AppHomeService.savePins(userId: number, roleIds: number[], menuIds: readonly number[], scope?: AppMenuModuleScope): Promise<HomeApps>`
  - `AppHomeService.recordUsage(userId: number, roleIds: number[], menuId: number, scope?: AppMenuModuleScope): Promise<{ recorded: boolean }>`
  - `AppHomeRepository.listPinnedIds / replacePins / listUsage / incrementUsage`
  - `interface WorkbenchUsageRow { workbenchMenuId: number; openCount: number; lastOpenedAt: Date }`

- [ ] **Step 1: 写迁移登记的失败测试**

Create `packages/core/system-api/test/migrations.user-workbench.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from './runtime-fixture'

const drizzleDir = join(__dirname, '..', 'drizzle')

describe('0004_user-workbench-preference migration', () => {
  it('is registered after 0003 in the journal and creates both tables', () => {
    const journal = JSON.parse(readFileSync(join(drizzleDir, 'meta', '_journal.json'), 'utf8'))
    const tags = journal.entries.map((e: { tag: string }) => e.tag)
    expect(tags).toContain('0004_user-workbench-preference')
    const entries = journal.entries as Array<{ idx: number; when: number; tag: string }>
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i].idx).toBeGreaterThan(entries[i - 1].idx)
      expect(entries[i].when).toBeGreaterThan(entries[i - 1].when)
    }
    const sql = readFileSync(join(drizzleDir, '0004_user-workbench-preference.sql'), 'utf8')
    expect(sql).toMatch(/CREATE TABLE `sys_user_workbench_pin`/)
    expect(sql).toMatch(/CREATE TABLE `sys_user_workbench_usage`/)
    expect(sql).toMatch(/UNIQUE\(`user_id`,`workbench_menu_id`\)/)
  })
})
```

- [ ] **Step 2: 写服务的失败测试**

Create `packages/core/system-api/test/app-home.service.test.ts`:

```ts
import {
  AppHomeService,
  authorizedEntryIds,
  rankHomeApps,
  usageScore,
} from '../src/core/services/app-home.service.ts'
import { AppHomeRepository } from '../src/core/repositories/app-home.repository.ts'
import { AppMenuService } from '../src/core/services/app-menu.service.ts'
import type { AppMenuNode } from '../src/core/schemas/app-menu.ts'
import { dbManager } from '../src/db/index.ts'
import { describe, it, expect, vi, beforeEach } from './runtime-fixture'

const now = new Date('2026-10-12T00:00:00Z')
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000)
const iso = now.toISOString()

function node(id: number, type: 0 | 1, children: AppMenuNode[] | null = null): AppMenuNode {
  return { id, type, name: `n${id}`, moduleId: 'core', sortOrder: id, status: '1', createdAt: iso, updatedAt: iso, children }
}
// 树先序：组 1 → [11, 12]，组 2 → [21, 22]
const tree = [node(1, 0, [node(11, 1), node(12, 1)]), node(2, 0, [node(21, 1), node(22, 1)])]

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('usageScore', () => {
  it('halves every 14 days and drops to zero after 90 days', () => {
    expect(usageScore({ workbenchMenuId: 1, openCount: 4, lastOpenedAt: now }, now)).toBe(4)
    expect(usageScore({ workbenchMenuId: 1, openCount: 4, lastOpenedAt: daysAgo(14) }, now)).toBeCloseTo(2)
    expect(usageScore({ workbenchMenuId: 1, openCount: 4, lastOpenedAt: daysAgo(91) }, now)).toBe(0)
  })
})

describe('authorizedEntryIds', () => {
  it('returns entry ids in tree pre-order and skips groups', () => {
    expect(authorizedEntryIds(tree)).toEqual([11, 12, 21, 22])
  })
})

describe('rankHomeApps', () => {
  it('keeps pinned order, drops unavailable pins and ranks the rest by score then tree order', () => {
    const result = rankHomeApps(
      [11, 12, 21, 22],
      [21, 99, 21],
      [
        { workbenchMenuId: 22, openCount: 3, lastOpenedAt: now },
        { workbenchMenuId: 12, openCount: 1, lastOpenedAt: now },
        { workbenchMenuId: 21, openCount: 50, lastOpenedAt: now },
      ],
      now,
    )
    expect(result).toEqual({ pinned: [21], ranked: [22, 12, 11] })
  })

  it('falls back to tree order for a user without usage', () => {
    expect(rankHomeApps([11, 12, 21], [], [], now)).toEqual({ pinned: [], ranked: [11, 12, 21] })
  })

  it('treats stale usage as zero so it ties back to tree order', () => {
    const result = rankHomeApps([11, 12], [], [{ workbenchMenuId: 12, openCount: 9, lastOpenedAt: daysAgo(120) }], now)
    expect(result.ranked).toEqual([11, 12])
  })
})

describe('AppHomeService', () => {
  function mockData(pins: number[] = [], usage: Parameters<typeof rankHomeApps>[2] = []) {
    vi.spyOn(AppMenuService, 'getAuthorizedTree').mockResolvedValue(tree)
    vi.spyOn(AppHomeRepository, 'listPinnedIds').mockResolvedValue(pins)
    vi.spyOn(AppHomeRepository, 'listUsage').mockResolvedValue([...usage])
  }

  it('getHome filters by the authorized tree of the caller roles', async () => {
    mockData([22, 77])
    const home = await AppHomeService.getHome(7, [2], undefined, now)
    expect(AppMenuService.getAuthorizedTree).toHaveBeenCalledWith([2], undefined)
    expect(home).toEqual({ pinned: [22], ranked: [11, 12, 21] })
  })

  it('savePins dedupes, drops unauthorized/group ids and writes in a transaction', async () => {
    mockData()
    const replace = vi.spyOn(AppHomeRepository, 'replacePins').mockResolvedValue()
    vi.spyOn(dbManager, 'transaction').mockImplementation(async (fn: any) => fn('tx'))
    await AppHomeService.savePins(7, [2], [21, 1, 21, 404, 11])
    expect(replace).toHaveBeenCalledWith(7, [21, 11], 'tx')
  })

  it('recordUsage only writes authorized entries', async () => {
    mockData()
    const increment = vi.spyOn(AppHomeRepository, 'incrementUsage').mockResolvedValue()
    expect(await AppHomeService.recordUsage(7, [2], 12)).toEqual({ recorded: true })
    expect(increment).toHaveBeenCalledWith(7, 12)
    expect(await AppHomeService.recordUsage(7, [2], 1)).toEqual({ recorded: false })
    expect(await AppHomeService.recordUsage(7, [2], 404)).toEqual({ recorded: false })
    expect(increment).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 3: 运行，确认失败**

Run: `pnpm --filter @yishan/core-system-api exec vitest run test/app-home.service.test.ts test/migrations.user-workbench.test.ts`
Expected: FAIL —— 找不到 `app-home.service.ts` / `0004_user-workbench-preference.sql`。

- [ ] **Step 4: 新增表定义**

在 `packages/core/system-api/src/db/schema/tables.ts` 的 `sysRoleWorkbenchMenu` 定义结束（`)` 之后）插入：

```ts
/** 用户固定到首页的工作台入口；整体覆盖写，不做软删除 */
export const sysUserWorkbenchPin = mysqlTable(
  'sys_user_workbench_pin',
  {
  id: int('id').primaryKey().autoincrement().notNull(),
  userId: int('user_id').notNull(),
  workbenchMenuId: int('workbench_menu_id').notNull(),
  sortOrder: int('sort_order').notNull().default(0),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  },
  (t) => ({
    uniqUserWorkbenchPin: uniqueIndex('uniq_user_workbench_pin').on(t.userId, t.workbenchMenuId),
  })
)

/** 用户打开工作台入口的计数，用于首页推荐 */
export const sysUserWorkbenchUsage = mysqlTable(
  'sys_user_workbench_usage',
  {
  id: int('id').primaryKey().autoincrement().notNull(),
  userId: int('user_id').notNull(),
  workbenchMenuId: int('workbench_menu_id').notNull(),
  openCount: int('open_count').notNull().default(0),
  lastOpenedAt: datetime('last_opened_at', { mode: 'date' }).notNull(),
  createdAt: datetime('created_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  updatedAt: datetime('updated_at', { mode: 'date' }).notNull().default(sql`CURRENT_TIMESTAMP(0)`),
  },
  (t) => ({
    uniqUserWorkbenchUsage: uniqueIndex('uniq_user_workbench_usage').on(t.userId, t.workbenchMenuId),
  })
)
```

（`mysqlTable`、`int`、`datetime`、`uniqueIndex`、`sql` 已在该文件顶部导入；`src/db/schema/index.ts` 以 `export * from './tables'` 自动导出。）

- [ ] **Step 5: 新增迁移 SQL**

Create `packages/core/system-api/drizzle/0004_user-workbench-preference.sql`（LF 换行）：

```sql
CREATE TABLE `sys_user_workbench_pin` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`workbench_menu_id` int NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	CONSTRAINT `sys_user_workbench_pin_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_user_workbench_pin` UNIQUE(`user_id`,`workbench_menu_id`)
);
--> statement-breakpoint
CREATE TABLE `sys_user_workbench_usage` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`workbench_menu_id` int NOT NULL,
	`open_count` int NOT NULL DEFAULT 0,
	`last_opened_at` datetime NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
	CONSTRAINT `sys_user_workbench_usage_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_user_workbench_usage` UNIQUE(`user_id`,`workbench_menu_id`)
);
```

- [ ] **Step 6: 登记 journal**

在 `packages/core/system-api/drizzle/meta/_journal.json` 的 `entries` 数组末尾（`0003_workbench-menu` 条目之后）追加：

```json
    {
      "idx": 4,
      "version": "5",
      "when": 1792540800000,
      "tag": "0004_user-workbench-preference",
      "breakpoints": true
    }
```

不要修改 `_published-hashes.json`（新迁移尚未发布）。

- [ ] **Step 7: 写 repository**

Create `packages/core/system-api/src/core/repositories/app-home.repository.ts`:

```ts
/**
 * 首页常用应用数据访问：用户固定的入口与使用计数
 */

import { asc, eq, sql } from "drizzle-orm";
import { drizzleDb, type AppQueryDb } from "@/db";
import { sysUserWorkbenchPin, sysUserWorkbenchUsage } from "@/db/schema";
import { dateUtils } from "../../utils/date.js";

export interface WorkbenchUsageRow {
  workbenchMenuId: number;
  openCount: number;
  lastOpenedAt: Date;
}

export class AppHomeRepository {
  /** 用户固定的入口 id，按用户排序 */
  static async listPinnedIds(userId: number, db: AppQueryDb = drizzleDb): Promise<number[]> {
    const rows = await db
      .select({ id: sysUserWorkbenchPin.workbenchMenuId })
      .from(sysUserWorkbenchPin)
      .where(eq(sysUserWorkbenchPin.userId, userId))
      .orderBy(asc(sysUserWorkbenchPin.sortOrder), asc(sysUserWorkbenchPin.id));
    return rows.map((row) => row.id);
  }

  /** 整体覆盖：数组下标即 sort_order。调用方负责放进事务 */
  static async replacePins(userId: number, menuIds: readonly number[], db: AppQueryDb = drizzleDb): Promise<void> {
    await db.delete(sysUserWorkbenchPin).where(eq(sysUserWorkbenchPin.userId, userId));
    if (menuIds.length === 0) return;
    const now = dateUtils.now();
    await db.insert(sysUserWorkbenchPin).values(
      menuIds.map((workbenchMenuId, sortOrder) => ({ userId, workbenchMenuId, sortOrder, createdAt: now, updatedAt: now })),
    );
  }

  static async listUsage(userId: number, db: AppQueryDb = drizzleDb): Promise<WorkbenchUsageRow[]> {
    return db
      .select({
        workbenchMenuId: sysUserWorkbenchUsage.workbenchMenuId,
        openCount: sysUserWorkbenchUsage.openCount,
        lastOpenedAt: sysUserWorkbenchUsage.lastOpenedAt,
      })
      .from(sysUserWorkbenchUsage)
      .where(eq(sysUserWorkbenchUsage.userId, userId));
  }

  static async incrementUsage(userId: number, menuId: number, db: AppQueryDb = drizzleDb): Promise<void> {
    const now = dateUtils.now();
    await db
      .insert(sysUserWorkbenchUsage)
      .values({ userId, workbenchMenuId: menuId, openCount: 1, lastOpenedAt: now, createdAt: now, updatedAt: now })
      .onDuplicateKeyUpdate({
        set: { openCount: sql`${sysUserWorkbenchUsage.openCount} + 1`, lastOpenedAt: now, updatedAt: now },
      });
  }
}
```

- [ ] **Step 8: 写服务**

Create `packages/core/system-api/src/core/services/app-home.service.ts`:

```ts
/**
 * 首页常用应用：用户固定的入口在前，其余已授权入口按使用习惯排序。
 * 只返回入口 id；是否有对应的移动端页面由 App 端 registry 判断并截断。
 */

import { dbManager } from "@/db";
import { AppHomeRepository, type WorkbenchUsageRow } from "../repositories/app-home.repository.js";
import type { AppMenuNode } from "../schemas/app-menu.js";
import { AppMenuService, type AppMenuModuleScope } from "./app-menu.service.js";

export const MAX_HOME_PINS = 8;
const HALF_LIFE_DAYS = 14;
const WINDOW_DAYS = 90;
const DAY_MS = 86_400_000;

export interface HomeApps {
  pinned: number[];
  ranked: number[];
}

/** 次数按 14 天半衰期衰减；90 天前最后一次打开的不再参与推荐 */
export function usageScore(row: WorkbenchUsageRow, now: Date): number {
  const ageDays = Math.max(0, (now.getTime() - row.lastOpenedAt.getTime()) / DAY_MS);
  if (ageDays > WINDOW_DAYS) return 0;
  return row.openCount * 0.5 ** (ageDays / HALF_LIFE_DAYS);
}

/** 授权树中的应用入口 id，保持树的先序（即工作台显示顺序） */
export function authorizedEntryIds(tree: readonly AppMenuNode[]): number[] {
  return tree.flatMap((node) =>
    node.type === 1 ? [node.id] : (node.children ?? []).filter((entry) => entry.type === 1).map((entry) => entry.id),
  );
}

export function rankHomeApps(
  entryIds: readonly number[],
  pinnedIds: readonly number[],
  usage: readonly WorkbenchUsageRow[],
  now: Date,
): HomeApps {
  const available = new Set(entryIds);
  const pinned = [...new Set(pinnedIds)].filter((id) => available.has(id));
  const pinnedSet = new Set(pinned);
  const scores = new Map(usage.map((row) => [row.workbenchMenuId, usageScore(row, now)]));
  const order = new Map(entryIds.map((id, index) => [id, index]));
  const ranked = entryIds
    .filter((id) => !pinnedSet.has(id))
    .sort((a, b) => (scores.get(b) ?? 0) - (scores.get(a) ?? 0) || order.get(a)! - order.get(b)!);
  return { pinned, ranked };
}

async function availableEntryIds(roleIds: number[], scope?: AppMenuModuleScope): Promise<number[]> {
  return authorizedEntryIds(await AppMenuService.getAuthorizedTree(roleIds, scope));
}

export class AppHomeService {
  static async getHome(
    userId: number,
    roleIds: number[],
    scope?: AppMenuModuleScope,
    now: Date = new Date(),
  ): Promise<HomeApps> {
    const [entryIds, pinned, usage] = await Promise.all([
      availableEntryIds(roleIds, scope),
      AppHomeRepository.listPinnedIds(userId),
      AppHomeRepository.listUsage(userId),
    ]);
    return rankHomeApps(entryIds, pinned, usage, now);
  }

  /** 去重保序，丢弃越权 / 分组 / 已删除的 id；schema 已限制最多 8 个，这里再兜底截断 */
  static async savePins(
    userId: number,
    roleIds: number[],
    menuIds: readonly number[],
    scope?: AppMenuModuleScope,
  ): Promise<HomeApps> {
    const available = new Set(await availableEntryIds(roleIds, scope));
    const next = [...new Set(menuIds)].filter((id) => available.has(id)).slice(0, MAX_HOME_PINS);
    await dbManager.transaction((tx) => AppHomeRepository.replacePins(userId, next, tx));
    return this.getHome(userId, roleIds, scope);
  }

  static async recordUsage(
    userId: number,
    roleIds: number[],
    menuId: number,
    scope?: AppMenuModuleScope,
  ): Promise<{ recorded: boolean }> {
    const available = await availableEntryIds(roleIds, scope);
    if (!available.includes(menuId)) return { recorded: false };
    await AppHomeRepository.incrementUsage(userId, menuId);
    return { recorded: true };
  }
}
```

- [ ] **Step 9: 运行，确认通过**

Run: `pnpm --filter @yishan/core-system-api exec vitest run test/app-home.service.test.ts test/migrations.user-workbench.test.ts`
Expected: PASS（全部用例）。

若 `savePins` 用例里 `getHome` 因 `listPinnedIds` 被 mock 为固定值而返回旧 pins，这是预期的 —— 该用例只断言 `replacePins` 参数。

- [ ] **Step 10: 类型检查**

Run: `pnpm --filter @yishan/core-system-api exec tsc --noEmit -p tsconfig.json`
Expected: 无错误。

- [ ] **Step 11: Commit**

```bash
git add packages/core/system-api/src/db/schema/tables.ts packages/core/system-api/drizzle/0004_user-workbench-preference.sql packages/core/system-api/drizzle/meta/_journal.json packages/core/system-api/src/core/repositories/app-home.repository.ts packages/core/system-api/src/core/services/app-home.service.ts packages/core/system-api/test/app-home.service.test.ts packages/core/system-api/test/migrations.user-workbench.test.ts
git commit -m "feat(system-api): store per-user workbench pins and usage for home apps"
```

---

### Task 2: 后端路由、schema、种子与 OpenAPI

**Files:**
- Create: `packages/core/system-api/src/core/schemas/app-home.ts`
- Modify: `packages/core/system-api/src/core/schemas/index.ts`
- Modify: `packages/core/system-api/src/core/routes/api/v1/app/menus/index.ts`
- Modify: `packages/core/system-api/src/scripts/seed/config/app-menus.json`
- Test: `packages/core/system-api/test/app.menus.home.routes.test.ts`
- Regenerate: `apps/demo/api/openapi.json`、`packages/core/system-admin/src/services/generated/*`

**Interfaces:**
- Consumes: Task 1 的 `AppHomeService.getHome / savePins / recordUsage`
- Produces（HTTP，均需登录，权限 `app:menu:authorized-tree`）:
  - `GET /api/v1/app/menus/home` → `data: { pinned: number[]; ranked: number[] }`
  - `PUT /api/v1/app/menus/pins` body `{ menuIds: number[] }`（`maxItems: 8`，元素为正整数）→ 同上
  - `POST /api/v1/app/menus/usage` body `{ menuId: number }` → `data: { recorded: boolean }`

- [ ] **Step 1: 写路由失败测试**

Create `packages/core/system-api/test/app.menus.home.routes.test.ts`:

```ts
import Fastify from 'fastify'
import appMenusPlugin from '../src/core/routes/api/v1/app/menus/index.ts'
import registerAppMenuSchemas from '../src/core/schemas/app-menu.ts'
import registerAppHomeSchemas from '../src/core/schemas/app-home.ts'
import registerCommonSchemas from '../src/core/schemas/common.ts'
import { errorHandlerPlugin } from '@yishan/core-api/plugins'
import { AppHomeService } from '../src/core/services/app-home.service.ts'
import { describe, it, expect, vi, beforeEach } from './runtime-fixture'

async function buildApp() {
  const app = Fastify({ logger: false })
  app.decorate('requirePermission', () => async () => undefined)
  app.decorate('requireRole', () => async () => undefined)
  app.decorate('authenticate', async (request: any) => {
    request.currentUser = { id: 7, roleIds: [2] }
  })
  await app.register(errorHandlerPlugin)
  registerCommonSchemas(app)
  registerAppMenuSchemas(app)
  registerAppHomeSchemas(app)
  await app.register(appMenusPlugin)
  await app.ready()
  return app
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('App menus home routes', () => {
  it('GET /home returns pinned and ranked ids for the current user', async () => {
    const app = await buildApp()
    const getHome = vi.spyOn(AppHomeService, 'getHome').mockResolvedValue({ pinned: [3], ranked: [4, 5] })
    const res = await app.inject({ method: 'GET', url: '/home' })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ pinned: [3], ranked: [4, 5] })
    expect(getHome).toHaveBeenCalledWith(7, [2], undefined)
    await app.close()
  })

  it('PUT /pins validates the body and passes ids through', async () => {
    const app = await buildApp()
    const savePins = vi.spyOn(AppHomeService, 'savePins').mockResolvedValue({ pinned: [4, 3], ranked: [] })
    const tooMany = await app.inject({ method: 'PUT', url: '/pins', payload: { menuIds: [1, 2, 3, 4, 5, 6, 7, 8, 9] } })
    expect(tooMany.statusCode).toBe(400)
    const bad = await app.inject({ method: 'PUT', url: '/pins', payload: { menuIds: ['x'] } })
    expect(bad.statusCode).toBe(400)
    const ok = await app.inject({ method: 'PUT', url: '/pins', payload: { menuIds: [4, 3] } })
    expect(ok.statusCode).toBe(200)
    expect(ok.json().data.pinned).toEqual([4, 3])
    expect(savePins).toHaveBeenCalledWith(7, [2], [4, 3], undefined)
    await app.close()
  })

  it('PUT /pins accepts an empty list to clear all pins', async () => {
    const app = await buildApp()
    vi.spyOn(AppHomeService, 'savePins').mockResolvedValue({ pinned: [], ranked: [3] })
    const res = await app.inject({ method: 'PUT', url: '/pins', payload: { menuIds: [] } })
    expect(res.statusCode).toBe(200)
    await app.close()
  })

  it('POST /usage records the open and reports whether it was written', async () => {
    const app = await buildApp()
    const record = vi.spyOn(AppHomeService, 'recordUsage').mockResolvedValue({ recorded: false })
    const res = await app.inject({ method: 'POST', url: '/usage', payload: { menuId: 12 } })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ recorded: false })
    expect(record).toHaveBeenCalledWith(7, [2], 12, undefined)
    const bad = await app.inject({ method: 'POST', url: '/usage', payload: {} })
    expect(bad.statusCode).toBe(400)
    await app.close()
  })
})
```

- [ ] **Step 2: 运行，确认失败**

Run: `pnpm --filter @yishan/core-system-api exec vitest run test/app.menus.home.routes.test.ts`
Expected: FAIL —— 找不到 `schemas/app-home.ts`。

- [ ] **Step 3: 写 schema**

Create `packages/core/system-api/src/core/schemas/app-home.ts`:

```ts
/**
 * 首页常用应用的 TypeBox Schema。只携带工作台入口 ID，名称图标仍以授权菜单树为准。
 */

import { Type } from "@sinclair/typebox";
import { FastifyInstance } from "fastify";
import { successResponse } from "./common.js";

const MenuIdSchema = Type.Integer({ minimum: 1, description: "工作台入口ID" });

const AppHomeAppsSchema = Type.Object(
  {
    pinned: Type.Array(MenuIdSchema, { description: "用户固定的入口，按用户排序" }),
    ranked: Type.Array(MenuIdSchema, { description: "其余已授权入口，按使用习惯排序；无记录时按工作台顺序" }),
  },
  { $id: "appHomeApps" }
);

const AppHomeAppsRespSchema = successResponse({
  data: Type.Ref("appHomeApps"),
  $id: "appHomeAppsResp",
  message: "获取常用应用成功",
});

const SaveAppHomePinsReqSchema = Type.Object(
  {
    menuIds: Type.Array(MenuIdSchema, { maxItems: 8, description: "固定的入口，按显示顺序；空数组表示全部取消" }),
  },
  { $id: "saveAppHomePinsReq" }
);

const ReportAppUsageReqSchema = Type.Object({ menuId: MenuIdSchema }, { $id: "reportAppUsageReq" });

const ReportAppUsageRespSchema = successResponse({
  data: Type.Object({ recorded: Type.Boolean({ description: "是否计入（入口不可用时为 false）" }) }),
  $id: "reportAppUsageResp",
  message: "已记录",
});

const registerAppHome = (fastify: FastifyInstance) => {
  fastify.addSchema(AppHomeAppsSchema);
  fastify.addSchema(AppHomeAppsRespSchema);
  fastify.addSchema(SaveAppHomePinsReqSchema);
  fastify.addSchema(ReportAppUsageReqSchema);
  fastify.addSchema(ReportAppUsageRespSchema);
};

export default registerAppHome;
```

在 `packages/core/system-api/src/core/schemas/index.ts`：在 `import registerAppMenu from "./app-menu.js";` 下一行加 `import registerAppHome from "./app-home.js";`，在 `registerAppMenu(fastify);` 下一行加 `registerAppHome(fastify);`。

- [ ] **Step 4: 写路由**

在 `packages/core/system-api/src/core/routes/api/v1/app/menus/index.ts` 顶部导入区加：

```ts
import { AppHomeService } from "../../../../../services/app-home.service.js";
```

在插件函数体内、`/flatten` 路由之后（插件 `};` 结束之前）追加：

```ts
  // 首页常用应用：只作用于当前用户；与工作台树同一权限，能看到工作台即可管理自己的常用应用
  const currentUser = (request: FastifyRequest) => ({
    userId: request.currentUser!.id,
    roleIds: request.currentUser?.roleIds ?? [],
  });

  // GET /api/v1/app/menus/home - 首页常用应用排序
  route.get(
    "/home",
    {
      access: { permission: PERMS.TREE_AUTHORIZED },
      schema: {
        summary: "获取首页常用应用",
        description: "pinned 为用户固定的入口（用户顺序），ranked 为其余已授权入口按使用习惯排序；均为工作台入口 ID",
        operationId: "appGetHomeApps",
        tags: ["app-menus"],
        security: [{ bearerAuth: [] }],
        response: { 200: { $ref: "appHomeAppsResp#" } },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId, roleIds } = currentUser(request);
      const home = await AppHomeService.getHome(userId, roleIds, fastify.moduleLoader);
      return ResponseUtil.success(reply, home, "获取常用应用成功");
    }
  );

  // PUT /api/v1/app/menus/pins - 保存固定的常用应用（整体覆盖）
  route.put(
    "/pins",
    {
      access: { permission: PERMS.TREE_AUTHORIZED },
      schema: {
        summary: "保存首页固定应用",
        description: "按数组顺序整体覆盖当前用户固定的入口；不可用的入口被丢弃，最多 8 个",
        operationId: "appSaveHomePins",
        tags: ["app-menus"],
        security: [{ bearerAuth: [] }],
        body: { $ref: "saveAppHomePinsReq#" },
        response: { 200: { $ref: "appHomeAppsResp#" } },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId, roleIds } = currentUser(request);
      const { menuIds } = request.body as { menuIds: number[] };
      const home = await AppHomeService.savePins(userId, roleIds, menuIds, fastify.moduleLoader);
      return ResponseUtil.success(reply, home, "保存成功");
    }
  );

  // POST /api/v1/app/menus/usage - 记录一次打开，用于首页推荐
  route.post(
    "/usage",
    {
      access: { permission: PERMS.TREE_AUTHORIZED },
      schema: {
        summary: "记录应用打开",
        description: "累加当前用户对某个工作台入口的打开次数；入口不可用时不记录",
        operationId: "appReportAppUsage",
        tags: ["app-menus"],
        security: [{ bearerAuth: [] }],
        body: { $ref: "reportAppUsageReq#" },
        response: { 200: { $ref: "reportAppUsageResp#" } },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId, roleIds } = currentUser(request);
      const { menuId } = request.body as { menuId: number };
      const result = await AppHomeService.recordUsage(userId, roleIds, menuId, fastify.moduleLoader);
      return ResponseUtil.success(reply, result, "已记录");
    }
  );
```

若 `route.put` / `route.post` 在 `createRouteRegistrar` 中不存在，打开 `packages/core/api/src/routes/route-registrar.ts` 确认方法名并照其用法（`admin/app-menus/index.ts` 已用到 post/put，可参照）。

- [ ] **Step 5: 运行，确认通过**

Run: `pnpm --filter @yishan/core-system-api exec vitest run test/app.menus.home.routes.test.ts test/admin.app-menus.routes.test.ts`
Expected: PASS。

- [ ] **Step 6: 种子改名**

在 `packages/core/system-api/src/scripts/seed/config/app-menus.json` 把第一个分组的 `"name": "常用"` 改为 `"name": "协同办公"`，其余不动。

然后检查是否有测试依赖种子里的「常用」名：

Run: `grep -rn "常用" packages/core/system-api/test packages/core/system-api/tests apps/demo/api/src apps/demo/api/test 2>/dev/null`
Expected: 只剩 `admin.app-menus.routes.test.ts` 中的自造 fixture（与种子无关，不改）。若有读取 `app-menus.json` 并断言分组名的测试，把断言里的「常用」改为「协同办公」。

- [ ] **Step 7: 全量后端测试与边界检查**

Run: `pnpm --filter @yishan/core-system-api test && pnpm --filter @yishan/demo-api test && pnpm check:boundaries`
Expected: 全部 PASS。

- [ ] **Step 8: 更新 OpenAPI 与生成客户端**

```bash
pnpm build:api
pnpm --filter @yishan/demo-api openapi:dump
node -e "const fs=require('fs');const p='apps/demo/api/openapi.json';fs.writeFileSync(p,JSON.stringify(JSON.parse(fs.readFileSync(p,'utf8')),null,2)+'\n')"
git diff --stat -- apps/demo/api/openapi.json
pnpm --filter @yishan/demo-admin openapi
git status --short packages/core/system-admin/src/services/generated apps/demo/admin/src/services/generated
pnpm --filter @yishan/demo-admin lint
```

Expected: `openapi.json` 的 diff 只有新增的三个 path 与五个 schema（几百行以内，**不应**出现整文件重写）；system-admin 生成目录出现 `appGetHomeApps` / `appSaveHomePins` / `appReportAppUsage` 相关改动；Admin lint 退出码 0。

- [ ] **Step 9: Commit**

```bash
git add packages/core/system-api/src/core/schemas/app-home.ts packages/core/system-api/src/core/schemas/index.ts packages/core/system-api/src/core/routes/api/v1/app/menus/index.ts packages/core/system-api/src/scripts/seed/config/app-menus.json packages/core/system-api/test/app.menus.home.routes.test.ts apps/demo/api/openapi.json packages/core/system-admin/src/services/generated apps/demo/admin/src/services/generated
git commit -m "feat(system-api): add home apps, pins and usage endpoints for the mobile workbench"
```

---

### Task 3: App API 客户端与 `getHomeApps`

**Files:**
- Modify: `apps/demo/app/src/api/types.ts`（`WorkbenchMenuNode` 定义之后）
- Modify: `apps/demo/app/src/api/menu.ts`
- Modify: `apps/demo/app/src/modules/registry.ts`（`getWorkbenchGroups` 之后）
- Test: `apps/demo/app/tests/home-apps.test.cjs`（新建）

**Interfaces:**
- Consumes: Task 2 的 HTTP 接口；已有 `getWorkbenchGroups(...)` 返回 `WorkbenchAppGroup[]`，`WorkbenchApp = { id: string; name: string; icon: string; menuId: number; entry: string }`
- Produces:
  - `interface HomeAppIds { pinned: number[]; ranked: number[] }`（`@/api/types`）
  - `menuApi.getHomeApps(): Promise<HomeAppIds>`
  - `menuApi.saveHomePins(menuIds: readonly number[]): Promise<HomeAppIds>`
  - `menuApi.reportAppUsage(menuId: number): Promise<{ recorded: boolean }>`
  - `MAX_HOME_APPS = 8`、`getHomeApps(groups: readonly WorkbenchAppGroup[], home: HomeAppIds | null, max?: number): WorkbenchApp[]`（`@/modules/registry`）

- [ ] **Step 1: 写失败测试**

Create `apps/demo/app/tests/home-apps.test.cjs`:

```js
const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')

const registry = loadTs('src/modules/registry.ts')

const app = (menuId, id = `app-${menuId}`) => ({ id, name: id, icon: 'X', menuId, entry: `pages/${id}/index` })
const groups = [
  { id: 'group-1', name: 'A', apps: [app(11), app(12), app(13)] },
  { id: 'group-2', name: 'B', apps: [app(21), app(22)] },
]

test('getHomeApps puts pinned first, fills with ranked and skips ids without a usable page', () => {
  const result = registry.getHomeApps(groups, { pinned: [22, 404], ranked: [13, 11, 405, 12, 21] })
  assert.deepEqual(result.map((a) => a.menuId), [22, 13, 11, 12, 21])
})

test('getHomeApps truncates to the limit and never repeats an app', () => {
  const result = registry.getHomeApps(groups, { pinned: [11, 11], ranked: [11, 12, 13] }, 2)
  assert.deepEqual(result.map((a) => a.menuId), [11, 12])
  assert.equal(registry.MAX_HOME_APPS, 8)
})

test('getHomeApps falls back to workbench order when the home list is unavailable', () => {
  assert.deepEqual(registry.getHomeApps(groups, null, 3).map((a) => a.menuId), [11, 12, 13])
})
```

- [ ] **Step 2: 运行，确认失败**

Run: `cd apps/demo/app && node --test tests/home-apps.test.cjs`
Expected: FAIL —— `registry.getHomeApps is not a function`。

- [ ] **Step 3: 类型与 API**

在 `apps/demo/app/src/api/types.ts` 的 `WorkbenchMenuNode` 接口之后加：

```ts
/** 首页常用应用：均为工作台入口 ID。pinned 为用户固定顺序，ranked 为其余已授权入口按使用习惯排序 */
export interface HomeAppIds {
  pinned: number[]
  ranked: number[]
}
```

在 `apps/demo/app/src/api/menu.ts` 改 import 为 `import type { HomeAppIds, WorkbenchMenuNode } from './types'`，并在文件末尾追加：

```ts
/** 首页常用应用的排序（只含 ID，名称图标以授权菜单树为准） */
export function getHomeApps() {
  return request<HomeAppIds>({ method: 'GET', path: '/api/v1/app/menus/home' })
}

/** 整体覆盖当前用户固定的常用应用 */
export function saveHomePins(menuIds: readonly number[]) {
  return request<HomeAppIds>({
    method: 'PUT',
    path: '/api/v1/app/menus/pins',
    data: { menuIds: [...menuIds] },
  })
}

/** 记录一次打开，供首页推荐使用 */
export function reportAppUsage(menuId: number) {
  return request<{ recorded: boolean }>({
    method: 'POST',
    path: '/api/v1/app/menus/usage',
    data: { menuId },
  })
}
```

- [ ] **Step 4: registry**

在 `apps/demo/app/src/modules/registry.ts` 顶部类型导入中加入 `HomeAppIds`（与已有的 `WorkbenchMenuNode` 同一条 `import type ... from '@/api/types'`），并在 `getWorkbenchGroups` 函数之后加：

```ts
export const MAX_HOME_APPS = 8

/**
 * 首页常用应用：先取用户固定的，再按推荐顺序补位。
 * 以工作台目录为准——没有已注册页面或无权限的入口不会出现；首页列表不可用时按工作台顺序。
 */
export function getHomeApps(
  groups: readonly WorkbenchAppGroup[],
  home: HomeAppIds | null,
  max = MAX_HOME_APPS,
): WorkbenchApp[] {
  const apps = groups.flatMap((group) => group.apps)
  if (!home) return apps.slice(0, max)
  const byMenuId = new Map(apps.map((app) => [app.menuId, app]))
  const result: WorkbenchApp[] = []
  const seen = new Set<number>()
  for (const id of [...home.pinned, ...home.ranked]) {
    const app = byMenuId.get(id)
    if (!app || seen.has(id)) continue
    seen.add(id)
    result.push(app)
    if (result.length >= max) break
  }
  return result
}
```

- [ ] **Step 5: 运行，确认通过**

Run: `cd apps/demo/app && node --test tests/home-apps.test.cjs && pnpm --filter @yishan/demo-app exec tsc --noEmit`
Expected: PASS，tsc 无错误。

- [ ] **Step 6: Commit**

```bash
git add apps/demo/app/src/api/types.ts apps/demo/app/src/api/menu.ts apps/demo/app/src/modules/registry.ts apps/demo/app/tests/home-apps.test.cjs
git commit -m "feat(app): add home apps API client and pinned-then-ranked selection"
```

---

### Task 4: store 改为后端常用应用

**Files:**
- Modify: `apps/demo/app/src/stores/modules.ts`
- Modify: `apps/demo/app/tests/workbench.test.cjs`
- Modify: `apps/demo/app/tests/modules.test.cjs`

**Interfaces:**
- Consumes: Task 3 的 `menuApi.getHomeApps / saveHomePins`、`HomeAppIds`
- Produces（`useModuleStore`）:
  - 状态 `home: HomeAppIds | null`（替代 `commonModuleIds` / `commonConfigured`）
  - `savePins(menuIds: readonly number[]): Promise<void>`（替代 `setCommonModules`；失败抛带中文信息的 Error）
  - 删除导出 `MAX_COMMON_APPS`

- [ ] **Step 1: 改写 workbench.test.cjs 中依赖本地常用存储的用例（先写失败测试）**

在 `apps/demo/app/tests/workbench.test.cjs` 的 `harness()` 中：
- `api` 改为：

```js
  const api = {
    getAuthorizedMenuTree: async () => [directory({ children: [menu(), contacts()] })],
    getHomeApps: async () => ({ pinned: [], ranked: [1, 2] }),
    saveHomePins: async (menuIds) => ({ pinned: [...menuIds], ranked: [] }),
    reportAppUsage: async () => ({ recorded: true }),
  }
```

- 删除 `loadTs('src/stores/modules.ts', {...})` mock 中的 `'@/config'` 与 `'@/utils/storage'` 两项，删除 `const saved = new Map()` 及返回值中的 `saved`。

用下面两个用例**替换** `favorites default to accessible apps, ...` 与 `account switches restore only that account preferences ...`：

```js
test('load fetches menus and home apps together; a failing home list keeps menus usable', async () => {
  const h = harness()
  await h.store.getState().load()
  assert.deepEqual(h.store.getState().home, { pinned: [], ranked: [1, 2] })
  assert.equal(h.store.getState().menus[0].children.length, 2)
  h.api.getHomeApps = async () => {
    throw new Error('404')
  }
  await h.store.getState().load({ force: true })
  assert.equal(h.store.getState().error, null)
  assert.deepEqual(h.store.getState().home, { pinned: [], ranked: [1, 2] }, 'keeps the last good home list')
  h.store.getState().reset()
  await h.store.getState().load()
  assert.equal(h.store.getState().home, null)
  assert.equal(h.store.getState().loaded, true)
})

test('savePins stores the server answer and refuses results that land after an account switch', async () => {
  const h = harness()
  await h.store.getState().load()
  await h.store.getState().savePins([2, 1])
  assert.deepEqual(h.store.getState().home, { pinned: [2, 1], ranked: [] })
  const pending = deferred()
  h.api.saveHomePins = () => pending.promise
  const saving = h.store.getState().savePins([1])
  const first = h.auth.getState().user
  h.auth.setState({ token: 'two', user: { ...first, id: 2 } })
  pending.resolve({ pinned: [1], ranked: [] })
  await assert.rejects(saving, /登录状态已变化/)
  assert.equal(h.store.getState().home, null)
})

test('savePins requires a loaded catalog for the current account', async () => {
  const h = harness()
  await assert.rejects(h.store.getState().savePins([1]), /请刷新应用列表后重试/)
})
```

在 `forced refresh updates permissions and menus together; failure keeps prior content` 中删除两行 `assert.deepEqual(h.store.getState().commonModuleIds, ...)`。

在 `workbench and profile refresh share identity requests ...` 末尾，把 `assert.deepEqual(modules.getState().commonModuleIds, [])` 删除（该用例的 api 没有 `getHomeApps`，store 必须容忍）。

在 `entries without a registered mobile page never become favorites or navigate` 中，把 `assert.deepEqual(h.store.getState().commonModuleIds, [])` 替换为：

```js
  const groups = registry.getWorkbenchGroups(h.store.getState().menus, ALL_PERMISSIONS, [])
  assert.deepEqual(registry.getHomeApps(groups, { pinned: [8], ranked: [] }), [])
```

- [ ] **Step 2: 改写 modules.test.cjs 的本地常用用例**

在 `apps/demo/app/tests/modules.test.cjs` 中，用下面的用例**替换** `common entries persist per user and never bleed into another account`：

```js
test('home apps are dropped when the account changes', async () => {
  const auth = authStore({
    bootstrapped: true,
    token: 'one',
    user: { id: 1, permissions: ['system:user:list'] },
  })
  const modules = loadTs('src/stores/modules.ts', {
    '@/api': {
      menuApi: {
        getAuthorizedMenuTree: async () => [group()],
        getHomeApps: async () => ({ pinned: [1], ranked: [] }),
      },
    },
    './auth': { useAuthStore: auth },
  }).useModuleStore
  await modules.getState().load()
  assert.deepEqual(modules.getState().home, { pinned: [1], ranked: [] })
  auth.setState({ token: 'two', user: { id: 2, permissions: [] } })
  assert.equal(modules.getState().home, null)
})
```

- [ ] **Step 3: 运行，确认失败**

Run: `cd apps/demo/app && node --test tests/workbench.test.cjs tests/modules.test.cjs`
Expected: FAIL —— `home` 为 undefined / `savePins is not a function`。

- [ ] **Step 4: 改写 store**

`apps/demo/app/src/stores/modules.ts`：

1. 导入改为：

```ts
import { create } from 'zustand'
import { menuApi } from '@/api'
import type { HomeAppIds, WorkbenchMenuNode } from '@/api/types'
import { loadIdentity, useAuthStore } from './auth'
```

（删除 `API_BASE_URL`、`getWorkbenchGroups`、`storage` 的导入；如 `getWorkbenchGroups` 仍被文件其他处使用则保留。）

2. `ModuleState` 改为：

```ts
interface ModuleState {
  menus: WorkbenchMenuNode[]
  /** 首页常用应用排序；接口不可用时为 null，首页退化为工作台顺序 */
  home: HomeAppIds | null
  loading: boolean
  error: string | null
  loaded: boolean
  load: (options?: { force?: boolean }) => Promise<void>
  savePins: (menuIds: readonly number[]) => Promise<void>
  reset: () => void
}
```

3. 删除 `MAX_COMMON_APPS`、`commonKey`、`commonFor`。新增：

```ts
/** 首页排序失败不影响工作台；旧后端没有该接口时同样返回 null */
async function loadHome(): Promise<HomeAppIds | null> {
  try {
    return await menuApi.getHomeApps()
  } catch {
    return null
  }
}
```

4. 初始状态：把 `commonModuleIds: [], commonConfigured: false,` 替换为 `home: null,`。

5. `load()` 内 `if (ownerId !== userId) { ... }` 块改为：

```ts
    if (ownerId !== userId) {
      get().reset()
      ownerId = userId
    }
```

6. `Promise.all` 与成功分支改为：

```ts
        const [menus, home, identity] = await Promise.all([
          menuApi.getAuthorizedMenuTree(),
          loadHome(),
          options.force ? loadIdentity() : Promise.resolve(null),
        ])
        if (generation !== requestGeneration || useAuthStore.getState().user?.id !== userId) return
        if (identity) {
          if (identity.user.id !== userId) throw new Error('账号信息已变化，请重新登录')
          syncingIdentity = true
          try {
            useAuthStore.setState(identity)
          } finally {
            syncingIdentity = false
          }
        }
        loadedAt = Date.now()
        set({ menus, home: home ?? get().home, loaded: true, error: null })
```

（删除原来计算 `available` / `saved` / `commonModuleIds` 的几行。）

7. 用下面的实现**替换** `setCommonModules`：

```ts
  async savePins(menuIds) {
    const auth = useAuthStore.getState()
    if (!auth.token || !auth.user || ownerId !== auth.user.id || !get().loaded) {
      throw new Error('请刷新应用列表后重试')
    }
    const userId = auth.user.id
    const requestGeneration = generation
    const home = await menuApi.saveHomePins(menuIds)
    if (generation !== requestGeneration || useAuthStore.getState().user?.id !== userId) {
      throw new Error('登录状态已变化，请重新登录')
    }
    set({ home })
  },
```

8. `reset()` 的 `set({...})` 中把 `commonModuleIds: [], commonConfigured: false,` 替换为 `home: null,`。

9. `useAuthStore.subscribe` 回调中的 `if (state.user && state.token) { ... }` 块改为：

```ts
    if (state.user && state.token) ownerId = state.user.id
```

- [ ] **Step 5: 运行，确认通过**

Run: `cd apps/demo/app && node --test tests/workbench.test.cjs tests/modules.test.cjs tests/home-apps.test.cjs`
Expected: PASS。

- [ ] **Step 6: 类型检查（预期首页报错）**

Run: `pnpm --filter @yishan/demo-app exec tsc --noEmit`
Expected: 仅 `src/pages/index/index.tsx`（`commonModuleIds` / `commonConfigured`）与 `src/pages/apps/FavoritesEditor.tsx`（`setCommonModules` / `MAX_COMMON_APPS`）报错。这两个文件在 Task 5 / Task 7 处理；**本任务不提交**，与 Task 5 一并提交，保证每个提交都能通过类型检查。

---

### Task 5: 统一打开应用并上报使用；首页接入

**Files:**
- Modify: `apps/demo/app/src/pages/apps/navigation.ts`
- Modify: `apps/demo/app/src/pages/index/index.tsx`
- Delete: `apps/demo/app/src/pages/apps/FavoritesEditor.tsx`
- Modify: `apps/demo/app/tests/workbench.test.cjs`（navigation 用例）
- Modify: `apps/demo/app/tests/home.test.cjs`

**Interfaces:**
- Consumes: Task 3 `getHomeApps`、`menuApi.reportAppUsage`；Task 4 `useModuleStore.home`
- Produces: `openWorkbenchApp(id: string): Promise<void>` 行为不变，成功后额外上报；首页 `SECONDARY_PAGES.homeApps` 链接（常量在 Task 6 定义 —— 本任务先在 `src/constants/routes.ts` 的 `SECONDARY_PAGES` 中加 `homeApps: 'pages/apps/pinned/index',`，页面文件在 Task 6 创建，`page-config.ts` 也在 Task 6 登记）

- [ ] **Step 1: navigation 失败测试**

在 `apps/demo/app/tests/workbench.test.cjs` 中，`navigation refreshes authorization, ...` 和 `entries without a registered mobile page ...` 两个用例里的 `loadTs('src/pages/apps/navigation.ts', {...})` mock 都加上一项 `'@/api': { menuApi: h.api },`。然后追加：

```js
test('opening an app reports usage once after navigation; reporting failures are swallowed', async () => {
  const h = harness()
  const reported = []
  h.api.reportAppUsage = async (menuId) => {
    reported.push(menuId)
    throw new Error('offline')
  }
  const calls = []
  const navigation = loadTs('src/pages/apps/navigation.ts', {
    '@/api': { menuApi: h.api },
    '@/stores/auth': { useAuthStore: h.auth },
    '@/stores/modules': { useModuleStore: h.store },
    '@/utils/router': { navigateTo: async (url) => calls.push(url) },
  })
  await navigation.openWorkbenchApp('contacts')
  await new Promise((resolve) => setImmediate(resolve))
  assert.deepEqual(calls, ['/pages/contacts/index/index'])
  assert.deepEqual(reported, [2])
})

test('a refused app is never reported', async () => {
  const h = harness()
  const reported = []
  h.api.reportAppUsage = async (menuId) => reported.push(menuId)
  h.authApi.getCapabilities = async () => ({ permissions: [], enabledModuleIds: [] })
  const navigation = loadTs('src/pages/apps/navigation.ts', {
    '@/api': { menuApi: h.api },
    '@/stores/auth': { useAuthStore: h.auth },
    '@/stores/modules': { useModuleStore: h.store },
    '@/utils/router': { navigateTo: async () => undefined },
  })
  await assert.rejects(navigation.openWorkbenchApp('contacts'), /权限|不可用/)
  assert.deepEqual(reported, [])
})
```

- [ ] **Step 2: 首页结构失败测试**

在 `apps/demo/app/tests/home.test.cjs` 末尾追加（文件顶部若无 `fs` / `path` / `appRoot`，按 `workbench.test.cjs` 的方式引入：`const fs = require('node:fs')`、`const path = require('node:path')`、`const { appRoot } = require('./helpers/load-ts.cjs')`）：

```js
test('首页常用应用来自后端排序并统一走工作台打开', () => {
  const page = fs.readFileSync(path.join(appRoot, 'src/pages/index/index.tsx'), 'utf8')
  assert.match(page, /getHomeApps\(/)
  assert.match(page, /openWorkbenchApp\(/)
  assert.match(page, /SECONDARY_PAGES\.homeApps/)
  assert.match(page, /<SectionLink text="编辑"/)
  assert.doesNotMatch(page, /commonModuleIds|commonConfigured/)
})
```

- [ ] **Step 3: 运行，确认失败**

Run: `cd apps/demo/app && node --test tests/workbench.test.cjs tests/home.test.cjs`
Expected: FAIL —— 上报未发生；首页源码不匹配。

- [ ] **Step 4: navigation 上报**

`apps/demo/app/src/pages/apps/navigation.ts`：顶部加 `import { menuApi } from '@/api'`，把 `await navigateTo(\`/${app.entry}\`)` 改为：

```ts
    await navigateTo(`/${app.entry}`)
    // 使用记录只服务首页推荐：不等待、不提示，接口缺失或失败都不影响打开应用
    void Promise.resolve()
      .then(() => menuApi.reportAppUsage(app.menuId))
      .catch(() => undefined)
```

- [ ] **Step 5: 首页接入**

`apps/demo/app/src/pages/index/index.tsx`：

1. 导入调整：
   - `import { SECONDARY_PAGES } from '@/constants/routes'`（去掉 `TAB_PAGES`）
   - `import { getAuthorizedMobileModules, getHomeApps, getWorkbenchGroups } from '@/modules/registry'`
   - `import { navigateTo } from '@/utils/router'`（去掉 `switchTab`）
   - 新增 `import { openWorkbenchApp } from '../apps/navigation'`
2. 删除常量 `const MAX_APPS = 8`。
3. 把 `commonModuleIds` / `commonConfigured` 两个 selector 替换为：

```ts
  const home = useModuleStore((state) => state.home)
```

4. 把从 `const modules = getAuthorizedMobileModules(...)` 到 `openModule` 结束的整段替换为：

```ts
  const modules = getAuthorizedMobileModules(menus, user?.permissions, enabledModuleIds)
  // 用户固定的在前，其余按使用习惯补位；首页排序不可用时按工作台顺序
  const apps: FavoriteAppItem[] = getHomeApps(
    getWorkbenchGroups(menus, user?.permissions, enabledModuleIds),
    home,
  ).map((app) => ({ id: app.id, name: app.name, icon: app.icon }))

  const openModule = (id: string) => {
    void openWorkbenchApp(id).catch((failure: unknown) => {
      Taro.showToast({
        title: failure instanceof Error ? failure.message : '无法打开应用，请重试',
        icon: 'none',
      })
    })
  }
```

（`getMetricDetail` 保持不变，继续用 `modules`；指标跳转不计入使用。）

5. 常用应用区块的 `extra` 改为：

```tsx
        extra={
          <SectionLink text="编辑" onClick={() => navigateTo(`/${SECONDARY_PAGES.homeApps}`)} />
        }
```

6. 在 `apps/demo/app/src/constants/routes.ts` 的 `SECONDARY_PAGES` 中 `about` 之后加一行 `homeApps: 'pages/apps/pinned/index',`。

- [ ] **Step 6: 删除旧编辑器**

```bash
git rm apps/demo/app/src/pages/apps/FavoritesEditor.tsx
grep -rn "FavoritesEditor\|setCommonModules\|commonModuleIds\|MAX_COMMON_APPS" apps/demo/app/src apps/demo/app/tests
```

Expected: grep 无输出。

- [ ] **Step 7: 运行，确认通过**

Run: `cd apps/demo/app && node --test tests/workbench.test.cjs tests/home.test.cjs tests/modules.test.cjs tests/home-apps.test.cjs && pnpm --filter @yishan/demo-app exec tsc --noEmit`
Expected: PASS，tsc 无错误。

注意：`tests/workbench.test.cjs` 中的 `every registered main or subpackage page exists on disk` 只校验 `app.config` 中登记的页面；此时 `pages/apps/pinned/index` 尚未登记，不会失败。

- [ ] **Step 8: Commit（含 Task 4 的改动）**

```bash
git add apps/demo/app/src/stores/modules.ts apps/demo/app/src/pages/apps/navigation.ts apps/demo/app/src/pages/index/index.tsx apps/demo/app/src/constants/routes.ts apps/demo/app/tests/workbench.test.cjs apps/demo/app/tests/modules.test.cjs apps/demo/app/tests/home.test.cjs
git commit -m "feat(app): drive home common apps from server pins and usage ranking"
```

---

### Task 6: `ManagementCell` 扩展与编辑页

**Files:**
- Modify: `apps/demo/app/src/components/management/ManagementList.tsx`
- Modify: `apps/demo/app/src/components/management/ManagementList.module.scss`
- Create: `apps/demo/app/src/pages/apps/pinned/model.ts`
- Create: `apps/demo/app/src/pages/apps/pinned/index.config.ts`
- Create: `apps/demo/app/src/pages/apps/pinned/index.tsx`
- Modify: `apps/demo/app/src/constants/page-config.ts`
- Test: `apps/demo/app/tests/home-apps.test.cjs`

**Interfaces:**
- Consumes: Task 3 `getWorkbenchGroups`、`MAX_HOME_APPS`；Task 4 `useModuleStore.home / savePins / load`；Task 5 `SECONDARY_PAGES.homeApps`
- Produces:
  - `ManagementCellProps.leading?: ReactNode`、`ManagementCellProps.disabled?: boolean`
  - `togglePin(ids: readonly number[], id: number, max?: number): number[]`
  - `movePin(ids: readonly number[], index: number, delta: -1 | 1): number[]`

- [ ] **Step 1: 写失败测试**

在 `apps/demo/app/tests/home-apps.test.cjs` 末尾追加：

```js
const fs = require('node:fs')
const path = require('node:path')
const { appRoot } = require('./helpers/load-ts.cjs')

const model = loadTs('src/pages/apps/pinned/model.ts', {
  '@/modules/registry': { MAX_HOME_APPS: 8 },
})

test('togglePin adds at the end, removes in place and refuses past the limit', () => {
  assert.deepEqual(model.togglePin([1, 2], 3), [1, 2, 3])
  assert.deepEqual(model.togglePin([1, 2, 3], 2), [1, 3])
  assert.deepEqual(model.togglePin([1, 2], 3, 2), [1, 2])
  assert.deepEqual(model.togglePin([1, 2], 2, 2), [1], 'removing still works when full')
})

test('movePin swaps neighbours and ignores moves past either end', () => {
  assert.deepEqual(model.movePin([1, 2, 3], 1, -1), [2, 1, 3])
  assert.deepEqual(model.movePin([1, 2, 3], 1, 1), [1, 3, 2])
  assert.deepEqual(model.movePin([1, 2, 3], 0, -1), [1, 2, 3])
  assert.deepEqual(model.movePin([1, 2, 3], 2, 1), [1, 2, 3])
})

const scss = new Proxy({}, { get: (_, k) => (k === '__esModule' ? false : k) })
const flat = (v) => (!v || typeof v !== 'object' ? [] : Array.isArray(v) ? v.flatMap(flat) : [v, ...flat(v.props?.children)])

test('ManagementCell renders a leading node and a disabled row ignores taps', () => {
  const { ManagementCell } = loadTs('src/components/management/ManagementList.tsx', {
    react: { useState: (v) => [v, () => {}], useMemo: (fn) => fn() },
    '@tarojs/components': { View: 'View', Text: 'Text', Image: 'Image' },
    '@/components/atoms': { AppText: 'AppText', Avatar: 'Avatar' },
    '@/components/feedback': { StateView: 'StateView' },
    './LineIcon': { LineIcon: 'LineIcon' },
    './ManagementList.module.scss': scss,
  })
  const onClick = () => {}
  const enabled = ManagementCell({ title: '用户', leading: { type: 'AppIcon', props: {} }, onClick })
  assert.ok(flat(enabled).some((n) => n.type === 'AppIcon'))
  assert.equal(enabled.props.onClick, onClick)
  const disabled = ManagementCell({ title: '用户', disabled: true, onClick })
  assert.equal(disabled.props.onClick, undefined)
  assert.equal(disabled.props.hoverClass, undefined)
  assert.match(disabled.props.className, /rowDisabled/)
})

test('编辑页只用现成管理组件并完成路由登记', () => {
  const page = fs.readFileSync(path.join(appRoot, 'src/pages/apps/pinned/index.tsx'), 'utf8')
  for (const name of ['ManagementPageHeader', 'ManagementSearchBar', 'DetailSection', 'ManagementCell', 'Checkbox', 'ActionSheet', 'FormSubmitBar', 'ManagementStates']) {
    assert.match(page, new RegExp(`<${name}\\b`), name)
  }
  assert.doesNotMatch(page, /<Checkbox[^>]*onClick/, 'Checkbox 不拦截点击，由整行切换')
  assert.match(page, /export default withAccountScope\(/)
  const config = fs.readFileSync(path.join(appRoot, 'src/pages/apps/pinned/index.config.ts'), 'utf8')
  assert.match(config, /navigationStyle: 'custom'/)
  const pages = fs.readFileSync(path.join(appRoot, 'src/constants/page-config.ts'), 'utf8')
  assert.match(pages, /'pages\/apps\/pinned\/index'/)
})
```

- [ ] **Step 2: 运行，确认失败**

Run: `cd apps/demo/app && node --test tests/home-apps.test.cjs`
Expected: FAIL —— 找不到 `pages/apps/pinned/model.ts`。

- [ ] **Step 3: 扩展 ManagementCell**

`apps/demo/app/src/components/management/ManagementList.tsx`：

在 `ManagementCellProps` 中 `glyphColor?: string` 之后加：

```ts
  /** 行首自定义图形（如应用图标）；thumb / avatar / glyph 都未提供时使用 */
  leading?: ReactNode
  /** 不可操作：整行转为三级灰，不响应点击 */
  disabled?: boolean
```

函数参数解构中加入 `leading,` 与 `disabled = false,`。

把根节点改为：

```tsx
    <View
      className={cx(styles.row, bordered && styles.rowBordered, disabled && styles.rowDisabled)}
      onClick={disabled ? undefined : onClick}
      hoverClass={onClick && !disabled ? styles.rowHover : undefined}
      {...longPressProps}
    >
```

把行首图形分支的最后 `) : null}` 改为：

```tsx
      ) : leading ? (
        <View className={styles.row__leading}>{leading}</View>
      ) : null}
```

`apps/demo/app/src/components/management/ManagementList.module.scss` 在 `.rowHover { ... }` 之后加：

```scss
/* 整行置灰：标题与描述一起降到三级灰，行高不变 */
.rowDisabled .row__title,
.rowDisabled .row__description {
  color: var(--color-text-tertiary);
}

.row__leading {
  display: flex;
  flex-shrink: 0;
}

.rowDisabled .row__leading {
  opacity: 0.5;
}
```

- [ ] **Step 4: 写 model**

Create `apps/demo/app/src/pages/apps/pinned/model.ts`:

```ts
import { MAX_HOME_APPS } from '@/modules/registry'

/** 勾选追加到末尾、取消原位移除；已满时不再追加 */
export function togglePin(ids: readonly number[], id: number, max = MAX_HOME_APPS): number[] {
  if (ids.includes(id)) return ids.filter((current) => current !== id)
  return ids.length >= max ? [...ids] : [...ids, id]
}

/** 与相邻项交换；越界时保持原样 */
export function movePin(ids: readonly number[], index: number, delta: -1 | 1): number[] {
  const target = index + delta
  if (index < 0 || index >= ids.length || target < 0 || target >= ids.length) return [...ids]
  const next = [...ids]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}
```

- [ ] **Step 5: 页面配置与登记**

Create `apps/demo/app/src/pages/apps/pinned/index.config.ts`:

```ts
export default definePageConfig({
  navigationBarTitleText: '编辑常用应用',
  navigationStyle: 'custom',
})
```

在 `apps/demo/app/src/constants/page-config.ts` 的 `pages` 数组中 `'pages/apps/index',` 之后加 `'pages/apps/pinned/index',`。

- [ ] **Step 6: 写编辑页**

Create `apps/demo/app/src/pages/apps/pinned/index.tsx`:

```tsx
import Taro from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import { ApplicationIcon } from '@/components/ApplicationIcon'
import {
  ActionSheet,
  type ActionSheetItem,
  Checkbox,
  DetailContent,
  DetailSection,
  FormSubmitBar,
  ManagementCell,
  ManagementFilterBar,
  ManagementPage,
  ManagementPageHeader,
  ManagementSearchBar,
  ManagementStates,
} from '@/components/management'
import { getWorkbenchGroups, MAX_HOME_APPS } from '@/modules/registry'
import { withAccountScope } from '@/pages/system/_shared/AdminUI'
import { useAuthStore } from '@/stores/auth'
import { useModuleStore } from '@/stores/modules'
import { useRequireAuth } from '@/utils/auth-guard'
import { navigateBack } from '@/utils/router'
import { movePin, togglePin } from './model'

function HomeAppsEditPage() {
  const guard = useRequireAuth()
  const menus = useModuleStore((state) => state.menus)
  const home = useModuleStore((state) => state.home)
  const loaded = useModuleStore((state) => state.loaded)
  const error = useModuleStore((state) => state.error)
  const user = useAuthStore((state) => state.user)
  const enabledModuleIds = useAuthStore((state) => state.enabledModuleIds)
  const [draft, setDraft] = useState<number[] | null>(null)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const locked = useRef(false)

  const ready = guard.ready && guard.allowed
  useEffect(() => {
    if (ready) void useModuleStore.getState().load({ force: true })
  }, [ready])

  const groups = getWorkbenchGroups(menus, user?.permissions, enabledModuleIds)
  const byMenuId = new Map(groups.flatMap((group) => group.apps).map((app) => [app.menuId, app]))

  // 草稿只在首次拿到数据时初始化，之后的刷新不覆盖用户正在做的调整
  useEffect(() => {
    if (draft === null && loaded && home) setDraft(home.pinned.filter((id) => byMenuId.has(id)))
  }, [loaded, home])

  if (!ready) return <ManagementPage>{null}</ManagementPage>

  const pinned = (draft ?? []).flatMap((id) => byMenuId.get(id) ?? [])
  const full = pinned.length >= MAX_HOME_APPS
  const searchGroups = query.trim()
    ? getWorkbenchGroups(menus, user?.permissions, enabledModuleIds, query)
    : groups
  const kind = draft !== null ? 'ready' : !loaded && !error ? 'loading' : 'error'
  const retry = () => void useModuleStore.getState().load({ force: true })

  const save = async () => {
    if (locked.current || draft === null) return
    locked.current = true
    setSaving(true)
    try {
      await useModuleStore.getState().savePins(pinned.map((app) => app.menuId))
      Taro.showToast({ title: '已保存', icon: 'success' })
      await navigateBack()
    } catch (failure) {
      Taro.showToast({
        title: failure instanceof Error ? failure.message : '保存失败，请重试',
        icon: 'none',
      })
    } finally {
      locked.current = false
      setSaving(false)
    }
  }

  const activeApp = active === null ? undefined : pinned[active]
  const sheetItems: ActionSheetItem[] =
    active === null || !draft
      ? []
      : [
          ...(active > 0
            ? [{ key: 'up', label: '上移', onClick: () => setDraft(movePin(draft, active, -1)) }]
            : []),
          ...(active < pinned.length - 1
            ? [{ key: 'down', label: '下移', onClick: () => setDraft(movePin(draft, active, 1)) }]
            : []),
          {
            key: 'remove',
            label: '取消固定',
            danger: true,
            onClick: () => activeApp && setDraft(togglePin(draft, activeApp.menuId)),
          },
        ]

  return (
    <ManagementPage withActions>
      <ManagementPageHeader title="编辑常用应用" />
      <ManagementFilterBar>
        <ManagementSearchBar value={query} onChange={setQuery} placeholder="搜索应用" />
      </ManagementFilterBar>
      <ManagementStates kind={kind} errorText={error ?? '常用应用加载失败'} onRetry={retry}>
        <DetailContent>
          <DetailSection title={`已固定 (${pinned.length}/${MAX_HOME_APPS})`}>
            {pinned.length ? (
              pinned.map((app, index) => (
                <ManagementCell
                  key={app.menuId}
                  leading={<ApplicationIcon id={app.id} icon={app.icon} />}
                  title={app.name}
                  bordered={index < pinned.length - 1}
                  showArrow={false}
                  onClick={() => setActive(index)}
                />
              ))
            ) : (
              <ManagementCell
                title="未固定的位置会按你的使用习惯自动推荐"
                bordered={false}
                showArrow={false}
              />
            )}
          </DetailSection>
          {searchGroups.map((group) => (
            <DetailSection key={group.id} title={group.name}>
              {group.apps.map((app, index) => {
                const checked = (draft ?? []).includes(app.menuId)
                const disabled = !checked && full
                return (
                  <ManagementCell
                    key={app.menuId}
                    leading={<ApplicationIcon id={app.id} icon={app.icon} />}
                    title={app.name}
                    tag={<Checkbox checked={checked} disabled={disabled} />}
                    disabled={disabled}
                    bordered={index < group.apps.length - 1}
                    showArrow={false}
                    onClick={() => draft && setDraft(togglePin(draft, app.menuId))}
                  />
                )
              })}
            </DetailSection>
          ))}
          {query.trim() && searchGroups.length === 0 ? (
            <ManagementStates kind="empty" emptyText="未找到相关应用" />
          ) : null}
        </DetailContent>
      </ManagementStates>
      <ActionSheet
        open={active !== null}
        title={activeApp?.name}
        items={sheetItems}
        onClose={() => setActive(null)}
      />
      {kind === 'ready' ? (
        <FormSubmitBar text="保存" submitting={saving} onSubmit={() => void save()} />
      ) : null}
    </ManagementPage>
  )
}

export default withAccountScope(HomeAppsEditPage)
```

注意 `ActionSheet` 的每个 item 点击后是否自动关闭：打开 `src/components/management/ActionBar.tsx` 查看 `ActionSheet` 的 item 点击实现；若不会自动调用 `onClose`，在每个 item 的 `onClick` 末尾加 `setActive(null)`。

- [ ] **Step 7: 运行，确认通过**

Run: `cd apps/demo/app && node --test tests/home-apps.test.cjs tests/workbench.test.cjs && pnpm --filter @yishan/demo-app exec tsc --noEmit`
Expected: PASS（含 `every registered main or subpackage page exists on disk`），tsc 无错误。

- [ ] **Step 8: Commit**

```bash
git add apps/demo/app/src/components/management/ManagementList.tsx apps/demo/app/src/components/management/ManagementList.module.scss apps/demo/app/src/pages/apps/pinned apps/demo/app/src/constants/page-config.ts apps/demo/app/tests/home-apps.test.cjs
git commit -m "feat(app): add home apps edit page built on management components"
```

---

### Task 7: 清理、文档与完整质量门

**Files:**
- Modify: `apps/demo/app/src/pages/apps/index.tsx`
- Modify: `apps/demo/app/tests/browser/workbench.js`
- Modify: `apps/demo/app/README.md`
- Modify: `CLAUDE.md`（「App workbench menu」一节）

- [ ] **Step 1: 删除工作台对「常用」分组的特殊过滤**

`apps/demo/app/src/pages/apps/index.tsx` 中删除注释 `// 旧后台目录仍可能下发「常用」...` 与 `const catalogMenus = ...` 两行，并把后续两处 `catalogMenus` 改为 `menus`。

- [ ] **Step 2: 浏览器用例同步**

`apps/demo/app/tests/browser/workbench.js`：
- 第 83 行附近 fixture 中的分组名 `'常用'` 改为 `'协同办公'`；
- 第 135 行附近断言 `'Server common category must be absent'` 改为断言该分组**存在**：

```js
  check((await page.getByText('协同办公', { exact: true }).count()) === 1, 'Server groups are shown as-is')
```

- 若浏览器 fixture 拦截 `/api/v1/app/menus/authorized`，同文件内为 `/api/v1/app/menus/home` 增加返回 `{ success: true, code: 10000, message: 'ok', data: { pinned: [], ranked: [] }, timestamp: new Date().toISOString() }` 的拦截（照该文件现有拦截写法）。

- [ ] **Step 3: 文档**

`apps/demo/app/README.md`：把「工作台支持按用户保存常用入口」一类描述改为：

```md
- 首页「常用应用」：用户在「编辑常用应用」页固定的入口在前（最多 8 个），其余位置按使用习惯（打开次数，14 天半衰期，90 天窗口）自动推荐；数据存后端 `sys_user_workbench_pin` / `sys_user_workbench_usage`，跨设备一致。工作台菜单只决定有哪些应用。
```

根 `CLAUDE.md` 的「App workbench menu (sys_workbench_menu)」一节末尾追加一段：

```md
Home common apps are per user and independent of workbench grouping: `sys_user_workbench_pin` (user-ordered pins, max 8) and `sys_user_workbench_usage` (open counts) behind `GET /api/v1/app/menus/home`, `PUT .../pins` and `POST .../usage`, all on the `app:menu:authorized-tree` permission. The API returns only authorized entry ids (`pinned`, then `ranked` by 14-day half-life usage, 90-day window, ties in tree order); the App drops entries without a registered page and shows 8. Opening an app goes through `openWorkbenchApp`, which reports usage fire-and-forget. Do not reintroduce a "常用" workbench group.
```

- [ ] **Step 4: 完整质量门**

```bash
pnpm typecheck:mobile
pnpm --filter @yishan/demo-app test
pnpm build:app
pnpm --filter @yishan/core-system-api test
pnpm --filter @yishan/demo-api test
pnpm check:boundaries
pnpm check:taro
pnpm lint
```

Expected: 全部退出码 0。App 测试中已知的 `React.jsx: type is invalid` 警告来自 `system-authorization` / `user-roles-page` 测试，属既有问题，不处理。

- [ ] **Step 5: H5 手动验证**

使用 `run` 技能（或 `pnpm dev:api` + App H5 dev）启动，先 `pnpm --filter @yishan/demo-api db:migrate --dry-run` 确认只计划执行 `0004_user-workbench-preference`，再 `--apply`。以管理员登录后走一遍：

1. 首页「常用应用」显示 8 个（无使用记录时按工作台顺序），标题右侧为「编辑 ›」。
2. 进入编辑页，勾选 3 个应用、把第 3 个上移到第 1，保存 → 返回首页，前三格为该顺序。
3. 勾满 8 个后，未勾选行整行置灰且点击无效。
4. 从工作台多次打开某个未固定应用，下拉刷新首页 → 它出现在推荐位靠前位置。
5. 在 Admin `/system/app-menu` 停用一个已固定入口 → 首页与编辑页都不再显示它。

把每一步的结果（截图或文字）记录在 PR 描述中；任一步不符合预期，按 `superpowers:systematic-debugging` 排查后再继续。

- [ ] **Step 6: Commit**

```bash
git add apps/demo/app/src/pages/apps/index.tsx apps/demo/app/tests/browser/workbench.js apps/demo/app/README.md CLAUDE.md
git commit -m "docs(app): document server-backed home apps and drop the common workbench group"
```

PR 描述中注明：已部署环境若存在名为「常用」的工作台分组，请在 `/system/app-menu` 手动改名或删除；新库种子已改为「协同办公」。
