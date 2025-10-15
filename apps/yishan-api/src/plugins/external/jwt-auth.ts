import fp from 'fastify-plugin'
import fastifyJwt from '@fastify/jwt'
import { ResponseUtil } from '../../utils/response.js'
import { UserBusinessCode } from '../../constants/business-code.js'

export const autoConfig = {
  secret: process.env.JWT_SECRET || 'your-secret-key-change-this-in-production',
  sign: {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  },
  messages: {
    badRequestErrorMessage: 'Format is Authorization: Bearer [token]',
    noAuthorizationInHeaderMessage: 'Autorization header is missing!',
    authorizationTokenExpiredMessage: 'Authorization token expired',
    authorizationTokenInvalid: (err: Error) => `Authorization token is invalid: ${err.message}`,
    authorizationTokenUnsigned: 'Authorization token unsigned'
  }
}

export default fp(async (fastify) => {
  fastify.register(fastifyJwt, autoConfig)

  // 添加JWT验证装饰器
  fastify.decorate('authenticate', async function(request: any, reply: any) {
    try {
      // 检查Authorization头是否存在且格式正确
      const authHeader = request.headers.authorization
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return ResponseUtil.error(
          reply,
          request,
          'Authorization头缺失或格式错误',
          UserBusinessCode.TOKEN_EXPIRED,
          null,
          400
        )
      }

      try {
        await request.jwtVerify()
      } catch (jwtErr: any) {
        // JWT格式错误或签名验证失败
        if (jwtErr.code === 'FAST_JWT_MALFORMED' || jwtErr.code === 'FAST_JWT_FORMAT_INVALID') {
          return ResponseUtil.error(
            reply,
            request,
            'Token格式非法',
            UserBusinessCode.TOKEN_EXPIRED,
            jwtErr,
            400
          )
        }
        
        // Token过期或签名验证失败
        return ResponseUtil.error(
          reply,
          request,
          '无效的token或token已过期',
          UserBusinessCode.TOKEN_EXPIRED,
          jwtErr,
          401
        )
      }
      
      // 使用AuthService验证token的数据库状态
      const { AuthService } = await import('../../services/authService.js')
      const authService = new AuthService(fastify)
      
      const token = authHeader.substring(7)
      // 验证token在数据库中的状态
      await authService.validateToken(token)
    } catch (err) {
      // 其他验证错误（如数据库验证失败）
      return ResponseUtil.error(
        reply,
        request,
        '无效的token或token已过期',
        UserBusinessCode.TOKEN_EXPIRED,
        err,
        401
      )
    }
  })
}, {
  name: 'jwt-auth'
})

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: any, reply: any) => Promise<void>
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      id: number
      email: string
      username: string
      real_name?: string
      status?: number
      type?: string  // 用于区分accessToken和refreshToken
    }
    user: {
      id: number
      email: string
      username: string
      real_name?: string
      status?: number
      type?: string  // 用于区分accessToken和refreshToken
    }
  }
}