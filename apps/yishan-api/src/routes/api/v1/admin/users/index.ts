import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { UserService } from '../../../../../services/userService.js'
import { CreateUserDTO, UpdateUserDTO, UserQueryDTO, UserStatus } from '../../../../../domain/user.js'
import { ResponseUtil } from '../../../../../utils/response.js'
import { UserBusinessCode, CommonBusinessCode } from '../../../../../constants/business-code.js'

export default async function userRoutes(fastify: FastifyInstance) {
  const userService = new UserService(fastify)

  // 创建用户
  fastify.post('/', {
    schema: {
      tags: ['sysUsers'],
      summary: '创建新用户',
      description: '创建一个新的用户账户',
      operationId: 'postAdminUsers',
      security: [{ bearerAuth: [] }],
      body: { $ref: 'sysUserCreateRequest#' },
      response: {
        201: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 20010 },
            message: { type: 'string', example: '用户创建成功' },
            isSuccess: { type: 'boolean', example: true },
            data: { $ref: 'sysUser#' }
          }
        },
        400: { $ref: 'errorResponse#' },
        401: { $ref: 'unauthorizedResponse#' },
        404: { $ref: 'errorResponse#' }
      }
    }
  }, async (
    request: FastifyRequest<{ Body: CreateUserDTO }>,
    reply: FastifyReply
  ) => {
    try {
      // 获取当前用户ID作为创建者（如果已认证）
      const creatorId = request.user?.id
      const newUser = await userService.createUser(request.body, creatorId)
      
      return ResponseUtil.send(
        reply,
        request,
        newUser,
        '用户创建成功',
        UserBusinessCode.USER_CREATED
      )
    } catch (error) {
      fastify.log.error(error)
      
      if (error instanceof Error) {
        // 处理UserService抛出的业务逻辑错误
        if (error.message.includes('用户名已存在')) {
          return ResponseUtil.error(
            reply,
            request,
            '用户名已存在',
            UserBusinessCode.USER_ALREADY_EXISTS,
            error
          )
        }
        if (error.message.includes('邮箱已存在')) {
          return ResponseUtil.error(
            reply,
            request,
            '邮箱已存在',
            UserBusinessCode.USER_ALREADY_EXISTS,
            error
          )
        }
        if (error.message.includes('手机号已存在')) {
          return ResponseUtil.error(
            reply,
            request,
            '手机号已存在',
            UserBusinessCode.USER_ALREADY_EXISTS,
            error
          )
        }
        // 处理数据库层面的重复键错误（作为备用）
        if (error.message.includes('Duplicate entry')) {
          return ResponseUtil.error(
            reply,
            request,
            '数据已存在',
            UserBusinessCode.USER_ALREADY_EXISTS,
            error
          )
        }
      }
    
      return ResponseUtil.error(
        reply,
        request,
        '用户创建失败',
        UserBusinessCode.USER_CREATE_FAILED,
        error
      )
    }
  })

  // 获取用户列表
  fastify.get('/', {
    schema: {
      tags: ['sysUsers'],
      summary: '获取用户列表',
      description: '获取系统用户列表，支持分页、搜索和排序',
      operationId: 'getUserList',
      security: [{ bearerAuth: [] }],
      querystring: { $ref: 'sysUserQueryRequest#' },
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 20000 },
            message: { type: 'string', example: '操作成功' },
            isSuccess: { type: 'boolean', example: true },
            data: { $ref: 'sysUserListResponse#' }
          }
        },
        400: { $ref: 'errorResponse#' },
        401: { $ref: 'unauthorizedResponse#' }
      }
    }
  }, async (
    request: FastifyRequest<{ Querystring: UserQueryDTO }>,
    reply: FastifyReply
  ) => {
    try {
      const query = request.query as UserQueryDTO
      
      // 参数验证和转换
      const validatedQuery: UserQueryDTO = {
        page: Math.max(1, query.page || 1),
        pageSize: Math.max(1, Math.min(100, query.pageSize || 10)),
        search: query.search,
        email: query.email,
        realName: query.realName,
        phone: query.phone,
        status: query.status,
        gender: query.gender,
        sortBy: query.sortBy || 'createdAt',
        sortOrder: query.sortOrder || 'desc'
      }

      // 验证排序字段合法性
      const allowedSortFields = ['id', 'username', 'email', 'realName', 'createdAt', 'updatedAt', 'status', 'lastLoginTime']
      if (validatedQuery.sortBy && !allowedSortFields.includes(validatedQuery.sortBy)) {
        return ResponseUtil.error(
          reply,
          request,
          '无效的排序字段',
          CommonBusinessCode.INVALID_PARAMETER,
          new Error('无效的排序字段')
        )
      }

      // 验证排序方向
      if (validatedQuery.sortOrder && !['asc', 'desc'].includes(validatedQuery.sortOrder)) {
        return ResponseUtil.error(
          reply,
          request,
          '无效的排序方向',
          CommonBusinessCode.INVALID_PARAMETER,
          new Error('无效的排序方向')
        )
      }

      const result = await userService.getUsers(validatedQuery)

      return ResponseUtil.paginated(
        reply,
        request,
        result.users,
        result.total,
        result.page,
        result.pageSize,
        '获取用户列表成功',
        UserBusinessCode.USERS_RETRIEVED
      )
    } catch (error) {
      fastify.log.error(error)
      return ResponseUtil.error(
        reply,
        request,
        error instanceof Error ? error.message : '获取用户列表失败',
        UserBusinessCode.USER_LIST_FAILED,
        error
      )
    }
  })

  // 根据搜索条件获取单个管理员信息
  fastify.get('/findOne', {
    schema: {
      tags: ['sysUsers'],
      summary: '根据搜索条件获取单个管理员信息',
      description: '根据搜索条件(用户名、邮箱、真实姓名、手机号)获取单个管理员信息',
      operationId: 'getUserBySearch',
      security: [{ bearerAuth: [] }],
      querystring: { $ref: 'sysUserSearchRequest#' },
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 20000 },
            message: { type: 'string', example: '获取成功' },
            isSuccess: { type: 'boolean', example: true },
            data: { $ref: 'sysUser#' }
          }
        },
        400: { $ref: 'errorResponse#' },
        401: { $ref: 'unauthorizedResponse#' },
        404: { $ref: 'errorResponse#' }
      }
    }
  }, async (
    request: FastifyRequest<{ Querystring: { search: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { search } = request.query
      
      if (!search || search.trim() === '') {
        return ResponseUtil.error(
          reply,
          request,
          '搜索关键词不能为空',
          CommonBusinessCode.INVALID_PARAMETER,
          new Error('搜索关键词不能为空')
        )
      }

      // 使用专门的getUserBySearch方法获取单个用户
      const user = await userService.getUserBySearch(search)
      
      if (!user) {
        return ResponseUtil.error(
          reply,
          request,
          '未找到匹配的用户',
          UserBusinessCode.USER_NOT_FOUND,
          new Error('未找到匹配的用户')
        )
      }
      
      return ResponseUtil.send(
        reply,
        request,
        user,
        '获取用户信息成功',
        UserBusinessCode.USER_RETRIEVED
      )
    } catch (error) {
      fastify.log.error(error)
      return ResponseUtil.error(
        reply,
        request,
        error instanceof Error ? error.message : '获取用户信息失败',
        UserBusinessCode.USER_FETCH_FAILED,
        error
      )
    }
  })

  // 根据ID获取用户详情
  fastify.get('/:id', {
    schema: {
      tags: ['sysUsers'],
      summary: '获取用户详情',
      description: '根据用户ID获取用户详细信息',
      operationId: 'getUserDetail',
      security: [{ bearerAuth: [] }],
      params: { $ref: 'sysUserIdParam#' },
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 20000 },
            message: { type: 'string', example: '获取成功' },
            isSuccess: { type: 'boolean', example: true },
            data: { $ref: 'sysUser#' }
          }
        },
        401: { $ref: 'unauthorizedResponse#' },
        404: { $ref: 'errorResponse#' }
      }
    }
  }, async (
    request: FastifyRequest<{ Params: { id: number } }>,
    reply: FastifyReply
  ) => {
    try {
      const user = await userService.getUserById(request.params.id)
      
      if (!user) {
        return ResponseUtil.notFound(
          reply,
          request,
          '用户不存在'
        )
      }
      
      return ResponseUtil.send(
        reply,
        request,
        user,
        '获取成功',
        UserBusinessCode.USER_RETRIEVED
      )
    } catch (error) {
      fastify.log.error(error)
      return ResponseUtil.error(
        reply,
        request,
        error instanceof Error ? error.message : '服务器内部错误',
        UserBusinessCode.USER_FETCH_FAILED,
        error
      )
    }
  })

  // 更新用户信息
  fastify.put('/:id', {
    schema: {
      tags: ['sysUsers'],
      summary: '更新用户信息',
      description: '更新指定用户的信息',
      operationId: 'updateUser',
      security: [{ bearerAuth: [] }],
      params: { $ref: 'sysUserIdParam#' },
      body: { $ref: 'sysUserUpdateRequest#' },
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 20012 },
            message: { type: 'string', example: '更新成功' },
            isSuccess: { type: 'boolean', example: true },
            data: { $ref: 'sysUser#' }
          }
        },
        400: { $ref: 'errorResponse#' },
        401: { $ref: 'unauthorizedResponse#' },
        404: { $ref: 'errorResponse#' }
      }
    }
  }, async (
    request: FastifyRequest<{ Params: { id: string }, Body: UpdateUserDTO }>,
    reply: FastifyReply
  ) => {
    try {
      const updatedUser = await userService.updateUser(
        parseInt(request.params.id),
        request.body as UpdateUserDTO,
        request.user.id
      )
      
      if (!updatedUser) {
        return ResponseUtil.notFound(
          reply,
          request,
          '用户不存在'
        )
      }
      
      return ResponseUtil.send(
        reply,
        request,
        updatedUser,
        '更新成功',
        UserBusinessCode.USER_UPDATED
      )
    } catch (error) {
      fastify.log.error(error)
      
      if (error instanceof Error) {
        if (error.message.includes('不存在')) {
          return ResponseUtil.notFound(
            reply,
            request,
            error.message
          )
        }
        if (error.message.includes('已存在')) {
          return ResponseUtil.error(
            reply,
            request,
            error.message,
            UserBusinessCode.USER_ALREADY_EXISTS,
            error
          )
        }
      }
      
      return ResponseUtil.error(
        reply,
        request,
        error instanceof Error ? error.message : '服务器内部错误',
        UserBusinessCode.USER_UPDATE_FAILED,
        error
      )
    }
  })

  // 删除用户
  fastify.delete('/:id', {
    schema: {
      tags: ['sysUsers'],
      summary: '删除用户',
      description: '删除指定用户（软删除）',
      operationId: 'deleteUser',
      security: [{ bearerAuth: [] }],
      params: { $ref: 'sysUserIdParam#' },
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 20014 },
            message: { type: 'string', example: '删除成功' },
            isSuccess: { type: 'boolean', example: true }
          }
        },
        401: { $ref: 'unauthorizedResponse#' },
        404: { $ref: 'errorResponse#' }
      }
    }
  }, async (
    request: FastifyRequest<{ Params: { id: number } }>,
    reply: FastifyReply
  ) => {
    try {
      await userService.deleteUser(request.params.id)
      
      return ResponseUtil.deleted(
        reply,
        request,
        '删除成功'
      )
    } catch (error) {
      fastify.log.error(error)
      
      if (error instanceof Error && error.message.includes('不存在')) {
        return ResponseUtil.notFound(
          reply,
          request,
          error.message
        )
      }
      
      return ResponseUtil.error(
        reply,
        request,
        error instanceof Error ? error.message : '服务器内部错误',
        UserBusinessCode.USER_DELETE_FAILED,
        error
      )
    }
  })

  // 修改用户状态
  fastify.patch('/:id/status', {
    schema: {
      tags: ['sysUsers'],
      summary: '修改用户状态',
      description: '修改指定用户的状态',
      operationId: 'updateUserStatus',
      security: [{ bearerAuth: [] }],
      params: { $ref: 'sysUserIdParam#' },
      body: { $ref: 'sysUserStatusRequest#' },
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 20022 },
            message: { type: 'string', example: '状态修改成功' },
            isSuccess: { type: 'boolean', example: true },
            data: { $ref: 'sysUserStatusResponse#' }
          }
        },
        400: { $ref: 'errorResponse#' },
        401: { $ref: 'unauthorizedResponse#' },
        404: { $ref: 'errorResponse#' }
      }
    }
  }, async (
    request: FastifyRequest<{ Params: { id: string }, Body: { status: UserStatus } }>,
    reply: FastifyReply
  ) => {
    try {
      const updatedUser = await userService.changeUserStatus(
        parseInt(request.params.id), 
        request.body.status,
        request.user.id
      )
      
      return ResponseUtil.send(
        reply,
        request,
        updatedUser,
        '用户状态修改成功',
        UserBusinessCode.USER_STATUS_CHANGED
      )
    } catch (error) {
      fastify.log.error(error)
      
      if (error instanceof Error) {
        if (error.message.includes('不存在')) {
          return ResponseUtil.notFound(
            reply,
            request,
            error.message
          )
        }
      }
      
      return ResponseUtil.error(
        reply,
        request,
        error instanceof Error ? error.message : '服务器内部错误',
        UserBusinessCode.USER_UPDATE_FAILED,
        error
      )
    }
  })

  // 重置用户密码
  fastify.patch('/:id/password', {
    schema: {
      tags: ['sysUsers'],
      summary: '重置用户密码',
      description: '重置指定用户的密码',
      operationId: 'resetUserPassword',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'number', description: '用户ID' }
        }
      },
      body: {
        type: 'object',
        required: ['newPassword'],
        properties: {
          newPassword: { type: 'string', minLength: 6, description: '新密码' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 20023 },
            message: { type: 'string', example: '密码重置成功' }
          }
        },
        404: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 40410 },
            message: { type: 'string', example: '用户不存在' }
          }
        },
        400: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 40010 },
            message: { type: 'string', example: '密码长度不足' }
          }
        }
      }
    }
  }, async (
    request: FastifyRequest<{ Params: { id: number }, Body: { newPassword: string } }>,
    reply: FastifyReply
  ) => {
    try {
      await userService.resetPassword(request.params.id, request.body.newPassword)
      
      return ResponseUtil.send(
        reply,
        request,
        null,
        '密码重置成功',
        UserBusinessCode.PASSWORD_RESET_SUCCESS
      )
    } catch (error) {
      fastify.log.error(error)
      
      if (error instanceof Error) {
        if (error.message.includes('不存在')) {
          return ResponseUtil.notFound(
            reply,
            request,
            error.message
          )
        }
        if (error.message.includes('密码') && error.message.includes('长度')) {
          return ResponseUtil.error(
            reply,
            request,
            error.message,
            UserBusinessCode.INVALID_PASSWORD_FORMAT,
            error
          )
        }
      }
      
      return ResponseUtil.error(
        reply,
        request,
        error instanceof Error ? error.message : '服务器内部错误',
        UserBusinessCode.PASSWORD_CHANGE_FAILED,
        error
      )
    }
  })

  // 清除用户缓存
  fastify.delete('/cache', {
    schema: {
      tags: ['用户管理'],
      summary: '清除用户缓存',
      description: '清除所有用户相关的缓存数据',
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number' },
            message: { type: 'string' },
            data: { type: 'null' },
            timestamp: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            code: { type: 'number' },
            message: { type: 'string' },
            error: { type: 'string' },
            timestamp: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // 这里应该调用缓存清除服务
      // await CacheService.clearUserCache()
      
      return ResponseUtil.send(
        reply,
        request,
        null,
        '用户缓存清除成功',
        CommonBusinessCode.SUCCESS
      )
    } catch (error) {
      return ResponseUtil.error(
        reply,
        request,
        '清除用户缓存失败',
        CommonBusinessCode.INTERNAL_SERVER_ERROR,
        error as Error
      )
    }
  })
}
