import { BusinessError } from '@/exceptions/business-error.js'
import { dbManager, type AppQueryDb } from '@/db'
import { CrmErrorCode } from '../schemas/error-codes.js'
import { ACTIVITY_TYPES } from '../schemas/activity.schema.js'
import type { DataScopeUser } from '../schemas/data-scope.js'
import { computeDataScope } from '../schemas/data-scope.js'
import {
  ActivityRepository,
  type ActivityRowWithOperator,
  type CreateActivityInput,
} from '../repositories/activity.repository.js'
import { CustomerRepository } from '../repositories/customer.repository.js'

/**
 * ActivityService —— 跟进记录业务编排。
 *
 * 关键不变量：
 *   - 新增跟进必须与"更新 crm_customer.last_follow_up_at / next_follow_up_at"在同一个事务；
 *   - 失败 → 整体回滚。
 */

export class ActivityService {
  constructor(private readonly deps: { db?: AppQueryDb } = {}) {}

  async listByCustomerId(
    customerId: number,
    currentUser: DataScopeUser,
    opts: { limit?: number } = {},
  ): Promise<{ total: number; items: ActivityRowWithOperator[] }> {
    const customer = await CustomerRepository.findById(customerId, this.deps.db)
    if (!customer) {
      throw new BusinessError(CrmErrorCode.CRM_CUSTOMER_NOT_FOUND, '客户不存在')
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
        throw new BusinessError(CrmErrorCode.CRM_CUSTOMER_NOT_FOUND, '客户不存在')
      }
    }
    return ActivityRepository.list({ customerId }, this.deps.db).then((r) => ({
      total: r.total,
      items: r.rows,
    }))
  }

  async create(
    customerId: number,
    input: Omit<CreateActivityInput, 'customerId' | 'operatorUserId'>,
    currentUser: DataScopeUser,
  ): Promise<ActivityRowWithOperator> {
    const customer = await CustomerRepository.findById(customerId, this.deps.db)
    if (!customer) {
      throw new BusinessError(CrmErrorCode.CRM_CUSTOMER_NOT_FOUND, '客户不存在')
    }

    // 数据范围：仅 owner / 部门 / super_admin 可写跟进；公海客户必须先认领
    const scope = computeDataScope(currentUser)
    if (scope.ownerUserIds !== null) {
      const inUserScope =
        customer.ownerUserId !== null && (scope.ownerUserIds ?? []).includes(customer.ownerUserId)
      const inDeptScope =
        customer.ownerDepartmentId !== null &&
        (scope.ownerDepartmentIds ?? []).includes(customer.ownerDepartmentId)
      if (!inUserScope && !inDeptScope) {
        throw new BusinessError(CrmErrorCode.CRM_CUSTOMER_TRANSFER_FORBIDDEN, '无权为此客户写跟进')
      }
    }

    if (!(ACTIVITY_TYPES as readonly string[]).includes(input.type)) {
      throw new BusinessError(CrmErrorCode.CRM_ACTIVITY_TYPE_INVALID, '跟进方式不合法')
    }

    const occurredAt = input.occurredAt ?? new Date()
    const nextFollowUpAt = input.nextFollowUpAt ?? null

    return dbManager.transaction(async (tx) => {
      const activity = await ActivityRepository.create(
        {
          customerId,
          contactId: input.contactId ?? null,
          type: input.type,
          content: input.content,
          occurredAt,
          nextFollowUpAt,
          operatorUserId: currentUser.id,
        },
        tx,
      )

      // 同步更新客户跟进时间
      await CustomerRepository.update(
        customerId,
        {
          lastFollowUpAt: occurredAt,
          nextFollowUpAt,
          updaterId: currentUser.id,
        },
        tx,
      )

      // 返回带 operator 名
      const list = await ActivityRepository.listByCustomerId(customerId, { limit: 1 }, tx)
      return list[0] ?? { ...activity, operatorUserName: null }
    })
  }
}
