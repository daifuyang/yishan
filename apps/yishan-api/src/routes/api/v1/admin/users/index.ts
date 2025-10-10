import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { UserService } from '../../../../../services/userService.js'
import { CreateUserDTO, UpdateUserDTO, UserQueryDTO, UserStatus } from '../../../../../domain/user.js'
import { ResponseUtil } from '../../../../../utils/response.js'
import { UserBusinessCode } from '../../../../../constants/business-code.js'

export default async function userRoutes(fastify: FastifyInstance) {
  const userService = new UserService(fastify)

  // 创建用户
  fastify.post('/', {
    schema: {
      tags: ['sysUsers'],
      summary: '创建新用户',
      description: '创建一个新的用户账户',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['email', 'username', 'password', 'real_name'],
        properties: {
          username: { type: 'string', minLength: 2, maxLength: 50, description: '用户名' },
          email: { type: 'string', format: 'email', description: '用户邮箱' },
          phone: { type: 'string', description: '手机号' },
          password: { type: 'string', minLength: 6, description: '用户密码' },
          realName: { type: 'string', minLength: 1, maxLength: 100, description: '真实姓名' },
                avatar: { type: 'string', description: '头像URL' },
                gender: { type: 'number', enum: [0, 1, 2], description: '性别：0-未知，1-男，2-女' },
                birthDate: { type: 'string', format: 'date', description: '出生日期' },
          status: { type: 'number', enum: [0, 1, 2], description: '状态：0-禁用，1-启用，2-锁定' }
        }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 20010 },
            message: { type: 'string', example: '用户创建成功' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'number', description: '用户ID' },
                username: { type: 'string', description: '用户名' },
                email: { type: 'string', description: '用户邮箱' },
                phone: { type: 'string', description: '手机号' },
                real_name: { type: 'string', description: '真实姓名' },
                avatar: { type: 'string', description: '头像URL' },
                gender: { type: 'number', description: '性别' },
                birth_date: { type: 'string', description: '出生日期' },
                status: { type: 'number', description: '状态' },
                created_at: { type: 'string', format: 'date-time', description: '创建时间' },
                updated_at: { type: 'string', format: 'date-time', description: '更新时间' }
              }
            }
          }
        },
        400: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 40011 },
            message: { type: 'string', example: '用户名已存在' }
          }
        }
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
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', minimum: 1, default: 1, description: '页码' },
          pageSize: { type: 'number', minimum: 1, maximum: 100, default: 10, description: '每页数量' },
          search: { type: 'string', description: '搜索关键词（支持用户名、邮箱、真实姓名、手机号模糊搜索）' },
          username: { type: 'string', description: '用户名筛选' },
          email: { type: 'string', description: '邮箱筛选' },
          real_name: { type: 'string', description: '真实姓名筛选' },
          phone: { type: 'string', description: '手机号筛选' },
          status: { type: 'number', enum: [0, 1, 2], description: '状态筛选：0-禁用，1-启用，2-锁定' },
          sort_by: { type: 'string', enum: ['id', 'username', 'email', 'real_name', 'created_at', 'updated_at', 'last_login_time', 'status'], default: 'created_at', description: '排序字段' },
          sort_order: { type: 'string', enum: ['asc', 'desc'], default: 'desc', description: '排序方向' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 20000 },
            message: { type: 'string', example: '操作成功' },
            data: {
              type: 'object',
              properties: {
                list: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'number', description: '用户ID' },
                      username: { type: 'string', description: '用户名' },
                      email: { type: 'string', description: '用户邮箱' },
                      phone: { type: 'string', description: '手机号' },
                      real_name: { type: 'string', description: '真实姓名' },
                      avatar: { type: 'string', description: '头像URL' },
                      gender: { type: 'number', description: '性别：0-未知，1-男，2-女' },
                      birth_date: { type: 'string', description: '出生日期' },
                      status: { type: 'number', description: '状态：0-禁用，1-启用，2-锁定' },
                      last_login_time: { type: 'string', format: 'date-time', description: '最后登录时间' },
                      last_login_ip: { type: 'string', description: '最后登录IP' },
                      login_count: { type: 'number', description: '登录次数' },
                      created_at: { type: 'string', format: 'date-time', description: '创建时间' },
                      updated_at: { type: 'string', format: 'date-time', description: '更新时间' }
                    }
                  }
                },
                pagination: {
                  type: 'object',
                  properties: {
                    page: { type: 'number', description: '当前页码' },
                    pageSize: { type: 'number', description: '每页条数' },
                    total: { type: 'number', description: '总记录数' },
                    totalPages: { type: 'number', description: '总页数' }
                  }
                }
              }
            }
          }
        },
        400: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 40010 },
            message: { type: 'string', example: '参数错误' }
          }
        }
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
        return reply.code(400).send({
          code: 40010,
          message: '无效的排序字段'
        })
      }

      // 验证排序方向
      if (validatedQuery.sortOrder && !['asc', 'desc'].includes(validatedQuery.sortOrder)) {
        return reply.code(400).send({
          code: 40010,
          message: '无效的排序方向'
        })
      }

      const result = await userService.getUsers(validatedQuery)

      return ResponseUtil.paginated(
        reply,
        request,
        result.users,
        result.total,
        result.page,
        result.pageSize,
        '获取用户列表成功'
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

  // 根据ID获取用户详情
  fastify.get('/:id', {
    schema: {
      tags: ['sysUsers'],
      summary: '获取用户详情',
      description: '根据用户ID获取用户详细信息',
      operationId: 'getUserDetail',
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
            code: { type: 'number', example: 20000 },
            message: { type: 'string', example: '获取成功' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'number', description: '用户ID' },
                username: { type: 'string', description: '用户名' },
                email: { type: 'string', description: '用户邮箱' },
                phone: { type: 'string', description: '手机号' },
                realName: { type: 'string', description: '真实姓名' },
                avatar: { type: 'string', description: '头像URL' },
                gender: { type: 'number', description: '性别：0-未知，1-男，2-女' },
                birthDate: { type: 'string', format: 'date', description: '出生日期' },
                status: { type: 'number', description: '状态：0-禁用，1-启用，2-锁定' },
                last_login_time: { type: 'string', format: 'date-time', description: '最后登录时间' },
                last_login_ip: { type: 'string', description: '最后登录IP' },
                login_count: { type: 'number', description: '登录次数' },
                created_at: { type: 'string', format: 'date-time', description: '创建时间' },
                updated_at: { type: 'string', format: 'date-time', description: '更新时间' }
              }
            }
          }
        },
        404: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 40010 },
            message: { type: 'string', example: '用户不存在' }
          }
        }
      }
    }
  }, async (
    request: FastifyRequest<{ Params: { id: number } }>,
    reply: FastifyReply
  ) => {
    try {
      const user = await userService.getUserById(request.params.id)
      
      if (!user) {
        return reply.code(404).send({
          code: 404,
          message: '用户不存在'
        })
      }
      
      return {
        code: 200,
        message: '获取成功',
        data: user
      }
    } catch (error) {
      fastify.log.error(error)
      return reply.code(500).send({
        code: 50000,
        message: error instanceof Error ? error.message : '服务器内部错误'
      })
    }
  })

  // 更新用户信息
  fastify.put('/:id', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['sysUsers'],
      summary: '更新用户信息',
      description: '更新指定用户的信息',
      operationId: 'updateUser',
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
        properties: {
          username: { type: 'string', minLength: 2, maxLength: 50, description: '用户名' },
          email: { type: 'string', format: 'email', description: '用户邮箱' },
          phone: { type: 'string', description: '手机号' },
          real_name: { type: 'string', minLength: 1, maxLength: 100, description: '真实姓名' },
          avatar: { type: 'string', description: '头像URL' },
          gender: { type: 'number', enum: [0, 1, 2], description: '性别：0-未知，1-男，2-女' },
          birth_date: { type: 'string', format: 'date', description: '出生日期' },
          status: { type: 'number', enum: [0, 1, 2], description: '状态：0-禁用，1-启用，2-锁定' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 20012 },
            message: { type: 'string', example: '更新成功' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'number', description: '用户ID' },
                username: { type: 'string', description: '用户名' },
                email: { type: 'string', description: '用户邮箱' },
                phone: { type: 'string', description: '手机号' },
                real_name: { type: 'string', description: '真实姓名' },
                avatar: { type: 'string', description: '头像URL' },
                gender: { type: 'number', description: '性别' },
                birth_date: { type: 'string', description: '出生日期' },
                status: { type: 'number', description: '状态' },
                updated_at: { type: 'string', format: 'date-time', description: '更新时间' }
              }
            }
          }
        },
        404: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 40010 },
            message: { type: 'string', example: '用户不存在' }
          }
        }
      }
    }
  }, async (
    request: FastifyRequest<{ Params: { id: number }, Body: UpdateUserDTO }>,
    reply: FastifyReply
  ) => {
    try {
      const user = await userService.updateUser(request.params.id, request.body)
      
      return {
        code: 200,
        message: '更新成功',
        data: user
      }
    } catch (error) {
      fastify.log.error(error)
      
      if (error instanceof Error) {
        if (error.message.includes('不存在')) {
          return reply.code(404).send({
            code: 404,
            message: error.message
          })
        }
        if (error.message.includes('已存在')) {
          return reply.code(400).send({
            code: 40010,
            message: error.message
          })
        }
      }
      
      return reply.code(500).send({
        code: 50000,
        message: error instanceof Error ? error.message : '服务器内部错误'
      })
    }
  })

  // 删除用户
  fastify.delete('/:id', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['sysUsers'],
      summary: '删除用户',
      description: '删除指定用户（软删除）',
      operationId: 'deleteUser',
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
            code: { type: 'number', example: 20014 },
            message: { type: 'string', example: '删除成功' }
          }
        },
        404: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 40010 },
            message: { type: 'string', example: '用户不存在' }
          }
        }
      }
    }
  }, async (
    request: FastifyRequest<{ Params: { id: number } }>,
    reply: FastifyReply
  ) => {
    try {
      await userService.deleteUser(request.params.id)
      
      return {
        code: 200,
        message: '删除成功'
      }
    } catch (error) {
      fastify.log.error(error)
      
      if (error instanceof Error && error.message.includes('不存在')) {
        return reply.code(404).send({
          code: 404,
          message: error.message
        })
      }
      
      return reply.code(500).send({
        code: 50000,
        message: error instanceof Error ? error.message : '服务器内部错误'
      })
    }
  })

  // 修改用户状态
  fastify.patch('/:id/status', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['sysUsers'],
      summary: '修改用户状态',
      description: '修改指定用户的状态',
      operationId: 'updateUserStatus',
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
        required: ['status'],
        properties: {
          status: { type: 'number', enum: [0, 1, 2], description: '状态：0-禁用，1-启用，2-锁定' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 20022 },
            message: { type: 'string', example: '状态修改成功' }
          }
        },
        404: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 40010 },
            message: { type: 'string', example: '用户不存在' }
          }
        }
      }
    }
  }, async (
    request: FastifyRequest<{ Params: { id: number }, Body: { status: UserStatus } }>,
    reply: FastifyReply
  ) => {
    try {
      await userService.changeUserStatus(request.params.id, request.body.status)
      
      return {
        code: 200,
        message: '用户状态修改成功'
      }
    } catch (error) {
      fastify.log.error(error)
      
      if (error instanceof Error) {
        if (error.message.includes('不存在')) {
          return reply.code(404).send({
            code: 404,
            message: error.message
          })
        }
      }
      
      return reply.code(500).send({
        code: 50000,
        message: error instanceof Error ? error.message : '服务器内部错误'
      })
    }
  })

  // 重置用户密码
  fastify.patch('/:id/password', {
    preHandler: fastify.authenticate,
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
            code: { type: 'number', example: 40010 },
            message: { type: 'string', example: '用户不存在' }
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
      
      return {
        code: 200,
        message: '密码重置成功'
      }
    } catch (error) {
      fastify.log.error(error)
      
      if (error instanceof Error) {
        if (error.message.includes('不存在')) {
          return reply.code(404).send({
            code: 404,
            message: error.message
          })
        }
      }
      
      return reply.code(500).send({
        code: 50000,
        message: error instanceof Error ? error.message : '服务器内部错误'
      })
    }
  })

  // 清除用户缓存
  fastify.delete('/cache', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['sysUsers'],
      summary: '清除用户缓存',
      description: '清除所有用户相关的缓存',
      operationId: 'clearUserCache',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 20024 },
            message: { type: 'string', example: '缓存清除成功' }
          }
        }
      }
    }
  }, async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      await userService.clearCache()
      
      return {
        code: 200,
        message: '用户缓存清除成功'
      }
    } catch (error) {
      fastify.log.error(error)
      return reply.code(500).send({
        code: 50000,
        message: error instanceof Error ? error.message : '服务器内部错误'
      })
    }
  })
}
