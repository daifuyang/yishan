import { FastifyInstance } from 'fastify'
import { RolePublic, CreateRoleDTO, UpdateRoleDTO, RoleQueryDTO, RoleStatus, RoleType } from '../domain/role.js'
import { Role, UserRole } from '../models/index.js'

const CACHE_PREFIX = 'role:'
const CACHE_TTL = 3600 // 1小时缓存

export class RoleRepository {
  private redis: FastifyInstance['redis']

  constructor(fastify: FastifyInstance) {
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
      console.error('清除缓存失败:', error)
    }
  }

  // 将完整角色信息转换为公开信息
  private toRolePublic(role: any): RolePublic {
    const { creatorId, updaterId, deletedAt, ...publicRole } = role;
    return publicRole as RolePublic;
  }

  // 将角色数组转换为公开信息数组
  private toRolesPublic(roles: any[]): RolePublic[] {
    return roles.map(role => this.toRolePublic(role));
  }

  /**
   * 创建角色
   * @param data 创建角色的数据
   * @returns 创建的角色信息
   */
  async create(data: CreateRoleDTO): Promise<RolePublic> {
    const cacheKey = `${CACHE_PREFIX}all`
    await this.invalidateCache(cacheKey)

    const createdRole = await Role.query().insert({
      roleName: data.roleName,
      roleDesc: data.roleDesc,
      status: data.status ?? RoleStatus.ENABLED,
      isSystem: data.type === RoleType.SYSTEM ? 1 : 0,
      sortOrder: data.sortOrder ?? 0,
      creatorId: data.creatorId
    })

    return this.toRolePublic(createdRole)
  }

  /**
   * 根据ID查找角色
   * @param id 角色ID
   * @returns 角色信息或null
   */
  async findById(id: number): Promise<RolePublic | null> {
    const cacheKey = `${CACHE_PREFIX}${id}`

    // 尝试从缓存获取
    const cached = await this.getCache<RolePublic>(cacheKey)
    if (cached) {
      return cached
    }

    const role = await Role.query().findById(id)
    if (!role) {
      return null
    }

    const publicRole = this.toRolePublic(role)
    await this.setCache(cacheKey, publicRole)
    return publicRole
  }

  /**
   * 根据角色名称查找角色
   * @param name 角色名称
   * @returns 角色信息或null
   */
  async findByName(name: string): Promise<RolePublic | null> {
    const cacheKey = `${CACHE_PREFIX}name:${name}`

    // 尝试从缓存获取
    const cached = await this.getCache<RolePublic>(cacheKey)
    if (cached) {
      return cached
    }

    const role = await Role.query().where('roleName', name).first()
    if (!role) {
      return null
    }

    const publicRole = this.toRolePublic(role)
    await this.setCache(cacheKey, publicRole, 1800) // 30分钟缓存
    return publicRole
  }

  /**
   * 根据角色编码查找角色
   * @param code 角色编码
   * @returns 角色信息或null
   */
  async findByCode(code: string): Promise<RolePublic | null> {
    const cacheKey = `${CACHE_PREFIX}code:${code}`

    // 尝试从缓存获取
    const cached = await this.getCache<RolePublic>(cacheKey)
    if (cached) {
      return cached
    }

    const role = await Role.query().where('roleName', code).first()
    if (!role) {
      return null
    }

    const publicRole = this.toRolePublic(role)
    await this.setCache(cacheKey, publicRole, 1800) // 30分钟缓存
    return publicRole
  }

  /**
   * 查找所有角色
   * @param query 查询条件
   * @returns 角色列表和总数
   */
  async findAll(query: RoleQueryDTO): Promise<{ roles: RolePublic[]; total: number; page: number; pageSize: number }> {
    const page = Math.max(1, query.page || 1)
    const pageSize = Math.max(1, Math.min(100, query.pageSize || 10))
    const offset = (page - 1) * pageSize

    let queryBuilder = Role.query().modify('notDeleted')

    // 添加搜索条件
    if (query.search) {
      queryBuilder = queryBuilder.where(function () {
        this.where('roleName', 'like', `%${query.search}%`)
          .orWhere('roleDesc', 'like', `%${query.search}%`)
      })
    }

    // 添加其他筛选条件
    if (query.id) queryBuilder = queryBuilder.where('id', query.id)
    if (query.roleName) queryBuilder = queryBuilder.where('roleName', 'like', `%${query.roleName}%`)
    if (query.code) queryBuilder = queryBuilder.where('roleName', 'like', `%${query.code}%`)
    if (query.status !== undefined) queryBuilder = queryBuilder.where('status', query.status)
    if (query.type) {
      const isSystemRole = query.type === RoleType.SYSTEM ? 1 : 0
      queryBuilder = queryBuilder.where('is_system', isSystemRole)
    }
    if (query.creatorId) queryBuilder = queryBuilder.where('creatorId', query.creatorId)

    // 排序 - 默认排序为更新时间，其次是排序字段，最后是id
    queryBuilder = queryBuilder
      .orderBy('isSystem', 'desc')
      .orderBy('sortOrder', 'asc')   // 排序字段升序
      .orderBy('updatedAt', 'desc')  // 更新时间倒序（最新的在前）
      .orderBy('id', 'asc')          // id升序作为最终排序

    // 分页查询
    const roles = await queryBuilder
      .clone()
      .limit(pageSize)
      .offset(offset)

    // 总数查询
    const total = await queryBuilder
      .clone()
      .resultSize()

    return {
      roles: this.toRolesPublic(roles),
      total,
      page,
      pageSize
    }
  }

  /**
   * 更新角色
   * @param id 角色ID
   * @param data 更新数据
   * @returns 更新后的角色信息或null
   */
  async update(id: number, data: UpdateRoleDTO): Promise<RolePublic | null> {
    const updateData: any = {
      updaterId: data.updaterId || null
    }

    // 使用与前端一致的字段名
    if (data.roleName !== undefined) updateData.roleName = data.roleName
    if (data.roleDesc !== undefined) updateData.roleDesc = data.roleDesc
    if (data.status !== undefined) updateData.status = data.status
    if (data.sortOrder !== undefined) updateData.sortOrder = Number(data.sortOrder)

    const updatedCount = await Role.query()
      .findById(id)
      .modify('notDeleted')
      .patch(updateData)

    if (updatedCount === 0) return null

    // 先清除缓存，确保不会返回旧数据
    await this.invalidateCache(`${CACHE_PREFIX}*`)

    // 直接从数据库获取最新数据，而不是通过findById可能会使用缓存
    const updatedRole = await Role.query().findById(id)
    if (!updatedRole) return null

    return this.toRolePublic(updatedRole)
  }

  /**
   * 删除角色（软删除）
   * @param id 角色ID
   * @param deleterId 删除者ID
   * @returns 是否删除成功
   */
  async delete(id: number, deleterId?: number): Promise<boolean> {
    const role = await Role.query().findById(id).modify('notDeleted')
    if (!role) return false

    await role.softDelete(deleterId)
    await this.invalidateCache(`${CACHE_PREFIX}*`)

    return true
  }

  /**
   * 根据用户ID查找角色
   * @param userId 用户ID
   * @returns 用户的角色列表
   */
  async findByUserId(userId: number): Promise<RolePublic[]> {
    const cacheKey = `${CACHE_PREFIX}user:${userId}`
    const cached = await this.getCache<RolePublic[]>(cacheKey)
    if (cached) return cached

    // 使用 join 而不是 joinRelated 来避免关联关系问题
    const roles = await Role.query()
      .join('sys_user_role', 'sys_role.id', 'sys_user_role.role_id')
      .where('sys_user_role.user_id', userId)
      .where('sys_user_role.status', 1) // 只查询启用的角色关联
      .whereNull('sys_role.deleted_at')
      .orderBy('sys_role.sort_order', 'asc')
      .orderBy('sys_role.id', 'asc')

    const publicRoles = this.toRolesPublic(roles)
    await this.setCache(cacheKey, publicRoles, 1800) // 30分钟缓存
    return publicRoles
  }

  /**
   * 为用户分配角色
   * @param userId 用户ID
   * @param roleIds 角色ID数组
   * @param assignedBy 分配者ID
   * @param expiresAt 过期时间
   * @returns 是否分配成功
   */
  async assignToUser(userId: number, roleIds: number[], assignedBy?: number, expiresAt?: string): Promise<boolean> {
    try {
      // 删除现有的角色分配
      await UserRole.query().delete().where('user_id', userId)

      // 插入新的角色分配
      const userRoles = roleIds.map(roleId => ({
        user_id: userId,
        role_id: roleId,
        status: 1,
        creator_id: assignedBy || null
      }))

      await UserRole.query().insert(userRoles)

      // 清除相关缓存
      await this.invalidateCache(`${CACHE_PREFIX}user:${userId}`)

      return true
    } catch (error) {
      return false
    }
  }

  /**
   * 移除用户的角色
   * @param userId 用户ID
   * @param roleIds 要移除的角色ID数组，如果为空则移除所有角色
   * @returns 是否移除成功
   */
  async removeFromUser(userId: number, roleIds?: number[]): Promise<boolean> {
    try {
      let query = UserRole.query().delete().where('userId', userId)

      if (roleIds && roleIds.length > 0) {
        query = query.whereIn('roleId', roleIds)
      }

      await query

      // 清除相关缓存
      await this.invalidateCache(`${CACHE_PREFIX}user:${userId}`)

      return true
    } catch (error) {
      return false
    }
  }

  /**
   * 清理角色相关缓存
   */
  async clearCache(): Promise<void> {
    await this.invalidateCache(`${CACHE_PREFIX}*`)
  }

  /**
   * 检查角色名称是否存在
   * @param name 角色名称
   * @param excludeId 排除的角色ID
   * @returns 是否存在
   */
  async existsByName(name: string, excludeId?: number): Promise<boolean> {
    let query = Role.query()
      .where('roleName', name)
      .modify('notDeleted')

    if (excludeId) {
      query = query.whereNot('id', excludeId)
    }

    const role = await query.first()
    return !!role
  }

  /**
   * 检查角色编码是否存在
   * @param code 角色编码
   * @param excludeId 排除的角色ID
   * @returns 是否存在
   */
  async existsByCode(code: string, excludeId?: number): Promise<boolean> {
    let query = Role.query()
      .where('roleName', code)
      .modify('notDeleted')

    if (excludeId) {
      query = query.whereNot('id', excludeId)
    }

    const role = await query.first()
    return !!role
  }
}