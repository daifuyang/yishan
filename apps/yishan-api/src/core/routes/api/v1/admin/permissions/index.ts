import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { ResponseUtil } from '../../../../../../utils/response.js';
import { PERMISSION_CODES } from '../../../../../../constants/permission-codes.js';
import { getGlobalCatalog } from '../../../../../services/permission-catalog.service.js';

/**
 * 仅暴露代码与插件注册的活动功能目录。
 * 管理端可选择其中的能力给角色授权，但不能通过 UI 创建任意权限码。
 */
const permissionsRoute: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.get(
    '/catalog',
    {
      preHandler: [fastify.requirePermission(PERMISSION_CODES.SYSTEM_ROLE_GRANT)] as any,
      schema: {
        summary: '获取活动功能/API 权限目录',
        operationId: 'getPermissionCatalog',
        tags: ['sysPermissions'],
        security: [{ bearerAuth: [] }],
        response: {
          200: { $ref: 'permissionCatalogResp#' },
        },
      },
    },
    async (_request, reply: FastifyReply) => {
      const catalog = await getGlobalCatalog().getActiveCatalog();
      return ResponseUtil.success(reply, catalog);
    },
  );
};

export default permissionsRoute;
