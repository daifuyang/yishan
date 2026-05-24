import { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { ResponseUtil } from '../../../../../../utils/response.js'
import {
  HelloEchoBody,
  HelloEchoBodySchema,
  HelloEchoResponseSchema,
  HelloHealthResponseSchema,
} from '../../../schemas/hello.js'
import { HelloService } from '../../../services/hello.service.js'

const routes: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.get(
    '/ping',
    {
      schema: {
        summary: 'Hello module health check',
        description: 'Provides module availability endpoint',
        operationId: 'getHelloPublicPing',
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

  fastify.post<{ Body: HelloEchoBody }>(
    '/echo',
    {
      preHandler: fastify.authenticate,
      schema: {
        summary: 'Hello module echo example',
        description: 'Demo endpoint with body validation and authentication',
        operationId: 'postHelloEcho',
        tags: ['helloModule'],
        security: [{ bearerAuth: [] }],
        body: HelloEchoBodySchema,
        response: {
          200: HelloEchoResponseSchema,
        },
      },
    },
    async (request, reply: FastifyReply) => {
      return ResponseUtil.success(reply, HelloService.echo(request.body.message, request.currentUser), 'hello echo success')
    }
  )
}

export default routes
