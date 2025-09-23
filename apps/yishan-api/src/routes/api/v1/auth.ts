import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { AuthService } from '../../../services/authService.js'
import { LoginDTO } from '../../../domain/auth.js'
import { ResponseUtil } from '../../../utils/response.js'
import { UserBusinessCode } from '../../../constants/business-code.js'

export default async function authRoutes(fastify: FastifyInstance) {
  const authService = new AuthService(fastify)

  // 用户登录
  fastify.post('/auth/login', {
    schema: {
      tags: ['Auth'],
      summary: '用户登录',
      description: '使用邮箱和密码进行用户登录',
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', description: '用户邮箱' },
          password: { type: 'string', minLength: 6, description: '用户密码' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 200 },
            message: { type: 'string', example: '登录成功' },
            data: {
              type: 'object',
              properties: {
                token: { type: 'string', description: 'JWT访问令牌' },
                user: {
                  type: 'object',
                  properties: {
                    id: { type: 'number', description: '用户ID' },
                    email: { type: 'string', description: '用户邮箱' },
                    username: { type: 'string', description: '用户名' }
                  }
                }
              }
            }
          }
        },
        400: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 400 },
            message: { type: 'string', example: '登录失败' }
          }
        },
        401: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 401 },
            message: { type: 'string', example: '密码错误' }
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
    request: FastifyRequest<{ Body: LoginDTO }>,
    reply: FastifyReply
  ) => {
    try {
      const result = await authService.login(request.body)
      
      return ResponseUtil.send(
        reply,
        request,
        result,
        '登录成功',
        UserBusinessCode.USER_LOGIN_SUCCESS
      )
    } catch (error) {
      fastify.log.error(error)
      
      const errorMessage = error instanceof Error ? error.message : '登录失败'
      const errorCode = errorMessage === '用户不存在' 
        ? UserBusinessCode.USER_NOT_FOUND 
        : errorMessage === '密码错误' 
        ? UserBusinessCode.INVALID_CREDENTIALS
        : UserBusinessCode.USER_LOGIN_FAILED

      return ResponseUtil.error(
        reply,
        request,
        errorMessage,
        errorCode,
        error
      )
    }
  })

  // 获取当前用户信息（需要鉴权）
  fastify.get('/auth/me', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['Auth'],
      summary: '获取当前用户信息',
      description: '获取当前登录用户的详细信息',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 200 },
            message: { type: 'string', example: '获取用户信息成功' },
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
        401: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 401 },
            message: { type: 'string', example: '未授权访问' }
          }
        }
      }
    }
  }, async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const userId = request.user.id
      const user = await authService.getCurrentUser(userId)
      
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
        '获取用户信息失败',
        UserBusinessCode.USER_FETCH_FAILED,
        error
      )
    }
  })

  // 刷新token
  fastify.post('/auth/refresh', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['Auth'],
      summary: '刷新访问令牌',
      description: '使用当前有效的令牌获取新的访问令牌',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 200 },
            message: { type: 'string', example: 'token刷新成功' },
            data: {
              type: 'object',
              properties: {
                token: { type: 'string', description: '新的JWT访问令牌' }
              }
            }
          }
        },
        401: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 401 },
            message: { type: 'string', example: '未授权访问' }
          }
        }
      }
    }
  }, async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const userId = request.user.id
      const user = await authService.getCurrentUser(userId)
      
      const payload = {
        id: user.id,
        email: user.email,
        username: user.username
      }
      
      const newToken = fastify.jwt.sign(payload)
      
      return ResponseUtil.send(
        reply,
        request,
        { token: newToken },
        'token刷新成功',
        UserBusinessCode.USER_PROFILE_UPDATED
      )
    } catch (error) {
      fastify.log.error(error)
      return ResponseUtil.error(
        reply,
        request,
        'token刷新失败',
        UserBusinessCode.TOKEN_GENERATION_FAILED,
        error
      )
    }
  })

  // 退出登录
  fastify.post('/auth/logout', {
    preHandler: fastify.authenticate,
    schema: {
      tags: ['Auth'],
      summary: '用户登出',
      description: '用户退出登录状态',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 200 },
            message: { type: 'string', example: '退出登录成功' },
            data: { type: 'null' }
          }
        },
        401: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 401 },
            message: { type: 'string', example: '未授权访问' }
          }
        }
      }
    }
  }, async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      // 在实际应用中，这里可以将token加入黑名单
      return ResponseUtil.send(
        reply,
        request,
        null,
        '退出登录成功',
        UserBusinessCode.USER_LOGOUT_SUCCESS
      )
    } catch (error) {
      fastify.log.error(error)
      return ResponseUtil.error(
        reply,
        request,
        '退出登录失败',
        UserBusinessCode.USER_LOGOUT_FAILED,
        error
      )
    }
  })
}