import fp from 'fastify-plugin'
import fastifyJwt from '@fastify/jwt'
import { FastifyRequest, FastifyReply } from 'fastify'
import { ValidationErrorCode } from '../../constants/business-codes/validation.js'
import { AuthErrorCode } from '../../constants/business-codes/auth.js'
import { BusinessError } from '../../exceptions/business-error.js'
import { JWT_CONFIG } from '../../config/index.js'
import { SysUserTokenModel } from '../../models/user-token.model.js'

export const autoConfig = {
  secret: JWT_CONFIG.secret,
  sign: {
    expiresIn: JWT_CONFIG.expiresIn
  },
  messages: {
    badRequestErrorMessage: '授权格式应为 Authorization: Bearer <访问令牌>',
    noAuthorizationInHeaderMessage: '请求未包含授权信息，请在请求头添加 Authorization: Bearer <访问令牌>',
    authorizationTokenExpiredMessage: '访问令牌已过期，请重新登录后重试',
    authorizationTokenInvalid: (err: Error) => `访问令牌无效，请重新登录后重试。原因：${err.message}`,
    authorizationTokenUnsigned: '访问令牌签名不合法，请重新登录获取新的令牌'
  }
}

export default fp(async (fastify) => {
  fastify.register(fastifyJwt, autoConfig)

  // 添加JWT验证装饰器
  fastify.decorate('authenticate', async function(request: FastifyRequest, reply: FastifyReply) {
    // 检查Authorization头是否存在
    const authHeader = request.headers.authorization
    if (!authHeader) {
      throw new BusinessError(
        AuthErrorCode.UNAUTHORIZED,
        '未登录或登录已失效，请在请求头中携带授权信息（Authorization: Bearer <访问令牌>）后重试。'
      )
    }

    // 检查Bearer格式
    if (!authHeader.startsWith('Bearer ')) {
      throw new BusinessError(
        ValidationErrorCode.PARAMETER_FORMAT_ERROR,
        '授权信息格式不正确，请使用 Authorization: Bearer <访问令牌>。'
      )
    }

    const token = authHeader.substring(7)

    // 验证JWT签名与有效性
    try {
      await (request as any).jwtVerify()
    } catch (jwtErr: any) {
      // JWT格式错误或签名验证失败
      if (jwtErr.code === 'FAST_JWT_MALFORMED' || jwtErr.code === 'FAST_JWT_FORMAT_INVALID') {
        throw new BusinessError(
          AuthErrorCode.TOKEN_INVALID,
          '访问令牌格式不正确或已损坏，请重新登录获取新的令牌。'
        )
      }

      // Token过期
      if (jwtErr.code === 'FAST_JWT_EXPIRED') {
        throw new BusinessError(
          AuthErrorCode.TOKEN_EXPIRED,
          '登录已过期，请重新登录获取新的访问令牌。'
        )
      }

      // 其他JWT验证失败
      throw new BusinessError(AuthErrorCode.UNAUTHORIZED, '访问令牌无效，请重新登录后重试。')
    }

    // 仅允许访问令牌用于接口访问
    const userPayload = (request as any).user
    if (userPayload?.type && userPayload.type !== 'access_token') {
      throw new BusinessError(
        AuthErrorCode.TOKEN_INVALID,
        '令牌类型不支持，仅支持访问令牌，请重新登录获取正确令牌。'
      )
    }

    // 数据库中校验令牌未被撤销且仍有效
    const record = await SysUserTokenModel.findByAccessToken(token)
    if (!record) {
      throw new BusinessError(
        AuthErrorCode.TOKEN_INVALID,
        '当前访问令牌已失效或已被注销，请重新登录。'
      )
    }
  })
}, {
  name: 'jwt-auth'
})

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
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