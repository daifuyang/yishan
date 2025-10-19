import { FastifyInstance } from 'fastify'
import { DateTimeUtil } from '../utils/datetime.js'

const CACHE_PREFIX = 'departments:'
const CACHE_TTL = parseInt(process.env.CACHE_TTL || '3600')
const TABLE_NAME = 'sys_department'

export interface Department {
  id: number
  parentId: number
  deptName: string
  deptDesc?: string
  deptType: number
  status: number
  sortOrder: number
  leaderId?: number
  leaderName?: string
  phone?: string
  email?: string
  address?: string
  createdAt: string
  updatedAt: string
  creatorId?: number
  updaterId?: number
  deletedAt?: string
  children?: Department[]
}

export interface CreateDepartmentDTO {
  parentId?: number
  deptName: string
  deptDesc?: string
  deptType?: number
  status?: number
  sortOrder?: number
  leaderId?: number
  phone?: string
  email?: string
  address?: string
  creatorId: number
}

export interface UpdateDepartmentDTO {
  parentId?: number
  deptName?: string
  deptDesc?: string
  deptType?: number
  status?: number
  sortOrder?: number
  leaderId?: number
  phone?: string
  email?: string
  address?: string
  updaterId: number
}

export interface DepartmentQueryDTO {
  page?: number
  pageSize?: number
  search?: string
  deptName?: string
  parentId?: number
  deptType?: number
  status?: number
  leaderId?: number
  sortBy?: string
  sortOrder?: string
  sorts?: Array<{ field: string; order: string }> | string
}

export class DepartmentRepository {
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

  // 根据ID查找部门（排除已软删除）
  async findById(id: number): Promise<Department | null> {
    const cacheKey = `${CACHE_PREFIX}dept:${id}`
    const cached = await this.getCache<Department>(cacheKey)
    if (cached) return cached

    const department = await this.knex(TABLE_NAME)
      .leftJoin('sys_user', 'sys_department.leader_id', 'sys_user.id')
      .select([
        'sys_department.*',
        'sys_user.real_name as leader_name'
      ])
      .where('sys_department.id', id)
      .whereNull('sys_department.deleted_at')
      .first()

    if (department) {
      // 处理日期时间字段格式
      const processedDept = {
        ...department,
        createdAt: department.created_at ? DateTimeUtil.formatDateTime(department.created_at) : null,
        updatedAt: department.updated_at ? DateTimeUtil.formatDateTime(department.updated_at) : null,
        deletedAt: department.deleted_at ? DateTimeUtil.formatDateTime(department.deleted_at) : null
      }

      await this.setCache(cacheKey, processedDept)
      return processedDept
    }
    return null
  }

  // 根据部门名称查找部门（排除已软删除）
  async findByName(deptName: string, excludeId?: number): Promise<Department | null> {
    let query = this.knex(TABLE_NAME)
      .leftJoin('sys_user', 'sys_department.leader_id', 'sys_user.id')
      .select([
        'sys_department.*',
        'sys_user.real_name as leader_name'
      ])
      .where('sys_department.dept_name', deptName)
      .whereNull('sys_department.deleted_at')
      .first()

    if (excludeId) {
      query = query.where('sys_department.id', '!=', excludeId)
    }

    return query.first()
  }

  // 查询部门列表（支持分页和筛选，排除已软删除）
  async findAll(query: DepartmentQueryDTO): Promise<{ departments: Department[]; total: number; page: number; pageSize: number }> {
    const page = Math.max(1, query.page || 1)
    const pageSize = Math.max(1, Math.min(100, query.pageSize || 10))
    const offset = (page - 1) * pageSize
    const sortBy = query.sortBy || 'sort_order'
    const sortOrder = query.sortOrder || 'asc'

    const cacheKey = `${CACHE_PREFIX}list:${JSON.stringify(query)}`
    const cached = await this.getCache<{ departments: Department[]; total: number; page: number; pageSize: number }>(cacheKey)
    if (cached) return cached

    // 构建基础查询
    let baseQuery = this.knex(TABLE_NAME)
      .leftJoin('sys_user', 'sys_department.leader_id', 'sys_user.id')
      .whereNull('sys_department.deleted_at')

    // 应用筛选条件
    if (query.parentId !== undefined) baseQuery = baseQuery.where('sys_department.parent_id', query.parentId)
    if (query.status !== undefined) baseQuery = baseQuery.where('sys_department.status', query.status)
    if (query.deptType !== undefined) baseQuery = baseQuery.where('sys_department.dept_type', query.deptType)
    if (query.leaderId) baseQuery = baseQuery.where('sys_department.leader_id', query.leaderId)

    // 应用统一搜索条件（模糊搜索部门名称）
    if (query.search) {
      baseQuery = baseQuery.where('sys_department.dept_name', 'like', `%${query.search}%`)
    }
    if (query.deptName) baseQuery = baseQuery.where('sys_department.dept_name', 'like', `%${query.deptName}%`)

    // 获取总数
    const countResult = await baseQuery.clone().count('sys_department.id as count').first()
    const total = parseInt((countResult as any)?.count as string)

    // 处理排序
    let orderQuery = baseQuery.clone()

    // 处理多字段排序
    if (query.sorts) {
      let sorts: Array<{ field: string; order: string }> = []

      if (typeof query.sorts === 'string') {
        try {
          sorts = JSON.parse(query.sorts)
        } catch (e) {
          // 解析失败，使用默认排序
          sorts = [{ field: 'sort_order', order: 'asc' }]
        }
      } else {
        sorts = query.sorts
      }

      sorts.forEach(sort => {
        const field = sort.field === 'deptName' ? 'dept_name' :
          sort.field === 'deptType' ? 'dept_type' :
            sort.field === 'sortOrder' ? 'sort_order' :
              sort.field === 'createdAt' ? 'created_at' :
                sort.field === 'updatedAt' ? 'updated_at' : sort.field
        orderQuery = orderQuery.orderBy(`sys_department.${field}`, sort.order)
      })
    } else {
      // 单字段排序
      const field = sortBy === 'deptName' ? 'dept_name' :
        sortBy === 'deptType' ? 'dept_type' :
          sortBy === 'sortOrder' ? 'sort_order' :
            sortBy === 'createdAt' ? 'created_at' :
              sortBy === 'updatedAt' ? 'updated_at' : sortBy
      orderQuery = orderQuery.orderBy(`sys_department.${field}`, sortOrder)
    }

    // 获取分页数据
    const departments = await orderQuery
      .select([
        'sys_department.*',
        'sys_user.real_name as leader_name'
      ])
      .limit(pageSize)
      .offset(offset)

    // 处理日期时间字段格式
    const processedDepartments = departments.map(dept => ({
      ...dept,
      createdAt: dept.created_at ? DateTimeUtil.formatDateTime(dept.created_at) : null,
      updatedAt: dept.updated_at ? DateTimeUtil.formatDateTime(dept.updated_at) : null,
      deletedAt: dept.deleted_at ? DateTimeUtil.formatDateTime(dept.deleted_at) : null
    }))

    const result = {
      departments: processedDepartments,
      total,
      page,
      pageSize
    }

    await this.setCache(cacheKey, result, 300) // 缓存5分钟
    return result
  }

  // 获取部门树结构（排除已软删除）
  async findTree(): Promise<Department[]> {
    const cacheKey = `${CACHE_PREFIX}tree`
    const cached = await this.getCache<Department[]>(cacheKey)
    if (cached) return cached

    // 获取所有部门
    const departments = await this.knex(TABLE_NAME)
      .leftJoin('sys_user', 'sys_department.leader_id', 'sys_user.id')
      .select([
        'sys_department.*',
        'sys_user.real_name as leader_name'
      ])
      .whereNull('sys_department.deleted_at')
      .orderBy('sys_department.sort_order', 'asc')
      .orderBy('sys_department.id', 'asc')

    // 处理日期时间字段格式
    const processedDepartments = departments.map(dept => ({
      ...dept,
      createdAt: dept.created_at ? DateTimeUtil.formatDateTime(dept.created_at) : null,
      updatedAt: dept.updated_at ? DateTimeUtil.formatDateTime(dept.updated_at) : null,
      deletedAt: dept.deleted_at ? DateTimeUtil.formatDateTime(dept.deleted_at) : null
    }))
    // 构建树结构
    const tree = this.buildTree(processedDepartments)
    await this.setCache(cacheKey, tree, 600) // 缓存10分钟
    return tree
  }

  // 构建树结构的辅助方法
  private buildTree(departments: Department[], parentId: number = 0): Department[] {
    const children = departments.filter(dept => dept.parentId === parentId)

    return children.map(dept => ({
      ...dept,
      children: this.buildTree(departments, dept.id)
    }))
  }

  // 获取子部门ID列表（仅获取未软删除的子部门）
  async getChildrenIds(parentId: number): Promise<number[]> {
    const children = await this.knex(TABLE_NAME)
      .select('id')
      .where('parent_id', parentId)
      .whereNull('deleted_at')

    let allIds: number[] = children.map(child => child.id)

    // 递归获取子部门的子部门
    for (const child of children) {
      const grandChildren = await this.getChildrenIds(child.id)
      allIds = allIds.concat(grandChildren)
    }

    return allIds
  }

  // 创建部门
  async create(data: CreateDepartmentDTO): Promise<Department> {
    const now = new Date()
    const insertData = {
      parent_id: data.parentId || 0,
      dept_name: data.deptName,
      dept_desc: data.deptDesc,
      dept_type: data.deptType || 2,
      status: data.status !== undefined ? data.status : 1,
      sort_order: data.sortOrder || 0,
      leader_id: data.leaderId,
      phone: data.phone,
      email: data.email,
      address: data.address,
      creator_id: data.creatorId,
      created_at: now,
      updated_at: now
    }

    const [id] = await this.knex(TABLE_NAME).insert(insertData)

    // 清除相关缓存
    await this.invalidateCache(`${CACHE_PREFIX}*`)

    const newDepartment = await this.findById(id)
    return newDepartment!
  }

  // 更新部门
  async update(id: number, data: UpdateDepartmentDTO): Promise<Department | null> {
    const updateData: any = {
      updated_at: new Date(),
      updater_id: data.updaterId
    }

    // 只更新提供的字段
    if (data.parentId !== undefined) updateData.parent_id = data.parentId
    if (data.deptName !== undefined) updateData.dept_name = data.deptName
    if (data.deptDesc !== undefined) updateData.dept_desc = data.deptDesc
    if (data.deptType !== undefined) updateData.dept_type = data.deptType
    if (data.status !== undefined) updateData.status = data.status
    if (data.sortOrder !== undefined) updateData.sort_order = data.sortOrder
    if (data.leaderId !== undefined) updateData.leader_id = data.leaderId
    if (data.phone !== undefined) updateData.phone = data.phone
    if (data.email !== undefined) updateData.email = data.email
    if (data.address !== undefined) updateData.address = data.address

    const affectedRows = await this.knex(TABLE_NAME)
      .where({ id })
      .update(updateData)

    if (affectedRows > 0) {
      // 清除相关缓存
      await this.invalidateCache(`${CACHE_PREFIX}*`)
      return await this.findById(id)
    }
    return null
  }

  // 删除部门（软删除）
  async delete(id: number, deleterId?: number): Promise<boolean> {
    // 递归软删除所有子部门
    const childrenIds = await this.getChildrenIds(id)
    if (childrenIds.length > 0) {
      await this.knex(TABLE_NAME)
        .whereIn('id', childrenIds)
        .update({
          deleted_at: new Date(),
          updater_id: deleterId
        })
    }

    // 检查是否有用户关联
    const userCount = await this.knex('sys_user')
      .count('id as count')
      .where('dept_id', id)
      .first()

    if (parseInt((userCount as any)?.count as string) > 0) {
      throw new Error('部门下存在用户，无法删除')
    }

    const affectedRows = await this.knex(TABLE_NAME)
      .where({ id })
      .update({
        deleted_at: new Date(),
        updater_id: deleterId
      })

    if (affectedRows > 0) {
      // 清除相关缓存
      await this.invalidateCache(`${CACHE_PREFIX}*`)
      return true
    }
    return false
  }

  // 批量删除部门
  async batchDelete(ids: number[], deleterId?: number): Promise<{ success: number[]; failed: number[] }> {
    const success: number[] = []
    const failed: number[] = []

    for (const id of ids) {
      try {
        const result = await this.delete(id, deleterId)
        if (result) {
          success.push(id)
        } else {
          failed.push(id)
        }
      } catch (error) {
        failed.push(id)
      }
    }

    return { success, failed }
  }

  // 移动部门
  async move(id: number, targetParentId: number, sortOrder?: number, updaterId?: number): Promise<Department | null> {
    // 检查是否会形成循环引用
    if (await this.wouldCreateCycle(id, targetParentId)) {
      throw new Error('移动操作会形成循环引用')
    }

    const updateData: any = {
      parent_id: targetParentId,
      updated_at: new Date(),
      updater_id: updaterId
    }

    if (sortOrder !== undefined) {
      updateData.sort_order = sortOrder
    }

    const affectedRows = await this.knex(TABLE_NAME)
      .where({ id })
      .update(updateData)

    if (affectedRows > 0) {
      // 清除相关缓存
      await this.invalidateCache(`${CACHE_PREFIX}*`)
      return await this.findById(id)
    }
    return null
  }

  // 检查是否会形成循环引用
  private async wouldCreateCycle(deptId: number, targetParentId: number): Promise<boolean> {
    if (targetParentId === 0) return false // 移动到根级别不会形成循环
    if (deptId === targetParentId) return true // 不能移动到自己

    // 检查目标父部门是否是当前部门的子部门
    const childrenIds = await this.getChildrenIds(deptId)
    return childrenIds.includes(targetParentId)
  }

  // 检查部门名称是否存在（同级别下，排除已软删除）
  async existsByNameInSameLevel(deptName: string, parentId: number, excludeId?: number): Promise<boolean> {
    let query = this.knex(TABLE_NAME)
      .where('dept_name', deptName)
      .where('parent_id', parentId)
      .whereNull('deleted_at')

    if (excludeId) {
      query = query.where('id', '!=', excludeId)
    }

    const result = await query.first()
    return !!result
  }

  // 清除缓存
  async clearCache(): Promise<void> {
    await this.invalidateCache(`${CACHE_PREFIX}*`)
  }
}