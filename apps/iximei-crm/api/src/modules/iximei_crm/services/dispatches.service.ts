import { BusinessError } from '@yishan/core-api/errors'
import { ResourceErrorCode } from '@yishan/core-api/business-codes/resource'
import { ValidationErrorCode } from '@yishan/core-api/business-codes/validation'
import { AuthErrorCode } from '@yishan/core-api/business-codes/auth'
import { withDbErrorMapping } from '@/modules/iximei_crm/utils/db-error'
import { DispatchesRepository } from '../repositories/dispatches.repository.js'
import { HospitalsRepository } from '../repositories/hospitals.repository.js'
import { CustomersRepository } from '../repositories/customers.repository.js'
import { compact, asDate, sanitizeReplyContent, hasReplyContent, sanitizeDispatchReplies, pageArgs } from './_shared.js'
import { DATA_SCOPE, type DataScopeCode } from '@/modules/iximei_crm/access-scope'
import { optionalString } from '../_validation.js'
import { ROLE_IDS } from '@/modules/iximei_crm/role-codes'

/**
 * 三种角色的派单数据范围:
 * - super_admin: 看全部 (lift)
 * - hospital_account: 关联自己医院的派单 (crm_hospital_account.hospital_id in own)
 * - customer_service / 默认 SELF: 自己添加的客户的派单 (crm_customer.owner_user_id = self)
 * - admin / 其它: 走 dataScope 字段（默认 SELF）
 */
async function dispatchFilters(
  roleIds: ReadonlyArray<number>,
  userId: number,
): Promise<{ hospitalIds?: number[]; creatorUserIds?: number[] }> {
  if (roleIds.includes(ROLE_IDS.SUPER_ADMIN)) return {}
  if (roleIds.includes(ROLE_IDS.HOSPITAL_ACCOUNT)) {
    const ids = await HospitalsRepository.accessibleHospitalIds(userId)
    return { hospitalIds: ids.map((x: any) => x.hospitalId) }
  }
  return { creatorUserIds: [userId] }
}

/**
 * 把 11 位手机号脱敏成 138****1234 形式；非 11 位数字原样返回。
 * 派单列表 / 详情接口在 HOSPITAL_ACCOUNT 视角下调用，避免医院账号未授权看到明文。
 */
function maskPhone(phone?: string | null): string | null {
  if (!phone) return phone ?? null
  const s = String(phone).trim()
  if (!/^\d{11}$/.test(s)) return s || null
  return `${s.slice(0, 3)}****${s.slice(7)}`
}

/**
 * 给派单对象的 customer.mobile 脱敏；hospital 视角调用，其它角色保持原样。
 * 同时给 customer 增加 mobileMasked 字段（医院视角下原 mobile 字段置 null）。
 */
function maskDispatchForHospital<T extends { customer?: { mobile?: string | null } | null }>(
  dispatch: T | null,
  roleIds: ReadonlyArray<number>,
): T | null {
  if (!dispatch) return dispatch
  if (!roleIds.includes(ROLE_IDS.HOSPITAL_ACCOUNT)) return dispatch
  const c: any = dispatch.customer
  if (!c) return dispatch
  const original = c.mobile
  return {
    ...dispatch,
    customer: {
      ...c,
      mobile: null,
      mobileMasked: maskPhone(original),
    },
  }
}

export class DispatchesService {
  static async listStatuses() {
    await CustomersRepository.ensureDefaultStatuses()
    return DispatchesRepository.listStatuses()
  }

  static async list(
    q: any,
    userId: number,
    roleIds: ReadonlyArray<number>,
    scope: DataScopeCode,
  ) {
    const p = pageArgs(q)
    const extra = await dispatchFilters(roleIds, userId)
    const result: any = await DispatchesRepository.list({ ...q, ...p, ...extra })
    const isHospital = roleIds.includes(ROLE_IDS.HOSPITAL_ACCOUNT)
    const list = (result.list || []).map((d: any) => {
      const cleaned = sanitizeDispatchReplies(d)
      return isHospital ? maskDispatchForHospital(cleaned, roleIds) : cleaned
    })
    return { ...result, list, ...p }
  }

  static async getById(
    id: number,
    userId: number,
    roleIds: ReadonlyArray<number>,
    scope: DataScopeCode,
    req?: any,
  ) {
    const d: any = await DispatchesRepository.findById(id)
    if (!d) return null
    if (roleIds.includes(ROLE_IDS.SUPER_ADMIN)) return sanitizeDispatchReplies(d)
    if (roleIds.includes(ROLE_IDS.HOSPITAL_ACCOUNT)) {
      const ids = (await HospitalsRepository.accessibleHospitalIds(userId)).map((x: any) => x.hospitalId)
      if (!ids.includes(d.hospitalId)) return null
      // 医院账号首次访问自动写 view_log —— 写日志失败不阻塞详情接口。
      const user = req?.currentUser
      const ip = req?.ip ?? null
      void DispatchesRepository.recordView({
        dispatchId: d.id,
        hospitalId: d.hospitalId,
        viewerUserId: userId,
        viewerUsername: user?.username ?? '',
        viewerHospitalName: user?.hospitalName ?? null,
        ipAddress: ip,
      }).catch(() => {})
    } else {
      if (d.creatorId !== userId && scope === DATA_SCOPE.SELF) return null
    }
    const cleaned = sanitizeDispatchReplies(d)
    return maskDispatchForHospital(cleaned, roleIds)
  }

  static async update(
    id: number,
    input: any,
    userId: number,
    roleIds: ReadonlyArray<number>,
    scope: DataScopeCode,
  ) {
    if (!(await this.getById(id, userId, roleIds, scope))) {
      throw new BusinessError(ResourceErrorCode.NOT_FOUND, '派单不存在或无权访问')
    }
    return withDbErrorMapping(() => DispatchesRepository.update(
      id,
      compact({
        hospitalId: input.hospitalId,
        statusId: input.statusId,
        image: optionalString(input.image, { field: '派单图片', max: 500 }) ?? undefined,
        receiveQq: optionalString(input.receiveQq, { field: '医院 QQ', max: 50 }) ?? undefined,
        receiveWechat: optionalString(input.receiveWechat, { field: '医院微信', max: 50 }) ?? undefined,
        finishedAt: asDate(input.finishedAt),
        updaterId: userId,
      }),
    ))
  }

  static async addReply(
    id: number,
    input: any,
    userId: number,
    roleIds: ReadonlyArray<number>,
    scope: DataScopeCode,
  ) {
    if (!(await this.getById(id, userId, roleIds, scope))) {
      throw new BusinessError(ResourceErrorCode.NOT_FOUND, '派单不存在或无权访问')
    }
    const content = input.content === undefined ? undefined : sanitizeReplyContent(input.content)
    if (content !== undefined && !hasReplyContent(content)) {
      throw new BusinessError(ValidationErrorCode.MISSING_PARAMETER, '留言不能为空')
    }
    return withDbErrorMapping(() => DispatchesRepository.reply(
      id,
      compact({
        receiveQq: optionalString(input.receiveQq, { field: '医院 QQ', max: 50 }) ?? undefined,
        receiveWechat: optionalString(input.receiveWechat, { field: '医院微信', max: 50 }) ?? undefined,
        image: optionalString(input.image, { field: '派单图片', max: 500 }) ?? undefined,
        statusId: input.statusId,
        updaterId: userId,
      }),
      userId,
      content,
    ))
  }

  static async addLog(
    id: number,
    content: string,
    userId: number,
    roleIds: ReadonlyArray<number>,
    scope: DataScopeCode,
  ) {
    if (!(await this.getById(id, userId, roleIds, scope))) {
      throw new BusinessError(ResourceErrorCode.NOT_FOUND, '派单不存在或无权访问')
    }
    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new BusinessError(ValidationErrorCode.MISSING_PARAMETER, '跟进内容不能为空')
    }
    return withDbErrorMapping(() => DispatchesRepository.addLog(id, userId, content))
  }

  static async delete(
    id: number,
    userId: number,
    roleIds: ReadonlyArray<number>,
    scope: DataScopeCode,
  ) {
    if (!(await this.getById(id, userId, roleIds, scope))) {
      throw new BusinessError(ResourceErrorCode.NOT_FOUND, '派单不存在或无权访问')
    }
    return withDbErrorMapping(() => DispatchesRepository.update(id, { deletedAt: new Date(), updaterId: userId }))
  }

  static async exportAll(
    q: any,
    userId: number,
    roleIds: ReadonlyArray<number>,
    scope: DataScopeCode,
  ) {
    const extra = await dispatchFilters(roleIds, userId)
    return DispatchesRepository.exportAll({ ...q, ...extra })
  }

  // ── 医院账号：查看派单客户手机号明文（写日志） ──

  /**
   * 仅 hospital_account 实际会触发此接口；其它角色（含 super_admin）拿到 getById
   * 时本来就看得到明文，本方法对它们也是幂等的（写日志 + 返回明文）。
   * 写日志失败不阻塞明文返回，否则会让"已记日志但接口失败"或"接口失败但未记日志"
   * 两种状态都不收敛。
   */
  static async viewDispatchMobile(
    id: number,
    userId: number,
    username: string,
    roleIds: ReadonlyArray<number>,
    scope: DataScopeCode,
    meta: { ip?: string | null; hospitalName?: string | null },
  ): Promise<{ mobile: string | null }> {
    const d: any = await DispatchesRepository.findById(id)
    if (!d) {
      throw new BusinessError(ResourceErrorCode.NOT_FOUND, '派单不存在')
    }
    // 数据范围校验（与 getById 一致）
    if (roleIds.includes(ROLE_IDS.HOSPITAL_ACCOUNT)) {
      const ids = (await HospitalsRepository.accessibleHospitalIds(userId)).map((x: any) => x.hospitalId)
      if (!ids.includes(d.hospitalId)) {
        throw new BusinessError(ResourceErrorCode.NOT_FOUND, '派单不存在或无权访问')
      }
    } else if (!roleIds.includes(ROLE_IDS.SUPER_ADMIN)) {
      if (d.creatorId !== userId && scope === DATA_SCOPE.SELF) {
        throw new BusinessError(ResourceErrorCode.NOT_FOUND, '派单不存在或无权访问')
      }
    }

    await withDbErrorMapping(() =>
      DispatchesRepository.recordMobileView({
        dispatchId: id,
        viewerUserId: userId,
        viewerUsername: username,
        viewerHospitalName: meta.hospitalName ?? null,
        ipAddress: meta.ip ?? null,
      }),
    ).catch(() => {})

    return { mobile: d.customer?.mobile ?? null }
  }

  // ── super_admin：列出某派单的全部手机号查看记录 ──

  static async listDispatchMobileViews(
    id: number,
    userId: number,
    roleIds: ReadonlyArray<number>,
    scope: DataScopeCode,
  ) {
    // 双重门禁：路由层 PERMS.DISPATCH_VIEW_MOBILE_LOGS，这里再校验 super_admin。
    if (!roleIds.includes(ROLE_IDS.SUPER_ADMIN)) {
      throw new BusinessError(AuthErrorCode.FORBIDDEN, '仅系统管理员可查看手机号查看日志')
    }
    const exists = await DispatchesRepository.findById(id)
    if (!exists) {
      throw new BusinessError(ResourceErrorCode.NOT_FOUND, '派单不存在')
    }
    const rows = await DispatchesRepository.listMobileViews(id)
    return {
      list: rows.map((r: any) => ({
        id: Number(r.id),
        dispatchId: Number(r.dispatchId),
        viewerUserId: Number(r.viewerUserId),
        viewerUsername: String(r.viewerUsername),
        viewerHospitalName: r.viewerHospitalName ?? null,
        ipAddress: r.ipAddress ?? null,
        createdAt:
          r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
      })),
    }
  }

  // ── super_admin / admin：列出某派单的全部医院查看记录 ──

  static async listDispatchHospitalViewLogs(
    id: number,
    userId: number,
    roleIds: ReadonlyArray<number>,
    scope: DataScopeCode,
  ) {
    if (!roleIds.includes(ROLE_IDS.SUPER_ADMIN) && !roleIds.includes(ROLE_IDS.ADMIN)) {
      throw new BusinessError(AuthErrorCode.FORBIDDEN, '仅系统管理员可查看医院查看日志')
    }
    const d = await DispatchesRepository.findById(id)
    if (!d) throw new BusinessError(ResourceErrorCode.NOT_FOUND, '派单不存在')
    const logs = await DispatchesRepository.listViewLogs(id)
    // 显式 map：listViewLogs 只做裸 select()，字段名 / 类型与 schema 声明不一致。
    //   - 表格里叫 viewer_hospital_name（"哪家医院的账号查看了"），schema 字段名为 hospitalName，
    //     沿用 schema 命名避免破坏 OpenAPI 契约。
    //   - createdAt 是 Date 对象，schema 声明 format: 'date-time' 字符串 → ISO 8601。
    const list = (logs as any[]).map((r) => ({
      id: Number(r.id),
      dispatchId: Number(r.dispatchId),
      hospitalId: Number(r.hospitalId),
      hospitalName: r.viewerHospitalName ?? null,
      viewerUserId: Number(r.viewerUserId),
      viewerUsername: String(r.viewerUsername),
      ipAddress: r.ipAddress ?? null,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    }))
    return { list }
  }
}
void compact
