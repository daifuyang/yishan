import { createRouteRegistrar } from '../../../../../../../apps/yishan-api/src/core/routes/route-registrar.ts';
import type { FastifyPluginAsync } from 'fastify';
import { ResponseUtil } from '../../../../../../../apps/yishan-api/src/utils/response.ts';
import { helloPermissions } from '../../../../plugin.ts';

const helloAdminRoutes: FastifyPluginAsync = async (fastify) => {
  const route = createRouteRegistrar(fastify);
  route.get('/', {
    access: { permission: helloPermissions.HEALTH_READ },
    schema: {
      summary: 'Hello 示例插件健康检查',
      description: '验证插件 manifest、鉴权和管理端路由是否已正确加载',
      operationId: 'getHelloAdminHealth',
      tags: ['helloModule'],
      security: [{ bearerAuth: [] }],
    },
  }, async (_request, reply) => ResponseUtil.success(reply, {
    module: 'hello',
    status: 'ok',
    time: new Date().toISOString(),
  }));
};

export default helloAdminRoutes;
