import { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { ResponseUtil } from '../../../../../../../utils/response.js'
import { HelloHealthResponseSchema } from '../../../../schemas/hello.js'
import { HelloService } from '../../../../services/hello.service.js'

const routes: FastifyPluginAsync = async (fastify): Promise<void> => {
    fastify.get('/', {
        schema: {
            summary: 'Hello 模块健康检查',
            description: '提供模块可用性检测端点',
            operationId: 'getHelloAdminHealth',
            tags: ['helloModule'],
            response: {
                200: HelloHealthResponseSchema
            }
        }
    }, async (_request: FastifyRequest, reply: FastifyReply) => {
        return ResponseUtil.success(reply, HelloService.getHealth(), 'hello module ready')
    })
}

export default routes
