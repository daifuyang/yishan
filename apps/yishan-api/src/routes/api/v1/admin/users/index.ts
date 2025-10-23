import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { ResponseUtil } from '../../../../../utils/response.js'
import { ErrorCode } from '../../../../../constants/business-code.js'
import { UserService } from '../../../../../services/user.service.js'
import { type UserListQuery } from '../../../../../schemas/user.js'

const sysUser: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  
  // GET /api/v1/admin/user - 获取管理员用户列表
  fastify.get(
    '/',
    {
      schema: {
        summary: '获取管理员用户列表',
        description: '分页获取系统用户列表，支持关键词搜索和状态筛选',
        operationId: 'getAdminUserList',
        tags: ['admin', 'user'],
        security: [{ bearerAuth: [] }],
        querystring: { $ref: 'userListQuerySchema#' },
        response: {
          200: { $ref: 'userListResponseSchema#' },
          400: { $ref: 'errorResponse#' },
          401: { $ref: 'unauthorizedResponse#' },
          403: { $ref: 'forbiddenResponse#' },
          500: { $ref: 'errorResponse#' }
        }
      }
    },
    async (request: FastifyRequest<{ Querystring: UserListQuery }>, reply: FastifyReply) => {
      try {
        const result = await UserService.getUserList(request.query)
        
        return ResponseUtil.sendPaginated(
          reply,
          result.list,
          result.pagination.page,
          result.pagination.pageSize,
          result.pagination.total,
          '获取用户列表成功'
        )

      } catch (error: unknown) {
         fastify.log.error(error);
         return ResponseUtil.sendError(
           reply,
           ErrorCode.DATABASE_ERROR,
           '获取用户列表失败'
         );
       }
    }
  )
}

export default sysUser