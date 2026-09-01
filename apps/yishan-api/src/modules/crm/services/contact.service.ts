import { BusinessError } from '@/exceptions/business-error.js'
import { dbManager, type AppQueryDb } from '@/db'
import { CrmErrorCode } from '../schemas/error-codes.js'
import type { DataScopeUser } from '../schemas/data-scope.js'
import { computeDataScope } from '../schemas/data-scope.js'
import { CustomerRepository } from '../repositories/customer.repository.js'
import {
  ContactRepository,
  type ContactListQuery,
  type ContactRow,
  type CreateContactInput,
  type UpdateContactInput,
} from '../repositories/contact.repository.js'

/**
 * ContactService —— 联系人业务编排。
 *
 * 业务规则：
 *   - 创建联系人必须属于一个已存在的客户；
 *   - 客户的 ownerUserId / ownerDepartmentId 不为空时，新建联系人同样要求当前用户有
 *     数据范围内的权限（owner 或同部门）；
 *   - isPrimary=1 时在事务内同步清空该客户其他联系人的 is_primary。
 */

export class ContactService {
  constructor(private readonly deps: { db?: AppQueryDb } = {}) {}

  async findById(id: number, currentUser: DataScopeUser): Promise<ContactRow> {
    const existing = await ContactRepository.findById(id, this.deps.db)
    if (!existing) {
      throw new BusinessError(CrmErrorCode.CRM_CONTACT_NOT_FOUND, '联系人不存在')
    }
    const customer = await CustomerRepository.findById(existing.customerId, this.deps.db)
    if (!customer) {
      throw new BusinessError(CrmErrorCode.CRM_CONTACT_NOT_FOUND, '客户不存在')
    }
    const scope = computeDataScope(currentUser)
    if (scope.ownerUserIds !== null) {
      const inUserScope =
        customer.ownerUserId !== null && (scope.ownerUserIds ?? []).includes(customer.ownerUserId)
      const inDeptScope =
        customer.ownerDepartmentId !== null &&
        (scope.ownerDepartmentIds ?? []).includes(customer.ownerDepartmentId)
      const inPool = customer.poolStatus === 'public'
      if (!inUserScope && !inDeptScope && !inPool) {
        throw new BusinessError(CrmErrorCode.CRM_CONTACT_NOT_FOUND, '联系人不存在')
      }
    }
    return existing
  }

  async list(
    query: ContactListQuery,
    currentUser: DataScopeUser,
  ): Promise<{ total: number; items: ContactRow[]; page: number; pageSize: number }> {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 10

    // 按客户筛选时，套上数据范围
    const merged: ContactListQuery = { ...query }
    if (query.customerId !== undefined) {
      const customer = await CustomerRepository.findById(query.customerId, this.deps.db)
      if (!customer) {
        return { total: 0, items: [], page, pageSize }
      }
      const scope = computeDataScope(currentUser)
      const allowed =
        scope.ownerUserIds === null ||
        (customer.ownerUserId !== null &&
          (scope.ownerUserIds ?? []).includes(customer.ownerUserId)) ||
        (customer.ownerDepartmentId !== null &&
          (scope.ownerDepartmentIds ?? []).includes(customer.ownerDepartmentId)) ||
        customer.poolStatus === 'public'
      if (!allowed) {
        return { total: 0, items: [], page, pageSize }
      }
    }

    const { rows, total } = await ContactRepository.list(merged, this.deps.db)
    return { total, items: rows, page, pageSize }
  }

  async listByCustomerId(customerId: number, currentUser: DataScopeUser): Promise<ContactRow[]> {
    const customer = await CustomerRepository.findById(customerId, this.deps.db)
    if (!customer) {
      throw new BusinessError(CrmErrorCode.CRM_CONTACT_NOT_FOUND, '客户不存在')
    }
    const scope = computeDataScope(currentUser)
    const allowed =
      scope.ownerUserIds === null ||
      (customer.ownerUserId !== null && (scope.ownerUserIds ?? []).includes(customer.ownerUserId)) ||
      (customer.ownerDepartmentId !== null &&
        (scope.ownerDepartmentIds ?? []).includes(customer.ownerDepartmentId)) ||
      customer.poolStatus === 'public'
    if (!allowed) {
      throw new BusinessError(CrmErrorCode.CRM_CONTACT_NOT_FOUND, '客户不存在')
    }
    return ContactRepository.listByCustomerId(customerId, this.deps.db)
  }

  async create(
    input: Omit<CreateContactInput, 'creatorId' | 'updaterId'>,
    currentUser: DataScopeUser,
  ): Promise<ContactRow> {
    const customer = await CustomerRepository.findById(input.customerId, this.deps.db)
    if (!customer) {
      throw new BusinessError(CrmErrorCode.CRM_CONTACT_NOT_FOUND, '客户不存在')
    }
    // 数据范围：客户的 owner 在数据范围内 OR 是公海
    const scope = computeDataScope(currentUser)
    if (scope.ownerUserIds !== null) {
      const inUserScope =
        customer.ownerUserId !== null && (scope.ownerUserIds ?? []).includes(customer.ownerUserId)
      const inDeptScope =
        customer.ownerDepartmentId !== null &&
        (scope.ownerDepartmentIds ?? []).includes(customer.ownerDepartmentId)
      const isPublic = customer.poolStatus === 'public'
      if (!inUserScope && !inDeptScope && !isPublic) {
        throw new BusinessError(CrmErrorCode.CRM_CUSTOMER_TRANSFER_FORBIDDEN, '无权为此客户添加联系人')
      }
    }

    const isPrimary = input.isPrimary ?? 0
    return dbManager.transaction(async (tx) => {
      const created = await ContactRepository.create(
        {
          ...input,
          creatorId: currentUser.id,
          updaterId: currentUser.id,
        },
        tx,
      )
      if (isPrimary === 1) {
        await ContactRepository.setPrimaryInTx(created.id, input.customerId, tx)
      }
      return created
    })
  }

  async update(
    id: number,
    input: UpdateContactInput,
    currentUser: DataScopeUser,
  ): Promise<ContactRow> {
    const existing = await ContactRepository.findById(id, this.deps.db)
    if (!existing) {
      throw new BusinessError(CrmErrorCode.CRM_CONTACT_NOT_FOUND, '联系人不存在')
    }
    const customer = await CustomerRepository.findById(existing.customerId, this.deps.db)
    if (!customer) {
      throw new BusinessError(CrmErrorCode.CRM_CONTACT_NOT_FOUND, '客户不存在')
    }
    const scope = computeDataScope(currentUser)
    if (scope.ownerUserIds !== null) {
      const inUserScope =
        customer.ownerUserId !== null && (scope.ownerUserIds ?? []).includes(customer.ownerUserId)
      const inDeptScope =
        customer.ownerDepartmentId !== null &&
        (scope.ownerDepartmentIds ?? []).includes(customer.ownerDepartmentId)
      if (!inUserScope && !inDeptScope) {
        throw new BusinessError(CrmErrorCode.CRM_CUSTOMER_TRANSFER_FORBIDDEN, '无权编辑该联系人')
      }
    }

    const isPrimary = input.isPrimary
    return dbManager.transaction(async (tx) => {
      const updated = await ContactRepository.update(id, { ...input, updaterId: currentUser.id }, tx)
      if (!updated) throw new BusinessError(CrmErrorCode.CRM_CONTACT_NOT_FOUND, '联系人不存在')
      if (isPrimary === 1) {
        await ContactRepository.setPrimaryInTx(id, existing.customerId, tx)
      }
      return updated
    })
  }

  async remove(id: number, currentUser: DataScopeUser): Promise<void> {
    const existing = await ContactRepository.findById(id, this.deps.db)
    if (!existing) {
      throw new BusinessError(CrmErrorCode.CRM_CONTACT_NOT_FOUND, '联系人不存在')
    }
    const customer = await CustomerRepository.findById(existing.customerId, this.deps.db)
    if (!customer) {
      throw new BusinessError(CrmErrorCode.CRM_CONTACT_NOT_FOUND, '客户不存在')
    }
    const scope = computeDataScope(currentUser)
    if (scope.ownerUserIds !== null) {
      const inUserScope =
        customer.ownerUserId !== null && (scope.ownerUserIds ?? []).includes(customer.ownerUserId)
      const inDeptScope =
        customer.ownerDepartmentId !== null &&
        (scope.ownerDepartmentIds ?? []).includes(customer.ownerDepartmentId)
      if (!inUserScope && !inDeptScope) {
        throw new BusinessError(CrmErrorCode.CRM_CUSTOMER_TRANSFER_FORBIDDEN, '无权删除该联系人')
      }
    }
    await dbManager.transaction(async (tx) => {
      await ContactRepository.softDelete(id, tx)
    })
  }
}
