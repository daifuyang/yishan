import { expect, test } from 'vitest'
import { createYishanApi, type ApiModule } from '@yishan/core-api'
import { registerModuleAdministration } from '../src/dev/module-administration'

test('dev management lists manifest modules and refuses toggling uninstalled modules', async () => {
  const module: ApiModule = { contractVersion: 2, id: 'demo', name: 'Demo', version: '1.0.0', tablePrefix: 'demo_', async register() {} }
  let toggled = ''
  const app = await createYishanApi({ modules: [module], context: {}, async setup(router) {
    router.decorate('authenticate', async () => {})
    router.decorate('requirePermission', () => async () => {})
    registerModuleAdministration(router, { moduleAdministration: {
      async list() { return [{ id: 'demo', name: 'Demo', version: '1.0.0', tablePrefix: 'demo_', enabled: true }] },
      async setEnabled(id) { toggled = id; return { previous: true } },
    } }, [module])
  } })
  try {
    const list = await app.inject('/api/v1/admin/system/module-management/list/')
    expect(list.json().data.items).toEqual([{ id: 'demo', name: 'Demo', version: '1.0.0', tablePrefix: 'demo_', enabled: true, mounted: true, routePrefix: '/api/demo' }])
    const unavailable = await app.inject({ method: 'POST', url: '/api/v1/admin/system/module-management/toggle/crm/toggle', payload: { enabled: false } })
    expect(unavailable.json().code).toBe(20001)
    expect(toggled).toBe('')
    const toggle = await app.inject({ method: 'POST', url: '/api/v1/admin/system/module-management/toggle/demo/toggle', payload: { enabled: false } })
    expect(toggle.json().data).toEqual({ id: 'demo', enabled: false })
    expect(toggled).toBe('demo')
  } finally { await app.close() }
})
