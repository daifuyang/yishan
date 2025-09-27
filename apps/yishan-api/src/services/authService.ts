import { FastifyInstance } from 'fastify'
import { UserRepository } from '../repository/userRepository.js'
import { LoginDTO, AuthResponse, JWTPayload, RefreshTokenResponse } from '../domain/auth.js'
import { UserStatus } from '../domain/user.js'
import { DateTimeUtil } from '../utils/datetime.js'

export class AuthService {
  private userRepository: UserRepository
  private fastify: FastifyInstance

  constructor(fastify: FastifyInstance) {
    this.userRepository = new UserRepository(fastify)
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
      login_count: user.login_count + 1
    })

    // 生成JWT payload
    const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
      id: user.id,
      email: user.email,
      username: user.username,
      real_name: user.real_name,
      status: user.status
    }

    // 生成访问令牌（较短过期时间）
    const accessTokenExpiresIn = 15 * 60 // 15分钟
    const accessTokenPayload = {
      ...payload,
      type: 'access'
    }
    const accessToken = this.fastify.jwt.sign(accessTokenPayload, { expiresIn: accessTokenExpiresIn })

    // 生成刷新令牌（较长过期时间）
    const refreshTokenExpiresIn = 7 * 24 * 60 * 60 // 7天
    const refreshTokenPayload: any = {
      id: user.id,
      email: user.email,
      username: user.username,
      type: 'refresh'
    }
    const refreshToken = this.fastify.jwt.sign(refreshTokenPayload, { expiresIn: refreshTokenExpiresIn })

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

  async refreshToken(refreshToken: string): Promise<RefreshTokenResponse> {
    try {
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

      // 生成accessToken (15分钟)
      const accessTokenPayload = {
        id: user.id,
        email: user.email,
        username: user.username,
        type: 'access'
      }
      const accessToken = this.fastify.jwt.sign(accessTokenPayload, { expiresIn: '15m' })

      // 生成refreshToken (7天)
      const newRefreshTokenPayload = {
        id: user.id,
        email: user.email,
        username: user.username,
        type: 'refresh'
      }
      const newRefreshToken = this.fastify.jwt.sign(newRefreshTokenPayload as any, { expiresIn: '7d' })

      return {
      accessToken,
      refreshToken: newRefreshToken,
      accessTokenExpiresIn: 15 * 60, // 15分钟
      refreshTokenExpiresIn: 7 * 24 * 60 * 60, // 7天
      tokenType: 'Bearer'
    }
    } catch (error) {
      throw new Error('刷新令牌失败: ' + (error as Error).message)
    }
  }

  async logout(userId: number): Promise<void> {
    // 这里可以实现token黑名单机制
    // 目前只是简单的返回成功
    // 实际项目中可能需要将token加入黑名单或者使用Redis存储
    return
  }
}