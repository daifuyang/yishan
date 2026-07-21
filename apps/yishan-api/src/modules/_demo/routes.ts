import type { FastifyPluginAsync } from 'fastify'

export const meta = {
  id: '_demo',
  name: 'Demo Module',
  defaultEnabled: false,
  prefix: '/api/_demo',
}

const routes: FastifyPluginAsync = async (app) => {
  app.get('/ping', async () => ({ pong: true, module: meta.id }))
  app.get('/echo', async (request) => ({ query: request.query }))
}

export default routes