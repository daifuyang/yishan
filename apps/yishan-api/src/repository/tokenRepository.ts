import { FastifyInstance } from 'fastify'
import { UserToken, CreateTokenDTO, UpdateTokenDTO, TokenQueryDTO, TokenValidationResult } from '../domain/token.js'
import { DateTimeUtil } from '../utils/datetime.js'

const TABLE_NAME = 'sys_user_token'
const CACHE_PREFIX = 'token:'
const CACHE_TTL = 3600 // 1小时缓存

export class TokenRepository {
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

  // 创建新的令牌记录
  async create(data: CreateTokenDTO): Promise<UserToken> {
    const now = DateTimeUtil.now()
    const tokenData = {
      ...data,
      token_type: data.token_type || 'Bearer',
      is_revoked: false,
      created_at: now,
      updated_at: now
    }

    const [id] = await this.knex(TABLE_NAME).insert(tokenData)
    const newToken = await this.knex(TABLE_NAME).where({ id }).first()
    
    if (!newToken) {
      throw new Error('创建令牌失败')
    }

    // 缓存新创建的令牌
    await this.setCache(`${CACHE_PREFIX}${id}`, newToken)
    
    return newToken
  }

  // 根据ID查找令牌
  async findById(id: number): Promise<UserToken | null> {
    const cacheKey = `${CACHE_PREFIX}${id}`
    const cachedToken = await this.getCache<UserToken>(cacheKey)
    if (cachedToken) return cachedToken

    const token = await this.knex(TABLE_NAME)
      .where({ id })
      .first()
    
    if (token) {
      await this.setCache(cacheKey, token)
      return token
    }
    return null
  }

  // 根据用户ID查找有效的令牌
  async findValidTokensByUserId(userId: number): Promise<UserToken[]> {
    const now = DateTimeUtil.now()
    
    return this.knex(TABLE_NAME)
      .where({ user_id: userId, is_revoked: false })
      .where('access_token_expires_at', '>', now)
      .orderBy('created_at', 'desc')
  }

  // 根据访问令牌查找令牌记录
  async findByAccessToken(accessToken: string): Promise<UserToken | null> {
    return this.knex(TABLE_NAME)
      .where({ access_token: accessToken })
      .first()
  }

  // 根据刷新令牌查找令牌记录
  async findByRefreshToken(refreshToken: string): Promise<UserToken | null> {
    return this.knex(TABLE_NAME)
      .where({ refresh_token: refreshToken })
      .first()
  }

  // 验证访问令牌
  async validateAccessToken(accessToken: string): Promise<TokenValidationResult> {
    const token = await this.findByAccessToken(accessToken)
    
    if (!token) {
      return { isValid: false, reason: '令牌不存在' }
    }

    if (token.is_revoked) {
      return { isValid: false, reason: '令牌已被撤销' }
    }

    const now = new Date()
    const expiresAt = new Date(token.access_token_expires_at)
    
    if (now > expiresAt) {
      return { isValid: false, reason: '令牌已过期' }
    }

    return { isValid: true, token }
  }

  // 验证刷新令牌
  async validateRefreshToken(refreshToken: string): Promise<TokenValidationResult> {
    const token = await this.findByRefreshToken(refreshToken)
    
    if (!token) {
      return { isValid: false, reason: '刷新令牌不存在' }
    }

    if (token.is_revoked) {
      return { isValid: false, reason: '刷新令牌已被撤销' }
    }

    const now = new Date()
    const expiresAt = new Date(token.refresh_token_expires_at)
    
    if (now > expiresAt) {
      return { isValid: false, reason: '刷新令牌已过期' }
    }

    return { isValid: true, token }
  }

  // 更新令牌
  async update(id: number, data: UpdateTokenDTO): Promise<UserToken | null> {
    const updateData = {
      ...data,
      updated_at: DateTimeUtil.now()
    }

    const affectedRows = await this.knex(TABLE_NAME)
      .where({ id })
      .update(updateData)

    if (affectedRows > 0) {
      // 清除缓存
      await this.invalidateCache(`${CACHE_PREFIX}${id}`)
      
      // 返回更新后的令牌
      return this.findById(id)
    }
    return null
  }

  // 撤销令牌
  async revokeToken(id: number): Promise<boolean> {
    const now = DateTimeUtil.now()
    const affectedRows = await this.knex(TABLE_NAME)
      .where({ id })
      .update({
        is_revoked: true,
        revoked_at: now,
        updated_at: now
      })

    if (affectedRows > 0) {
      await this.invalidateCache(`${CACHE_PREFIX}${id}`)
      return true
    }
    return false
  }

  // 撤销用户的所有令牌
  async revokeAllUserTokens(userId: number): Promise<number> {
    const now = DateTimeUtil.now()
    const affectedRows = await this.knex(TABLE_NAME)
      .where({ user_id: userId, is_revoked: false })
      .update({
        is_revoked: true,
        revoked_at: now,
        updated_at: now
      })

    // 清除相关缓存
    const tokens = await this.knex(TABLE_NAME)
      .select('id')
      .where({ user_id: userId })
    
    for (const token of tokens) {
      await this.invalidateCache(`${CACHE_PREFIX}${token.id}`)
    }

    return affectedRows
  }

  // 清理过期的令牌
  async cleanupExpiredTokens(): Promise<number> {
    const now = DateTimeUtil.now()
    
    // 删除访问令牌和刷新令牌都已过期的记录
    const expiredTokens = await this.knex(TABLE_NAME)
      .select('id')
      .where('access_token_expires_at', '<', now)
      .where('refresh_token_expires_at', '<', now)

    if (expiredTokens.length === 0) {
      return 0
    }

    // 清除缓存
    for (const token of expiredTokens) {
      await this.invalidateCache(`${CACHE_PREFIX}${token.id}`)
    }

    // 删除过期令牌
    const deletedCount = await this.knex(TABLE_NAME)
      .where('access_token_expires_at', '<', now)
      .where('refresh_token_expires_at', '<', now)
      .del()

    return deletedCount
  }

  // 查询令牌列表（支持分页和筛选）
  async findAll(query: TokenQueryDTO): Promise<{ tokens: UserToken[]; total: number; page: number; limit: number }> {
    const page = query.page || 1
    const limit = query.limit || 10
    const offset = (page - 1) * limit
    const sortBy = query.sort_by || 'created_at'
    const sortOrder = query.sort_order || 'desc'

    let dbQuery = this.knex(TABLE_NAME)
      .select('*')

    // 应用筛选条件
    if (query.user_id) dbQuery = dbQuery.where('user_id', query.user_id)
    if (query.is_revoked !== undefined) dbQuery = dbQuery.where('is_revoked', query.is_revoked)

    // 获取总数
    const countQuery = dbQuery.clone().count('* as count').first()
    const countResult = await countQuery
    const total = parseInt((countResult as any)?.count as string)

    // 获取分页数据
    const tokens = await dbQuery
      .orderBy(sortBy, sortOrder)
      .limit(limit)
      .offset(offset)

    return { tokens, total, page, limit }
  }

  // 获取用户令牌统计信息
  async getUserTokenStats(userId: number): Promise<{
    total: number;
    active: number;
    revoked: number;
    expired: number;
  }> {
    const now = DateTimeUtil.now()
    
    const stats = await this.knex(TABLE_NAME)
      .where({ user_id: userId })
      .select(
        this.knex.raw('COUNT(*) as total'),
        this.knex.raw('SUM(CASE WHEN is_revoked = 0 AND access_token_expires_at > ? THEN 1 ELSE 0 END) as active', [now]),
        this.knex.raw('SUM(CASE WHEN is_revoked = 1 THEN 1 ELSE 0 END) as revoked'),
        this.knex.raw('SUM(CASE WHEN is_revoked = 0 AND access_token_expires_at <= ? THEN 1 ELSE 0 END) as expired', [now])
      )
      .first()

    return {
      total: parseInt(stats?.total || '0'),
      active: parseInt(stats?.active || '0'),
      revoked: parseInt(stats?.revoked || '0'),
      expired: parseInt(stats?.expired || '0')
    }
  }

  // 根据刷新令牌更新token信息
  async updateByRefreshToken(refreshToken: string, data: UpdateTokenDTO): Promise<UserToken | null> {
    const updateData = {
      ...data,
      updated_at: DateTimeUtil.now()
    }

    const affectedRows = await this.knex(TABLE_NAME)
      .where({ refresh_token: refreshToken })
      .update(updateData)

    if (affectedRows > 0) {
      // 返回更新后的令牌
      return this.findByRefreshToken(data.refresh_token || refreshToken)
    }
    return null
  }

  // 根据访问令牌撤销token
  async revokeByAccessToken(accessToken: string): Promise<boolean> {
    const now = DateTimeUtil.now()
    const affectedRows = await this.knex(TABLE_NAME)
      .where({ access_token: accessToken })
      .update({
        is_revoked: true,
        revoked_at: now,
        updated_at: now
      })

    return affectedRows > 0
  }
}