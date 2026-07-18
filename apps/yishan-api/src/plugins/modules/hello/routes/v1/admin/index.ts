import { createRouteRegistrar } from '../../../../../../core/routes/route-registrar.js';
import type { FastifyPluginAsync } from 'fastify';
import { ResponseUtil } from '../../../../../../utils/response.js';
import { helloPermissions } from '../../../manifest.js';

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
