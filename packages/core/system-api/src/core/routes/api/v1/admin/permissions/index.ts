import { createRouteRegistrar } from '@yishan/core-api/routes/route-registrar';
import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { ResponseUtil } from '@yishan/core-api/response';
import { registerPermissions, listPermissions, type PermissionRef } from '@yishan/core-api/permissions/catalog';

/**
 * 仅暴露代码与已注册的活动功能目录。
 * 管理端可选择其中的能力给角色授权，但不能通过 UI 创建任意权限码。
 */
const PERMS: { readonly [k: string]: PermissionRef } = Object.freeze({
  CATALOG: { code: 'system:permission:catalog', label: '权限目录-查看', group: 'system' },
});

const permissionsRoute: FastifyPluginAsync = async (fastify): Promise<void> => {
  registerPermissions(...Object.values(PERMS));
  const route = createRouteRegistrar(fastify);
  route.get(
    '/catalog',
    {
      access: { permission: PERMS.CATALOG },
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
      const catalog = listPermissions();
      return ResponseUtil.success(reply, catalog);
    },
  );
};

export default permissionsRoute;
