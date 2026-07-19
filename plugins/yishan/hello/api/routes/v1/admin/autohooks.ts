import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export default async function helloAdminAuth(fastify: FastifyInstance) {
  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    return fastify.authenticate(request, reply);
  });
}
