import { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { ResponseUtil } from '../../../../../../utils/response.js'
import { HelloHealthResponseSchema } from '../../../schemas/hello.js'
import { HelloService } from '../../../services/hello.service.js'

const routes: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.get(
    '/',
    {
      schema: {
        summary: 'Hello module health check',
        description: 'Provides module availability endpoint',
        operationId: 'getHelloAdminHealth',
        tags: ['helloModule'],
        response: {
          200: HelloHealthResponseSchema,
        },
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return ResponseUtil.success(reply, HelloService.getHealth(), 'hello module ready')
    }
  )
}

export default routes
