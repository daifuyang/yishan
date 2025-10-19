import { FastifyInstance } from 'fastify';
import { AuthService } from '../../../services/authService.js'
import { UserService } from '../../../services/userService.js'
import { ErrorCode } from '../../../constants/business-code.js'
import { ResponseUtil } from '../../../utils/response.js'
import { LoginDTO, RefreshTokenDTO } from '../../../domain/auth.js'

export default async function authRoutes(fastify: FastifyInstance) {
  const authService = new AuthService(fastify)
  const userService = new UserService(fastify)

  // 用户登录
  fastify.post('/login', {
    schema: {
      operationId: 'userLogin',
      summary: '用户登录',
      description: '用户登录接口',
      tags: ['sysAuth'],
      body: {
        type: 'object',
        required: ['password'],
        properties: {
          username: { type: 'string', description: '用户名' },
          email: { type: 'string', format: 'email', description: '邮箱' },
          password: { type: 'string', minLength: 6, description: '密码' }
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
            code: { type: 'number', example: 10000 },
            message: { type: 'string', example: '登录成功' },
            data: { $ref: 'sysUserTokenResponse#' },
            success: { type: 'boolean', example: true },
            timestamp: { type: 'string', format: 'date-time' }
          }
        },
        400: { $ref: 'errorResponse#' },
        401: { $ref: 'unauthorizedResponse#' },
        500: { $ref: 'errorResponse#' }
      }
    },
    handler: async (request, reply) => {
      try {
        const loginData = request.body as LoginDTO
        const clientIp = request.ip || ''
        
        // 验证输入参数
        if (!loginData.username && !loginData.email) {
          return ResponseUtil.error(
            reply,
            request,
            ErrorCode.MISSING_PARAMETER,
            '请提供用户名或邮箱'
          )
        }
        
        if (!loginData.password) {
          return ResponseUtil.error(
            reply,
            request,
            ErrorCode.MISSING_PARAMETER,
            '请提供密码'
          )
        }
        
        const result = await authService.login(loginData, clientIp)
        
        return ResponseUtil.success(
          reply,
          request,
          result,
          '登录成功'
        )
      } catch (error) {
        fastify.log.error(error)
        
        if (error instanceof Error) {
          if (error.message.includes('用户不存在') || error.message.includes('user not found')) {
            return ResponseUtil.error(
              reply,
              request,
              ErrorCode.USER_NOT_FOUND,
              '用户不存在'
            )
          }
          if (error.message.includes('密码错误') || error.message.includes('invalid password')) {
            return ResponseUtil.error(
              reply,
              request,
              ErrorCode.INVALID_CREDENTIALS,
              '用户名或密码错误'
            )
          }
          if (error.message.includes('账户已被禁用')) {
            return ResponseUtil.error(
              reply,
              request,
              ErrorCode.USER_ACCOUNT_DISABLED,
              '账户已被禁用'
            )
          }
          if (error.message.includes('账户已被锁定')) {
            return ResponseUtil.error(
              reply,
              request,
              ErrorCode.USER_ACCOUNT_LOCKED,
              '账户已被锁定'
            )
          }
        }
        
        const errorMessage = error instanceof Error ? error.message : '登录失败'
        return ResponseUtil.error(
          reply,
          request,
          ErrorCode.SYSTEM_ERROR,
          errorMessage
        )
      }
    }
  })

  // 获取当前用户信息
  fastify.get('/me', {
    preHandler: fastify.authenticate,
    schema: {
      operationId: 'getCurrentUser',
      summary: '获取当前用户信息',
      description: '获取当前登录用户的详细信息',
      tags: ['sysAuth'],
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 10000 },
            message: { type: 'string', example: '获取用户信息成功' },
            data: { $ref: 'sysUser#' },
            success: { type: 'boolean', example: true },
            timestamp: { type: 'string', format: 'date-time' }
          }
        },
        401: { $ref: 'unauthorizedResponse#' },
        500: { $ref: 'errorResponse#' }
      }
    },
    handler: async (request, reply) => {
      try {
        const userId = (request.user as any).id
        const user = await userService.getUserById(userId)
        
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
          '获取用户信息成功'
        )
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '获取用户信息失败'
        return ResponseUtil.error(
          reply,
          request,
          ErrorCode.SYSTEM_ERROR,
          errorMessage
        )
      }
    }
  })

  // 刷新令牌
  fastify.post('/refresh', {
    schema: {
      operationId: 'refreshToken',
      summary: '刷新访问令牌',
      description: '使用刷新令牌获取新的访问令牌',
      tags: ['sysAuth'],
      body: { $ref: 'sysUserRefreshTokenRequest#' },
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 10000 },
            message: { type: 'string', example: '刷新令牌成功' },
            data: { $ref: 'sysUserTokenResponse#' },
            success: { type: 'boolean', example: true },
            timestamp: { type: 'string', format: 'date-time' }
          }
        },
        400: { $ref: 'errorResponse#' },
        401: { $ref: 'unauthorizedResponse#' },
        500: { $ref: 'errorResponse#' }
      }
    },
    handler: async (request, reply) => {
      try {
        const refreshTokenData = request.body as RefreshTokenDTO
        const clientIp = request.ip || ''
        
        const result = await authService.refreshToken(refreshTokenData.refresh_token, clientIp)
        
        return ResponseUtil.success(
          reply,
          request,
          result,
          '刷新令牌成功'
        )
      } catch (error) {
        fastify.log.error(error)
        
        const msg = error instanceof Error ? error.message : ''
        const lowered = msg.toLowerCase()
        const isAuthFailure = (
          msg.includes('无效') ||
          msg.includes('不存在') ||
          msg.includes('撤销') ||
          msg.includes('过期') ||
          lowered.includes('invalid') ||
          lowered.includes('expired') ||
          lowered.includes('revoked') ||
          lowered.includes('not found')
        )
        
        if (isAuthFailure) {
          return ResponseUtil.unauthorized(
            reply,
            request,
            '刷新令牌失败'
          )
        }
        
        const errorMessage = error instanceof Error ? msg : '令牌刷新失败'
        return ResponseUtil.error(
          reply,
          request,
          ErrorCode.SYSTEM_ERROR,
          errorMessage
        )
      }
    }
  })

  // 用户登出
  fastify.post('/logout', {
    preHandler: fastify.authenticate,
    schema: {
      operationId: 'userLogout',
      summary: '用户登出',
      description: '用户登出接口',
      tags: ['sysAuth'],
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number', example: 10000 },
            message: { type: 'string', example: '退出登录成功' },
            data: { type: 'null' },
            success: { type: 'boolean', example: true },
            timestamp: { type: 'string', format: 'date-time' }
          }
        },
        401: { $ref: 'unauthorizedResponse#' },
        500: { $ref: 'errorResponse#' }
      }
    },
    handler: async (request, reply) => {
      try {
        const userId = (request.user as any).id
        
        await authService.logout(userId)
        
        return ResponseUtil.success(
          reply,
          request,
          null,
          '退出登录成功'
        )
      } catch (error) {
        fastify.log.error(error)
        
        const errorMessage = error instanceof Error ? error.message : '登出失败'
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