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
      tags: ['sysAuth'],
      summary: '用户登录',
      description: '使用用户名/邮箱和密码进行用户登录',
      body: {
        type: 'object',
        required: ['password'],
        properties: {
          username: { type: 'string', description: '用户名' },
          email: { type: 'string', format: 'email', description: '用户邮箱' },
          password: { type: 'string', minLength: 6, description: '用户密码' }
        },
        anyOf: [
          { required: ['username', 'password'] },
          { required: ['email', 'password'] }
        ]
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
                accessToken: { type: 'string', description: 'JWT访问令牌' },
                refreshToken: { type: 'string', description: 'JWT刷新令牌' },
                accessTokenExpiresIn: { type: 'number', description: '访问令牌过期时间（秒）', example: 900 },
                refreshTokenExpiresIn: { type: 'number', description: '刷新令牌过期时间（秒）', example: 604800 },
                tokenType: { type: 'string', example: 'Bearer', description: '令牌类型' }
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
      const result = await authService.login(request.body, request.ip)
      
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
      tags: ['sysAuth'],
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
                username: { type: 'string', description: '用户名' },
                email: { type: 'string', description: '用户邮箱' },
                phone: { type: 'string', description: '手机号' },
                real_name: { type: 'string', description: '真实姓名' },
                avatar: { type: 'string', description: '头像URL' },
                gender: { type: 'number', enum: [0, 1, 2], description: '性别：0-未知，1-男，2-女' },
                birth_date: { type: 'string', format: 'date', description: '出生日期' },
                status: { type: 'number', enum: [0, 1, 2], description: '状态：0-禁用，1-启用，2-锁定' },
                last_login_time: { type: 'string', format: 'date-time', description: '最后登录时间' },
                login_count: { type: 'number', description: '登录次数' },
                created_at: { type: 'string', format: 'date-time', description: '创建时间' },
                updated_at: { type: 'string', format: 'date-time', description: '更新时间' }
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
      const userId = request.user!.id
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
    schema: {
      tags: ['sysAuth'],
      summary: '刷新访问令牌',
      description: '使用refreshToken获取新的accessToken和refreshToken',
      body: {
        type: 'object',
        required: ['refreshToken'],
        properties: {
          refreshToken: { type: 'string', description: '刷新令牌' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 200 },
            message: { type: 'string', example: 'token刷新成功' },
            data: {
              type: 'object',
              properties: {
                accessToken: { type: 'string', description: '新的JWT访问令牌' },
                refreshToken: { type: 'string', description: '新的JWT刷新令牌' },
                accessTokenExpiresIn: { type: 'number', description: '访问令牌过期时间（秒）', example: 900 },
                refreshTokenExpiresIn: { type: 'number', description: '刷新令牌过期时间（秒）', example: 604800 },
                tokenType: { type: 'string', example: 'Bearer', description: '令牌类型' }
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
    request: FastifyRequest<{ Body: { refreshToken: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { refreshToken } = request.body
      const clientIp = request.ip // 获取客户端IP
      const tokenData = await authService.refreshToken(refreshToken, clientIp)
      
      return ResponseUtil.send(
        reply,
        request,
        tokenData,
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
      tags: ['sysAuth'],
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
      const userId = request.user!.id
      
      // 从Authorization头中提取accessToken
      const authHeader = request.headers.authorization
      let accessToken: string | undefined
      if (authHeader && authHeader.startsWith('Bearer ')) {
        accessToken = authHeader.substring(7) // 移除 'Bearer ' 前缀
      }
      
      // 调用AuthService的logout方法，传递userId和accessToken
      await authService.logout(userId, accessToken)
      
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