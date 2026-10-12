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
