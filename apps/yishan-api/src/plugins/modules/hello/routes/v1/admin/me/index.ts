import { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { ResponseUtil } from '../../../../../../../utils/response.js'
import { HelloCurrentUserResponseSchema } from '../../../../schemas/hello.js'
import { HelloService } from '../../../../services/hello.service.js'

const routes: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.get(
    '/',
    {
      schema: {
        summary: 'Hello module auth example',
        description: 'Demo endpoint for authenticated module access',
        operationId: 'getHelloCurrentUser',
        tags: ['helloModule'],
        security: [{ bearerAuth: [] }],
        response: {
          200: HelloCurrentUserResponseSchema,
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return ResponseUtil.success(reply, HelloService.getCurrentUser(request.currentUser), 'authenticated hello access granted')
    }
  )
}

export default routes
