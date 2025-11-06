import fp from 'fastify-plugin'
import fastifyJwt from '@fastify/jwt'
import { ResponseUtil } from '../../utils/response.js'
import { ValidationErrorCode } from '../../constants/business-codes/validation.js'
import { AuthErrorCode } from '../../constants/business-codes/auth.js'
import { BusinessError } from '../../exceptions/business-error.js'
import { JWT_CONFIG } from '../../config/index.js'

export const autoConfig = {
  secret: JWT_CONFIG.secret,
  sign: {
    expiresIn: JWT_CONFIG.expiresIn
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
      if (!authHeader) {
        throw new BusinessError(ValidationErrorCode.VALIDATION_ERROR, 'Authorization头缺失')
      }

      // 检查Bearer格式
      if (!authHeader.startsWith('Bearer ')) {
        throw new BusinessError(ValidationErrorCode.VALIDATION_ERROR, 'Authorization头格式错误')
      }

      try {
        await request.jwtVerify()
      } catch (jwtErr: any) {
        // JWT格式错误或签名验证失败
        if (jwtErr.code === 'FAST_JWT_MALFORMED' || jwtErr.code === 'FAST_JWT_FORMAT_INVALID') {
          throw new BusinessError(AuthErrorCode.UNAUTHORIZED, 'Token格式非法')
        }
        
        // Token过期
        if (jwtErr.code === 'FAST_JWT_EXPIRED') {
          throw new BusinessError(AuthErrorCode.TOKEN_EXPIRED, 'Token已过期')
        }
        
        // 其他JWT验证失败
        throw new BusinessError(AuthErrorCode.UNAUTHORIZED, '无效的token')
      }
      
      // 注意：由于AuthService还未实现，暂时跳过数据库token验证
      // 后续需要实现AuthService后，可以添加以下代码：
      // const { AuthService } = await import('../services/authService.js')
      // const authService = new AuthService(fastify)
      // const token = authHeader.substring(7)
      // await authService.validateToken(token)
      
    } catch (err) {
      // 其他验证错误（如数据库验证失败）
      return ResponseUtil.error(
        reply,
        AuthErrorCode.UNAUTHORIZED,
        '无效的token'
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