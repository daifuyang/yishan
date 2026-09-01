import { BusinessError } from '@/exceptions/business-error.js'
import { dbManager, type AppQueryDb } from '@/db'
import { computeDataScope, type DataScopeUser } from '../schemas/data-scope.js'
import { CrmErrorCode } from '../schemas/error-codes.js'
import {
  CustomerRepository,
  type CreateCustomerInput,
  type CustomerDetailRow,
  type CustomerListQuery,
  type CustomerRow,
  type UpdateCustomerInput,
} from '../repositories/customer.repository.js'
import { StatusRepository } from '../repositories/status.repository.js'
import { SourceRepository } from '../repositories/source.repository.js'

/**
 * CustomerService —— 客户业务编排。
 *
 * 单一职责：把"客户 CRUD + 查重 + 标签 + 数据范围"等业务规则收拢在 Service 层；
 * 路由层只调 service。
 */

export interface ListCustomersArgs {
  query: CustomerListQuery
  currentUser: DataScopeUser
}

export interface CreateCustomerArgs {
  input: {
    name: string
    type?: 'enterprise' | 'individual'
    statusId?: number | null
    sourceId?: number | null
    level?: string | null
    industry?: string | null
    phone?: string | null
    website?: string | null
    province?: string | null
    city?: string | null
    address?: string | null
    ownerUserId?: number | null
    ownerDepartmentId?: number | null
    tagIds?: number[]
    remark?: string | null
  }
  currentUser: DataScopeUser
}

export interface UpdateCustomerArgs {
  id: number
  input: UpdateCustomerInput & { tagIds?: number[] }
  currentUser: DataScopeUser
}

export interface CustomerServiceDeps {
  db?: AppQueryDb
}

export class CustomerService {
  constructor(private readonly deps: CustomerServiceDeps = {}) {}

  /** 列表：自动套上当前用户的数据范围。 */
  async list({
    query,
    currentUser,
  }: ListCustomersArgs): Promise<{ total: number; items: CustomerRow[]; page: number; pageSize: number }> {
    const scope = computeDataScope(currentUser)
    const merged: CustomerListQuery = {
      ...query,
      ownerUserIds: scope.ownerUserIds,
      ownerDepartmentIds: scope.ownerDepartmentIds,
    }
    const { rows, total } = await CustomerRepository.list(merged, this.deps.db)
    return {
      total,
      items: rows,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 10,
    }
  }

  async detail(id: number, currentUser: DataScopeUser): Promise<CustomerDetailRow> {
    const row = await CustomerRepository.findDetailById(id, this.deps.db)
    if (!row) {
      throw new BusinessError(CrmErrorCode.CRM_CUSTOMER_NOT_FOUND, '客户不存在或已删除')
    }
    // 数据范围校验：非 ALL 时，确认"我有权限看到"
    const scope = computeDataScope(currentUser)
    if (scope.ownerUserIds !== null) {
      const allowedUserIds = scope.ownerUserIds ?? []
      const allowedDeptIds = scope.ownerDepartmentIds ?? []
      const inUserScope = row.ownerUserId !== null && allowedUserIds.includes(row.ownerUserId)
      const inDeptScope =
        row.ownerDepartmentId !== null && allowedDeptIds.includes(row.ownerDepartmentId)
      const inPool = row.poolStatus === 'public'
      if (!inUserScope && !inDeptScope && !inPool) {
        // 复用 NOT_FOUND 错误，避免泄漏存在性
        throw new BusinessError(CrmErrorCode.CRM_CUSTOMER_NOT_FOUND, '客户不存在或已删除')
      }
    }
    return row
  }

  /**
   * 创建客户：
   *   1. 查重：enterprise 按 name 精确，phone 辅助；individual 按 phone 优先。
   *      重复 → BusinessError(CRM_CUSTOMER_DUPLICATE)，附 existingCustomerId/Name/OwnerUserId。
   *   2. 校验 statusId/sourceId 存在（如设置）。
   *   3. 校验 ownerUserId 存在（如设置）。
   *   4. 写入客户 + 标签（在事务内）。
   */
  async create({ input, currentUser }: CreateCustomerArgs): Promise<{
    customer: CustomerRow
    duplicate: { existingCustomerId: number; existingCustomerName: string; ownerUserId: number | null; ownerUserName: string | null } | null
  }> {
    const type = input.type ?? 'enterprise'
    if (type !== 'enterprise' && type !== 'individual') {
      throw new BusinessError(CrmErrorCode.CRM_CUSTOMER_TYPE_INVALID, '客户类型必须是 enterprise 或 individual')
    }

    // 1. 查重
    const dupe = await CustomerRepository.findDuplicate(
      { name: input.name, type, phone: input.phone ?? null },
      undefined,
      this.deps.db,
    )
    if (dupe) {
      const ownerName =
        dupe.ownerUserId !== null
          ? (await CustomerRepository.findOwnerNamesByUserIds([dupe.ownerUserId], this.deps.db)).get(
              dupe.ownerUserId,
            ) ?? null
          : null
      throw new BusinessError(
        CrmErrorCode.CRM_CUSTOMER_DUPLICATE,
        '发现疑似重复客户',
        JSON.stringify({
          existingCustomerId: dupe.id,
          existingCustomerName: dupe.name,
          ownerUserId: dupe.ownerUserId,
          ownerUserName: ownerName,
        }),
      )
    }

    // 2. 校验 statusId / sourceId 存在
    if (input.statusId !== undefined && input.statusId !== null) {
      const exists = await StatusRepository.findById(input.statusId, this.deps.db)
      if (!exists) {
        throw new BusinessError(CrmErrorCode.CRM_STATUS_NOT_FOUND, '客户状态不存在')
      }
    }
    if (input.sourceId !== undefined && input.sourceId !== null) {
      const exists = await SourceRepository.findById(input.sourceId, this.deps.db)
      if (!exists) {
        throw new BusinessError(CrmErrorCode.CRM_SOURCE_NOT_FOUND, '客户来源不存在')
      }
    }

    // 3. 校验 ownerUserId（如设置）：这里不做"用户是否存在"的额外校验；
    //    crm_customer.owner_user_id 只是 INT，依赖 service 上层 / 数据约束做兜底。

    // 4. 写入
    const createInput: CreateCustomerInput = {
      name: input.name,
      type,
      statusId: input.statusId ?? null,
      sourceId: input.sourceId ?? null,
      level: input.level ?? null,
      industry: input.industry ?? null,
      phone: input.phone ?? null,
      website: input.website ?? null,
      province: input.province ?? null,
      city: input.city ?? null,
      address: input.address ?? null,
      ownerUserId: input.ownerUserId ?? null,
      ownerDepartmentId: input.ownerDepartmentId ?? null,
      poolStatus: input.ownerUserId ? 'owned' : 'public',
      remark: input.remark ?? null,
      creatorId: currentUser.id,
      updaterId: currentUser.id,
    }

    const created = await dbManager.transaction(async (tx) => {
      const customer = await CustomerRepository.create(createInput, tx)
      if (input.tagIds && input.tagIds.length > 0) {
        await CustomerRepository.setCustomerTags(customer.id, input.tagIds, tx)
      }
      return customer
    })

    return { customer: created, duplicate: null }
  }

  async update({ id, input, currentUser }: UpdateCustomerArgs): Promise<CustomerRow> {
    const existing = await CustomerRepository.findById(id, this.deps.db)
    if (!existing) {
      throw new BusinessError(CrmErrorCode.CRM_CUSTOMER_NOT_FOUND, '客户不存在或已删除')
    }

    // 数据范围校验
    await this.assertCanOperate(existing, currentUser, 'update')

    // 查重：如果改了 name / phone / type，则重查
    if (
      (input.name !== undefined && input.name !== existing.name) ||
      (input.phone !== undefined && input.phone !== existing.phone) ||
      (input.type !== undefined && input.type !== existing.type)
    ) {
      const dupe = await CustomerRepository.findDuplicate(
        {
          name: input.name ?? existing.name,
          type: (input.type ?? (existing.type as 'enterprise' | 'individual')) ?? 'enterprise',
          phone: input.phone !== undefined ? input.phone : existing.phone,
        },
        id,
        this.deps.db,
      )
      if (dupe) {
        const ownerName =
          dupe.ownerUserId !== null
            ? (await CustomerRepository.findOwnerNamesByUserIds([dupe.ownerUserId], this.deps.db)).get(
                dupe.ownerUserId,
              ) ?? null
            : null
        throw new BusinessError(
          CrmErrorCode.CRM_CUSTOMER_DUPLICATE,
          '发现疑似重复客户',
          JSON.stringify({
            existingCustomerId: dupe.id,
            existingCustomerName: dupe.name,
            ownerUserId: dupe.ownerUserId,
            ownerUserName: ownerName,
          }),
        )
      }
    }

    // 校验 statusId / sourceId
    if (input.statusId !== undefined && input.statusId !== null) {
      const exists = await StatusRepository.findById(input.statusId, this.deps.db)
      if (!exists) {
        throw new BusinessError(CrmErrorCode.CRM_STATUS_NOT_FOUND, '客户状态不存在')
      }
    }
    if (input.sourceId !== undefined && input.sourceId !== null) {
      const exists = await SourceRepository.findById(input.sourceId, this.deps.db)
      if (!exists) {
        throw new BusinessError(CrmErrorCode.CRM_SOURCE_NOT_FOUND, '客户来源不存在')
      }
    }

    const updated = await dbManager.transaction(async (tx) => {
      const row = await CustomerRepository.update(id, { ...input, updaterId: currentUser.id }, tx)
      if (!row) throw new BusinessError(CrmErrorCode.CRM_CUSTOMER_NOT_FOUND, '客户不存在')
      if (input.tagIds !== undefined) {
        await CustomerRepository.setCustomerTags(id, input.tagIds, tx)
      }
      return row
    })

    return updated
  }

  async remove(id: number, currentUser: DataScopeUser): Promise<void> {
    const existing = await CustomerRepository.findById(id, this.deps.db)
    if (!existing) {
      throw new BusinessError(CrmErrorCode.CRM_CUSTOMER_NOT_FOUND, '客户不存在或已删除')
    }
    await this.assertCanOperate(existing, currentUser, 'delete')
    await dbManager.transaction(async (tx) => {
      await CustomerRepository.softDelete(id, tx)
    })
  }

  /**
   * 检查当前用户是否有权操作指定客户：
   *   - update：owner 必须在数据范围内；公海客户（public）任何人都能 update 基础字段；
   *     严格策略：公海客户只允许 claim，不允许 update。
   *   - delete：仅 owner 在数据范围内可删除（不暴露公海删除）。
   */
  private async assertCanOperate(
    row: CustomerRow,
    user: DataScopeUser,
    op: 'update' | 'delete',
  ): Promise<void> {
    const scope = computeDataScope(user)
    if (scope.ownerUserIds === null) {
      // super_admin
      return
    }
    const allowedUserIds = scope.ownerUserIds ?? []
    const allowedDeptIds = scope.ownerDepartmentIds ?? []
    const inUserScope = row.ownerUserId !== null && allowedUserIds.includes(row.ownerUserId)
    const inDeptScope =
      row.ownerDepartmentId !== null && allowedDeptIds.includes(row.ownerDepartmentId)
    const inPool = row.poolStatus === 'public'

    if (op === 'update') {
      // 公海客户不允许 update：必须先认领
      if (inPool) {
        throw new BusinessError(
          CrmErrorCode.CRM_CUSTOMER_NOT_IN_POOL,
          '公海客户不能直接编辑，请先认领',
        )
      }
      if (!inUserScope && !inDeptScope) {
        throw new BusinessError(CrmErrorCode.CRM_CUSTOMER_TRANSFER_FORBIDDEN, '无权操作该客户')
      }
      return
    }

    if (op === 'delete') {
      if (!inUserScope && !inDeptScope) {
        throw new BusinessError(CrmErrorCode.CRM_CUSTOMER_TRANSFER_FORBIDDEN, '无权删除该客户')
      }
    }
  }
}
