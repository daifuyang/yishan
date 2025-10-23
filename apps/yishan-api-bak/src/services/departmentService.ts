import { FastifyInstance } from 'fastify'
import { 
  DepartmentRepository, 
  Department, 
  CreateDepartmentDTO, 
  UpdateDepartmentDTO, 
  DepartmentQueryDTO 
} from '../repository/departmentRepository.js'
import { UserRepository } from '../repository/userRepository.js'

export class DepartmentService {
  private departmentRepository: DepartmentRepository
  private userRepository: UserRepository

  constructor(fastify: FastifyInstance) {
    this.departmentRepository = new DepartmentRepository(fastify)
    this.userRepository = new UserRepository(fastify)
  }

  /**
   * 创建部门
   */
  async createDepartment(data: CreateDepartmentDTO): Promise<Department> {
    // 验证父部门是否存在（如果不是根部门）
    if (data.parentId && data.parentId > 0) {
      const parentDept = await this.departmentRepository.findById(data.parentId)
      if (!parentDept) {
        throw new Error('父部门不存在')
      }
      if (parentDept.status === 0) {
        throw new Error('父部门已禁用，无法在其下创建子部门')
      }
    }

    // 验证同级别下部门名称唯一性
    const parentId = data.parentId || 0
    const existsByName = await this.departmentRepository.existsByNameInSameLevel(data.deptName, parentId)
    if (existsByName) {
      throw new Error('同级别下已存在相同名称的部门')
    }

    // 处理 leaderId 为 0 的情况，将其转换为 undefined
    let processedData = { ...data }
    if (processedData.leaderId === 0) {
      processedData.leaderId = undefined
    }

    // 验证负责人是否存在且有效（如果提供了负责人）
    if (processedData.leaderId && processedData.leaderId > 0) {
      const user = await this.userRepository.findById(processedData.leaderId)
      if (!user) {
        throw new Error('部门负责人不存在')
      }
      if (user.status === 0) {
        throw new Error('部门负责人已禁用，无法设置为负责人')
      }
    }

    return await this.departmentRepository.create(processedData)
  }

  /**
   * 根据ID获取部门信息
   */
  async getDepartmentById(id: number): Promise<Department | null> {
    return await this.departmentRepository.findById(id)
  }

  /**
   * 获取部门列表（支持分页和筛选）
   */
  async getDepartmentList(query: DepartmentQueryDTO): Promise<{ departments: Department[]; total: number; page: number; pageSize: number }> {
    return await this.departmentRepository.findAll(query)
  }

  /**
   * 获取部门树结构
   */
  async getDepartmentTree(): Promise<Department[]> {
    return await this.departmentRepository.findTree()
  }

  /**
   * 更新部门信息
   */
  async updateDepartment(id: number, data: UpdateDepartmentDTO): Promise<Department | null> {
    // 验证部门是否存在
    const existingDept = await this.departmentRepository.findById(id)
    if (!existingDept) {
      throw new Error('部门不存在')
    }

    // 验证父部门是否存在（如果要修改父部门）
    if (data.parentId !== undefined && data.parentId > 0) {
      const parentDept = await this.departmentRepository.findById(data.parentId)
      if (!parentDept) {
        throw new Error('父部门不存在')
      }
      if (parentDept.status === 0) {
        throw new Error('父部门已禁用，无法移动到该部门下')
      }
      
      // 检查是否会形成循环引用
      if (data.parentId === id) {
        throw new Error('不能将部门移动到自己下面')
      }
      
      const childrenIds = await this.departmentRepository.getChildrenIds(id)
      if (childrenIds.includes(data.parentId)) {
        throw new Error('不能将部门移动到其子部门下')
      }
    }

    // 验证同级别下部门名称唯一性（如果要修改名称或父部门）
    if (data.deptName || data.parentId !== undefined) {
      const newName = data.deptName || existingDept.deptName
      const newParentId = data.parentId !== undefined ? data.parentId : existingDept.parentId
      
      if (newName !== existingDept.deptName || newParentId !== existingDept.parentId) {
        const existsByName = await this.departmentRepository.existsByNameInSameLevel(newName, newParentId, id)
        if (existsByName) {
          throw new Error('同级别下已存在相同名称的部门')
        }
      }
    }

    // 验证负责人是否存在且有效（如果要修改负责人）
    if (data.leaderId !== undefined) {
      // 处理 leaderId 为 0 的情况，将其转换为 undefined
      if (data.leaderId === 0) {
        data.leaderId = undefined
      } else if (data.leaderId > 0) {
        const user = await this.userRepository.findById(data.leaderId)
        if (!user) {
          throw new Error('部门负责人不存在')
        }
        if (user.status === 0) {
          throw new Error('部门负责人已禁用，无法设置为负责人')
        }
      }
    }

    return await this.departmentRepository.update(id, data)
  }

  /**
   * 更新部门状态
   */
  async updateDepartmentStatus(id: number, status: number, updaterId: number): Promise<Department | null> {
    // 验证部门是否存在
    const existingDept = await this.departmentRepository.findById(id)
    if (!existingDept) {
      throw new Error('部门不存在')
    }

    // 如果要禁用部门，检查是否有启用的子部门
    if (status === 0) {
      const children = await this.departmentRepository.findAll({ parentId: id, status: 1 })
      if (children.total > 0) {
        throw new Error('存在启用状态的子部门，无法禁用')
      }
      
      // 检查是否有用户关联（这里可以添加用户检查逻辑）
      // const userCount = await userRepository.countByDepartment(id)
      // if (userCount > 0) {
      //   throw new Error('部门下存在用户，无法禁用')
      // }
    }

    return await this.departmentRepository.update(id, { status, updaterId })
  }

  /**
   * 删除部门
   */
  async deleteDepartment(id: number, deleterId?: number): Promise<boolean> {
    // 验证部门是否存在
    const existingDept = await this.departmentRepository.findById(id)
    if (!existingDept) {
      throw new Error('部门不存在')
    }

    // 检查是否为系统默认部门（ID为1的部门通常是根部门，不允许删除）
    if (id === 1) {
      throw new Error('系统默认部门不允许删除')
    }

    return await this.departmentRepository.delete(id, deleterId)
  }

  /**
   * 检查部门名称是否存在（全局，不区分层级）
   */
  async checkDepartmentNameExists(deptName: string): Promise<boolean> {
    const department = await this.departmentRepository.findByName(deptName)
    return !!department
  }

  /**
   * 检查同级别下部门名称是否存在
   */
  async checkDepartmentNameExistsInSameLevel(deptName: string, parentId: number, excludeId?: number): Promise<boolean> {
    return await this.departmentRepository.existsByNameInSameLevel(deptName, parentId, excludeId)
  }

  /**
   * 批量删除部门（返回删除数量）
   */
  async batchDeleteDepartments(ids: number[], deleterId?: number): Promise<{ deletedCount: number; success: number[]; failed: number[] }> {
    // 过滤掉系统默认部门
    const validIds = ids.filter(id => id !== 1)
    
    if (validIds.length === 0) {
      return { deletedCount: 0, success: [], failed: ids }
    }

    const result = await this.departmentRepository.batchDelete(validIds, deleterId)
    return {
      deletedCount: result.success.length,
      success: result.success,
      failed: result.failed
    }
  }

  /**
   * 移动部门
   */
  async moveDepartment(id: number, targetParentId: number, sortOrder?: number, updaterId?: number): Promise<Department | null> {
    // 验证部门是否存在
    const existingDept = await this.departmentRepository.findById(id)
    if (!existingDept) {
      throw new Error('部门不存在')
    }

    // 验证目标父部门是否存在（如果不是移动到根级别）
    if (targetParentId > 0) {
      const targetParent = await this.departmentRepository.findById(targetParentId)
      if (!targetParent) {
        throw new Error('目标父部门不存在')
      }
      if (targetParent.status === 0) {
        throw new Error('目标父部门已禁用，无法移动到该部门下')
      }
    }

    // 验证同级别下部门名称唯一性
    const existsByName = await this.departmentRepository.existsByNameInSameLevel(
      existingDept.deptName, 
      targetParentId, 
      id
    )
    if (existsByName) {
      throw new Error('目标位置已存在相同名称的部门')
    }

    return await this.departmentRepository.move(id, targetParentId, sortOrder, updaterId)
  }

  /**
   * 根据部门名称获取部门信息
   */
  async getDepartmentByName(deptName: string): Promise<Department | null> {
    return await this.departmentRepository.findByName(deptName)
  }

  /**
   * 获取部门的所有子部门ID
   */
  async getDepartmentChildrenIds(parentId: number): Promise<number[]> {
    return await this.departmentRepository.getChildrenIds(parentId)
  }

  /**
   * 清除缓存
   */
  async clearCache(): Promise<void> {
    await this.departmentRepository.clearCache()
  }
}