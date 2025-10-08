import { FastifyInstance } from 'fastify'
import { UserRepository } from '../repository/userRepository.js'
import { CreateUserDTO, UpdateUserDTO, UserQueryDTO, UserPublic, UserStatus } from '../domain/user.js'

export class UserService {
  private userRepository: UserRepository

  constructor(fastify: FastifyInstance) {
    this.userRepository = new UserRepository(fastify)
  }

  async createUser(data: CreateUserDTO, creatorId?: number): Promise<UserPublic> {
    // 检查用户名是否已存在
    const existingUserByUsername = await this.userRepository.findByUsername(data.username)
    if (existingUserByUsername) {
      throw new Error('用户名已存在')
    }

    // 检查邮箱是否已存在
    const existingUserByEmail = await this.userRepository.findByEmail(data.email)
    if (existingUserByEmail) {
      throw new Error('邮箱已存在')
    }

    // 检查手机号是否已存在（如果提供了手机号）
    if (data.phone) {
      const existingUserByPhone = await this.userRepository.findByPhone(data.phone)
      if (existingUserByPhone) {
        throw new Error('手机号已存在')
      }
    }

    // 创建用户数据，包含创建者ID
    const createData: CreateUserDTO = {
      ...data,
      creatorId: creatorId,
      status: data.status || UserStatus.ENABLED
    }

    const newUser = await this.userRepository.create(createData)
    return newUser
  }

  async getUserById(id: number): Promise<UserPublic | null> {
    return this.userRepository.findById(id)
  }

  async getUsers(query: UserQueryDTO): Promise<{ users: UserPublic[]; total: number; page: number; pageSize: number }> {
    return this.userRepository.findAll(query)
  }

  async updateUser(id: number, data: UpdateUserDTO, updaterId?: number): Promise<UserPublic | null> {
    // 检查用户是否存在
    const existingUser = await this.userRepository.findById(id)
    if (!existingUser) {
      throw new Error('用户不存在')
    }

    // 如果更新用户名，检查是否与其他用户冲突
    if (data.username && data.username !== existingUser.username) {
      const userWithSameUsername = await this.userRepository.findByUsername(data.username)
      if (userWithSameUsername && userWithSameUsername.id !== id) {
        throw new Error('用户名已存在')
      }
    }

    // 如果更新邮箱，检查是否与其他用户冲突
    if (data.email && data.email !== existingUser.email) {
      const userWithSameEmail = await this.userRepository.findByEmail(data.email)
      if (userWithSameEmail && userWithSameEmail.id !== id) {
        throw new Error('邮箱已存在')
      }
    }

    // 如果更新手机号，检查是否与其他用户冲突
    if (data.phone && data.phone !== existingUser.phone) {
      const userWithSamePhone = await this.userRepository.findByPhone(data.phone)
      if (userWithSamePhone && userWithSamePhone.id !== id) {
        throw new Error('手机号已存在')
      }
    }

    // 添加更新者ID
    const updateData: UpdateUserDTO = {
      ...data,
      updaterId: updaterId
    }

    return this.userRepository.update(id, updateData)
  }

  async deleteUser(id: number, deleterId?: number): Promise<boolean> {
    // 检查用户是否存在
    const existingUser = await this.userRepository.findById(id)
    if (!existingUser) {
      throw new Error('用户不存在')
    }

    return this.userRepository.delete(id, deleterId)
  }

  async changeUserStatus(id: number, status: UserStatus, updaterId?: number): Promise<UserPublic | null> {
    return this.updateUser(id, { status }, updaterId)
  }

  async resetPassword(id: number, newPassword: string, updaterId?: number): Promise<boolean> {
    // 检查用户是否存在
    const existingUser = await this.userRepository.findById(id)
    if (!existingUser) {
      throw new Error('用户不存在')
    }

    const updateData: UpdateUserDTO = {
      password: newPassword,
      updaterId: updaterId
    }

    const result = await this.userRepository.update(id, updateData)
    return !!result
  }

  async getUserProfile(id: number): Promise<UserPublic | null> {
    return this.getUserById(id)
  }

  async updateUserProfile(id: number, data: Omit<UpdateUserDTO, 'status' | 'password'>): Promise<UserPublic | null> {
    // 用户只能更新自己的基本信息，不能更新状态和密码
    const updateData: UpdateUserDTO = {
      ...data,
      updaterId: id // 用户更新自己的信息
    }

    return this.updateUser(id, updateData, id)
  }

  async changePassword(id: number, oldPassword: string, newPassword: string): Promise<boolean> {
    // 获取用户完整信息（包含密码哈希）
    const user = await this.userRepository.findByIdWithSensitiveInfo(id)
    if (!user) {
      throw new Error('用户不存在')
    }
    
    // 验证旧密码
    const isOldPasswordValid = await this.userRepository.verifyPassword(user, oldPassword)
    if (!isOldPasswordValid) {
      throw new Error('原密码错误')
    }

    // 更新密码
    return this.resetPassword(id, newPassword, id)
  }

  async clearCache(): Promise<void> {
    return this.userRepository.clearCache()
  }

  /**
   * 根据邮箱查找用户
   * @param email - 用户邮箱
   * @returns 用户或null
   */
  async findByEmail(email: string): Promise<UserPublic | null> {
    const user = await this.userRepository.findByEmail(email)
    if (!user) return null
    return this.userRepository.findById(user.id)
  }

  /**
   * 根据手机号查找用户
   * @param phone - 手机号
   * @returns 用户或null
   */
  async findByPhone(phone: string): Promise<UserPublic | null> {
    const user = await this.userRepository.findByPhone(phone)
    if (!user) return null
    return this.userRepository.findById(user.id)
  }
}