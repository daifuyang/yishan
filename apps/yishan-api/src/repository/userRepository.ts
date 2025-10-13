import { FastifyInstance } from 'fastify'
import { randomBytes } from 'node:crypto'
import { 
  User, 
  UserPublic, 
  CreateUserDTO, 
  UpdateUserDTO, 
  UserQueryDTO, 
  UpdateLoginInfoDTO,
  UserStatus 
} from '../domain/user.js'
import { scryptHash, compare } from '../plugins/app/password-manager.js'
import { DateTimeUtil } from '../utils/datetime.js'

const CACHE_PREFIX = 'users:'
const CACHE_TTL = parseInt(process.env.CACHE_TTL || '3600')
const TABLE_NAME = 'sys_user'

export class UserRepository {
  private knex: FastifyInstance['knex']
  private redis: FastifyInstance['redis']

  constructor(fastify: FastifyInstance) {
    this.knex = fastify.knex
    this.redis = fastify.redis
  }

  private async getCache<T>(key: string): Promise<T | null> {
    try {
      const data = await this.redis.get(key)
      return data ? JSON.parse(data) : null
    } catch (error) {
      // 缓存读取失败不应影响主流程
      return null
    }
  }

  private async setCache(key: string, data: any, ttl?: number): Promise<void> {
    try {
      await this.redis.setex(key, ttl || CACHE_TTL, JSON.stringify(data))
    } catch (error) {
      // 缓存设置失败不应影响主流程
    }
  }

  private async invalidateCache(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern)
      if (keys.length > 0) {
        await this.redis.del(...keys)
      }
    } catch (error) {
      // 缓存清除失败不应影响主流程
    }
  }

  // 将完整用户信息转换为公开信息
  private toUserPublic(user: User): UserPublic {
    const { passwordHash, salt, deletedAt, version, creatorId, updaterId, ...publicUser } = user;
    return publicUser as UserPublic;
  }

  // 根据邮箱查找用户（包含敏感信息，用于认证）
  async findByEmail(email: string): Promise<User | null> {
    return this.knex(TABLE_NAME)
      .where({ email })
      .whereNull('deleted_at')
      .first()
  }

  // 根据用户名查找用户（包含敏感信息，用于认证）
  async findByUsername(username: string): Promise<User | null> {
    return this.knex(TABLE_NAME)
      .where({ username })
      .whereNull('deleted_at')
      .first()
  }

  // 根据ID查找用户（包含敏感信息，用于内部验证）
  async findByIdWithSensitiveInfo(id: number): Promise<User | null> {
    return this.knex(TABLE_NAME)
      .where({ id })
      .whereNull('deleted_at')
      .first()
  }

  // 根据用户名或邮箱查找用户（用于登录）
  async findByUsernameOrEmail(identifier: string): Promise<User | null> {
    return this.knex(TABLE_NAME)
      .where(function() {
        this.where('username', identifier).orWhere('email', identifier)
      })
      .whereNull('deleted_at')
      .first()
  }

  // 根据手机号查找用户（包含敏感信息，用于认证）
  async findByPhone(phone: string): Promise<User | null> {
    return this.knex(TABLE_NAME)
      .where({ phone })
      .whereNull('deleted_at')
      .first()
  }

  // 根据ID查找用户（返回公开信息）
  async findById(id: number): Promise<UserPublic | null> {
    const cacheKey = `${CACHE_PREFIX}user:${id}`
    const cachedUser = await this.getCache<UserPublic>(cacheKey)
    if (cachedUser) return cachedUser

    const user = await this.knex(TABLE_NAME)
      .where({ id })
      .whereNull('deleted_at')
      .first()
    
    if (user) {
      // 确保日期时间字段转换为ISO字符串格式
      const processedUser = {
        ...user,
        last_login_time: user.last_login_time ? DateTimeUtil.formatDateTime(user.last_login_time) : null,
        created_at: user.created_at ? DateTimeUtil.formatDateTime(user.created_at) : null,
        updated_at: user.updated_at ? DateTimeUtil.formatDateTime(user.updated_at) : null,
        birth_date: user.birth_date ? DateTimeUtil.formatDate(user.birth_date) : null
      };
      
      const publicUser = this.toUserPublic(processedUser)
      await this.setCache(cacheKey, publicUser)
      return publicUser
    }
    return null
  }

  // 根据搜索条件查找单个用户
  async findOneBySearch(search: string): Promise<UserPublic | null> {
    // 构建基础查询
    let query = this.knex(TABLE_NAME)
      .whereNull('deleted_at')
      .where(function() {
        this.where('username', 'like', `%${search}%`)
          .orWhere('email', 'like', `%${search}%`)
          .orWhere('real_name', 'like', `%${search}%`)
          .orWhere('phone', 'like', `%${search}%`)
      })
      .select([
        'id', 'username', 'email', 'phone', 'real_name', 'avatar', 
        'gender', 'birth_date', 'status', 'last_login_time', 'login_count',
        'created_at', 'updated_at'
      ])
      .orderBy('created_at', 'desc')
      .limit(1)
      .first()

    const user = await query
    
    if (user) {
      // 处理日期时间字段格式
      const processedUser = {
        ...user,
        last_login_time: user.last_login_time ? DateTimeUtil.formatDateTime(user.last_login_time) : null,
        created_at: user.created_at ? DateTimeUtil.formatDateTime(user.created_at) : null,
        updated_at: user.updated_at ? DateTimeUtil.formatDateTime(user.updated_at) : null,
        birth_date: user.birth_date ? DateTimeUtil.formatDate(user.birth_date) : null
      };
      
      return this.toUserPublic(processedUser)
    }
    return null
  }

  // 查询用户列表（支持分页和筛选）
  async findAll(query: UserQueryDTO): Promise<{ users: UserPublic[]; total: number; page: number; pageSize: number }> {
    const page = Math.max(1, query.page || 1)
    const pageSize = Math.max(1, Math.min(100, query.pageSize || 10))
    const offset = (page - 1) * pageSize
    const sortBy = query.sortBy || 'created_at'
    const sortOrder = query.sortOrder || 'desc'

    const cacheKey = `${CACHE_PREFIX}list:${JSON.stringify(query)}`
    const cached = await this.getCache<{ users: UserPublic[]; total: number; page: number; pageSize: number }>(cacheKey)
    if (cached) return cached

    // 构建基础查询
    let baseQuery = this.knex(TABLE_NAME)
      .whereNull('deleted_at')

    // 应用筛选条件
    if (query.id) baseQuery = baseQuery.where('id', query.id)
    if (query.status !== undefined) baseQuery = baseQuery.where('status', query.status)
    if (query.gender !== undefined) baseQuery = baseQuery.where('gender', query.gender)
    if (query.creatorId) baseQuery = baseQuery.where('creator_id', query.creatorId)

    // 应用统一搜索条件（模糊搜索用户名、邮箱、真实姓名、手机号）
    if (query.search) {
      baseQuery = baseQuery.where(function() {
        this.where('username', 'like', `%${query.search}%`)
          .orWhere('email', 'like', `%${query.search}%`)
          .orWhere('real_name', 'like', `%${query.search}%`)
          .orWhere('phone', 'like', `%${query.search}%`)
      })
    }
    if (query.email) baseQuery = baseQuery.where('email', 'like', `%${query.email}%`)
    if (query.realName) baseQuery = baseQuery.where('real_name', 'like', `%${query.realName}%`)
    if (query.phone) baseQuery = baseQuery.where('phone', 'like', `%${query.phone}%`)

    // 获取总数 - 使用独立的count查询
    const countResult = await baseQuery.clone().count('* as count').first()
    const total = parseInt((countResult as any)?.count as string)
    
    // 获取分页数据 - 使用独立的select查询
    const users = await baseQuery
      .clone()
      .select([
        'id', 'username', 'email', 'phone', 'real_name', 'avatar', 
        'gender', 'birth_date', 'status', 'last_login_time', 'login_count',
        'created_at', 'updated_at'
      ])
      .orderBy(sortBy, sortOrder)
      .limit(pageSize)
      .offset(offset)

    // 处理日期时间字段格式
    const processedUsers = users.map(user => ({
      ...user,
      last_login_time: user.last_login_time ? DateTimeUtil.formatDateTime(user.last_login_time) : null,
      created_at: user.created_at ? DateTimeUtil.formatDateTime(user.created_at) : null,
      updated_at: user.updated_at ? DateTimeUtil.formatDateTime(user.updated_at) : null,
      birth_date: user.birth_date ? DateTimeUtil.formatDate(user.birth_date) : null
    }));

    const result = { 
      users: processedUsers.map(user => {
        const { passwordHash, salt, deletedAt, version, creatorId, updaterId, ...publicUser } = user;
        return publicUser as UserPublic;
      }), 
      total, 
      page, 
      pageSize 
    }
    await this.setCache(cacheKey, result, 300) // 列表缓存时间较短
    return result
  }

  // 创建用户
  async create(data: CreateUserDTO): Promise<UserPublic> {
    // 生成随机salt并加密密码
    const salt = randomBytes(4).toString('hex')
    const passwordWithSalt = data.password + salt
    const passwordHash = await scryptHash(passwordWithSalt)

    const userData = {
      username: data.username,
      email: data.email,
      phone: data.phone || null,
      password_hash: passwordHash,
      salt: salt,
      real_name: data.realName,
      avatar: data.avatar || null,
      gender: data.gender || 0,
      birth_date: data.birthDate || null,
      status: data.status || UserStatus.ENABLED,
      login_count: 0,
      creator_id: data.creatorId || null,
      version: 1
    }

    const [userId] = await this.knex(TABLE_NAME).insert(userData)
    await this.invalidateCache(`${CACHE_PREFIX}*`)
    
    const newUser = await this.knex(TABLE_NAME).where({ id: userId }).first()
    
    // 处理日期时间字段格式
    const processedUser = {
      ...newUser,
      last_login_time: newUser.last_login_time ? DateTimeUtil.formatDateTime(newUser.last_login_time) : null,
      created_at: newUser.created_at ? DateTimeUtil.formatDateTime(newUser.created_at) : null,
      updated_at: newUser.updated_at ? DateTimeUtil.formatDateTime(newUser.updated_at) : null,
      birth_date: newUser.birth_date ? DateTimeUtil.formatDate(newUser.birth_date) : null
    };
    
    return this.toUserPublic(processedUser)
  }

  // 更新用户
  async update(id: number, data: UpdateUserDTO): Promise<UserPublic | null> {
    const updateData: any = {
      updated_at: this.knex.fn.now()
    }

    // 只更新提供的字段
    if (data.username !== undefined) updateData.username = data.username
    if (data.email !== undefined) updateData.email = data.email
    if (data.phone !== undefined) updateData.phone = data.phone
    if (data.realName !== undefined) updateData.real_name = data.realName
    if (data.avatar !== undefined) updateData.avatar = data.avatar
    if (data.gender !== undefined) updateData.gender = data.gender
    if (data.birthDate !== undefined) updateData.birth_date = data.birthDate
    if (data.status !== undefined) updateData.status = data.status
    if (data.updaterId !== undefined) updateData.updater_id = data.updaterId

    // 如果需要更新密码
    if (data.password) {
      const salt = randomBytes(4).toString('hex')
      const passwordWithSalt = data.password + salt
      const passwordHash = await scryptHash(passwordWithSalt)
      updateData.password_hash = passwordHash
      updateData.salt = salt
    }

    // 使用乐观锁更新
    const affectedRows = await this.knex(TABLE_NAME)
      .where({ id })
      .whereNull('deleted_at')
      .update({
        ...updateData,
        version: this.knex.raw('version + 1')
      })

    if (affectedRows === 0) return null

    await this.invalidateCache(`${CACHE_PREFIX}*`)
    const updatedUser = await this.knex(TABLE_NAME).where({ id }).first()
    
    // 处理日期时间字段格式
    const processedUser = {
      ...updatedUser,
      last_login_time: updatedUser.last_login_time ? DateTimeUtil.formatDateTime(updatedUser.last_login_time) : null,
      created_at: updatedUser.created_at ? DateTimeUtil.formatDateTime(updatedUser.created_at) : null,
      updated_at: updatedUser.updated_at ? DateTimeUtil.formatDateTime(updatedUser.updated_at) : null,
      birth_date: updatedUser.birth_date ? DateTimeUtil.formatDate(updatedUser.birth_date) : null
    };
    
    return this.toUserPublic(processedUser)
  }

  // 更新登录信息
  async updateLoginInfo(id: number, data: UpdateLoginInfoDTO): Promise<boolean> {
    const affectedRows = await this.knex(TABLE_NAME)
      .where({ id })
      .whereNull('deleted_at')
      .update({
        last_login_time: data.last_login_time,
        last_login_ip: data.last_login_ip,
        login_count: data.login_count,
        updated_at: this.knex.fn.now()
      })

    if (affectedRows > 0) {
      await this.invalidateCache(`${CACHE_PREFIX}user:${id}`)
      return true
    }
    return false
  }

  // 验证密码
  async verifyPassword(user: User, password: string): Promise<boolean> {
    const passwordWithSalt = password + user.salt
    return compare(passwordWithSalt, user.passwordHash)
  }

  // 软删除用户
  async delete(id: number, deleterId?: number): Promise<boolean> {
    // 先获取用户信息，用于后续更新唯一字段
    const user = await this.knex(TABLE_NAME)
      .where({ id })
      .whereNull('deleted_at')
      .first()
    
    if (!user) return false
    
    // 生成时间戳后缀，用于确保唯一性
    const timestamp = Date.now()
    
    const affectedRows = await this.knex(TABLE_NAME)
      .where({ id })
      .whereNull('deleted_at')
      .update({
        // 更新唯一字段，添加时间戳后缀
        username: `${user.username}_${timestamp}`,
        email: `${user.email}_${timestamp}`,
        phone: user.phone ? `${user.phone}_${timestamp}` : null,
        // 软删除标记
        deleted_at: this.knex.fn.now(),
        updater_id: deleterId || null,
        updated_at: this.knex.fn.now()
      })

    if (affectedRows > 0) {
      await this.invalidateCache(`${CACHE_PREFIX}*`)
      return true
    }
    return false
  }

  // 检查用户名是否存在
  async existsByUsername(username: string, excludeId?: number): Promise<boolean> {
    let query = this.knex(TABLE_NAME)
      .where({ username })
      .whereNull('deleted_at')

    if (excludeId) {
      query = query.whereNot('id', excludeId)
    }

    const user = await query.first()
    return !!user
  }

  // 检查邮箱是否存在
  async existsByEmail(email: string, excludeId?: number): Promise<boolean> {
    let query = this.knex(TABLE_NAME)
      .where({ email })
      .whereNull('deleted_at')

    if (excludeId) {
      query = query.whereNot('id', excludeId)
    }

    const user = await query.first()
    return !!user
  }

  // 检查手机号是否存在
  async existsByPhone(phone: string, excludeId?: number): Promise<boolean> {
    let query = this.knex(TABLE_NAME)
      .where({ phone })
      .whereNull('deleted_at')

    if (excludeId) {
      query = query.whereNot('id', excludeId)
    }

    const user = await query.first()
    return !!user
  }

  // 清除缓存
  async clearCache(): Promise<void> {
    await this.invalidateCache(`${CACHE_PREFIX}*`)
  }
}