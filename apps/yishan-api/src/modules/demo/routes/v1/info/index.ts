import { type FastifyPluginAsync } from 'fastify'
import {
  createRouteRegistrar,
  registerPermissionGroups,
  registerPermissions,
  type PermissionRef,
} from '@/core/module-api.js'
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
// 模块自己登记权限分组的展示名（PAT 可授予范围等处使用），Core 不预置业务分组。
registerPermissionGroups({ id: 'demo', label: '示例插件' })

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
         operationId: 'demoInfo',
        response: { 200: ServerInfoRespSchema },
      },
    },
    async () => getServerInfo(),
  )
}) as FastifyPluginAsync
