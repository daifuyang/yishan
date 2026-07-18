import { createRouteRegistrar } from '../../../../../route-registrar.js';
import type { FastifyPluginAsync } from 'fastify'
import { ResponseUtil } from '../../../../../../../utils/response.js'
import { PluginManageService } from '../../../../../../services/plugin-manage.service.js'
import { SyncStrategy } from '../../../../../../services/plugin-menu-sync.service.js'
import permissions from './permissions.js';

const VALID_STRATEGIES: SyncStrategy[] = ['strict', 'safe']

const adminSystemPlugins: FastifyPluginAsync = async (fastify) => {
  const route = createRouteRegistrar(fastify);
  const getService = () => new PluginManageService(fastify.pluginRuntime)

  route.get(
    '/hooks/reports',
    {
      access: { permission: permissions.AUDIT },
      schema: {
        summary: '获取插件 Hook 执行报告',
        tags: ['system'],
        operationId: 'getPluginHookReports',
      }
    },
    async (request, reply) => {
      const limit = Number((request.query as { limit?: string }).limit ?? 50)
      const reports = getService().getHookReports(limit)
      return ResponseUtil.success(reply, reports)
    }
  )

  route.get(
    '/',
    {
      access: { permission: permissions.LIST },
      schema: {
        summary: '获取插件列表',
        tags: ['system'],
        operationId: 'listPlugins',
      }
    },
    async (_request, reply) => {
      const data = await getService().listPlugins()
      return ResponseUtil.success(reply, data)
    }
  )

  route.get(
    '/:name',
    {
      access: { permission: permissions.LIST },
      schema: {
        summary: '获取插件详情',
        tags: ['system'],
        operationId: 'getPluginDetail',
      }
    },
    async (request, reply) => {
      const data = await getService().getPlugin((request.params as { name: string }).name)
      return ResponseUtil.success(reply, data)
    }
  )

  route.get(
    '/:name/sync-logs',
    {
      access: { permission: permissions.LIST },
      schema: {
        summary: '获取插件菜单同步历史',
        tags: ['system'],
        operationId: 'getPluginSyncLogs',
      }
    },
    async (request, reply) => {
      const { name } = request.params as { name: string }
      const limit = Number((request.query as { limit?: string }).limit ?? 10)
      const logs = await getService().getSyncLogs(name, limit)
      return ResponseUtil.success(reply, logs)
    }
  )

  route.post(
    '/:name/enable',
    {
      access: { permission: permissions.ENABLE },
      schema: {
        summary: '启用插件（可选 syncStrategy: strict | safe）',
        tags: ['system'],
        operationId: 'enablePlugin',
      }
    },
    async (request, reply) => {
      const { name } = request.params as { name: string }
      const { strategy } = request.query as { strategy?: string }
      const validStrategy: SyncStrategy = VALID_STRATEGIES.includes(strategy as SyncStrategy) ? (strategy as SyncStrategy) : 'safe'
      const data = await getService().enablePlugin(name, validStrategy)
      return ResponseUtil.success(reply, data)
    }
  )

  route.post(
    '/:name/sync',
    {
      access: { permission: permissions.SYNC },
      schema: {
        summary: '手动同步插件菜单（插件需已启用）',
        tags: ['system'],
        operationId: 'syncPluginMenu',
      }
    },
    async (request, reply) => {
      const { name } = request.params as { name: string }
      const { strategy } = request.query as { strategy?: string }
      const validStrategy: SyncStrategy = VALID_STRATEGIES.includes(strategy as SyncStrategy) ? (strategy as SyncStrategy) : 'safe'
      const data = await getService().syncPlugin(name, validStrategy)
      return ResponseUtil.success(reply, data)
    }
  )

  route.post(
    '/:name/disable',
    {
      access: { permission: permissions.DISABLE },
      schema: {
        summary: '停用插件',
        tags: ['system'],
        operationId: 'disablePlugin',
      }
    },
    async (request, reply) => {
      const data = await getService().disablePlugin((request.params as { name: string }).name)
      return ResponseUtil.success(reply, data)
    }
  )
}

export default adminSystemPlugins
