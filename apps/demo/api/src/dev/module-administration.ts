import type { FastifyInstance } from 'fastify'
import { Type } from '@sinclair/typebox'
import { moduleRoutePrefix, type ApiModule } from '@yishan/core-api'
import { createRouteRegistrar } from '@yishan/core-api/routes/route-registrar'
import { ResponseUtil } from '@yishan/core-api/response'
import type { SystemRuntime } from '@yishan/core-system-api'

export function registerModuleAdministration(router: FastifyInstance, runtime: Pick<SystemRuntime, 'moduleAdministration'>, modules: readonly ApiModule<SystemRuntime>[]) {
  const route = createRouteRegistrar(router)
  const installed = new Map(modules.map(module => [module.id, module]))
  const response = (data: ReturnType<typeof Type.Object>) => Type.Object({ success: Type.Boolean(), code: Type.Number(), message: Type.String(), data, timestamp: Type.String() })
  route.get('/api/v1/admin/system/module-management/list/', {
    access: { permission: { code: 'system:module-management:list', label: '模块管理-列表', group: 'module-management' } },
    schema: { summary: '模块列表', description: '显式安装清单中的业务模块及当前启停、挂载状态。', operationId: 'getModuleManagementList', tags: ['moduleManagement'], response: { 200: response(Type.Object({ items: Type.Array(Type.Object({ id: Type.String(), name: Type.String(), routePrefix: Type.String(), tablePrefix: Type.String(), version: Type.String(), enabled: Type.Boolean(), mounted: Type.Boolean() })) })) } },
  }, async (_request, reply) => {
    const rows = new Map((await runtime.moduleAdministration.list([...installed.keys()])).map(row => [row.id, row]))
    const items = [...installed.values()].sort((a, b) => a.id.localeCompare(b.id)).map(module => ({
      id: module.id, name: rows.get(module.id)?.name ?? module.name, tablePrefix: module.tablePrefix, version: module.version,
      enabled: rows.get(module.id)?.enabled ?? false, mounted: router.moduleLoader.isMounted(module.id), routePrefix: moduleRoutePrefix(module),
    }))
    return ResponseUtil.success(reply, { items }, '获取模块列表成功')
  })
  route.post<{ Params: { id: string }; Body: { enabled: boolean } }>('/api/v1/admin/system/module-management/toggle/:id/toggle', {
    access: { permission: { code: 'system:module-management:toggle', label: '模块启停', group: 'module-management' } },
    schema: { summary: '切换模块启停', operationId: 'toggleModuleManagement', tags: ['moduleManagement'], params: Type.Object({ id: Type.String() }), body: Type.Object({ enabled: Type.Boolean() }), response: { 200: response(Type.Object({ id: Type.String(), enabled: Type.Boolean() })) } },
  }, async (request, reply) => {
    const { id } = request.params
    if (!installed.has(id)) return ResponseUtil.error(reply, 40400, `模块不存在：${id}`)
    const enabled = request.body.enabled
    const current = await runtime.moduleAdministration.setEnabled(id, enabled)
    if (!current) return ResponseUtil.error(reply, 40400, `模块不存在：${id}`)
    await router.moduleLoader.invalidateEnabledCache()
    request.log.info({ action: 'module.toggle', moduleId: id, previous: current.previous, next: enabled, operatorId: request.currentUser?.id, operatorUsername: request.currentUser?.username, ip: request.ip }, 'module toggle')
    return ResponseUtil.success(reply, { id, enabled }, enabled ? '已启用（即时生效）' : '已停用（即时生效）')
  })
}
