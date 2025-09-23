import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { UserService } from '../../../services/userService.js'
import { CreateUserDTO, UpdateUserDTO, UserQueryDTO } from '../../../domain/user.js'
import { ResponseUtil } from '../../../utils/response.js'
import { UserBusinessCode } from '../../../constants/business-code.js'

export default async function userRoutes(fastify: FastifyInstance) {
  const userService = new UserService(fastify)

  // 创建用户
  fastify.post('/users', {
    schema: {
      tags: ['User'],
      summary: '创建新用户',
      description: '创建一个新的用户账户',
      body: {
        type: 'object',
        required: ['email', 'username', 'password'],
        properties: {
          email: { type: 'string', format: 'email', description: '用户邮箱' },
          username: { type: 'string', minLength: 2, maxLength: 50, description: '用户名' },
          password: { type: 'string', minLength: 6, description: '用户密码' }
        }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 201 },
            message: { type: 'string', example: '用户创建成功' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'number', description: '用户ID' },
                email: { type: 'string', description: '用户邮箱' },
                username: { type: 'string', description: '用户名' },
                createdAt: { type: 'string', format: 'date-time', description: '创建时间' }
              }
            }
          }
        },
        400: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 400 },
            message: { type: 'string', example: '用户已存在' }
          }
        }
      }
    }
  }, async (
    request: FastifyRequest<{ Body: CreateUserDTO }>,
    reply: FastifyReply
  ) => {
    try {
      const newUser = await userService.createUser(request.body)
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
        if (error.message.includes('already exists')) {
          return ResponseUtil.error(
            reply,
            request,
            '用户已存在',
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

  // 获取所有用户（需要鉴权）
  fastify.get('/users', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['User'],
      summary: '获取用户列表',
      description: '获取所有用户的分页列表，支持搜索和过滤',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', minimum: 1, default: 1, description: '页码' },
          pageSize: { type: 'number', minimum: 1, maximum: 100, default: 20, description: '每页数量' },
          search: { type: 'string', description: '搜索关键词（用户名或邮箱）' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 200 },
            message: { type: 'string', example: '用户列表获取成功' },
            data: {
              type: 'object',
              properties: {
                list: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'number', description: '用户ID' },
                      email: { type: 'string', description: '用户邮箱' },
                      username: { type: 'string', description: '用户名' },
                      createdAt: { type: 'string', format: 'date-time', description: '创建时间' },
                      updatedAt: { type: 'string', format: 'date-time', description: '更新时间' }
                    }
                  }
                },
                total: { type: 'number', description: '总记录数' },
                page: { type: 'number', description: '当前页码' },
                pageSize: { type: 'number', description: '每页数量' }
              }
            }
          }
        }
      }
    }
  }, async (
    request: FastifyRequest<{ Querystring: UserQueryDTO }>,
    reply: FastifyReply
  ) => {
    try {
      const result = await userService.getUsers(request.query)
      
      // 处理分页响应
      if ('users' in result && 'total' in result) {
        const { users, total, page = 1, pageSize = 20 } = result as { users: any[], total: number, page?: number, pageSize?: number }
        return ResponseUtil.paginated(
          reply,
          request,
          users,
          total,
          page,
          pageSize,
          '用户列表获取成功',
          UserBusinessCode.USERS_RETRIEVED
        )
      }
      
      // 处理列表响应
      return ResponseUtil.list(
        reply,
        request,
        result.users || result,
        '用户列表获取成功',
        UserBusinessCode.USERS_RETRIEVED
      )
    } catch (error) {
      fastify.log.error(error)
      return ResponseUtil.error(
        reply,
        request,
        '用户获取失败',
        UserBusinessCode.USER_FETCH_FAILED,
        error
      )
    }
  })

  // 获取单个用户（需要鉴权）
  fastify.get('/users/:id', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['User'],
      summary: '获取用户详情',
      description: '根据用户ID获取单个用户的详细信息',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: '用户ID' }
        },
        required: ['id']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 200 },
            message: { type: 'string', example: '用户获取成功' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'number', description: '用户ID' },
                email: { type: 'string', description: '用户邮箱' },
                username: { type: 'string', description: '用户名' },
                createdAt: { type: 'string', format: 'date-time', description: '创建时间' },
                updatedAt: { type: 'string', format: 'date-time', description: '更新时间' }
              }
            }
          }
        },
        404: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 404 },
            message: { type: 'string', example: '用户不存在' }
          }
        }
      }
    }
  }, async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = parseInt(request.params.id)
      
      if (isNaN(userId)) {
        return ResponseUtil.error(
          reply,
          request,
          '无效的用户ID',
          UserBusinessCode.INVALID_USER_ID
        )
      }
      
      const user = await userService.getUserById(userId)
      
      if (!user) {
        return ResponseUtil.error(
          reply,
          request,
          '用户不存在',
          UserBusinessCode.USER_NOT_FOUND
        )
      }
      
      return ResponseUtil.send(
        reply,
        request,
        user,
        '用户获取成功',
        UserBusinessCode.USER_RETRIEVED
      )
    } catch (error) {
      fastify.log.error(error)
      return ResponseUtil.error(
        reply,
        request,
        '用户获取失败',
        UserBusinessCode.USER_FETCH_FAILED,
        error
      )
    }
  })

  // 更新用户信息（需要鉴权）
  fastify.put('/users/:id', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['User'],
      summary: '更新用户信息',
      description: '更新指定用户的信息（只能更新自己的信息）',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: '用户ID' }
        },
        required: ['id']
      },
      body: {
        type: 'object',
        properties: {
          username: { type: 'string', minLength: 2, maxLength: 50, description: '用户名' },
          email: { type: 'string', format: 'email', description: '用户邮箱' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 200 },
            message: { type: 'string', example: '用户更新成功' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'number', description: '用户ID' },
                email: { type: 'string', description: '用户邮箱' },
                username: { type: 'string', description: '用户名' },
                updatedAt: { type: 'string', format: 'date-time', description: '更新时间' }
              }
            }
          }
        },
        403: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 403 },
            message: { type: 'string', example: '没有权限更新其他用户信息' }
          }
        },
        404: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 404 },
            message: { type: 'string', example: '用户不存在' }
          }
        }
      }
    }
  }, async (
    request: FastifyRequest<{ Params: { id: string }; Body: UpdateUserDTO }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = parseInt(request.params.id)
      
      if (isNaN(userId)) {
        return ResponseUtil.error(
          reply,
          request,
          '无效的用户ID',
          UserBusinessCode.INVALID_USER_ID
        )
      }
      
      // 检查用户是否有权限更新（只能更新自己的信息或管理员）
      if (request.user.id !== userId) {
        return ResponseUtil.error(
          reply,
          request,
          '没有权限更新其他用户信息',
          UserBusinessCode.INVALID_CREDENTIALS
        )
      }
      
      const updatedUser = await userService.updateUser(userId, request.body)
      
      if (!updatedUser) {
        return ResponseUtil.error(
          reply,
          request,
          '用户不存在',
          UserBusinessCode.USER_NOT_FOUND
        )
      }
      
      return ResponseUtil.send(
        reply,
        request,
        updatedUser,
        '用户更新成功',
        UserBusinessCode.USER_UPDATED
      )
    } catch (error) {
      fastify.log.error(error)
      return ResponseUtil.error(
        reply,
        request,
        '用户更新失败',
        UserBusinessCode.USER_UPDATE_FAILED,
        error
      )
    }
  })

  // 删除用户（需要鉴权）
  fastify.delete('/users/:id', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['User'],
      summary: '删除用户',
      description: '删除指定用户（只能删除自己）',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: '用户ID' }
        },
        required: ['id']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 200 },
            message: { type: 'string', example: '用户删除成功' }
          }
        },
        403: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 403 },
            message: { type: 'string', example: '没有权限删除其他用户' }
          }
        },
        404: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 404 },
            message: { type: 'string', example: '用户不存在' }
          }
        }
      }
    }
  }, async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = parseInt(request.params.id)
      
      if (isNaN(userId)) {
        return ResponseUtil.error(
          reply,
          request,
          '无效的用户ID',
          UserBusinessCode.INVALID_USER_ID
        )
      }
      
      // 检查用户是否有权限删除（只能删除自己或管理员）
      if (request.user.id !== userId) {
        return ResponseUtil.error(
          reply,
          request,
          '没有权限删除其他用户',
          UserBusinessCode.INVALID_CREDENTIALS
        )
      }
      
      const isDeleted = await userService.deleteUser(userId)
      
      if (!isDeleted) {
        return ResponseUtil.error(
          reply,
          request,
          '用户不存在',
          UserBusinessCode.USER_NOT_FOUND
        )
      }
      
      return ResponseUtil.send(
        reply,
        request,
        null,
        '用户删除成功',
        UserBusinessCode.USER_DELETED
      )
    } catch (error) {
      fastify.log.error(error)
      return ResponseUtil.error(
        reply,
        request,
        '用户删除失败',
        UserBusinessCode.USER_DELETE_FAILED,
        error
      )
    }
  })

  // 清除缓存
  fastify.post('/users/cache/clear', {
    schema: {
      tags: ['User'],
      summary: '清除用户缓存',
      description: '清除所有与用户相关的缓存数据'
    }
  }, async (_request, reply) => {
    try {
      await userService.clearCache()
      return ResponseUtil.send(
        reply,
        _request,
        null,
        '缓存清除成功',
        UserBusinessCode.CACHE_CLEARED
      )
    } catch (error) {
      fastify.log.error(error)
      return ResponseUtil.error(
        reply,
        _request,
        '缓存清除失败',
        UserBusinessCode.CACHE_CLEAR_FAILED,
        error
      )
    }
  })
}
