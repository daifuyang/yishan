import { FastifyPluginAsync } from 'fastify'

const root: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get('/', { 
    schema: { 
      response: {
        200: {
          type: 'object',
          properties: {
            root: { type: 'boolean' }
          }
        }
      }
    } 
  }, async function (request, reply) {
    return { root: true }
  })
}

export default root
