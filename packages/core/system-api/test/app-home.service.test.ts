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
