import { FastifyInstance } from 'fastify'
import { RoleRepository } from '../repository/roleRepository.js'
import { UserRepository } from '../repository/userRepository.js'
import { CreateRoleDTO, UpdateRoleDTO, RoleQueryDTO, RolePublic, RoleStatus, RoleType, AssignRoleDTO, AssignPermissionDTO } from '../domain/role.js'

export class RoleService {
  private roleRepository: RoleRepository
  private userRepository: UserRepository

  constructor(fastify: FastifyInstance) {
    this.roleRepository = new RoleRepository(fastify)
    this.userRepository = new UserRepository(fastify)
  }

  /**
   * 创建角色
   * @param data 创建角色的数据
   * @param creatorId 创建者ID
   * @returns 创建的角色信息
   */
  async createRole(data: CreateRoleDTO, creatorId?: number): Promise<RolePublic> {
    // 1. 验证角色数据的合法性
    if (!data.name || data.name.trim().length < 2) {
      throw new Error('角色名称不能为空且长度不能少于2个字符')
    }

    // 2. 检查角色名称是否已存在
    const existingRoleByName = await this.roleRepository.existsByName(data.name.trim())
    if (existingRoleByName) {
      throw new Error('角色名称已存在')
    }

    // 3. 准备创建数据
    const createData: CreateRoleDTO = {
      ...data,
      name: data.name.trim(),
      description: data.description?.trim() || null,
      type: data.type || RoleType.CUSTOM,
      status: data.status !== undefined ? data.status : RoleStatus.ENABLED,
      sortOrder: data.sortOrder || 0,
      creatorId: creatorId
    }

    // 4. 调用repository创建角色
    const newRole = await this.roleRepository.create(createData)
    return newRole
  }

  /**
   * 根据ID获取角色
   * @param id 角色ID
   * @returns 角色信息或null
   */
  async getRoleById(id: number): Promise<RolePublic | null> {
    if (!id || id <= 0) {
      throw new Error('无效的角色ID')
    }
    
    return this.roleRepository.findById(id)
  }

  /**
   * 获取角色列表
   * @param query 查询条件
   * @returns 角色列表和分页信息
   */
  async getRoles(query: RoleQueryDTO): Promise<{ roles: RolePublic[]; total: number; page: number; pageSize: number }> {
    // 验证查询参数
    const validatedQuery: RoleQueryDTO = {
      ...query,
      page: Math.max(1, query.page || 1),
      pageSize: Math.max(1, Math.min(100, query.pageSize || 10))
    }

    return this.roleRepository.findAll(validatedQuery)
  }

  /**
   * 更新角色
   * @param id 角色ID
   * @param data 更新数据
   * @param updaterId 更新者ID
   * @returns 更新后的角色信息
   */
  async updateRole(id: number, data: UpdateRoleDTO, updaterId?: number): Promise<RolePublic | null> {
    // 1. 检查角色是否存在
    const existingRole = await this.roleRepository.findById(id)
    if (!existingRole) {
      throw new Error('角色不存在')
    }

    // 2. 检查系统角色是否允许修改
    if (existingRole.isSystemRole === 1) {
      // 系统角色只允许修改描述和排序
      const allowedFields = ['description', 'sortOrder']
      const updateFields = Object.keys(data)
      const hasDisallowedFields = updateFields.some(field => !allowedFields.includes(field))
      
      if (hasDisallowedFields) {
        throw new Error('系统角色只允许修改描述和排序')
      }
    }

    // 3. 验证更新数据的合法性
    if (data.name !== undefined) {
      if (!data.name || data.name.trim().length < 2) {
        throw new Error('角色名称不能为空且长度不能少于2个字符')
      }
      data.name = data.name.trim()
    }

    if (data.description !== undefined && data.description !== null) {
      data.description = data.description.trim() || null
    }

    // 4. 检查名称的唯一性
    if (data.name && data.name !== existingRole.roleName) {
      const nameExists = await this.roleRepository.existsByName(data.name, id)
      if (nameExists) {
        throw new Error('角色名称已存在')
      }
    }

    // 5. 添加更新者ID
    const updateData: UpdateRoleDTO = {
      ...data,
      updaterId: updaterId
    }

    // 6. 调用repository更新角色
    return this.roleRepository.update(id, updateData)
  }

  /**
   * 删除角色
   * @param id 角色ID
   * @param deleterId 删除者ID
   * @returns 是否删除成功
   */
  async deleteRole(id: number, deleterId?: number): Promise<boolean> {
    // 1. 检查角色是否存在
    const existingRole = await this.roleRepository.findById(id)
    if (!existingRole) {
      throw new Error('角色不存在')
    }

    // 2. 检查是否为系统角色（系统角色不允许删除）
    if (existingRole.isSystemRole === 1) {
      throw new Error('系统角色不允许删除')
    }

    // 3. 检查是否有用户正在使用该角色
    const usersWithRole = await this.roleRepository.findByUserId(id)
    if (usersWithRole && usersWithRole.length > 0) {
      throw new Error('该角色正在被用户使用，无法删除')
    }

    // 4. 调用repository删除角色
    const deleted = await this.roleRepository.delete(id, deleterId)
    
    if (deleted) {
      // 5. 清理相关缓存
      await this.roleRepository.clearCache()
    }

    return deleted
  }

  /**
   * 修改角色状态
   * @param id 角色ID
   * @param status 新状态
   * @param updaterId 更新者ID
   * @returns 更新后的角色信息
   */
  async changeRoleStatus(id: number, status: RoleStatus, updaterId?: number): Promise<RolePublic | null> {
    // 1. 检查角色是否存在
    const existingRole = await this.roleRepository.findById(id)
    if (!existingRole) {
      throw new Error('角色不存在')
    }

    // 2. 检查系统角色是否允许修改状态
    if (existingRole.isSystemRole === 1 && status === RoleStatus.DISABLED) {
      throw new Error('系统角色不允许禁用')
    }

    // 3. 调用updateRole方法更新状态
    return this.updateRole(id, { status }, updaterId)
  }

  /**
   * 为用户分配角色
   * @param data 角色分配数据
   * @returns 是否分配成功
   */
  async assignRolesToUser(data: AssignRoleDTO): Promise<boolean> {
    // 1. 验证用户是否存在
    const user = await this.userRepository.findById(data.userId)
    if (!user) {
      throw new Error('用户不存在')
    }

    // 2. 验证角色是否存在且状态正常
    const validRoleIds: number[] = []
    for (const roleId of data.roleIds) {
      const role = await this.roleRepository.findById(roleId)
      if (!role) {
        throw new Error(`角色ID ${roleId} 不存在`)
      }
      if (role.status === RoleStatus.DISABLED) {
        throw new Error(`角色 ${role.roleName} 已被禁用，无法分配`)
      }
      validRoleIds.push(roleId)
    }

    // 3. 分配新角色
    const success = await this.roleRepository.assignToUser(
      data.userId, 
      validRoleIds, 
      data.assignedBy, 
      data.expiresAt || undefined
    )

    if (success) {
      // 清理相关缓存
      await this.roleRepository.clearCache()
    }

    return success
  }

  /**
   * 为角色分配权限
   * @param data 权限分配数据
   * @returns 是否分配成功
   */
  async assignPermissionsToRole(data: AssignPermissionDTO): Promise<boolean> {
    // 1. 验证角色是否存在
    const role = await this.roleRepository.findById(data.roleId)
    if (!role) {
      throw new Error('角色不存在')
    }

    // TODO: 实现权限系统后完善此方法
    // 2. 验证权限是否存在
    // 3. 清理角色现有权限（如果需要）
    // 4. 分配新权限
    // 5. 记录分配日志
    
    throw new Error('权限系统尚未实现，此功能暂不可用')
  }

  /**
   * 获取用户的角色列表
   * @param userId 用户ID
   * @returns 用户的角色列表
   */
  async getUserRoles(userId: number): Promise<RolePublic[]> {
    // 1. 验证用户是否存在
    const user = await this.userRepository.findById(userId)
    if (!user) {
      throw new Error('用户不存在')
    }

    // 2. 查询用户的角色关联
    return this.roleRepository.findByUserId(userId)
  }

  /**
   * 获取角色的权限列表
   * @param roleId 角色ID
   * @returns 角色的权限列表
   */
  async getRolePermissions(roleId: number): Promise<any[]> {
    // 1. 验证角色是否存在
    const role = await this.roleRepository.findById(roleId)
    if (!role) {
      throw new Error('角色不存在')
    }

    // TODO: 实现权限系统后完善此方法
    // 2. 查询角色的权限关联
    // 3. 返回权限信息列表
    
    throw new Error('权限系统尚未实现，此功能暂不可用')
  }

  /**
   * 移除用户角色
   * @param userId 用户ID
   * @param roleIds 要移除的角色ID列表，如果为空则移除所有角色
   * @returns 是否移除成功
   */
  async removeUserRoles(userId: number, roleIds?: number[]): Promise<boolean> {
    // 验证用户是否存在
    const user = await this.userRepository.findById(userId)
    if (!user) {
      throw new Error('用户不存在')
    }

    // 如果指定了角色ID，验证角色是否存在
    if (roleIds && roleIds.length > 0) {
      for (const roleId of roleIds) {
        const role = await this.roleRepository.findById(roleId)
        if (!role) {
          throw new Error(`角色ID ${roleId} 不存在`)
        }
      }
    }

    const success = await this.roleRepository.removeFromUser(userId, roleIds)
    
    if (success) {
      // 清理相关缓存
      await this.roleRepository.clearCache()
    }

    return success
  }

  /**
   * 检查角色名称是否存在
   * @param name 角色名称
   * @param excludeId 排除的角色ID
   * @returns 是否存在
   */
  async checkRoleNameExists(name: string, excludeId?: number): Promise<boolean> {
    if (!name || name.trim().length === 0) {
      return false
    }
    return this.roleRepository.existsByName(name.trim(), excludeId)
  }

  /**
   * 检查角色编码是否存在
   * @param code 角色编码
   * @param excludeId 排除的角色ID
   * @returns 是否存在
   */
  async checkRoleCodeExists(code: string, excludeId?: number): Promise<boolean> {
    if (!code || code.trim().length === 0) {
      return false
    }
    return this.roleRepository.existsByCode(code.trim(), excludeId)
  }

  /**
   * 根据名称查找角色
   * @param name 角色名称
   * @returns 角色信息或null
   */
  async getRoleByName(name: string): Promise<RolePublic | null> {
    if (!name || name.trim().length === 0) {
      return null
    }
    return this.roleRepository.findByName(name.trim())
  }

  /**
   * 根据编码查找角色
   * @param code 角色编码
   * @returns 角色信息或null
   */
  async getRoleByCode(code: string): Promise<RolePublic | null> {
    if (!code || code.trim().length === 0) {
      return null
    }
    return this.roleRepository.findByCode(code.trim())
  }

  /**
   * 清理缓存
   */
  async clearCache(): Promise<void> {
    return this.roleRepository.clearCache()
  }
}