import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { Type } from '@sinclair/typebox';
import { eq } from 'drizzle-orm';
import { drizzleDb } from '@/db';
import { sysModule } from '@/db/schema/tables';
import { createRouteRegistrar } from '@/core/routes/route-registrar.js';
import { registerPermissions, type PermissionRef } from '@/core/permissions/catalog.js';
import { ResponseUtil } from '@/utils/response.js';

const PERMS: { readonly [k: string]: PermissionRef } = Object.freeze({
  TOGGLE: { code: 'system:module-management:toggle', label: '模块启停', group: 'module-management' },
});
registerPermissions(PERMS.TOGGLE);

const adminSystemModuleManagementToggle: FastifyPluginAsync = async (fastify) => {
  const route = createRouteRegistrar(fastify);
  route.post(
    '/:id/toggle',
    {
      access: { permission: PERMS.TOGGLE },
      schema: {
        summary: '切换模块启停',
        description: 'UPDATE sys_module.enabled 并清 enabled 缓存；由全局 onRequest gate 即时拦截，无需重启。',
        operationId: 'toggleModuleManagement',
        tags: ['moduleManagement'],
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.String() }),
        body: Type.Object({ enabled: Type.Boolean() }),
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            code: Type.Number(),
            message: Type.String(),
            data: Type.Object({
              id: Type.String(),
              enabled: Type.Boolean(),
            }),
            timestamp: Type.String(),
          }),
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: { enabled?: boolean } }>,
      reply: FastifyReply,
    ) => {
      const { id } = request.params
      const next = request.body?.enabled
      if (typeof next !== 'boolean') {
        reply.code(400)
        return ResponseUtil.error(reply, 40000, 'enabled 字段必须是 boolean')
      }

      await drizzleDb
        .update(sysModule)
        .set({ enabled: next ? 1 : 0, updatedAt: new Date() })
        .where(eq(sysModule.id, id))

      // 清 enabled 缓存（redis + 进程内 memo），下一个请求经 gate 即时生效。
      const loader = (fastify as unknown as {
        moduleLoader: { invalidateEnabledCache: () => Promise<void> }
      }).moduleLoader
      await loader.invalidateEnabledCache()

      return ResponseUtil.success(
        reply,
        { id, enabled: next },
        next ? '已启用（即时生效）' : '已停用（即时生效）',
      )
    },
  )
}

export default adminSystemModuleManagementToggle
