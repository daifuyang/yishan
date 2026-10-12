import Fastify from 'fastify'
import adminAppMenusPlugin from '../src/core/routes/api/v1/admin/app-menus/index.ts'
import registerAppMenuSchemas from '../src/core/schemas/app-menu.ts'
import registerCommonSchemas from '../src/core/schemas/common.ts'
import { errorHandlerPlugin } from '@yishan/core-api/plugins'
import { AppMenuService } from '../src/core/services/app-menu.service.ts'
import { AppMenuRepository, type AppMenuPublicRow } from '../src/core/repositories/app-menu.repository.ts'
import { PermissionService } from '../src/core/services/permission.service.ts'
import { MenuErrorCode } from '@yishan/core-api/business-codes/menu'
import { BusinessError } from '@yishan/core-api/errors'
import { describe, it, expect, vi, beforeEach } from './runtime-fixture'

async function buildApp() {
  const app = Fastify({ logger: false })
  app.decorate('requirePermission', () => async () => undefined)
  app.decorate('requireRole', () => async () => undefined)
  app.decorate('authenticate', async (request: any) => {
    request.currentUser = { id: 7, roleIds: [1] }
  })
  await app.register(errorHandlerPlugin)
  registerCommonSchemas(app)
  registerAppMenuSchemas(app)
  await app.register(adminAppMenusPlugin)
  await app.ready()
  return app
}

const at = new Date('2026-01-01T00:00:00Z')
function row(partial: Partial<AppMenuPublicRow> & { id: number }): AppMenuPublicRow {
  return {
    parentId: null,
    type: 1,
    name: `n${partial.id}`,
    icon: null,
    page: null,
    moduleId: 'core',
    sortOrder: partial.id * 10,
    status: 1,
    creatorId: 1,
    createdAt: at,
    updaterId: 1,
    updatedAt: at,
    ...partial,
  }
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('Admin app-menus routes', () => {
  it('GET /tree returns the tree', async () => {
    const app = await buildApp()
    vi.spyOn(AppMenuService, 'getTree').mockResolvedValue([
      {
        id: 1, type: 0, name: '常用', moduleId: 'core', sortOrder: 10, status: '1',
        createdAt: at.toISOString(), updatedAt: at.toISOString(),
        children: [
          {
            id: 2, parentId: 1, type: 1, name: '通讯录', page: 'pages/contacts/index/index', moduleId: 'core',
            sortOrder: 10, status: '1', createdAt: at.toISOString(), updatedAt: at.toISOString(), children: null,
          },
        ],
      },
    ])
    const res = await app.inject({ method: 'GET', url: '/tree' })
    expect(res.statusCode).toBe(200)
    expect(res.json().data[0].children[0].page).toBe('pages/contacts/index/index')
    await app.close()
  })

  it('POST / passes the operator id and maps business errors', async () => {
    const app = await buildApp()
    const create = vi
      .spyOn(AppMenuService, 'create')
      .mockRejectedValue(new BusinessError(MenuErrorCode.MENU_ALREADY_EXISTS, '同级下名称已存在'))
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { name: '通讯录', parentId: 1, page: 'pages/contacts/index/index' },
    })
    expect(res.json().code).toBe(MenuErrorCode.MENU_ALREADY_EXISTS)
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ name: '通讯录' }), 7)
    await app.close()
  })

  it('POST /reorder validates the body', async () => {
    const app = await buildApp()
    const reorder = vi.spyOn(AppMenuService, 'reorder').mockResolvedValue({ count: 2 })
    const bad = await app.inject({ method: 'POST', url: '/reorder', payload: { orderedIds: [] } })
    expect(bad.statusCode).toBe(400)
    const ok = await app.inject({ method: 'POST', url: '/reorder', payload: { parentId: 1, orderedIds: [3, 2] } })
    expect(ok.statusCode).toBe(200)
    expect(reorder).toHaveBeenCalledWith({ parentId: 1, orderedIds: [3, 2] })
    await app.close()
  })
})

describe('AppMenuService', () => {
  const rows = [
    row({ id: 1, type: 0, name: '常用', sortOrder: 20 }),
    row({ id: 2, type: 0, name: '系统管理', sortOrder: 10 }),
    row({ id: 3, parentId: 1, name: '通讯录', page: 'pages/contacts/index/index' }),
    row({ id: 4, parentId: 2, name: '用户', page: 'pages/system/user/index' }),
    row({ id: 5, parentId: 2, name: '客户', page: 'pages/crm/customers/index', moduleId: 'crm' }),
    row({ id: 6, parentId: 1, name: '停用', page: 'pages/x/y', status: 0 }),
  ]

  function mockRoles(codes: string[], granted: number[]) {
    vi.spyOn(AppMenuRepository, 'listAll').mockResolvedValue(
      [...rows].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id),
    )
    vi.spyOn(AppMenuRepository, 'findIdsByRoleIds').mockResolvedValue(granted)
    vi.spyOn(PermissionService, 'loadForRoleIds').mockResolvedValue({ roleCodes: new Set(codes) } as any)
  }
  const modules = (enabled: string[], mounted: string[]) => ({
    enabledIdsCached: async () => new Set(enabled),
    listModuleIds: () => new Set(mounted),
  })

  it('sorts siblings by sort_order and includes ancestors of granted entries', async () => {
    mockRoles(['normal_user'], [3, 4])
    const tree = await AppMenuService.getAuthorizedTree([2])
    expect(tree.map((g) => g.name)).toEqual(['系统管理', '常用'])
    expect(tree[1].children?.map((e) => e.name)).toEqual(['通讯录'])
  })

  it('shows everything except disabled nodes to super_admin', async () => {
    mockRoles(['super_admin'], [])
    const tree = await AppMenuService.getAuthorizedTree([1], modules(['crm'], ['crm']))
    expect(tree.flatMap((g) => g.children ?? []).map((e) => e.id).sort()).toEqual([3, 4, 5])
  })

  it('hides entries of disabled or unmounted modules and drops emptied groups', async () => {
    mockRoles(['normal_user'], [5])
    expect(await AppMenuService.getAuthorizedTree([2], modules([], ['crm']))).toEqual([])
    expect(await AppMenuService.getAuthorizedTree([2], modules(['crm'], []))).toEqual([])
    const tree = await AppMenuService.getAuthorizedTree([2], modules(['crm'], ['crm']))
    expect(tree[0].children?.[0].page).toBe('pages/crm/customers/index')
  })

  it('rejects a reorder list that is not the full sibling set', async () => {
    vi.spyOn(AppMenuRepository, 'listChildren').mockResolvedValue([rows[2], rows[5]])
    await expect(AppMenuService.reorder({ parentId: 1, orderedIds: [3] })).rejects.toBeInstanceOf(BusinessError)
    await expect(AppMenuService.reorder({ parentId: 1, orderedIds: [3, 3] })).rejects.toBeInstanceOf(BusinessError)
  })

  it('requires entries to have a group parent and a valid page', async () => {
    vi.spyOn(AppMenuRepository, 'findById').mockResolvedValue(rows[0])
    vi.spyOn(AppMenuRepository, 'findByParentAndName').mockResolvedValue(null)
    vi.spyOn(AppMenuRepository, 'findByPage').mockResolvedValue(null)
    await expect(AppMenuService.create({ name: 'a', type: 1, page: 'pages/a/b' })).rejects.toMatchObject({
      code: MenuErrorCode.MENU_INVALID_PARENT,
    })
    await expect(AppMenuService.create({ name: 'a', type: 1, parentId: 1, page: 'http://x' })).rejects.toMatchObject({
      code: MenuErrorCode.MENU_INVALID_COMPONENT,
    })
    await expect(AppMenuService.create({ name: 'a', type: 0, parentId: 1 })).rejects.toMatchObject({
      code: MenuErrorCode.MENU_INVALID_PARENT,
    })
  })
})
