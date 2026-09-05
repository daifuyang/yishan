import { BusinessError } from '@/exceptions/business-error.js'
import { dbManager, type AppQueryDb } from '@/db'
import { CrmErrorCode } from '../schemas/error-codes.js'
import { ACTIVITY_TYPES } from '../schemas/activity.schema.js'
import type { DataScopeUser } from '../schemas/data-scope.js'
import { computeDataScope } from '../schemas/data-scope.js'
import {
  ActivityRepository,
  type ActivityRow,
  type ActivityRowWithOperator,
  type CreateActivityInput,
  type UpdateActivityInput,
} from '../repositories/activity.repository.js'
import { CustomerRepository, type CustomerRow } from '../repositories/customer.repository.js'
import { CustomerMemberRepository } from '../repositories/member.repository.js'

/**
 * ActivityService —— 跟进记录业务编排。
 *
 * 关键不变量：
 *   - 任何会改变跟进集合的操作（新增 / 编辑 / 删除）都必须与
 *     "重算 crm_customer.last_follow_up_at / next_follow_up_at" 在同一个事务；
 *   - 失败 → 整体回滚；
 *   - 客户的跟进时间**永远**由 ActivityRepository.computeFollowUpState 从现存记录推出，
 *     不由"本次操作的那条记录"直接决定（补录 / 删除最新一条都要正确）。
 */

export class ActivityService {
  constructor(private readonly deps: { db?: AppQueryDb } = {}) {}

  /**
   * 读可见性：owner / 部门 / 协同人 / super_admin，公海客户所有人可读。
   * 越权一律报 CUSTOMER_NOT_FOUND，不泄漏客户是否存在。
   */
  private async assertCanRead(
    customerId: number,
    currentUser: DataScopeUser,
  ): Promise<CustomerRow> {
    const customer = await CustomerRepository.findById(customerId, this.deps.db)
    if (!customer) {
      throw new BusinessError(CrmErrorCode.CRM_CUSTOMER_NOT_FOUND, '客户不存在')
    }
    const scope = computeDataScope(currentUser)
    if (scope.ownerUserIds === null) return customer

    const inUserScope =
      customer.ownerUserId !== null && (scope.ownerUserIds ?? []).includes(customer.ownerUserId)
    const inDeptScope =
      customer.ownerDepartmentId !== null &&
      (scope.ownerDepartmentIds ?? []).includes(customer.ownerDepartmentId)
    const inPool = customer.poolStatus === 'public'
    if (inUserScope || inDeptScope || inPool) return customer

    const isCollaborator =
      scope.collaboratorUserId != null &&
      (await CustomerMemberRepository.isCollaborator(
        customerId,
        scope.collaboratorUserId,
        this.deps.db,
      ))
    if (isCollaborator) return customer

    throw new BusinessError(CrmErrorCode.CRM_CUSTOMER_NOT_FOUND, '客户不存在')
  }

  /**
   * 写权限：owner / 部门 / 协同人 / super_admin。
   * 公海客户**不允许**写跟进 —— 必须先认领（README §7.2）。
   */
  private async assertCanWrite(
    customerId: number,
    currentUser: DataScopeUser,
  ): Promise<CustomerRow> {
    const customer = await CustomerRepository.findById(customerId, this.deps.db)
    if (!customer) {
      throw new BusinessError(CrmErrorCode.CRM_CUSTOMER_NOT_FOUND, '客户不存在')
    }
    const scope = computeDataScope(currentUser)
    if (scope.ownerUserIds === null) return customer

    const inUserScope =
      customer.ownerUserId !== null && (scope.ownerUserIds ?? []).includes(customer.ownerUserId)
    const inDeptScope =
      customer.ownerDepartmentId !== null &&
      (scope.ownerDepartmentIds ?? []).includes(customer.ownerDepartmentId)
    if (inUserScope || inDeptScope) return customer

    const isCollaborator =
      scope.collaboratorUserId != null &&
      (await CustomerMemberRepository.isCollaborator(
        customerId,
        scope.collaboratorUserId,
        this.deps.db,
      ))
    if (isCollaborator) return customer

    throw new BusinessError(CrmErrorCode.CRM_CUSTOMER_TRANSFER_FORBIDDEN, '无权为此客户写跟进')
  }

  /** 跟进记录的时间重算：写在事务里，create / update / remove 共用。 */
  private static async syncCustomerFollowUp(
    customerId: number,
    updaterId: number,
    tx: AppQueryDb,
  ): Promise<void> {
    const state = await ActivityRepository.computeFollowUpState(customerId, tx)
    await CustomerRepository.update(
      customerId,
      {
        lastFollowUpAt: state.lastFollowUpAt,
        nextFollowUpAt: state.nextFollowUpAt,
        updaterId,
      },
      tx,
    )
  }

  async listByCustomerId(
    customerId: number,
    currentUser: DataScopeUser,
    opts: { limit?: number } = {},
  ): Promise<{ total: number; items: ActivityRowWithOperator[] }> {
    await this.assertCanRead(customerId, currentUser)
    const r = await ActivityRepository.list({ customerId, limit: opts.limit }, this.deps.db)
    return { total: r.total, items: r.rows }
  }

  async findById(id: number, currentUser: DataScopeUser): Promise<ActivityRow> {
    const activity = await ActivityRepository.findById(id, this.deps.db)
    if (!activity) {
      throw new BusinessError(CrmErrorCode.CRM_ACTIVITY_NOT_FOUND, '跟进记录不存在')
    }
    await this.assertCanRead(activity.customerId, currentUser)
    return activity
  }

  async create(
    customerId: number,
    input: Omit<CreateActivityInput, 'customerId' | 'operatorUserId' | 'occurredAt' | 'nextFollowUpAt'> & { occurredAt?: Date | string; nextFollowUpAt?: Date | string | null },
    currentUser: DataScopeUser,
  ): Promise<ActivityRowWithOperator> {
    await this.assertCanWrite(customerId, currentUser)

    if (!(ACTIVITY_TYPES as readonly string[]).includes(input.type)) {
      throw new BusinessError(CrmErrorCode.CRM_ACTIVITY_TYPE_INVALID, '跟进方式不合法')
    }

    return dbManager.transaction(async (tx) => {
      const activity = await ActivityRepository.create(
        {
          customerId,
          contactId: input.contactId ?? null,
          type: input.type,
          content: input.content,
          occurredAt: typeof input.occurredAt === 'string' ? new Date(input.occurredAt) : input.occurredAt ?? new Date(),
          nextFollowUpAt: typeof input.nextFollowUpAt === 'string' ? new Date(input.nextFollowUpAt) : input.nextFollowUpAt ?? null,
          operatorUserId: currentUser.id,
        },
        tx,
      )

      await ActivityService.syncCustomerFollowUp(customerId, currentUser.id, tx)

      const list = await ActivityRepository.listByCustomerId(customerId, { limit: 1 }, tx)
      return list[0] ?? { ...activity, operatorUserName: null }
    })
  }

  /**
   * 编辑跟进。改了 occurredAt / nextFollowUpAt 都可能让客户的跟进时间失效，
   * 所以无条件重算，而不是只在"看起来相关"时才算。
   */
  async update(
    id: number,
    input: Omit<UpdateActivityInput, 'occurredAt' | 'nextFollowUpAt'> & { occurredAt?: Date | string; nextFollowUpAt?: Date | string | null },
    currentUser: DataScopeUser,
  ): Promise<ActivityRow> {
    const activity = await ActivityRepository.findById(id, this.deps.db)
    if (!activity) {
      throw new BusinessError(CrmErrorCode.CRM_ACTIVITY_NOT_FOUND, '跟进记录不存在')
    }
    await this.assertCanWrite(activity.customerId, currentUser)

    if (input.type !== undefined && !(ACTIVITY_TYPES as readonly string[]).includes(input.type)) {
      throw new BusinessError(CrmErrorCode.CRM_ACTIVITY_TYPE_INVALID, '跟进方式不合法')
    }

    return dbManager.transaction(async (tx) => {
      const updated = await ActivityRepository.update(id, {
        ...input,
        occurredAt: typeof input.occurredAt === 'string' ? new Date(input.occurredAt) : input.occurredAt,
        nextFollowUpAt: typeof input.nextFollowUpAt === 'string' ? new Date(input.nextFollowUpAt) : input.nextFollowUpAt,
      }, tx)
      if (!updated) {
        throw new BusinessError(CrmErrorCode.CRM_ACTIVITY_NOT_FOUND, '跟进记录不存在')
      }
      await ActivityService.syncCustomerFollowUp(activity.customerId, currentUser.id, tx)
      return updated
    })
  }

  /**
   * 删除跟进（软删）。删掉最新一条后，客户的"最近跟进"会回落到次新一条，
   * "下次跟进"回落到剩余记录里最近一条填过下次跟进时间的值 —— 全部由重算保证。
   */
  async remove(id: number, currentUser: DataScopeUser): Promise<void> {
    const activity = await ActivityRepository.findById(id, this.deps.db)
    if (!activity) {
      throw new BusinessError(CrmErrorCode.CRM_ACTIVITY_NOT_FOUND, '跟进记录不存在')
    }
    await this.assertCanWrite(activity.customerId, currentUser)

    await dbManager.transaction(async (tx) => {
      await ActivityRepository.softDelete(id, tx)
      await ActivityService.syncCustomerFollowUp(activity.customerId, currentUser.id, tx)
    })
  }
}
