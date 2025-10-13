import { FastifyInstance } from 'fastify'
import { UserRepository } from '../repository/userRepository.js'
import { TokenRepository } from '../repository/tokenRepository.js'
import { LoginDTO, AuthResponse, JWTPayload, RefreshTokenResponse } from '../domain/auth.js'
import { UserStatus } from '../domain/user.js'
import { DateTimeUtil } from '../utils/datetime.js'

export class AuthService {
  private userRepository: UserRepository
  private tokenRepository: TokenRepository
  private fastify: FastifyInstance

  constructor(fastify: FastifyInstance) {
    this.userRepository = new UserRepository(fastify)
    this.tokenRepository = new TokenRepository(fastify)
    this.fastify = fastify
  }

  async login(data: LoginDTO, clientIp: string): Promise<AuthResponse> {
    const { username, email, password } = data

    // 确定登录标识符（优先使用用户名，其次使用邮箱）
    const identifier = username || email
    if (!identifier) {
      throw new Error('请提供用户名或邮箱')
    }

    // 查找用户（包含敏感信息用于验证）
    const user = await this.userRepository.findByUsernameOrEmail(identifier)
    if (!user) {
      throw new Error('用户不存在')
    }

    // 检查用户状态
    if (user.status === UserStatus.DISABLED) {
      throw new Error('账户已被禁用')
    }
    if (user.status === UserStatus.LOCKED) {
      throw new Error('账户已被锁定')
    }

    // 验证密码
    const isPasswordValid = await this.userRepository.verifyPassword(user, password)
    if (!isPasswordValid) {
      throw new Error('密码错误')
    }

    // 更新登录信息
    const now = DateTimeUtil.now()
    await this.userRepository.updateLoginInfo(user.id, {
      last_login_time: now,
      last_login_ip: clientIp,
      login_count: user.loginCount + 1
    })

    // 生成JWT payload
    const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
      id: user.id,
      email: user.email,
      username: user.username,
      real_name: user.realName,
      status: user.status
    }

    // 生成访问令牌（较短过期时间）
    const accessTokenExpiresIn = 60 * 60 // 1小时 后续改成配置的
    const accessTokenPayload = {
      ...payload,
      type: 'access',
      jti: `${user.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` // 添加唯一标识符
    }
    const accessToken = this.fastify.jwt.sign(accessTokenPayload, { expiresIn: accessTokenExpiresIn })

    // 生成刷新令牌（较长过期时间）
    const refreshTokenExpiresIn = 7 * 24 * 60 * 60 // 7天
    const refreshTokenPayload: any = {
      id: user.id,
      email: user.email,
      username: user.username,
      type: 'refresh',
      jti: `${user.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` // 添加唯一标识符
    }
    const refreshToken = this.fastify.jwt.sign(refreshTokenPayload, { expiresIn: refreshTokenExpiresIn })

    // 将token信息存储到数据库
    const accessTokenExpiresAt = new Date(Date.now() + accessTokenExpiresIn * 1000)
    const refreshTokenExpiresAt = new Date(Date.now() + refreshTokenExpiresIn * 1000)
    
    await this.tokenRepository.create({
      user_id: user.id,
      access_token: accessToken,
      refresh_token: refreshToken,
      access_token_expires_at: accessTokenExpiresAt,
      refresh_token_expires_at: refreshTokenExpiresAt,
      token_type: 'Bearer',
      client_ip: clientIp,
      user_agent: '', // 可以从请求头中获取
      is_revoked: false
    })

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresIn,
      refreshTokenExpiresIn,
      tokenType: 'Bearer'
    }
  }

  async validateToken(token: string): Promise<JWTPayload> {
    try {
      // 首先检查数据库中的access token是否有效
      const tokenValidation = await this.tokenRepository.validateAccessToken(token)
      if (!tokenValidation.isValid) {
        throw new Error(tokenValidation.reason || '无效的token')
      }

      const decoded = this.fastify.jwt.verify(token) as JWTPayload
      
      // 验证用户是否仍然存在且状态正常
      const user = await this.userRepository.findById(decoded.id)
      if (!user) {
        throw new Error('用户不存在')
      }
      
      if (user.status === UserStatus.DISABLED) {
        throw new Error('账户已被禁用')
      }
      
      if (user.status === UserStatus.LOCKED) {
        throw new Error('账户已被锁定')
      }

      return decoded
    } catch (error) {
      throw new Error('无效的token')
    }
  }

  async getCurrentUser(userId: number) {
    const user = await this.userRepository.findById(userId)
    if (!user) {
      throw new Error('用户不存在')
    }

    return user
  }

  async refreshToken(refreshToken: string, clientIp: string = ''): Promise<RefreshTokenResponse> {
    try {
      // 首先检查数据库中的refresh token是否有效
      const tokenValidation = await this.tokenRepository.validateRefreshToken(refreshToken)
      if (!tokenValidation.isValid) {
        throw new Error(tokenValidation.reason || '无效的刷新令牌')
      }

      // 验证refreshToken
      const decoded = this.fastify.jwt.verify(refreshToken) as any
      
      // 检查是否为refresh token
      if (decoded.type !== 'refresh') {
        throw new Error('无效的刷新令牌')
      }

      // 获取用户信息
      const user = await this.userRepository.findById(decoded.id)
      if (!user) {
        throw new Error('用户不存在')
      }

      // 检查用户状态
      if (user.status === UserStatus.DISABLED) {
        throw new Error('账户已被禁用')
      }
      if (user.status === UserStatus.LOCKED) {
        throw new Error('账户已被锁定')
      }

      // 生成新的accessToken (15分钟)
      const accessTokenExpiresIn = 15 * 60 // 15分钟
      const accessTokenPayload = {
        id: user.id,
        email: user.email,
        username: user.username,
        real_name: user.realName,
        status: user.status,
        type: 'access'
      }
      const accessToken = this.fastify.jwt.sign(accessTokenPayload, { expiresIn: accessTokenExpiresIn })

      // 生成新的refreshToken (7天)
      const refreshTokenExpiresIn = 7 * 24 * 60 * 60 // 7天
      const newRefreshTokenPayload = {
        id: user.id,
        email: user.email,
        username: user.username,
        type: 'refresh'
      }
      const newRefreshToken = this.fastify.jwt.sign(newRefreshTokenPayload as any, { expiresIn: refreshTokenExpiresIn })

      // 更新数据库中的token信息
      const accessTokenExpiresAt = new Date(Date.now() + accessTokenExpiresIn * 1000)
      const refreshTokenExpiresAt = new Date(Date.now() + refreshTokenExpiresIn * 1000)
      
      await this.tokenRepository.updateByRefreshToken(refreshToken, {
        access_token: accessToken,
        refresh_token: newRefreshToken,
        access_token_expires_at: accessTokenExpiresAt,
        refresh_token_expires_at: refreshTokenExpiresAt,
        client_ip: clientIp,
        updated_at: new Date()
      })

      return {
        accessToken,
        refreshToken: newRefreshToken,
        accessTokenExpiresIn,
        refreshTokenExpiresIn,
        tokenType: 'Bearer'
      }
    } catch (error) {
      throw new Error('刷新令牌失败: ' + (error as Error).message)
    }
  }

  async logout(userId: number, accessToken?: string): Promise<void> {
    try {
      if (accessToken) {
        // 撤销特定的token
        await this.tokenRepository.revokeByAccessToken(accessToken)
      } else {
        // 撤销用户的所有token
        await this.tokenRepository.revokeAllUserTokens(userId)
      }
    } catch (error) {
      // 记录错误但不抛出，确保logout操作总是成功
      console.error('Token revocation failed:', error)
    }
  }
}