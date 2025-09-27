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
      tags:['sysUsers'],
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
          real_name: { type: 'string', minLength: 1, maxLength: 100, description: '真实姓名' },
          avatar: { type: 'string', description: '头像URL' },
          gender: { type: 'number', enum: [0, 1, 2], description: '性别：0-未知，1-男，2-女' },
          birth_date: { type: 'string', format: 'date', description: '出生日期' },
          status: { type: 'number', enum: [0, 1, 2], description: '状态：0-禁用，1-启用，2-锁定' }
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
            code: { type: 'number', example: 400 },
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
    preHandler: fastify.authenticate,
    schema: {
      tags: ['sysUsers'],
      summary: '获取用户列表',
      description: '分页获取用户列表，支持搜索和筛选',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', minimum: 1, default: 1, description: '页码' },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 10, description: '每页数量' },
          search: { type: 'string', description: '搜索关键词（用户名、邮箱、真实姓名或手机号）' },
          status: { type: 'number', enum: [0, 1, 2], description: '用户状态筛选' },
          gender: { type: 'number', enum: [0, 1, 2], description: '性别筛选' },
          sortBy: { type: 'string', enum: ['id', 'username', 'email', 'real_name', 'created_at', 'last_login_time'], default: 'id', description: '排序字段' },
          sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc', description: '排序方向' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 200 },
            message: { type: 'string', example: '获取成功' },
            data: {
              type: 'object',
              properties: {
                users: {
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
                      gender: { type: 'number', description: '性别' },
                      birth_date: { type: 'string', description: '出生日期' },
                      status: { type: 'number', description: '状态' },
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
                    limit: { type: 'number', description: '每页数量' },
                    total: { type: 'number', description: '总数量' },
                    totalPages: { type: 'number', description: '总页数' }
                  }
                }
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
      return ResponseUtil.send(
        reply,
        request,
        result,
        '获取用户列表成功',
        UserBusinessCode.USER_LIST_SUCCESS
      )
    } catch (error) {
      fastify.log.error(error)
      return ResponseUtil.error(
        reply,
        request,
        '获取用户列表失败',
        UserBusinessCode.USER_LIST_FAILED,
        error
      )
    }
  })

  // 根据ID获取用户详情
  fastify.get('/:id', {
    schema: {
      tags:['sysUsers'],
      summary: '获取用户详情',
      description: '根据用户ID获取用户详细信息',
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
            code: { type: 'number', example: 200 },
            message: { type: 'string', example: '获取成功' },
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
            code: { type: 'number', example: 404 },
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
        '获取用户详情成功',
        UserBusinessCode.USER_DETAIL_SUCCESS
      )
    } catch (error) {
      fastify.log.error(error)
      return ResponseUtil.error(
        reply,
        request,
        '获取用户详情失败',
        UserBusinessCode.USER_DETAIL_FAILED,
        error
      )
    }
  })

  // 更新用户信息
  fastify.put('/:id', {
    preHandler: fastify.authenticate,
    schema: {
      tags:['sysUsers'],
      summary: '更新用户信息',
      description: '更新指定用户的信息',
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
            code: { type: 'number', example: 200 },
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
            code: { type: 'number', example: 404 },
            message: { type: 'string', example: '用户不存在' }
          }
        },
        409: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 409 },
            message: { type: 'string', example: '用户名或邮箱已存在' }
          }
        }
      }
    }
  }, async (
    request: FastifyRequest<{ Params: { id: number }, Body: UpdateUserDTO }>,
    reply: FastifyReply
  ) => {
    try {
      // 获取当前用户ID作为更新者
      const updaterId = request.user?.id
      const updatedUser = await userService.updateUser(request.params.id, request.body, updaterId)
      
      return ResponseUtil.send(
        reply,
        request,
        updatedUser,
        '用户信息更新成功',
        UserBusinessCode.USER_UPDATED
      )
    } catch (error) {
      fastify.log.error(error)
      
      if (error instanceof Error) {
        if (error.message.includes('不存在')) {
          return ResponseUtil.error(
            reply,
            request,
            error.message,
            UserBusinessCode.USER_NOT_FOUND,
            error
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
        
        if (error.message.includes('版本冲突')) {
          return ResponseUtil.error(
            reply,
            request,
            error.message,
            UserBusinessCode.USER_VERSION_CONFLICT,
            error
          )
        }
      }
      
      return ResponseUtil.error(
        reply,
        request,
        '用户信息更新失败',
        UserBusinessCode.USER_UPDATE_FAILED,
        error
      )
    }
  })

  // 删除用户（软删除）
  fastify.delete('/:id', {
    preHandler: fastify.authenticate,
    schema: {
      tags:['sysUsers'],
      summary: '删除用户',
      description: '软删除指定用户',
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
            code: { type: 'number', example: 200 },
            message: { type: 'string', example: '删除成功' }
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
    request: FastifyRequest<{ Params: { id: number } }>,
    reply: FastifyReply
  ) => {
    try {
      // 获取当前用户ID作为删除者
      const deleterId = request.user?.id
      await userService.deleteUser(request.params.id, deleterId)
      
      return ResponseUtil.send(
        reply,
        request,
        null,
        '用户删除成功',
        UserBusinessCode.USER_DELETED
      )
    } catch (error) {
      fastify.log.error(error)
      
      if (error instanceof Error) {
        if (error.message.includes('不存在')) {
          return ResponseUtil.error(
            reply,
            request,
            error.message,
            UserBusinessCode.USER_NOT_FOUND,
            error
          )
        }
      }
      
      return ResponseUtil.error(
        reply,
        request,
        '用户删除失败',
        UserBusinessCode.USER_DELETE_FAILED,
        error
      )
    }
  })

  // 修改用户状态
  fastify.patch('/:id/status', {
    preHandler: fastify.authenticate,
    schema: {
      tags:['sysUsers'],
      summary: '修改用户状态',
      description: '修改指定用户的状态',
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
            code: { type: 'number', example: 200 },
            message: { type: 'string', example: '状态修改成功' }
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
    request: FastifyRequest<{ Params: { id: number }, Body: { status: UserStatus } }>,
    reply: FastifyReply
  ) => {
    try {
      // 获取当前用户ID作为更新者
      const updaterId = request.user?.id
      await userService.changeUserStatus(request.params.id, request.body.status, updaterId)
      
      return ResponseUtil.send(
        reply,
        request,
        null,
        '用户状态修改成功',
        UserBusinessCode.USER_STATUS_CHANGED
      )
    } catch (error) {
      fastify.log.error(error)
      
      if (error instanceof Error) {
        if (error.message.includes('不存在')) {
          return ResponseUtil.error(
            reply,
            request,
            error.message,
            UserBusinessCode.USER_NOT_FOUND,
            error
          )
        }
      }
      
      return ResponseUtil.error(
        reply,
        request,
        '用户状态修改失败',
        UserBusinessCode.USER_STATUS_CHANGE_FAILED,
        error
      )
    }
  })

  // 重置用户密码
  fastify.patch('/:id/password', {
    preHandler: fastify.authenticate,
    schema: {
      tags:['sysUsers'],
      summary: '重置用户密码',
      description: '重置指定用户的密码',
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
            code: { type: 'number', example: 200 },
            message: { type: 'string', example: '密码重置成功' }
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
    request: FastifyRequest<{ Params: { id: number }, Body: { newPassword: string } }>,
    reply: FastifyReply
  ) => {
    try {
      // 获取当前用户ID作为更新者
      const updaterId = request.user?.id
      await userService.resetPassword(request.params.id, request.body.newPassword, updaterId)
      
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
          return ResponseUtil.error(
            reply,
            request,
            error.message,
            UserBusinessCode.USER_NOT_FOUND,
            error
          )
        }
      }
      
      return ResponseUtil.error(
        reply,
        request,
        '密码重置失败',
        UserBusinessCode.PASSWORD_RESET_FAILED,
        error
      )
    }
  })

  // 清除用户缓存
  fastify.delete('/cache', {
    preHandler: fastify.authenticate,
    schema: {
      tags:['sysUsers'],
      summary: '清除用户缓存',
      description: '清除所有用户相关的缓存',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 200 },
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
      
      return ResponseUtil.send(
        reply,
        request,
        null,
        '用户缓存清除成功',
        UserBusinessCode.CACHE_CLEARED
      )
    } catch (error) {
      fastify.log.error(error)
      return ResponseUtil.error(
        reply,
        request,
        '缓存清除失败',
        UserBusinessCode.CACHE_CLEAR_FAILED,
        error
      )
    }
  })
}
