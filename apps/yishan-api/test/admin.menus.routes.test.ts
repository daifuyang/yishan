import Fastify from 'fastify'
import adminMenusPlugin from '../src/routes/api/v1/admin/menus/index.ts'
import registerMenuSchemas from '../src/schemas/menu.ts'
import registerCommonSchemas from '../src/schemas/common.ts'
import errorHandlerPlugin from '../src/plugins/external/error-handler.ts'
import { MenuService } from '../src/services/menu.service.ts'
import { ValidationErrorCode } from '../src/constants/business-codes/validation.ts'
import { MenuErrorCode } from '../src/constants/business-codes/menu.ts'
import { BusinessError } from '../src/exceptions/business-error.js'
import { describe, it, expect, vi, beforeEach } from 'vitest'

async function buildApp() {
  const app = Fastify({ logger: false })
  app.decorate('authenticate', async (request: any) => {
    const auth = request.headers.authorization
    if (!auth || !auth.startsWith('Bearer ')) {
      throw new Error('Unauthorized')
    }
    request.currentUser = {
      id: 1,
      username: 'admin',
      email: 'admin@example.com',
      realName: 'Admin',
      gender: 1,
      genderName: '男',
      status: 1,
      statusName: '启用',
      loginCount: 10,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastLoginTime: new Date().toISOString(),
      roleIds: [1, 2]
    }
  })
  await app.register(errorHandlerPlugin)
  // 注册通用与菜单相关Schema
  registerCommonSchemas(app)
  registerMenuSchemas(app)
  await app.register(adminMenusPlugin)
  await app.ready()
  return app
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('Admin Menus routes', () => {
  it('GET / 应返回分页的菜单列表', async () => {
    const app = await buildApp()

    const now = new Date().toISOString()
    const list = [
      {
        id: 1,
        name: '系统管理',
        type: 0,
        path: '/system',
        icon: 'SettingOutlined',
        status: 1,
        sort_order: 1,
        hideInMenu: false,
        isExternalLink: false,
        keepAlive: false,
        creatorId: 1,
        creatorName: 'system',
        createdAt: now,
        updaterId: 1,
        updaterName: 'system',
        updatedAt: now,
      }
    ] as any

    vi.spyOn(MenuService, 'getMenuList').mockResolvedValue({ list, total: 1, page: 2, pageSize: 5 })

    const res = await app.inject({ method: 'GET', url: '/?page=2&pageSize=5&keyword=sys&status=1&type=0&sortBy=sort_order&sortOrder=asc' })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.data.length).toBe(1)
    expect(body.pagination.page).toBe(2)
    expect(body.pagination.pageSize).toBe(5)
    expect(body.pagination.total).toBe(1)

    await app.close()
  })

  it('POST / 成功创建菜单', async () => {
    const app = await buildApp()

    const now = new Date().toISOString()
    const created = {
      id: 100,
      name: '仪表盘',
      type: 1,
      path: '/dashboard',
      icon: 'DashboardOutlined',
      status: 1,
      sort_order: 0,
      hideInMenu: false,
      isExternalLink: false,
      keepAlive: false,
      creatorId: 1,
      creatorName: 'system',
      createdAt: now,
      updaterId: 1,
      updaterName: 'system',
      updatedAt: now,
    } as any

    vi.spyOn(MenuService, 'createMenu').mockResolvedValue(created)

    const res = await app.inject({ method: 'POST', url: '/', payload: { name: '仪表盘', type: 1, path: '/dashboard' } })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.data).toMatchObject({ id: 100, name: '仪表盘' })

    await app.close()
  })

  it('POST / 当菜单已存在返回业务错误码', async () => {
    const app = await buildApp()

    vi.spyOn(MenuService, 'createMenu').mockRejectedValue(
      new BusinessError(MenuErrorCode.MENU_ALREADY_EXISTS, '菜单已存在')
    )

    const res = await app.inject({ method: 'POST', url: '/', payload: { name: '仪表盘', type: 1, path: '/dashboard' } })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(MenuErrorCode.MENU_ALREADY_EXISTS)

    await app.close()
  })

  it('PUT /:id 成功更新菜单返回 200', async () => {
    const app = await buildApp()

    const now = new Date().toISOString()
    const updated = {
      id: 5,
      name: '工作台',
      type: 1,
      path: '/workbench',
      icon: 'AppstoreOutlined',
      status: 1,
      sort_order: 2,
      hideInMenu: false,
      isExternalLink: false,
      keepAlive: false,
      creatorId: 1,
      creatorName: 'system',
      createdAt: now,
      updaterId: 1,
      updaterName: 'system',
      updatedAt: now,
    } as any

    vi.spyOn(MenuService, 'updateMenu').mockResolvedValue(updated)

    const res = await app.inject({ method: 'PUT', url: '/5', payload: { name: '工作台' } })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.data).toMatchObject({ id: 5, name: '工作台' })

    await app.close()
  })

  it('PUT /:id 非法ID应返回 400 和验证错误码', async () => {
    const app = await buildApp()

    const res = await app.inject({ method: 'PUT', url: '/abc', payload: { name: 'any' } })

    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(ValidationErrorCode.INVALID_PARAMETER)

    await app.close()
  })

  it('PUT /:id 菜单不存在返回业务错误码（HTTP 200）', async () => {
    const app = await buildApp()

    vi.spyOn(MenuService, 'updateMenu').mockRejectedValue(
      new BusinessError(MenuErrorCode.MENU_NOT_FOUND, '菜单不存在')
    )

    const res = await app.inject({ method: 'PUT', url: '/99', payload: { name: 'x' } })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(MenuErrorCode.MENU_NOT_FOUND)

    await app.close()
  })

  it('DELETE /:id 删除菜单返回成功', async () => {
    const app = await buildApp()

    vi.spyOn(MenuService, 'deleteMenu').mockResolvedValue({ id: 7 })

    const res = await app.inject({ method: 'DELETE', url: '/7' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.data).toMatchObject({ id: 7 })

    await app.close()
  })

  it('GET /:id 成功获取菜单详情', async () => {
    const app = await buildApp()

    const now = new Date().toISOString()
    const detail = {
      id: 11,
      name: '日志审计',
      type: 1,
      path: '/audit',
      icon: 'FileSearchOutlined',
      status: 1,
      sort_order: 3,
      hideInMenu: false,
      hideChildrenInMenu: false,
      isExternalLink: false,
      keepAlive: false,
      creatorId: 1,
      creatorName: 'system',
      createdAt: now,
      updaterId: 2,
      updaterName: 'ops',
      updatedAt: now,
    } as any

    vi.spyOn(MenuService, 'getMenuById').mockResolvedValue(detail)

    const res = await app.inject({ method: 'GET', url: '/11' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.data).toMatchObject({ id: 11, name: '日志审计' })

    await app.close()
  })

  it('GET /:id 非法ID应返回 400 和验证错误码', async () => {
    const app = await buildApp()

    const res = await app.inject({ method: 'GET', url: '/abc' })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(ValidationErrorCode.INVALID_PARAMETER)

    await app.close()
  })

  it('GET /:id 菜单不存在返回业务错误码（HTTP 200）', async () => {
    const app = await buildApp()

    vi.spyOn(MenuService, 'getMenuById').mockResolvedValue(null as any)

    const res = await app.inject({ method: 'GET', url: '/999' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(MenuErrorCode.MENU_NOT_FOUND)

    await app.close()
  })

  it('POST / 参数不合法应返回 400', async () => {
    const app = await buildApp()

    const res = await app.inject({ method: 'POST', url: '/', payload: { type: 1 } })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(ValidationErrorCode.INVALID_PARAMETER)

    await app.close()
  })

  it('DELETE /:id 菜单删除被禁止返回业务错误码（HTTP 200）', async () => {
    const app = await buildApp()

    vi.spyOn(MenuService, 'deleteMenu').mockRejectedValue(
      new BusinessError(MenuErrorCode.MENU_DELETE_FORBIDDEN, '菜单删除被禁止')
    )

    const res = await app.inject({ method: 'DELETE', url: '/10' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe(MenuErrorCode.MENU_DELETE_FORBIDDEN)

    await app.close()
  })

  it('GET /tree 成功返回树形菜单', async () => {
    const app = await buildApp()

    const now = new Date().toISOString()
    const tree = [
      {
        id: 1,
        name: '系统',
        type: 0,
        path: '/system',
        icon: 'SettingOutlined',
        status: 1,
        sort_order: 1,
        hideInMenu: false,
        isExternalLink: false,
        keepAlive: false,
        creatorId: 1,
        creatorName: 'system',
        createdAt: now,
        updaterId: 1,
        updaterName: 'system',
        updatedAt: now,
        children: [
          {
            id: 2,
            name: '菜单管理',
            type: 1,
            path: '/system/menu',
            icon: 'MenuOutlined',
            status: 1,
            sort_order: 2,
            hideInMenu: false,
            isExternalLink: false,
            keepAlive: false,
            creatorId: 1,
            creatorName: 'system',
            createdAt: now,
            updaterId: 1,
            updaterName: 'system',
            updatedAt: now,
            children: null,
          },
        ],
      },
    ] as any

    vi.spyOn(MenuService, 'getMenuTree').mockResolvedValue(tree)

    const res = await app.inject({ method: 'GET', url: '/tree' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.data.length).toBe(1)
    expect(Array.isArray(body.data[0].children)).toBe(true)
    expect(body.data[0].children[0].id).toBe(2)

    await app.close()
  })

  it('GET /tree/authorized 返回授权菜单树（角色并集）', async () => {
    const app = await buildApp()

    const now = new Date().toISOString()
    const tree = [
      {
        id: 1,
        name: '系统',
        type: 0,
        path: '/system',
        icon: 'SettingOutlined',
        status: 1,
        sort_order: 1,
        hideInMenu: false,
        isExternalLink: false,
        keepAlive: false,
        creatorId: 1,
        creatorName: 'system',
        createdAt: now,
        updaterId: 1,
        updaterName: 'system',
        updatedAt: now,
        children: [
          {
            id: 2,
            name: '菜单管理',
            type: 1,
            path: '/system/menu',
            icon: 'MenuOutlined',
            status: 1,
            sort_order: 2,
            hideInMenu: false,
            isExternalLink: false,
            keepAlive: false,
            creatorId: 1,
            creatorName: 'system',
            createdAt: now,
            updaterId: 1,
            updaterName: 'system',
            updatedAt: now,
            children: null,
          },
        ],
      },
    ] as any

    vi.spyOn(MenuService, 'getAuthorizedMenuTree').mockResolvedValue(tree)

    const res = await app.inject({ method: 'GET', url: '/tree/authorized', headers: { Authorization: 'Bearer access-token' } })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.data.length).toBe(1)
    expect(Array.isArray(body.data[0].children)).toBe(true)
    expect(body.data[0].children[0].id).toBe(2)

    await app.close()
  })

  it('GET /paths/authorized 返回授权路径列表', async () => {
    const app = await buildApp()

    const paths = ['/system', '/system/menu', '/audit']

    vi.spyOn(MenuService, 'getAuthorizedMenuPaths').mockResolvedValue(paths)

    const res = await app.inject({ method: 'GET', url: '/paths/authorized', headers: { Authorization: 'Bearer access-token' } })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.data).toEqual(paths)

    await app.close()
  })
})