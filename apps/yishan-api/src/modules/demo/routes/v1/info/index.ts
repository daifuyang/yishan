import { type FastifyPluginAsync } from 'fastify'
import { registerPermissions, type PermissionRef } from '@/core/permissions/catalog.js'
import { createRouteRegistrar } from '@/core/routes/route-registrar.js'
import { getServerInfo } from '../../../services/server-info.service.js'
import { ROUTE_TAG, ServerInfoRespSchema } from '../../../schemas/routes.schema.js'

/**
 * demo 健康检查 / 快速入门资源。
 *
 * 目录即 URL：autoload 推导为 `/api/demo/v1/info`，本文件只负责该资源。
 */
export const PERMS: { readonly [k: string]: PermissionRef } = Object.freeze({
  HEALTH: { code: 'demo:health:read', label: '示例插件-健康检查', group: 'demo' },
  QUICKSTART: { code: 'demo:quickstart:read', label: '示例插件-快速入门', group: 'demo' },
})
registerPermissions(...Object.values(PERMS))

export default (async (app) => {
  const route = createRouteRegistrar(app)

  // 健康检查
  route.get(
    '/',
    {
      access: { permission: PERMS.HEALTH },
      schema: {
        tags: [ROUTE_TAG],
        summary: '插件健康检查',
        description: '返回模块自身与运行环境的只读信息，用于演示 plugin 不读 db 的纯函数 service。',
        operationId: 'demoV1Info',
        response: { 200: ServerInfoRespSchema },
      },
    },
    async () => getServerInfo(),
  )
}) as FastifyPluginAsync
