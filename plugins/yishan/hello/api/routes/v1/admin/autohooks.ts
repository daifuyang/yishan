import type { FastifyReply, FastifyRequest, PluginServer } from '@yishan/plugin-api';

export default async function helloAdminAuth(fastify: PluginServer) {
  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    return fastify.authenticate(request, reply);
  });
}
