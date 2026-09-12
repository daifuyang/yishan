/**
 * 报价单服务（Phase 2 Quotation）。
 *
 * 设计原则：
 *   - ownerUserId 始终从 currentUser.id 派生；不接受客户端传入。
 *   - status 字段只能由显式的状态机方法变更；update 仅允许 draft 阶段改主表 + items。
 *   - 状态机迁移全部走 dbManager.transaction + 行锁 + 状态日志写库。
 *   - 金额一律走 utils/money；不在 service 内做浮点乘除。
 *   - 可见性：默认沿用 sales 角色按 ownerUserId / ownerDepartmentId 过滤；
 *     后续若引入公海报价再扩 data-scope。
 *
 * 状态机（白名单 + 显式 if）：
 *   draft    → sent            （sendQuotation）
 *   sent     → accepted        （acceptQuotation）
 *   sent     → rejected        （rejectQuotation）
 *   draft | sent → voided      （voidQuotation）
 *   accepted（被同 opportunity 新版覆盖）→ superseded  （acceptQuotation 内部自动）
 *   accepted 不可编辑、不可作废、不可 reject
 */
import { dbManager, drizzleDb } from '@/db'
import { BusinessError } from '@/exceptions/business-error.js'
import { computeLineAmountCents, sumCents } from '@/utils/money.js'
import { computeDataScope, type DataScopeUser } from '../schemas/data-scope.js'
import { CrmErrorCode } from '../schemas/error-codes.js'
import {
  QUOTATION_STATUS,
  type QuotationCreateReq,
  type QuotationStatus,
  type QuotationUpdateReq,
} from '../schemas/quotation.schema.js'
import {
  QuotationRepository,
  type CreateQuotationItemInput,
  type QuotationItemRow,
  type QuotationListQuery,
  type QuotationRow,
  type QuotationStatusLogRow,
} from '../repositories/quotation.repository.js'

/**
 * 详情响应：主表 + items[]，均来自仓库 Row（DB Date）。
 * 路由层在序列化时由 fast-json-stringify 转 date-time 字符串。
 */
export interface QuotationDetailResp {
  head: QuotationRow
  items: QuotationItemRow[]
}

const STATUS_LABELS: Record<QuotationStatus, string> = {
  draft: '草稿',
  sent: '已发送',
  accepted: '已接受',
  rejected: '已拒绝',
  voided: '已作废',
  superseded: '已被新版替代',
}

/**
 * 单条 item 的最终金额分摊：依据 crm_quotation_item 的 lineAmountCents 直接采用，
 * 不在此处再做"重算 / 一致性校验"，避免 db 写完又被 service 二次算错覆盖。
 * 计算发生在 createDraft / updateDraft，service 用 helper 汇总：
 */
interface ItemsTotals {
  netCents: number
  taxCents: number
  totalCents: number
  items: CreateQuotationItemInput[]
}

/**
 * 根据「每行 unit price × qty × (1 − discount) × (1 + taxRate)」计算明细行与总额。
 * 所有金额进入 DB 时是已经计算好的 cents；服务层不二次重算总额。
 *
 * - netCents  = Σ item.unitPriceCents × qty/10000 × (1 - discountBp/10000)   税前
 * - taxCents  = Σ item.net × taxRateBp/10000                                  税额
 * - totalCents = Σ item.lineAmountCents                                       总价
 */
function computeItemsTotals(items: NonNullable<QuotationCreateReq['items']> | NonNullable<QuotationUpdateReq['items']>): ItemsTotals {
  const out: CreateQuotationItemInput[] = []
  const netList: number[] = []
  const totalList: number[] = []
  let sort = 0
  for (const it of items) {
    const qty = it.quantityCents
    const unitPriceCents = it.unitPriceCents
    const discountBp = it.discountBp ?? 0
    const taxRateBp = it.taxRateBp ?? 0
    const lineAmountCents = computeLineAmountCents({ qty, unitPriceCents, discountBp, taxRateBp })
    // net = unitPrice × qty × (1 − discount)
    const netFactor = (qty / 10000) * (10000 - discountBp) / 10000
    const net = Math.round(unitPriceCents * netFactor)
    out.push({
      quotationId: 0, // service 在插入前会重写为实际 id；create 时由 repository 处理
      productId: it.productId,
      productNameSnapshot: it.productNameSnapshot ?? '',
      unitSnapshot: it.unitSnapshot ?? null,
      quantityCents: qty,
      unitPriceCents,
      discountBp,
      taxRateBp,
      lineAmountCents,
      sortOrder: sort++,
    })
    netList.push(net)
    totalList.push(lineAmountCents)
  }
  const netCents = sumCents(netList)
  const totalCents = sumCents(totalList)
  // tax = total - net（保证 3 个数一致，不做重复乘除）
  const taxCents = totalCents - netCents
  return { netCents, taxCents, totalCents, items: out }
}

/**
 * 生成 quotationNo：Q-yyyyMMdd-后缀 4 位递增。
 * 不依赖 sequence；冲突由 uniq index 兜底（出现时重试一次）。
 */
function genQuotationNo(todayCount: number): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const seq = String(todayCount + 1).padStart(4, '0')
  return `Q-${yyyy}${mm}${dd}-${seq}`
}

export class QuotationService {
  /**
   * 列表。data-scope：与 LeadService/CustomerService 一致，按 role.dataScope 收敛。
   */
  async list(query: QuotationListQuery, currentUser: DataScopeUser): Promise<{ items: QuotationRow[]; total: number; page: number; pageSize: number }> {
    const scope = computeDataScope(currentUser)
    const result = await QuotationRepository.list({ ...query, ...scope })
    return {
      items: result.rows,
      total: result.total,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 10,
    }
  }

  /** 详情：主表 + items[]。 */
  async findDetailById(quotationId: number, currentUser: DataScopeUser): Promise<QuotationDetailResp> {
    const row = await this.getAccessibleQuotation(quotationId, currentUser)
    const items = await QuotationRepository.listItemsByQuotationId(row.id)
    return { head: row, items }
  }

  /** 状态审计列表。 */
  async listStatusLogs(quotationId: number, currentUser: DataScopeUser): Promise<{ total: number; items: QuotationStatusLogRow[] }> {
    await this.getAccessibleQuotation(quotationId, currentUser)
    const items = await QuotationRepository.listStatusLogs(quotationId)
    return { total: items.length, items }
  }

  /**
   * 创建 draft 报价。
   *
   * 必填 customerId + items；service 自动绑定 ownerUserId = currentUser.id、status = draft、
   * version = 1、生成 quotationNo。
   */
  async createDraft(input: QuotationCreateReq, currentUser: DataScopeUser): Promise<QuotationDetailResp> {
    if (!input.items || input.items.length === 0) {
      throw new BusinessError(CrmErrorCode.CRM_QUOTATION_ITEMS_REQUIRED, '报价单至少要有一条商品')
    }
    const totals = computeItemsTotals(input.items)
    // 单号生成：用本日 prefix + 当前 count + 1；uniq index 兜底，重试一次。
    const today = new Date()
    const prefix = `Q-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}-`
    const tryCreate = async (attempt: number): Promise<{ id: number; quotationNo: string }> => {
      const count = await QuotationRepository.countTodayByNoPrefix(prefix)
      const quotationNo = genQuotationNo(count + attempt - 1)
      const { id } = await QuotationRepository.create({
        quotationNo,
        customerId: input.customerId,
        opportunityId: input.opportunityId ?? null,
        contactId: input.contactId ?? null,
        ownerUserId: currentUser.id,
        status: 'draft',
        validUntil: input.validUntil ? new Date(input.validUntil) : null,
        netCents: totals.netCents,
        taxCents: totals.taxCents,
        totalCents: totals.totalCents,
        remark: input.remark ?? null,
        creatorId: currentUser.id,
        updaterId: currentUser.id,
      })
      return { id, quotationNo }
    }
    let created: { id: number; quotationNo: string }
    try {
      created = await tryCreate(1)
    } catch {
      // 极少数情况：同毫秒两次创建撞唯一键，重试一次即可。
      created = await tryCreate(2)
    }
    // items 写入
    const itemsWithId = totals.items.map((it) => ({ ...it, quotationId: created.id }))
    await QuotationRepository.replaceItems(created.id, itemsWithId, drizzleDb)
    const detail = await QuotationRepository.findDetailById(created.id)
    if (!detail) throw new BusinessError(CrmErrorCode.CRM_QUOTATION_NOT_FOUND, '报价单创建失败')
    return detail
  }

  /**
   * 编辑 draft 报价：仅 draft 状态可整体改主表 + items；其它状态抛 NOT_EDITABLE。
   * items 整体替换；customerId 等可白名单字段若未传则保留旧值。
   */
  async updateDraft(quotationId: number, input: QuotationUpdateReq, currentUser: DataScopeUser): Promise<QuotationDetailResp> {
    return dbManager.transaction(async (tx) => {
      const locked = await QuotationRepository.findByIdWithLock(quotationId, tx)
      if (!locked) throw new BusinessError(CrmErrorCode.CRM_QUOTATION_NOT_FOUND, '报价单不存在或已删除')
      if (locked.status !== 'draft') {
        throw new BusinessError(CrmErrorCode.CRM_QUOTATION_NOT_EDITABLE, '只有草稿状态的报价单可以编辑')
      }
      let nextItems: CreateQuotationItemInput[] | null = null
      let nextTotals: ItemsTotals | null = null
      if (input.items && input.items.length > 0) {
        const totals = computeItemsTotals(input.items)
        nextTotals = totals
        nextItems = totals.items.map((it) => ({ ...it, quotationId: locked.id }))
        await QuotationRepository.replaceItems(locked.id, nextItems, tx)
      }
      const updated = await QuotationRepository.update(locked.id, {
        ...(input.customerId !== undefined ? { customerId: input.customerId } : {}),
        ...(input.opportunityId !== undefined ? { opportunityId: input.opportunityId } : {}),
        ...(input.contactId !== undefined ? { contactId: input.contactId } : {}),
        ...(input.validUntil !== undefined ? { validUntil: input.validUntil ? new Date(input.validUntil) : null } : {}),
        ...(input.remark !== undefined ? { remark: input.remark } : {}),
        ...(nextTotals
          ? { netCents: nextTotals.netCents, taxCents: nextTotals.taxCents, totalCents: nextTotals.totalCents }
          : {}),
        updaterId: currentUser.id,
      }, tx)
      if (!updated) throw new BusinessError(CrmErrorCode.CRM_QUOTATION_NOT_FOUND, '报价单不存在或已删除')
      const items = await QuotationRepository.listItemsByQuotationId(locked.id, tx)
      return { head: updated, items }
    })
  }

  /**
   * 软删除：仅 draft 状态允许。
   */
  async softDelete(quotationId: number, currentUser: DataScopeUser): Promise<void> {
    return dbManager.transaction(async (tx) => {
      const locked = await QuotationRepository.findByIdWithLock(quotationId, tx)
      if (!locked) throw new BusinessError(CrmErrorCode.CRM_QUOTATION_NOT_FOUND, '报价单不存在或已删除')
      if (locked.status !== 'draft') {
        throw new BusinessError(CrmErrorCode.CRM_QUOTATION_NOT_EDITABLE, '只有草稿状态的报价单可以删除')
      }
      const affected = await QuotationRepository.softDelete(locked.id, tx)
      if (affected === 0) throw new BusinessError(CrmErrorCode.CRM_QUOTATION_NOT_FOUND, '报价单不存在或已删除')
    })
  }

  /**
   * draft → sent。
   * sent 后明细冻结；后续只能做 accept / reject / void。
   */
  async sendQuotation(quotationId: number, currentUser: DataScopeUser): Promise<QuotationDetailResp> {
    return dbManager.transaction(async (tx) => {
      const locked = await QuotationRepository.findByIdWithLock(quotationId, tx)
      if (!locked) throw new BusinessError(CrmErrorCode.CRM_QUOTATION_NOT_FOUND, '报价单不存在或已删除')
      if (locked.status === 'sent') {
        throw new BusinessError(CrmErrorCode.CRM_QUOTATION_ALREADY_SENT, '报价单已发送，无需重复操作')
      }
      if (locked.status !== 'draft') {
        throw new BusinessError(CrmErrorCode.CRM_QUOTATION_STATUS_INVALID, `当前状态「${STATUS_LABELS[locked.status]}」不能发送`)
      }
      const items = await QuotationRepository.listItemsByQuotationId(locked.id, tx)
      if (items.length === 0) {
        throw new BusinessError(CrmErrorCode.CRM_QUOTATION_ITEMS_REQUIRED, '报价单至少要有一条商品')
      }
      const now = new Date()
      const updated = await QuotationRepository.update(locked.id, {
        status: 'sent',
        sentAt: now,
        updaterId: currentUser.id,
      }, tx)
      if (!updated) throw new BusinessError(CrmErrorCode.CRM_QUOTATION_NOT_FOUND, '报价单不存在或已删除')
      await QuotationRepository.createStatusLog({
        quotationId: locked.id,
        fromStatus: 'draft',
        toStatus: 'sent',
        operatorUserId: currentUser.id,
      }, tx)
      return { head: updated, items }
    })
  }

  /**
   * sent → accepted。
   * 同 opportunity 下旧 accepted 自动置 superseded。
   */
  async acceptQuotation(quotationId: number, currentUser: DataScopeUser): Promise<QuotationDetailResp> {
    return dbManager.transaction(async (tx) => {
      const locked = await QuotationRepository.findByIdWithLock(quotationId, tx)
      if (!locked) throw new BusinessError(CrmErrorCode.CRM_QUOTATION_NOT_FOUND, '报价单不存在或已删除')
      if (locked.status === 'accepted') {
        throw new BusinessError(CrmErrorCode.CRM_QUOTATION_ACCEPTED_IMMUTABLE, '报价单已接受，不可重复操作')
      }
      if (locked.status !== 'sent') {
        throw new BusinessError(CrmErrorCode.CRM_QUOTATION_NOT_SENT, '只有已发送的报价单可以接受')
      }
      const now = new Date()
      const updated = await QuotationRepository.update(locked.id, {
        status: 'accepted',
        acceptedAt: now,
        updaterId: currentUser.id,
      }, tx)
      if (!updated) throw new BusinessError(CrmErrorCode.CRM_QUOTATION_NOT_FOUND, '报价单不存在或已删除')
      await QuotationRepository.createStatusLog({
        quotationId: locked.id,
        fromStatus: 'sent',
        toStatus: 'accepted',
        operatorUserId: currentUser.id,
      }, tx)
      // 同 opportunity 下其它 accepted 置 superseded
      if (locked.opportunityId !== null) {
        const olderAcceptedIds = await QuotationRepository.findAcceptedIdsByOpportunity(locked.opportunityId, locked.id, tx)
        for (const olderId of olderAcceptedIds) {
          await QuotationRepository.update(olderId, {
            status: 'superseded',
            closedAt: now,
            updaterId: currentUser.id,
          }, tx)
          await QuotationRepository.createStatusLog({
            quotationId: olderId,
            fromStatus: 'accepted',
            toStatus: 'superseded',
            operatorUserId: currentUser.id,
            reason: `被新版报价单 #${locked.id} 替代`,
          }, tx)
        }
      }
      const items = await QuotationRepository.listItemsByQuotationId(locked.id, tx)
      return { head: updated, items }
    })
  }

  /**
   * sent → rejected。reason 可选；audit 行 reason 字段会写入。
   */
  async rejectQuotation(quotationId: number, reason: string | undefined, currentUser: DataScopeUser): Promise<QuotationDetailResp> {
    return dbManager.transaction(async (tx) => {
      const locked = await QuotationRepository.findByIdWithLock(quotationId, tx)
      if (!locked) throw new BusinessError(CrmErrorCode.CRM_QUOTATION_NOT_FOUND, '报价单不存在或已删除')
      if (locked.status !== 'sent') {
        throw new BusinessError(CrmErrorCode.CRM_QUOTATION_NOT_SENT, '只有已发送的报价单可以拒绝')
      }
      const now = new Date()
      const updated = await QuotationRepository.update(locked.id, {
        status: 'rejected',
        closedAt: now,
        updaterId: currentUser.id,
      }, tx)
      if (!updated) throw new BusinessError(CrmErrorCode.CRM_QUOTATION_NOT_FOUND, '报价单不存在或已删除')
      await QuotationRepository.createStatusLog({
        quotationId: locked.id,
        fromStatus: 'sent',
        toStatus: 'rejected',
        operatorUserId: currentUser.id,
        reason: reason ?? null,
      }, tx)
      const items = await QuotationRepository.listItemsByQuotationId(locked.id, tx)
      return { head: updated, items }
    })
  }

  /**
   * draft | sent → voided。accepted 永远不可作废。
   */
  async voidQuotation(quotationId: number, reason: string | undefined, currentUser: DataScopeUser): Promise<QuotationDetailResp> {
    return dbManager.transaction(async (tx) => {
      const locked = await QuotationRepository.findByIdWithLock(quotationId, tx)
      if (!locked) throw new BusinessError(CrmErrorCode.CRM_QUOTATION_NOT_FOUND, '报价单不存在或已删除')
      if (locked.status === 'accepted' || locked.status === 'superseded') {
        throw new BusinessError(CrmErrorCode.CRM_QUOTATION_ACCEPTED_IMMUTABLE, '已接受或已被替代的报价单不可作废')
      }
      if (locked.status !== 'draft' && locked.status !== 'sent') {
        throw new BusinessError(CrmErrorCode.CRM_QUOTATION_STATUS_INVALID, `当前状态「${STATUS_LABELS[locked.status]}」不可作废`)
      }
      const now = new Date()
      const updated = await QuotationRepository.update(locked.id, {
        status: 'voided',
        closedAt: now,
        updaterId: currentUser.id,
      }, tx)
      if (!updated) throw new BusinessError(CrmErrorCode.CRM_QUOTATION_NOT_FOUND, '报价单不存在或已删除')
      await QuotationRepository.createStatusLog({
        quotationId: locked.id,
        fromStatus: locked.status,
        toStatus: 'voided',
        operatorUserId: currentUser.id,
        reason: reason ?? null,
      }, tx)
      const items = await QuotationRepository.listItemsByQuotationId(locked.id, tx)
      return { head: updated, items }
    })
  }

  /**
   * 可见性判定：与 LeadService.getAccessibleLead 风格一致。
   * 无权 → 抛 NOT_FOUND 而不是 403，避免泄漏存在性。
   */
  private async getAccessibleQuotation(quotationId: number, currentUser: DataScopeUser): Promise<QuotationRow> {
    const row = await QuotationRepository.findById(quotationId)
    if (!row) throw new BusinessError(CrmErrorCode.CRM_QUOTATION_NOT_FOUND, '报价单不存在或已删除')
    const scope = computeDataScope(currentUser)
    if (scope.ownerUserIds === null) return row
    const ownerOk = row.ownerUserId === currentUser.id
    if (!ownerOk) {
      throw new BusinessError(CrmErrorCode.CRM_QUOTATION_NOT_FOUND, '报价单不存在或已删除')
    }
    return row
  }
}

/**
 * 暴露给 route 层的 status label 字典（用于响应里某些场景补字段，目前仅测试需要）。
 */
export const quotationStatusLabels = STATUS_LABELS
export { QUOTATION_STATUS }