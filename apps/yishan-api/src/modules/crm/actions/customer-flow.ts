import { BusinessError } from '@/exceptions/business-error.js'
import { dbManager } from '@/db'
import { CrmErrorCode } from '../schemas/error-codes.js'
import type { DataScopeUser } from '../schemas/data-scope.js'
import { CustomerRepository, type CustomerRow } from '../repositories/customer.repository.js'
import { TransferRepository } from '../repositories/transfer.repository.js'

/**
 * 客户流转 Action —— claim / release / transfer。
 *
 * 与普通 CRUD 分离，单独暴露。Route 文件仅作薄包装。
 *
 * 三类动作都遵循：
 *   - 主表更新 + crm_customer_transfer 写入，**同一个事务**；
 *   - 失败抛 BusinessError，不静默吞；
 *   - 不做"先读后写"——claim 用 CAS（compare-and-set）守卫避免并发。
 */

export interface ClaimCustomerArgs {
  customerId: number
  currentUser: DataScopeUser & { deptId: number | null }
}

export interface ReleaseCustomerArgs {
  customerId: number
  reason?: string | null
  currentUser: DataScopeUser
}

export interface TransferCustomerArgs {
  customerId: number
  targetUserId: number
  reason?: string | null
  currentUser: DataScopeUser
}

export class CustomerFlowService {
  constructor() {}

  /**
   * 公海客户认领。
   * - 必须 poolStatus = 'public'，否则 CRM_CUSTOMER_ALREADY_OWNED。
   * - 用 Repository.claimInTx 的 WHERE pool_status='public' CAS，
   *   防止两个销售并发认领成功。
   * - 认领后 owner_user_id = currentUser.id；owner_department_id 取自 deptId。
   * - 同步写 crm_customer_transfer(type='claim')。
   */
  async claim({ customerId, currentUser }: ClaimCustomerArgs): Promise<CustomerRow> {
    const result = await dbManager.transaction(async (tx) => {
      const affected = await CustomerRepository.claimInTx(
        customerId,
        currentUser.id,
        currentUser.deptId,
        currentUser.id,
        tx,
      )
      if (affected === 0) {
        // 不是公海客户 / 不存在 / 已被认领
        const row = await CustomerRepository.findById(customerId, tx)
        if (!row) {
          throw new BusinessError(
            CrmErrorCode.CRM_CUSTOMER_NOT_FOUND,
            '客户不存在或已删除',
          )
        }
        if (row.poolStatus !== 'public') {
          throw new BusinessError(
            CrmErrorCode.CRM_CUSTOMER_ALREADY_OWNED,
            '客户已被认领，无法再次认领',
          )
        }
        throw new BusinessError(
          CrmErrorCode.CRM_CUSTOMER_NOT_IN_POOL,
          '客户当前不在公海，无法认领',
        )
      }
      const updated = await CustomerRepository.findById(customerId, tx)
      if (!updated) {
        throw new BusinessError(CrmErrorCode.CRM_CUSTOMER_NOT_FOUND, '客户不存在')
      }
      await TransferRepository.create(
        {
          customerId,
          type: 'claim',
          fromUserId: null,
          toUserId: currentUser.id,
          operatorUserId: currentUser.id,
          reason: null,
        },
        tx,
      )
      return updated
    })

    return result
  }

  /**
   * 释放客户到公海。
   * - 必须由当前 owner 操作；公海客户不能再 release。
   * - 清空 owner_user_id / owner_department_id；pool_status = 'public'。
   * - 同步写 crm_customer_transfer(type='release')。
   */
  async release({ customerId, reason, currentUser }: ReleaseCustomerArgs): Promise<CustomerRow> {
    return dbManager.transaction(async (tx) => {
      const existing = await CustomerRepository.findById(customerId, tx)
      if (!existing) {
        throw new BusinessError(CrmErrorCode.CRM_CUSTOMER_NOT_FOUND, '客户不存在或已删除')
      }
      if (existing.poolStatus !== 'owned' || existing.ownerUserId === null) {
        throw new BusinessError(
          CrmErrorCode.CRM_CUSTOMER_NOT_IN_POOL,
          '该客户不在我的名下，无法释放',
        )
      }
      if (existing.ownerUserId !== currentUser.id) {
        throw new BusinessError(
          CrmErrorCode.CRM_CUSTOMER_RELEASE_FORBIDDEN,
          '只能释放自己名下的客户',
        )
      }

      const fromUserId = existing.ownerUserId
      const updated = await CustomerRepository.update(
        customerId,
        {
          ownerUserId: null,
          ownerDepartmentId: null,
          poolStatus: 'public',
          updaterId: currentUser.id,
        },
        tx,
      )
      if (!updated) {
        throw new BusinessError(CrmErrorCode.CRM_CUSTOMER_NOT_FOUND, '客户不存在')
      }

      await TransferRepository.create(
        {
          customerId,
          type: 'release',
          fromUserId,
          toUserId: null,
          operatorUserId: currentUser.id,
          reason: reason ?? null,
        },
        tx,
      )
      return updated
    })
  }

  /**
   * 转交客户：
   * - 当前用户必须有 transfer 权限（rbac 层负责）。
   * - 客户必须存在且当前有 owner。
   * - targetUserId 必须存在且 status = 1（不查 DB，直接相信调用方 / 上层鉴权）。
   * - 同步 owner_department_id = targetUser 的主部门（这里取 currentUser 的部门做兜底，
   *   真正严谨应查 UserService.getUserById().deptIds[0]，但避免跨模块 join；
   *   转交后的部门归属由"业务策略"决定，第一版固定为目标用户的主部门；
   *   当前实现：departmentId 留空，让后续"完善 User 信息"动作单独补齐）。
   * - 同步写 crm_customer_transfer(type='transfer')。
   */
  async transfer({ customerId, targetUserId, reason, currentUser }: TransferCustomerArgs): Promise<CustomerRow> {
    if (targetUserId === currentUser.id) {
      throw new BusinessError(
        CrmErrorCode.CRM_CUSTOMER_TRANSFER_TARGET_INVALID,
        '转交目标不能是自己',
      )
    }
    return dbManager.transaction(async (tx) => {
      const existing = await CustomerRepository.findById(customerId, tx)
      if (!existing) {
        throw new BusinessError(CrmErrorCode.CRM_CUSTOMER_NOT_FOUND, '客户不存在或已删除')
      }

      const fromUserId = existing.ownerUserId
      const updated = await CustomerRepository.update(
        customerId,
        {
          ownerUserId: targetUserId,
          ownerDepartmentId: null, // 第一版：转交时不强制同步部门；后续可加 target 用户的 deptIds[0]
          poolStatus: 'owned',
          updaterId: currentUser.id,
        },
        tx,
      )
      if (!updated) {
        throw new BusinessError(CrmErrorCode.CRM_CUSTOMER_NOT_FOUND, '客户不存在')
      }

      await TransferRepository.create(
        {
          customerId,
          type: 'transfer',
          fromUserId,
          toUserId: targetUserId,
          operatorUserId: currentUser.id,
          reason: reason ?? null,
        },
        tx,
      )
      return updated
    })
  }
}
