import { FastifyInstance } from 'fastify'
import { UserRepository } from '../repository/userRepository.js'
import { CreateUserDTO, UpdateUserDTO, UserQueryDTO, User } from '../domain/user.js'

export class UserService {
  private userRepository: UserRepository
  private passwordManager: FastifyInstance['passwordManager']

  constructor(fastify: FastifyInstance) {
    this.userRepository = new UserRepository(fastify)
    this.passwordManager = fastify.passwordManager
  }

  async createUser(data: CreateUserDTO): Promise<User> {
    const existingUser = await this.userRepository.findByEmail(data.email)
    if (existingUser) {
      throw new Error('A user with this email already exists')
    }

    const hashedPassword = await this.passwordManager.hash(data.password)
    const newUser = await this.userRepository.create({ ...data, password: hashedPassword })
    
    // 移除返回对象中的密码
    const { password, ...userWithoutPassword } = newUser
    return userWithoutPassword as User
  }

  async getUserById(id: number): Promise<User | null> {
    const user = await this.userRepository.findById(id)
    if (!user) return null

    const { password, ...userWithoutPassword } = user
    return userWithoutPassword as User
  }

  async getUsers(query: UserQueryDTO): Promise<{ users: User[]; count: number }> {
    return this.userRepository.findAll(query)
  }

  async updateUser(id: number, data: UpdateUserDTO): Promise<User | null> {
    let updateData: Partial<UpdateUserDTO> & { password?: string } = { ...data }
    if (data.password) {
      updateData.password = await this.passwordManager.hash(data.password)
    }

    const updatedUser = await this.userRepository.update(id, updateData)
    if (!updatedUser) return null

    const { password, ...userWithoutPassword } = updatedUser
    return userWithoutPassword as User
  }

  async deleteUser(id: number): Promise<boolean> {
    return this.userRepository.delete(id)
  }

  async clearCache(): Promise<void> {
    return this.userRepository.clearCache()
  }
}