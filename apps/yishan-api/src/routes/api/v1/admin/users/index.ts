import { FastifyPluginAsync } from 'fastify'
import { UserService } from '../../../../../services/userService.js'
import { ErrorCode } from '../../../../../constants/business-code.js'
import { ResponseUtil } from '../../../../../utils/response.js'

const userRoutes: FastifyPluginAsync = async function (fastify, opts) {
  const userService = new UserService(fastify)

  // 创建用户
  fastify.post('/', {
    schema: {
      operationId: 'createUser',
      summary: '创建用户',
      description: '创建新用户',
      tags: ['sysUsers'],
      security: [{ bearerAuth: [] }],
      body: { $ref: 'sysUserCreateRequest#' },
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 10000 },
            message: { type: 'string', example: '创建成功' },
            data: { $ref: 'sysUser#' },
            success: { type: 'boolean', example: true },
            timestamp: { type: 'string', format: 'date-time' },
            request_id: { type: 'string' }
          }
        },
        400: { $ref: 'errorResponse#' },
        401: { $ref: 'unauthorizedResponse#' },
        409: { $ref: 'conflictResponse#' },
        500: { $ref: 'errorResponse#' }
      }
    },
    handler: async (request, reply) => {
      try {
        const body = request.body as any
        const creatorId = (request as any).user.id

        const createData = {
          ...body,
          creatorId
        }

        const user = await userService.createUser(createData)
        
        return ResponseUtil.success(
          reply,
          request,
          user,
          '用户创建成功'
        )
      } catch (error) {
        fastify.log.error(error)
        
        if (error instanceof Error) {
          if (error.message.includes('用户名已存在') || error.message.includes('username')) {
            return ResponseUtil.error(
              reply,
              request,
              ErrorCode.USER_ALREADY_EXISTS,
              '用户名已存在'
            )
          }
          if (error.message.includes('邮箱已存在') || error.message.includes('email')) {
            return ResponseUtil.error(
              reply,
              request,
              ErrorCode.USER_ALREADY_EXISTS,
              '邮箱已存在'
            )
          }
          if (error.message.includes('手机号已存在') || error.message.includes('phone')) {
            return ResponseUtil.error(
              reply,
              request,
              ErrorCode.USER_ALREADY_EXISTS,
              '手机号已存在'
            )
          }
          if (error.message.includes('工号已存在') || error.message.includes('employeeId')) {
            return ResponseUtil.error(
              reply,
              request,
              ErrorCode.USER_ALREADY_EXISTS,
              '工号已存在'
            )
          }
        }
        
        const errorMessage = error instanceof Error ? error.message : '创建失败'
        return ResponseUtil.error(
          reply,
          request,
          ErrorCode.SYSTEM_ERROR,
          errorMessage
        )
      }
    }
  })

  // 获取用户列表
  fastify.get('/', {
    schema: {
      operationId: 'getUserList',
      summary: '获取用户列表',
      description: '获取用户列表，支持分页和筛选',
      tags: ['sysUsers'],
      security: [{ bearerAuth: [] }],
      querystring: { $ref: 'sysUserQueryRequest#' },
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 10000 },
            message: { type: 'string', example: '获取成功' },
            data: { $ref: 'sysUserListResponse#' },
            success: { type: 'boolean', example: true },
            timestamp: { type: 'string', format: 'date-time' },
            request_id: { type: 'string' }
          }
        },
        401: { $ref: 'unauthorizedResponse#' },
        500: { $ref: 'errorResponse#' }
      }
    },
    handler: async (request, reply) => {
      try {
        const query = request.query as any
        const normalizedQuery = {
          ...query,
          page: query.page !== undefined ? Number(query.page) : undefined,
          pageSize: query.pageSize !== undefined ? Number(query.pageSize) : undefined,
          status: query.status !== undefined ? Number(query.status) : undefined
        }
        const result = await userService.getUsers(normalizedQuery)
         
         return ResponseUtil.paginated(
           reply,
           request,
           result.users,
           result.total,
           result.page,
           result.pageSize,
           '获取成功'
         )
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '获取失败'
        return ResponseUtil.error(
          reply,
          request,
          ErrorCode.SYSTEM_ERROR,
          errorMessage
        )
      }
    }
  })

  // 根据ID获取用户详情
  fastify.get('/:id', {
    
    schema: {
      operationId: 'getUserById',
      summary: '获取用户详情',
      description: '根据ID获取用户详细信息',
      tags: ['sysUsers'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'number', description: '用户ID' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 10000 },
            message: { type: 'string', example: '获取成功' },
            data: { $ref: 'sysUser#' },
            success: { type: 'boolean', example: true },
            timestamp: { type: 'string', format: 'date-time' },
            request_id: { type: 'string' }
          }
        },
        404: { $ref: 'notFoundResponse#' },
        401: { $ref: 'unauthorizedResponse#' },
        500: { $ref: 'errorResponse#' }
      }
    },
    handler: async (request, reply) => {
      try {
        const { id } = request.params as { id: number }
        const user = await userService.getUserById(id)
        
        if (!user) {
          return ResponseUtil.error(
            reply,
            request,
            ErrorCode.USER_NOT_FOUND,
            '用户不存在'
          )
        }
        
        return ResponseUtil.success(
          reply,
          request,
          user,
          '获取成功'
        )
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '获取失败'
        return ResponseUtil.error(
          reply,
          request,
          ErrorCode.SYSTEM_ERROR,
          errorMessage
        )
      }
    }
  })

  // 根据用户名获取用户详情
  fastify.get('/username/:username', {
    
    schema: {
      operationId: 'getUserByUsername',
      summary: '根据用户名获取用户详情',
      description: '根据用户名获取用户详细信息',
      tags: ['sysUsers'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['username'],
        properties: {
          username: { type: 'string', description: '用户名' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 10000 },
            message: { type: 'string', example: '获取成功' },
            data: { $ref: 'sysUser#' },
            success: { type: 'boolean', example: true },
            timestamp: { type: 'string', format: 'date-time' },
            request_id: { type: 'string' }
          }
        },
        404: { $ref: 'notFoundResponse#' },
        401: { $ref: 'unauthorizedResponse#' },
        500: { $ref: 'errorResponse#' }
      }
    },
    handler: async (request, reply) => {
      try {
        const { username } = request.params as { username: string }
        const user = await userService.getUserBySearch(username)
        
        if (!user) {
          return ResponseUtil.error(
            reply,
            request,
            ErrorCode.USER_NOT_FOUND,
            '用户不存在'
          )
        }
        
        return ResponseUtil.success(
          reply,
          request,
          user,
          '获取成功'
        )
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '获取失败'
        return ResponseUtil.error(
          reply,
          request,
          ErrorCode.SYSTEM_ERROR,
          errorMessage
        )
      }
    }
  })

  // 更新用户信息
  fastify.put('/:id', {
    
    schema: {
      operationId: 'updateUser',
      summary: '更新用户信息',
      description: '根据ID更新用户信息',
      tags: ['sysUsers'],
      security: [{ bearerAuth: [] }],
      params: { $ref: 'sysUserIdParam#' },
      body: { $ref: 'sysUserUpdateRequest#' },
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 200 },
            message: { type: 'string', example: '更新成功' },
            data: { $ref: 'sysUser#' }
          }
        },
        400: { $ref: 'errorResponse#' },
        401: { $ref: 'unauthorizedResponse#' },
        404: { $ref: 'notFoundResponse#' },
        409: { $ref: 'conflictResponse#' },
        500: { $ref: 'errorResponse#' }
      }
    },
    handler: async (request, reply) => {
      try {
        const { id } = request.params as { id: number }
        const body = request.body as any
        const updaterId = (request as any).user.id

        const updateData = {
          ...body,
          updaterId
        }

        const user = await userService.updateUser(id, updateData)
        
        if (!user) {
          return ResponseUtil.error(
            reply,
            request,
            ErrorCode.USER_NOT_FOUND,
            '用户不存在'
          )
        }
        
        return ResponseUtil.success(
          reply,
          request,
          user,
          '更新成功'
        )
      } catch (error) {
        fastify.log.error(error)
        
        if (error instanceof Error) {
          if (error.message.includes('已存在') || error.message.includes('duplicate')) {
            return ResponseUtil.error(
              reply,
              request,
              ErrorCode.USER_ALREADY_EXISTS,
              error.message
            )
          }
          if (error.message.includes('不存在') || error.message.toLowerCase().includes('not found')) {
            return ResponseUtil.error(
              reply,
              request,
              ErrorCode.USER_NOT_FOUND,
              '用户不存在'
            )
          }
        }
        
        const errorMessage = error instanceof Error ? error.message : '更新失败'
        return ResponseUtil.error(
          reply,
          request,
          ErrorCode.SYSTEM_ERROR,
          errorMessage
        )
      }
    }
  })

  // 删除用户
  fastify.delete('/:id', {
    
    schema: {
      operationId: 'deleteUser',
      summary: '删除用户',
      description: '根据ID删除用户',
      tags: ['sysUsers'],
      security: [{ bearerAuth: [] }],
      params: { $ref: 'sysUserIdParam#' },
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 200 },
            message: { type: 'string', example: '删除成功' },
            data: { type: 'null' }
          }
        },
        400: { $ref: 'errorResponse#' },
        401: { $ref: 'unauthorizedResponse#' },
        404: { $ref: 'notFoundResponse#' },
        500: { $ref: 'errorResponse#' }
      }
    },
    handler: async (request, reply) => {
      try {
        const { id } = request.params as { id: number }
        const deleterId = (request as any).user.id

        const result = await userService.deleteUser(id, deleterId)
        
        if (!result) {
          return ResponseUtil.error(
            reply,
            request,
            ErrorCode.USER_NOT_FOUND,
            '用户不存在'
          )
        }
        
        return ResponseUtil.success(
          reply,
          request,
          null,
          '删除成功'
        )
      } catch (error) {
        fastify.log.error(error)
        if (error instanceof Error && (error.message.includes('不存在') || error.message.toLowerCase().includes('not found'))) {
          return ResponseUtil.error(
            reply,
            request,
            ErrorCode.USER_NOT_FOUND,
            '用户不存在'
          )
        }
        
        const errorMessage = error instanceof Error ? error.message : '删除失败'
        return ResponseUtil.error(
          reply,
          request,
          ErrorCode.SYSTEM_ERROR,
          errorMessage
        )
      }
    }
  })

  // 清除用户缓存
  fastify.delete('/cache', {
    
    schema: {
      operationId: 'clearUserCache',
      summary: '清除用户缓存',
      tags: ['sysUsers'],
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 10000 },
            message: { type: 'string', example: '用户缓存清除成功' },
            data: { type: 'null' },
            success: { type: 'boolean', example: true },
            timestamp: { type: 'string', format: 'date-time' }
          }
        },
        401: { $ref: 'unauthorizedResponse#' },
        500: { $ref: 'errorResponse#' }
      }
    }
  }, async (request, reply) => {
    return ResponseUtil.success(reply, request, null, '用户缓存清除成功');
  })

  // 修改用户状态
  fastify.patch('/:id/status', {
    
    schema: {
      operationId: 'updateUserStatus',
      summary: '修改用户状态',
      description: '修改指定用户的状态',
      tags: ['sysUsers'],
      security: [{ bearerAuth: [] }],
      params: { $ref: 'sysUserIdParam#' },
      body: { $ref: 'sysUserStatusRequest#' },
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 200 },
            message: { type: 'string', example: '用户状态修改成功' },
            data: { $ref: 'sysUser#' }
          }
        },
        400: { $ref: 'errorResponse#' },
        401: { $ref: 'unauthorizedResponse#' },
        404: { $ref: 'notFoundResponse#' },
        500: { $ref: 'errorResponse#' }
      }
    },
    handler: async (request, reply) => {
      try {
        const { id } = request.params as { id: number }
        const { status } = request.body as { status: number }
        const updaterId = (request as any).user.id

        const user = await userService.changeUserStatus(id, status, updaterId)
        
        if (!user) {
          return ResponseUtil.error(
            reply,
            request,
            ErrorCode.USER_NOT_FOUND,
            '用户不存在'
          )
        }
        
        return ResponseUtil.success(
          reply,
          request,
          user,
          '用户状态修改成功'
        )
      } catch (error) {
        fastify.log.error(error)
        if (error instanceof Error && (error.message.includes('不存在') || error.message.toLowerCase().includes('not found'))) {
          return ResponseUtil.error(
            reply,
            request,
            ErrorCode.USER_NOT_FOUND,
            '用户不存在'
          )
        }
        const errorMessage = error instanceof Error ? error.message : '状态更新失败'
        return ResponseUtil.error(
          reply,
          request,
          ErrorCode.SYSTEM_ERROR,
          errorMessage
        )
      }
    }
  })

  // 重置用户密码
  fastify.patch('/:id/password/reset', {
    
    schema: {
      operationId: 'resetUserPassword',
      summary: '重置用户密码',
      description: '重置指定用户的密码为默认密码',
      tags: ['sysUsers'],
      security: [{ bearerAuth: [] }],
      params: { $ref: 'sysUserIdParam#' },
      body: {
        type: 'object',
        properties: {
          newPassword: { type: 'string', minLength: 6, description: '新密码（可选，不提供则使用默认密码）' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 200 },
            message: { type: 'string', example: '密码重置成功' },
            data: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: true },
                defaultPassword: { type: 'string', description: '默认密码（仅在使用默认密码时返回）' }
              }
            }
          }
        },
        400: { $ref: 'errorResponse#' },
        401: { $ref: 'unauthorizedResponse#' },
        404: { $ref: 'notFoundResponse#' },
        500: { $ref: 'errorResponse#' }
      }
    },
    handler: async (request, reply) => {
      try {
        const { id } = request.params as { id: number }
        const body = request.body as { newPassword: string }
        const operatorId = (request as any).user.id

        const result = await userService.resetPassword(id, body.newPassword, operatorId)
        
        if (!result) {
          return ResponseUtil.error(
            reply,
            request,
            ErrorCode.USER_NOT_FOUND,
            '用户不存在'
          )
        }
        
        return ResponseUtil.success(
          reply,
          request,
          result,
          '密码重置成功'
        )
      } catch (error) {
        fastify.log.error(error)
        
        if (error instanceof Error) {
          if (error.message.includes('密码格式') || error.message.includes('password format')) {
            return ResponseUtil.error(
              reply,
              request,
              ErrorCode.INVALID_PASSWORD_FORMAT,
              error.message
            )
          }
          if (error.message.includes('不存在') || error.message.toLowerCase().includes('not found')) {
            return ResponseUtil.error(
              reply,
              request,
              ErrorCode.USER_NOT_FOUND,
              '用户不存在'
            )
          }
        }
        
        const errorMessage = error instanceof Error ? error.message : '密码重置失败'
        return ResponseUtil.error(
          reply,
          request,
          ErrorCode.SYSTEM_ERROR,
          errorMessage
        )
      }
    }
  })

  // 修改用户密码
  fastify.patch('/:id/password', {
    
    schema: {
      operationId: 'updateUserPassword',
      summary: '修改用户密码',
      description: '修改指定用户的密码',
      tags: ['sysUsers'],
      security: [{ bearerAuth: [] }],
      params: { $ref: 'sysUserIdParam#' },
      body: { $ref: 'sysUserPasswordChangeRequest#' },
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 200 },
            message: { type: 'string', example: '密码修改成功' },
            data: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: true }
              }
            }
          }
        },
        400: { $ref: 'errorResponse#' },
        401: { $ref: 'unauthorizedResponse#' },
        404: { $ref: 'notFoundResponse#' },
        500: { $ref: 'errorResponse#' }
      }
    },
    handler: async (request, reply) => {
      try {
        const { id } = request.params as { id: number }
        const { oldPassword, newPassword } = request.body as { oldPassword: string; newPassword: string }

        const result = await userService.changePassword(id, oldPassword, newPassword)
        
        if (!result) {
          return ResponseUtil.error(
            reply,
            request,
            ErrorCode.USER_NOT_FOUND,
            '用户不存在'
          )
        }
        
        return ResponseUtil.success(
          reply,
          request,
          { success: true },
          '密码修改成功'
        )
      } catch (error) {
        fastify.log.error(error)
        if (error instanceof Error && (error.message.includes('不存在') || error.message.toLowerCase().includes('not found'))) {
          return ResponseUtil.error(
            reply,
            request,
            ErrorCode.USER_NOT_FOUND,
            '用户不存在'
          )
        }
        const errorMessage = error instanceof Error ? error.message : '密码修改失败'
        return ResponseUtil.error(
          reply,
          request,
          ErrorCode.SYSTEM_ERROR,
          errorMessage
        )
      }
    }
  })
}

export default userRoutes
