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
import {
  CustomerMemberRepository,
  type CustomerMemberWithUser,
} from '../repositories/member.repository.js'

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

  /** My customers: private ownership intersected with the existing CRM data scope. */
  async list(args: ListCustomersArgs) {
    return this.listInDomain(args, 'private')
  }

  async listPool(args: ListCustomersArgs) {
    return this.listInDomain(args, 'pool')
  }

  async listOptions(currentUser: DataScopeUser) {
    const scope = computeDataScope(currentUser)
    const owners = await CustomerRepository.findVisibleOwners(scope, this.deps.db)
    return {
      canFilterOwners: scope.ownerUserIds === null || Boolean(scope.ownerDepartmentIds?.length) || owners.some(owner => owner.id !== currentUser.id),
      owners,
    }
  }

  private async listInDomain({
    query,
    currentUser,
  }: ListCustomersArgs, domain: 'private' | 'pool' | 'trash'): Promise<{ total: number; items: CustomerRow[]; page: number; pageSize: number }> {
    const scope = computeDataScope(currentUser)
    const merged: CustomerListQuery = {
      ...query,
      poolStatus: domain === 'private' ? 'owned' : domain === 'pool' ? 'public' : query.poolStatus,
      requireOwner: domain === 'private',
      onlyDeleted: domain === 'trash',
      ownerUserIds: scope.ownerUserIds,
      ownerDepartmentIds: scope.ownerDepartmentIds,
      collaboratorUserId: scope.collaboratorUserId,
      // view=mine / collaborating 的"我"永远取自登录态，不接受前端传 userId，
      // 否则任何人都能拿别人的 id 当 view 参数来窥探数据范围边界。
      currentUserId: currentUser.id,
    }
    const { rows, total } = await CustomerRepository.list(merged, this.deps.db)
    const [contacts, owners] = await Promise.all([
      CustomerRepository.findPrimaryContactsByCustomerIds(rows.map(row => row.id), this.deps.db),
      CustomerRepository.findOwnerNamesByUserIds([...new Set(rows.flatMap(row => row.ownerUserId == null ? [] : [row.ownerUserId]))], this.deps.db),
    ])
    return {
      total,
      items: rows.map(row => ({
        ...row,
        ownerUserName: row.ownerUserId == null ? null : owners.get(row.ownerUserId) ?? null,
        primaryContactId: contacts.get(row.id)?.id ?? null,
        primaryContactName: contacts.get(row.id)?.name ?? null,
        primaryContactMobile: contacts.get(row.id)?.mobile ?? null,
      })),
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 10,
    }
  }

  /** 回收站列表：只看已软删的客户，同样套数据范围。 */
  async listTrash({
    query,
    currentUser,
  }: ListCustomersArgs): Promise<{ total: number; items: CustomerRow[]; page: number; pageSize: number }> {
    return this.listInDomain({ query: { ...query, onlyDeleted: true }, currentUser }, 'trash')
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
      const isCollaborator =
        !inUserScope &&
        !inDeptScope &&
        !inPool &&
        scope.collaboratorUserId != null &&
        (await CustomerMemberRepository.isCollaborator(
          id,
          scope.collaboratorUserId,
          this.deps.db,
        ))
      if (!inUserScope && !inDeptScope && !inPool && !isCollaborator) {
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

  /* ─── 回收站 ─────────────────────────── */

  /**
   * 从回收站恢复客户。
   *
   * 权限沿用 delete 的判定（能删的人才能恢复）。用 CAS UPDATE 保证并发恢复只有一次生效。
   */
  async restore(id: number, currentUser: DataScopeUser): Promise<CustomerRow> {
    const existing = await CustomerRepository.findDeletedById(id, this.deps.db)
    if (!existing) {
      throw new BusinessError(CrmErrorCode.CRM_CUSTOMER_NOT_FOUND, '客户不在回收站中')
    }
    await this.assertCanOperate(existing, currentUser, 'delete')

    const affected = await CustomerRepository.restore(id, currentUser.id, this.deps.db)
    if (affected === 0) {
      // 并发：别人抢先恢复了。这不是错误状态，直接返回当前值即可。
      const current = await CustomerRepository.findById(id, this.deps.db)
      if (current) return current
      throw new BusinessError(CrmErrorCode.CRM_CUSTOMER_NOT_FOUND, '客户不存在')
    }
    const restored = await CustomerRepository.findById(id, this.deps.db)
    if (!restored) throw new BusinessError(CrmErrorCode.CRM_CUSTOMER_NOT_FOUND, '客户不存在')
    return restored
  }

  /**
   * 永久删除。只能删回收站里的客户；关联的标签桥接和协同人在同一事务里一并清掉，
   * 否则会留下指向不存在客户的孤儿行。
   *
   * 跟进记录 / 流转日志**保留**：它们是审计痕迹，不随客户消失。
   */
  async purge(id: number, currentUser: DataScopeUser): Promise<void> {
    const existing = await CustomerRepository.findDeletedById(id, this.deps.db)
    if (!existing) {
      throw new BusinessError(CrmErrorCode.CRM_CUSTOMER_NOT_FOUND, '客户不在回收站中')
    }
    await this.assertCanOperate(existing, currentUser, 'delete')

    await dbManager.transaction(async (tx) => {
      await CustomerRepository.setCustomerTags(id, [], tx)
      await CustomerMemberRepository.removeAllByCustomerId(id, tx)
      await CustomerRepository.hardDelete(id, tx)
    })
  }

  /* ─── 协同人 ─────────────────────────── */

  async listMembers(
    customerId: number,
    currentUser: DataScopeUser,
  ): Promise<CustomerMemberWithUser[]> {
    // 复用 detail 的可见性判定：能看到客户才能看到它的协同人
    await this.detail(customerId, currentUser)
    return CustomerMemberRepository.listByCustomerId(customerId, this.deps.db)
  }

  /**
   * 添加协同人。
   *
   * 负责人不进协同人表 —— owner 的唯一真相是 crm_customer.owner_user_id，
   * 把 owner 同时写成 collaborator 会让"协同客户"视图把自己的客户也算进去。
   */
  async addMember(
    customerId: number,
    userId: number,
    currentUser: DataScopeUser,
  ): Promise<CustomerMemberWithUser[]> {
    const existing = await CustomerRepository.findById(customerId, this.deps.db)
    if (!existing) {
      throw new BusinessError(CrmErrorCode.CRM_CUSTOMER_NOT_FOUND, '客户不存在或已删除')
    }
    await this.assertCanOperate(existing, currentUser, 'update')

    if (existing.ownerUserId === userId) {
      throw new BusinessError(
        CrmErrorCode.CRM_CUSTOMER_MEMBER_IS_OWNER,
        '该用户已是客户负责人，无需添加为协同人',
      )
    }

    await CustomerMemberRepository.add(customerId, userId, currentUser.id, this.deps.db)
    return CustomerMemberRepository.listByCustomerId(customerId, this.deps.db)
  }

  async removeMember(
    customerId: number,
    userId: number,
    currentUser: DataScopeUser,
  ): Promise<CustomerMemberWithUser[]> {
    const existing = await CustomerRepository.findById(customerId, this.deps.db)
    if (!existing) {
      throw new BusinessError(CrmErrorCode.CRM_CUSTOMER_NOT_FOUND, '客户不存在或已删除')
    }
    await this.assertCanOperate(existing, currentUser, 'update')
    await CustomerMemberRepository.remove(customerId, userId, this.deps.db)
    return CustomerMemberRepository.listByCustomerId(customerId, this.deps.db)
  }

  /**
   * 检查当前用户是否有权操作指定客户：
   *   - update：owner / 部门 / 协同人在数据范围内；公海客户只允许 claim，不允许 update。
   *   - delete：owner / 部门 在数据范围内可删除。协同人**不能删客户** ——
   *     协同是"一起跟进"，不是"共同处置"。
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
      if (inUserScope || inDeptScope) return
      const isCollaborator =
        scope.collaboratorUserId != null &&
        (await CustomerMemberRepository.isCollaborator(
          row.id,
          scope.collaboratorUserId,
          this.deps.db,
        ))
      if (!isCollaborator) {
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
