import fp from 'fastify-plugin'
import fastifyJwt from '@fastify/jwt'
import { FastifyRequest, FastifyReply } from 'fastify'
import { ValidationErrorCode } from '../../../constants/business-codes/validation.js'
import { AuthErrorCode } from '../../../constants/business-codes/auth.js'
import { UserErrorCode } from '../../../constants/business-codes/user.js'
import { BusinessError } from '../../../exceptions/business-error.js'
import { JWT_CONFIG } from '../../../config/index.js'
import { UserTokenRepository } from '../../repositories/user-token.repository.js'
import { UserService } from '../../services/user.service.js'
import { ApiTokenRepository } from '../../repositories/api-token.repository.js'
import { SysUserResp } from '../../schemas/user.js'

export const autoConfig = {
  secret: JWT_CONFIG.secret,
  sign: {
    expiresIn: JWT_CONFIG.expiresIn
  },
  // 允许 jwtVerify() 在没有 Authorization header 时回退到 HttpOnly cookie 读取访问令牌。
  // cookie 内容即由 JWT 自签名校验，故 signed: false。
  cookie: {
    cookieName: 'yishan_at',
    signed: false
  },
  messages: {
    badRequestErrorMessage: '授权格式应为 Authorization: Bearer <访问令牌>',
    noAuthorizationInHeaderMessage: '请求未包含授权信息，请在请求头添加 Authorization: Bearer <访问令牌>',
    authorizationTokenExpiredMessage: '访问令牌已过期，请重新登录后重试',
    authorizationTokenInvalid: (err: Error) => `访问令牌无效，请重新登录后重试。原因：${err.message}`,
    authorizationTokenUnsigned: '访问令牌签名不合法，请重新登录获取新的令牌'
  }
}

/**
 * 从请求中提取 token（仅当来源是 header / cookie 时），并返回标准化错误（如果有）。
 * 失败时返回 { token: undefined, error: BusinessError }。
 * body.token 不在这里处理 —— softAuthenticate 独有的路径。
 */
function extractStandardToken(request: FastifyRequest): { token?: string } {
  const authHeader = request.headers.authorization
  if (authHeader) {
    if (!authHeader.startsWith('Bearer ')) {
      throw new BusinessError(
        ValidationErrorCode.PARAMETER_FORMAT_ERROR,
        '授权信息格式不正确，请使用 Authorization: Bearer <访问令牌>。'
      )
    }
    return { token: authHeader.substring(7) }
  }
  if (request.cookies?.yishan_at) {
    return { token: request.cookies.yishan_at }
  }
  return {}
}

/**
 * 校验 JWT 签名与有效性；将 fastify 的 jwtVerify 抛出的内部错误归一为 BusinessError。
 */
async function verifyJwtOrThrow(request: FastifyRequest): Promise<void> {
  try {
    await request.jwtVerify()
  } catch (jwtErr: any) {
    if (jwtErr.code === 'FAST_JWT_MALFORMED' || jwtErr.code === 'FAST_JWT_FORMAT_INVALID') {
      throw new BusinessError(
        AuthErrorCode.TOKEN_INVALID,
        '访问令牌格式不正确或已损坏，请重新登录获取新的令牌。'
      )
    }
    if (jwtErr.code === 'FAST_JWT_EXPIRED') {
      throw new BusinessError(
        AuthErrorCode.TOKEN_EXPIRED,
        '登录已过期，请重新登录获取新的访问令牌。'
      )
    }
    throw new BusinessError(AuthErrorCode.UNAUTHORIZED, '访问令牌无效，请重新登录后重试。')
  }
}

/**
 * 检查用户状态（禁用 / 锁定）。失败时抛 BusinessError。
 */
async function ensureUserAccessible(currentUser: SysUserResp): Promise<void> {
  if (currentUser.status === "0") {
    throw new BusinessError(
      UserErrorCode.USER_DISABLED,
      '账号已被禁用，无法访问。'
    )
  }
  if (currentUser.status === "2") {
    throw new BusinessError(
      AuthErrorCode.ACCOUNT_LOCKED,
      '账号已被锁定，请联系管理员。'
    )
  }
}

export default fp(async (fastify) => {
  fastify.register(fastifyJwt, autoConfig)

  /**
   * 标准 JWT 鉴权 preHandler。强制要求 access token 类型；token 必须存在于
   * sys_user_token 中且未被撤销。挂载 currentUser。
   */
  fastify.decorate('authenticate', async function(request: FastifyRequest, reply: FastifyReply) {
    const { token } = extractStandardToken(request)
    if (!token) {
      throw new BusinessError(
        AuthErrorCode.UNAUTHORIZED,
        '未登录或登录已失效，请在请求头中携带授权信息（Authorization: Bearer <访问令牌>）后重试。'
      )
    }

    // API Token (GitHub PAT style) 鉴权： opaque token 不能落入 JWT 校验分支
    if (token.startsWith('yishan_pat_')) {
      const apiToken = await ApiTokenRepository.findByRawToken(token)
      if (!apiToken) {
        throw new BusinessError(
          AuthErrorCode.API_TOKEN_NOT_FOUND,
          'API Token 不存在、已过期或已被撤销。'
        )
      }

      const currentUser = await UserService.getUserById(apiToken.userId)
      if (!currentUser) {
        throw new BusinessError(
          AuthErrorCode.API_TOKEN_REVOKED,
          'API Token 关联用户不存在或已不可用。'
        )
      }

      if (currentUser.status === "0" || currentUser.status === "2") {
        throw new BusinessError(
          AuthErrorCode.API_TOKEN_REVOKED,
          'API Token 关联用户已被禁用或锁定。'
        )
      }

      request.currentUser = currentUser
      // Section 2 — PAT 用户必须仅在 tokenScope 范围内有权限：
      // `requirePermission` 在校验时会与 role-based perms 取交集。
      ;(request as any).tokenScope = apiToken.scopes ?? []
      setImmediate(() => {
        ApiTokenRepository.touch(apiToken.id, request.ip ?? null).catch((err) => {
          request.log.warn({ err, apiTokenId: apiToken.id }, 'Failed to update API token last-used metadata')
        })
      })
      return
    }

    await verifyJwtOrThrow(request)

    // 标准 authenticate 仅接受 access_token；refresh token 必须走 /refresh。
    const userPayload = request.user
    if (userPayload?.type && userPayload.type !== 'access_token') {
      throw new BusinessError(
        AuthErrorCode.TOKEN_INVALID,
        '令牌类型不支持，仅支持访问令牌，请重新登录获取正确令牌。'
      )
    }

    const record = await UserTokenRepository.findByAccessToken(token)
    if (!record) {
      throw new BusinessError(
        AuthErrorCode.TOKEN_INVALID,
        '当前访问令牌已失效或已被注销，请重新登录。'
      )
    }

    const currentUser = await UserService.getUserById(record.userId)
    if (!currentUser) {
      throw new BusinessError(
        AuthErrorCode.TOKEN_INVALID,
        '当前用户不存在，请联系管理员处理。'
      )
    }

    await ensureUserAccessible(currentUser)
    request.currentUser = currentUser
  })

  /**
   * 软鉴权 preHandler —— 与 authenticate 等价的语义，但额外允许请求体中的 `token`
   * 字段作为 Authorization header 的回退来源，并且接受 refresh_token。
   * 专用于"鸡生蛋"类接口（如 logout）：
   * 客户端可能因为 access token 过期才想 logout，但当前实现要求请求头携带有效 token，
   * 导致无法撤销。softAuthenticate 支持：
   *   1. 标准 Authorization: Bearer <token> 头（优先级最高）
   *   2. HttpOnly cookie `yishan_at`（浏览器场景）
   *   3. 请求体 `{ token: "<token>" }`（API 客户端、过期 token 撤销场景）
   * 同时，access_token 与 refresh_token 均被接受 —— 用户可能凭未过期的 refresh token
   * 撤销整个会话。
   * 完全无 token 时抛 AuthErrorCode.UNAUTHORIZED。
   */
  fastify.decorate('softAuthenticate', async function(request: FastifyRequest, reply: FastifyReply) {
    let { token } = extractStandardToken(request)

    // 仅在没有任何"标准来源"（header / cookie）时，才尝试 body.token 回退。
    // 已在 header 中显式提供 token 时不会重复覆盖。
    if (!token) {
      const body = (request.body ?? {}) as { token?: unknown }
      if (body && typeof body.token === 'string' && body.token.length > 0) {
        token = body.token
        // @fastify/jwt 的 jwtVerify() 仅从 Authorization header / cookie 读取，
        // 因此手动注入 header 让下游签名校验复用。
        request.headers.authorization = `Bearer ${body.token}`
      }
    }

    if (!token) {
      throw new BusinessError(
        AuthErrorCode.UNAUTHORIZED,
        '未登录或登录已失效，请在请求头中携带授权信息（Authorization: Bearer <访问令牌>）后重试。'
      )
    }

    // API Token 路径：与标准 authenticate 完全一致。
    if (token.startsWith('yishan_pat_')) {
      const apiToken = await ApiTokenRepository.findByRawToken(token)
      if (!apiToken) {
        throw new BusinessError(
          AuthErrorCode.API_TOKEN_NOT_FOUND,
          'API Token 不存在、已过期或已被撤销。'
        )
      }
      const currentUser = await UserService.getUserById(apiToken.userId)
      if (!currentUser) {
        throw new BusinessError(
          AuthErrorCode.API_TOKEN_REVOKED,
          'API Token 关联用户不存在或已不可用。'
        )
      }
      if (currentUser.status === "0" || currentUser.status === "2") {
        throw new BusinessError(
          AuthErrorCode.API_TOKEN_REVOKED,
          'API Token 关联用户已被禁用或锁定。'
        )
      }
      request.currentUser = currentUser
      ;(request as any).tokenScope = apiToken.scopes ?? []
      setImmediate(() => {
        ApiTokenRepository.touch(apiToken.id, request.ip ?? null).catch((err) => {
          request.log.warn({ err, apiTokenId: apiToken.id }, 'Failed to update API token last-used metadata')
        })
      })
      return
    }

    await verifyJwtOrThrow(request)

    // softAuthenticate 接受 access_token 与 refresh_token 两种类型。
    // 根据 JWT payload 中的 type 字段选择对应的 DB 校验路径。
    const userPayload = request.user
    const isRefresh = userPayload?.type === 'refresh_token'
    const record = isRefresh
      ? await UserTokenRepository.findByRefreshToken(token)
      : await UserTokenRepository.findByAccessToken(token)
    if (!record) {
      throw new BusinessError(
        AuthErrorCode.TOKEN_INVALID,
        '当前令牌已失效或已被注销，请重新登录。'
      )
    }

    const currentUser = await UserService.getUserById(record.userId)
    if (!currentUser) {
      throw new BusinessError(
        AuthErrorCode.TOKEN_INVALID,
        '当前用户不存在，请联系管理员处理。'
      )
    }

    await ensureUserAccessible(currentUser)
    request.currentUser = currentUser
  })
}, {
  name: 'jwt-auth'
})

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
    /**
     * 软鉴权：与 authenticate 等价，但额外允许 body.token 作为 Authorization header 的回退，
     * 并接受 refresh_token。用于 logout 等"鸡生蛋"场景：客户端可能因 token 过期才想 logout。
     */
    softAuthenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

// 扩展 FastifyRequest 类型以包含错误上下文
declare module 'fastify' {
  interface FastifyRequest {
    currentUser: SysUserResp
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      id: number
      type: 'access_token' | 'refresh_token'  // 用于区分accessToken和refreshToken
    }
    user: {
      id: number
      type: 'access_token' | 'refresh_token'
    }
  }
}