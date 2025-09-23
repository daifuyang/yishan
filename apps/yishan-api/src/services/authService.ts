import { FastifyInstance } from 'fastify'
import { UserRepository } from '../repository/userRepository.js'
import { LoginDTO, AuthResponse } from '../domain/auth.js'

export class AuthService {
  private userRepository: UserRepository
  private passwordManager: FastifyInstance['passwordManager']
  private jwt: FastifyInstance['jwt']

  constructor(fastify: FastifyInstance) {
    this.userRepository = new UserRepository(fastify)
    this.passwordManager = fastify.passwordManager
    this.jwt = fastify.jwt
  }

  async login(data: LoginDTO): Promise<AuthResponse> {
    const { email, password } = data

    // 查找用户
    const user = await this.userRepository.findByEmail(email)
    if (!user) {
      throw new Error('用户不存在')
    }

    // 验证密码
    const isPasswordValid = await this.passwordManager.compare(password, user.password!)
    if (!isPasswordValid) {
      throw new Error('密码错误')
    }

    // 生成JWT token
    const payload = {
      id: user.id,
      email: user.email,
      username: user.username
    }

    const token = this.jwt.sign(payload)

    // 移除密码字段
    const { password: _, ...userWithoutPassword } = user

    return {
      user: userWithoutPassword,
      token
    }
  }

  async validateToken(token: string): Promise<any> {
    try {
      const decoded = this.jwt.verify(token)
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

    const { password: _, ...userWithoutPassword } = user
    return userWithoutPassword
  }
}