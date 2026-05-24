import type { FastifyPluginAsync } from 'fastify'
import { ResponseUtil } from '../../../../../../../utils/response.js'
import { PluginManageService } from '../../../../../../services/plugin-manage.service.js'
import { SyncStrategy } from '../../../../../../services/plugin-menu-sync.service.js'

const VALID_STRATEGIES: SyncStrategy[] = ['strict', 'safe']

const adminSystemPlugins: FastifyPluginAsync = async (fastify) => {
  const getService = () => new PluginManageService(fastify.pluginRuntime)

  fastify.get(
    '/hooks/reports',
    {
      preHandler: fastify.authenticate,
      schema: {
        summary: '获取插件 Hook 执行报告',
        tags: ['system']
      }
    },
    async (request, reply) => {
      const limit = Number((request.query as { limit?: string }).limit ?? 50)
      const reports = getService().getHookReports(limit)
      return ResponseUtil.success(reply, reports)
    }
  )

  fastify.get(
    '/',
    {
      preHandler: fastify.authenticate,
      schema: {
        summary: '获取插件列表',
        tags: ['system']
      }
    },
    async (_request, reply) => {
      const data = await getService().listPlugins()
      return ResponseUtil.success(reply, data)
    }
  )

  fastify.get(
    '/:name',
    {
      preHandler: fastify.authenticate,
      schema: {
        summary: '获取插件详情',
        tags: ['system']
      }
    },
    async (request, reply) => {
      const data = await getService().getPlugin((request.params as { name: string }).name)
      return ResponseUtil.success(reply, data)
    }
  )

  fastify.get(
    '/:name/sync-logs',
    {
      preHandler: fastify.authenticate,
      schema: {
        summary: '获取插件菜单同步历史',
        tags: ['system']
      }
    },
    async (request, reply) => {
      const { name } = request.params as { name: string }
      const limit = Number((request.query as { limit?: string }).limit ?? 10)
      const logs = await getService().getSyncLogs(name, limit)
      return ResponseUtil.success(reply, logs)
    }
  )

  fastify.post(
    '/:name/enable',
    {
      preHandler: fastify.authenticate,
      schema: {
        summary: '启用插件（可选 syncStrategy: strict | safe）',
        tags: ['system']
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

  fastify.post(
    '/:name/sync',
    {
      preHandler: fastify.authenticate,
      schema: {
        summary: '手动同步插件菜单（插件需已启用）',
        tags: ['system']
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

  fastify.post(
    '/:name/disable',
    {
      preHandler: fastify.authenticate,
      schema: {
        summary: '停用插件',
        tags: ['system']
      }
    },
    async (request, reply) => {
      const data = await getService().disablePlugin((request.params as { name: string }).name)
      return ResponseUtil.success(reply, data)
    }
  )
}

export default adminSystemPlugins
