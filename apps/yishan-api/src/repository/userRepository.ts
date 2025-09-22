import { FastifyInstance } from 'fastify'
import { User, CreateUserDTO, UpdateUserDTO, UserQueryDTO } from '../domain/user.js'

const CACHE_PREFIX = 'users:'
const CACHE_TTL = parseInt(process.env.CACHE_TTL || '3600')

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

  async findByEmail(email: string): Promise<User | null> {
    return this.knex('users').where({ email }).first()
  }

  async findById(id: number): Promise<User | null> {
    const cacheKey = `${CACHE_PREFIX}user:${id}`
    const cachedUser = await this.getCache<User>(cacheKey)
    if (cachedUser) return cachedUser

    const user = await this.knex('users').where({ id }).first()
    if (user) {
      await this.setCache(cacheKey, user)
    }
    return user
  }

  async findAll(query: UserQueryDTO): Promise<{ users: User[]; count: number }> {
    const cacheKey = `${CACHE_PREFIX}list:${JSON.stringify(query)}`
    const cached = await this.getCache<{ users: User[]; count: number }>(cacheKey)
    if (cached) return cached

    let dbQuery = this.knex('users').select('id', 'email', 'username', 'created_at')

    if (query.email) {
      dbQuery = dbQuery.where('email', 'like', `%${query.email}%`)
    }

    if (query.username) {
      dbQuery = dbQuery.where('username', 'like', `%${query.username}%`)
    }

    const users = await dbQuery.orderBy('created_at', 'desc')
    const result = { users, count: users.length }

    await this.setCache(cacheKey, result)
    return result
  }

  async create(data: CreateUserDTO): Promise<User> {
    const [userId] = await this.knex('users').insert(data)
    await this.invalidateCache(`${CACHE_PREFIX}*`)
    return this.knex('users').where({ id: userId }).first()
  }

  async update(id: number, data: UpdateUserDTO): Promise<User | null> {
    const affectedRows = await this.knex('users').where({ id }).update(data)
    if (affectedRows === 0) return null

    await this.invalidateCache(`${CACHE_PREFIX}*`)
    return this.knex('users').where({ id }).first()
  }

  async delete(id: number): Promise<boolean> {
    const affectedRows = await this.knex('users').where({ id }).del()
    if (affectedRows > 0) {
      await this.invalidateCache(`${CACHE_PREFIX}*`)
      return true
    }
    return false
  }

  async clearCache(): Promise<void> {
    await this.invalidateCache(`${CACHE_PREFIX}*`)
  }
}