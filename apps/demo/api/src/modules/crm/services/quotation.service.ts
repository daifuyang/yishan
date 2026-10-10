/** 报价草稿与发送动作：金额使用整数分，商机阶段和业务动态在同一事务中提交。 */
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { dbManager, type AppQueryDb } from '@yishan/core-system-api/database'
import { BusinessError } from '@yishan/core-api/errors'
import { computeLineAmountCents, sumCents } from '@yishan/core-system-api/utils/money'
import { OpportunityService } from './opportunity.service.js'
import { OpportunityRepository } from '../repositories/opportunity.repository.js'
import { CustomerRepository } from '../repositories/customer.repository.js'
import { ContractRepository } from '../repositories/contract.repository.js'
import { ContactRepository } from '../repositories/contact.repository.js'
import { ActivityRepository } from '../repositories/activity.repository.js'
import { BusinessNumberRepository } from '../repositories/business-number.repository.js'
import { computeDataScope, type DataScopeUser } from '../schemas/data-scope.js'
import { CrmErrorCode } from '../schemas/error-codes.js'
import {
  QUOTATION_STATUS,
  type QuotationCreateReq,
  type QuotationStatus,
  type QuotationUpdateReq,
  type QuotationRevokeConfirmationReq,
} from '../schemas/quotation.schema.js'
import {
  QuotationRepository,
  type CreateQuotationItemInput,
  type QuotationItemRow,
  type QuotationListQuery,
  type QuotationRow,
  type QuotationStatusLogRow,
  type QuotationShareRow,
  type QuoteSeriesSummary,
} from '../repositories/quotation.repository.js'

/**
 * 详情响应：主表 + items[]，均来自仓库 Row（DB Date）。
 * 路由层在序列化时由 fast-json-stringify 转 date-time 字符串。
 */
export interface QuotationDetailResp {
  head: QuotationRow
  items: QuotationItemRow[]
  share?: (QuotationShareRow & { url?: string }) | null
  versions?: QuotationRow[]
}

export interface QuoteShareCreateResult {
  share: QuotationShareRow
  rawToken: string
  url: string
}

export interface PublicQuoteItem {
  name: string
  description: string | null
  quantity: number
  unit: string | null
  unitPriceCents: number
  amountCents: number
}

export interface PublicQuoteDTO {
  companyName: string
  quoteTitle: string
  quoteNumber: string
  quoteDate: Date | null
  validUntil: Date | null
  customerName: string
  contactDisplayName: string | null
  items: PublicQuoteItem[]
  subtotalCents: number
  discountAmountCents: number
  publicDiscountDescription: string | null
  totalAmountCents: number
  remark: string | null
  salesContactName: string | null
  salesContactPhone: string | null
  version: number
}

export type PublicQuoteResult =
  | { state: 'ok'; quote: PublicQuoteDTO }
  | { state: 'expired' | 'revoked' | 'invalid'; quote: null }

function tokenHash(rawToken: string): string {
  return createHash('sha256').update(rawToken, 'utf8').digest('hex')
}

// 旧分享只保存随机 token 的 hash；用该记录独有的密钥派生稳定地址，兼容旧链接且不重建分享。
function reusableShareToken(share: QuotationShareRow): string {
  const signature = createHmac('sha256', Buffer.from(share.tokenHash, 'hex'))
    .update(`crm:quotation-share:v1:${share.id}:${share.quotationId}`)
    .digest('base64url')
  return `s1-${share.id}-${signature}`
}

function endOfBusinessDay(value: Date): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(value)
  const year = Number(parts.find((p) => p.type === 'year')?.value)
  const month = Number(parts.find((p) => p.type === 'month')?.value)
  const day = Number(parts.find((p) => p.type === 'day')?.value)
  // DATETIME(0) 以秒存储，避免 .999 被舍入到次日 00:00。
  return new Date(Date.UTC(year, month - 1, day, 15, 59, 59))
}

function expiryFromSentAt(sentAt: Date, durationDays: number): Date {
  const end = endOfBusinessDay(sentAt)
  end.setUTCDate(end.getUTCDate() + durationDays)
  return end
}

function stableQuoteTitle(name: string): string {
  return name.replace(/(?:第[一二三四五六七八九十\d]+版|V\d+)?报价$/u, '报价').trim().slice(0, 100)
}

const STATUS_LABELS: Record<QuotationStatus, string> = {
  draft: '草稿',
  sent: '已发送',
  accepted: '已确认',
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
  discountAmountCents: number
  items: CreateQuotationItemInput[]
}

/** 明细快照先按行舍入，再汇总并扣减整单固定优惠；拒绝负值或超额优惠。 */
function computeItemsTotals(
  items: NonNullable<QuotationCreateReq['items']> | NonNullable<QuotationUpdateReq['items']>,
  discountAmountCents: number = 0,
): ItemsTotals {
  const out: CreateQuotationItemInput[] = []
  const netList: number[] = []
  const totalList: number[] = []
  let sort = 0
  for (const it of items) {
    if (!it.productNameSnapshot?.trim() || !Number.isSafeInteger(it.quantityCents) || it.quantityCents <= 0 || !Number.isSafeInteger(it.unitPriceCents) || it.unitPriceCents < 0) {
      throw new BusinessError(CrmErrorCode.CRM_QUOTATION_INVALID, '报价项目名称、数量或单价无效')
    }
    const qty = it.quantityCents
    const unitPriceCents = it.unitPriceCents
    const discountBp = it.discountBp ?? 0
    const taxRateBp = it.taxRateBp ?? 0
    const lineAmountCents = computeLineAmountCents({ qty, unitPriceCents, discountBp, taxRateBp })
    // net = unitPrice × qty × (1 − discount)
    const net = computeLineAmountCents({ qty, unitPriceCents, discountBp, taxRateBp: 0 })
    out.push({
      quotationId: 0, // service 在插入前会重写为实际 id；create 时由 repository 处理
      productId: it.productId ?? null, // 自定义项：productId = null
      productNameSnapshot: it.productNameSnapshot.trim(),
      description: it.description?.trim() || null,
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
  const itemsTax = sumCents(totalList) - netCents
  const itemsTotal = sumCents(totalList)
  if (!Number.isSafeInteger(discountAmountCents) || discountAmountCents < 0 || discountAmountCents > itemsTotal) throw new BusinessError(CrmErrorCode.CRM_QUOTATION_INVALID, '优惠金额必须为非负整数分且不能大于小计')
  const safeDiscount = discountAmountCents
  const totalCents = itemsTotal - safeDiscount
  // netCents / taxCents 保留未优惠前金额；totalCents 反映 head 优惠。
  // 当 headDiscount > 0 时，net + tax > total；账目以 totalCents 为准。
  const taxCents = itemsTax
  return {
    netCents,
    taxCents,
    totalCents,
    discountAmountCents: safeDiscount,
    items: out,
  }
}

/**
 * 生成 quotationNo：Q-yyyyMMdd-后缀 4 位递增。
 * 不依赖 sequence；唯一索引兜底，冲突时重试整个创建事务。
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
  async findDuplicateSeries(opportunityId: number, name: string, currentUser: DataScopeUser): Promise<QuoteSeriesSummary[]> {
    const normalized = stableQuoteTitle(name).replace(/报价$/u, '').trim()
    const result = await this.list({ opportunityId, page: 1, pageSize: 100 }, currentUser)
    return result.items.filter((row) => normalized && stableQuoteTitle(row.title).replace(/报价$/u, '').trim() === normalized
      && ['draft', 'sent', 'accepted'].includes(row.currentStatus))
  }
  /**
   * 列表。data-scope：与 CustomerService 一致，按 role.dataScope 收敛。
   */
  async list(query: QuotationListQuery, currentUser: DataScopeUser): Promise<{ items: QuoteSeriesSummary[]; total: number; page: number; pageSize: number }> {
    const scope = computeDataScope(currentUser)
    const result = await QuotationRepository.listSeries({ ...query, ...scope })
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
    const share = await QuotationRepository.findLatestShare(row.id)
    const contract = await ContractRepository.findByQuotationId(row.id, undefined, true)
    return { head: { ...row, contractId: contract?.id ?? null }, items, share: share ? { ...share, url: `/q/${reusableShareToken(share)}` } : null, versions: row.seriesId ? await QuotationRepository.listVersions(row.seriesId) : [row] }
  }

  async createShare(quotationId: number, input: { durationDays?: number; followQuoteValidUntil?: boolean; customDate?: string; replaceShareId?: number }, currentUser: DataScopeUser): Promise<QuoteShareCreateResult> {
    return dbManager.transaction(async (tx) => {
      const quote = await this.getAccessibleQuotation(quotationId, currentUser, tx, true)
      if (quote.status !== 'draft' && quote.status !== 'sent' && quote.status !== 'accepted') throw this.invalid('当前状态不能生成分享链接')
      const previous = input.replaceShareId ? await QuotationRepository.findShareById(input.replaceShareId, tx) : null
      if (input.replaceShareId && (!previous || previous.quotationId !== quotationId)) throw this.invalid('分享链接不存在')
      if (previous) {
        const latest = await QuotationRepository.findLatestShare(quotationId, tx)
        if (latest?.id !== previous.id) throw this.invalid('分享链接已更新，请刷新后重试')
      }
      const custom = input.customDate ? new Date(`${input.customDate}T00:00:00+08:00`) : null
      if (custom && !Number.isFinite(custom.getTime())) throw this.invalid('自定义有效期无效')
      const follow = Boolean(!custom && input.followQuoteValidUntil && quote.validUntil)
      const days = input.durationDays ?? 7
      if (!follow && ![3, 7, 14, 30].includes(days)) throw this.invalid('分享有效期无效')
      const now = new Date()
      const expiresAt = custom ? endOfBusinessDay(custom) : follow ? endOfBusinessDay(quote.validUntil!) : expiryFromSentAt(now, days)
      if (expiresAt.getTime() <= now.getTime()) throw this.invalid('分享有效期必须晚于当前时间')
      const rawToken = randomBytes(32).toString('base64url')
      const share = await QuotationRepository.createShare({
        quotationId, tokenHash: tokenHash(rawToken), expiresAt,
        durationDays: custom ? -1 : follow ? null : days,
        followQuoteValidUntil: follow, createdBy: currentUser.id,
      }, tx)
      if (previous?.status === 'active') {
        await QuotationRepository.updateShare(previous.id, { status: 'revoked', revokedAt: now }, tx)
        await this.writeActivity(quote, 'quote_share_revoked', currentUser, tx)
      }
      await this.writeActivity(quote, 'quote_share_created', currentUser, tx)
      return { share, rawToken, url: `/q/${reusableShareToken(share)}` }
    })
  }

  async revokeShare(quotationId: number, shareId: number, currentUser: DataScopeUser): Promise<void> {
    return dbManager.transaction(async (tx) => {
      const quote = await this.getAccessibleQuotation(quotationId, currentUser, tx)
      const share = await QuotationRepository.findShareById(shareId, tx)
      if (!share || share.quotationId !== quote.id) throw this.invalid('分享链接不存在')
      if (share.status === 'revoked') return
      await QuotationRepository.updateShare(share.id, { status: 'revoked', revokedAt: new Date() }, tx)
      await this.writeActivity(quote, 'quote_share_revoked', currentUser, tx)
    })
  }

  async publicQuote(rawToken: string): Promise<PublicQuoteResult> {
    let share: QuotationShareRow | null
    if (rawToken.startsWith('s1-') && rawToken.length > 43) {
      const match = /^s1-([1-9]\d*)-([A-Za-z0-9_-]{43})$/.exec(rawToken)
      if (!match || !Number.isSafeInteger(Number(match[1]))) return { state: 'invalid', quote: null }
      share = await QuotationRepository.findShareById(Number(match[1]))
      if (!share) return { state: 'invalid', quote: null }
      const expected = Buffer.from(reusableShareToken(share))
      const supplied = Buffer.from(rawToken)
      if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return { state: 'invalid', quote: null }
    } else {
      share = await QuotationRepository.findShareByTokenHash(tokenHash(rawToken))
    }
    if (!share) return { state: 'invalid', quote: null }
    if (share.status === 'revoked' || share.revokedAt) return { state: 'revoked', quote: null }
    if (share.expiresAt.getTime() <= Date.now()) return { state: 'expired', quote: null }
    const detail = await QuotationRepository.findDetailById(share.quotationId)
    if (!detail || !['sent', 'accepted'].includes(detail.head.status)) return { state: 'invalid', quote: null }
    const now = new Date()
    const viewed = await dbManager.transaction(async (tx) => {
      const locked = await QuotationRepository.findShareById(share.id, tx)
      if (!locked || locked.status !== 'active' || locked.expiresAt.getTime() <= now.getTime()) return null
      const first = locked.firstViewedAt === null
      const updated = await QuotationRepository.updateShare(locked.id, {
        firstViewedAt: first ? now : locked.firstViewedAt,
        lastViewedAt: now,
        viewCount: locked.viewCount + 1,
      }, tx)
      if (first) await this.writeActivity(detail.head, 'quote_first_viewed', { id: detail.head.ownerUserId } as DataScopeUser, tx)
      return updated
    })
    if (!viewed) return { state: 'expired', quote: null }
    return { state: 'ok', quote: this.toPublicQuote(detail) }
  }

  /** 内部预览沿用客户文档白名单，不写入分享统计或客户活动。 */
  async previewQuote(quotationId: number, currentUser: DataScopeUser): Promise<PublicQuoteDTO> {
    const head = await this.getAccessibleQuotation(quotationId, currentUser)
    const items = await QuotationRepository.listItemsByQuotationId(head.id)
    return this.toPublicQuote({ head, items })
  }

  private toPublicQuote(detail: QuotationDetailResp): PublicQuoteDTO {
    return {
      companyName: detail.head.customerName ?? '',
      quoteTitle: detail.head.name || detail.head.quotationNo,
      quoteNumber: detail.head.quotationNo,
      quoteDate: detail.head.quoteDate,
      validUntil: detail.head.validUntil,
      customerName: detail.head.customerName ?? '',
      contactDisplayName: detail.head.contactName,
      items: detail.items.map((item) => ({
        name: item.productNameSnapshot,
        description: item.description,
        quantity: item.quantityCents / 10000,
        unit: item.unitSnapshot,
        unitPriceCents: item.unitPriceCents,
        amountCents: item.lineAmountCents,
      })),
      subtotalCents: detail.head.netCents + detail.head.taxCents,
      discountAmountCents: detail.head.discountAmountCents,
      publicDiscountDescription: detail.head.discountAmountCents > 0 ? detail.head.publicDiscountDescription ?? null : null,
      totalAmountCents: detail.head.totalCents,
      remark: detail.head.remark,
      salesContactName: detail.head.ownerUserName,
      salesContactPhone: null,
      version: detail.head.version,
    }
  }

  /** 发送报价并推进商机阶段，分享校验、状态机和活动在同一事务中完成。 */
  async sendQuotationWithShare(quotationId: number, shareId: number, currentUser: DataScopeUser): Promise<QuotationDetailResp> {
    return dbManager.transaction(async (tx) => {
      const locked = await QuotationRepository.findByIdWithLock(quotationId, tx)
      if (!locked) throw new BusinessError(CrmErrorCode.CRM_QUOTATION_NOT_FOUND, '报价单不存在或已删除')
      if (locked.status !== 'draft') throw new BusinessError(CrmErrorCode.CRM_QUOTATION_STATUS_INVALID, '只有草稿状态的报价单可以发送')
      this.assertVisible(locked, currentUser)
      const share = await QuotationRepository.findShareById(shareId, tx)
      if (!share || share.quotationId !== locked.id || share.status !== 'active' || share.revokedAt) throw this.invalid('分享链接无效')
      const items = await QuotationRepository.listItemsByQuotationId(locked.id, tx)
      if (!items.length) throw new BusinessError(CrmErrorCode.CRM_QUOTATION_ITEMS_REQUIRED, '报价单至少要有一条商品')
      if (!Number.isSafeInteger(locked.totalCents) || locked.totalCents <= 0) throw this.invalid('报价金额必须大于零')
      const opportunity = await this.validateContext(locked.customerId, locked.opportunityId, locked.contactId, currentUser, tx)
      if (!['solution', 'quotation', 'negotiation'].includes(opportunity.stage)) throw this.invalid('当前商机阶段不能发送报价')
      const now = new Date()
      const expiresAt = share.followQuoteValidUntil && locked.validUntil
        ? endOfBusinessDay(locked.validUntil)
        : share.durationDays === -1
          ? share.expiresAt
          : expiryFromSentAt(now, share.durationDays ?? 7)
      if (expiresAt.getTime() <= now.getTime()) throw this.invalid('分享有效期已过')
      const updated = await QuotationRepository.update(locked.id, {
        status: 'sent', sentAt: now, validUntil: locked.validUntil ?? expiresAt, updaterId: currentUser.id,
      }, tx)
      if (!updated) throw new BusinessError(CrmErrorCode.CRM_QUOTATION_NOT_FOUND, '报价单不存在或已删除')
      await QuotationRepository.updateShare(share.id, { expiresAt, sentAt: now }, tx)
      await QuotationRepository.createStatusLog({ quotationId: locked.id, fromStatus: 'draft', toStatus: 'sent', operatorUserId: currentUser.id }, tx)
      if (opportunity.stage === 'solution') await new OpportunityService().advanceStage({ id: opportunity.id, input: { toStage: 'quotation' }, currentUser, tx })
      await this.writeActivity(updated, 'quote_sent', currentUser, tx)
      return { head: updated, items, share: await QuotationRepository.findShareById(share.id, tx) }
    })
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
   * 校验商机、客户与联系人关系；继承商机负责人，固定 status = draft、
   * version = 1、生成 quotationNo。
   */
  async createDraft(input: QuotationCreateReq, currentUser: DataScopeUser): Promise<QuotationDetailResp> {
    if (!input.items || input.items.length === 0) {
      throw new BusinessError(CrmErrorCode.CRM_QUOTATION_ITEMS_REQUIRED, '报价单至少要有一条商品')
    }
    const totals = computeItemsTotals(input.items, input.discountAmountCents ?? 0)
    const quoteDate = new Date(input.quoteDate)
    const validUntil = input.validUntil
      ? new Date(input.validUntil)
      : new Date(quoteDate.getTime() + 7 * 24 * 60 * 60 * 1000)
    this.validateDates(quoteDate, validUntil)
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await dbManager.transaction(async (tx) => {
          const opportunity = await this.validateContext(input.customerId, input.opportunityId, input.contactId, currentUser, tx)
          const name = stableQuoteTitle(input.name?.trim() || `${opportunity.name ?? ''}报价`)
          if (!name) throw this.invalid('报价名称不能为空')
          const today = new Date()
          const prefix = 'Q-' + today.getFullYear() + String(today.getMonth() + 1).padStart(2, '0') + String(today.getDate()).padStart(2, '0') + '-'
          const count = await QuotationRepository.countTodayByNoPrefix(prefix, tx)
          const seriesPrefix = prefix
          const seriesNumber = typeof (tx as { insert?: unknown }).insert === 'function'
            ? await BusinessNumberRepository.next(seriesPrefix, tx)
            : typeof (tx as { select?: unknown }).select === 'function'
              ? (await QuotationRepository.countSeriesTodayByNoPrefix(seriesPrefix, tx)) + 1
              : 1
          const seriesNo = `${seriesPrefix}${String(seriesNumber).padStart(4, '0')}`
          const seriesId = randomUUID()
          const { id } = await QuotationRepository.create({
            quotationNo: genQuotationNo(count), name, customerId: opportunity.customerId,
            seriesId, seriesNo,
            opportunityId: opportunity.id, contactId: input.contactId,
            ownerUserId: opportunity.ownerId ?? currentUser.id, status: 'draft', quoteDate, validUntil,
            netCents: totals.netCents, taxCents: totals.taxCents, totalCents: totals.totalCents,
            discountAmountCents: totals.discountAmountCents, remark: input.remark?.trim() || null,
            publicDiscountDescription: totals.discountAmountCents > 0 ? input.publicDiscountDescription?.trim() || null : null,
            internalDiscountReason: totals.discountAmountCents > 0 ? input.internalDiscountReason?.trim() || null : null,
            creatorId: currentUser.id, updaterId: currentUser.id,
          }, tx)
          await QuotationRepository.replaceItems(id, totals.items.map(it => ({ ...it, quotationId: id })), tx)
          const detail = await QuotationRepository.findDetailById(id, tx)
          if (!detail) throw this.invalid('报价创建失败')
          await this.writeActivity(detail.head, 'quote_created', currentUser, tx)
          return detail
        })
      } catch (error) {
        const cause = error instanceof Error ? error.cause : undefined
        const duplicate = (value: unknown) => typeof value === 'object' && value !== null && 'code' in value && value.code === 'ER_DUP_ENTRY'
        if (attempt === 2 || (!duplicate(error) && !duplicate(cause))) throw error
      }
    }
    throw this.invalid('报价编号生成失败')
  }

  /** 复制商业快照；只写新报价，不改变源版本、分享或商机。 */
  async reviseQuotation(quotationId: number, currentUser: DataScopeUser): Promise<QuotationDetailResp> {
    const accessible = await this.getAccessibleQuotation(quotationId, currentUser)
    const rootQuoteId = accessible.rootQuoteId ?? accessible.id
    return dbManager.transaction(async tx => {
      // 所有来源先锁同一根行，再锁来源，避免 V1/V2 并发创建时锁顺序相反。
      const root = await this.getAccessibleQuotation(rootQuoteId, currentUser, tx, true)
      const source = quotationId === rootQuoteId ? root : await this.getAccessibleQuotation(quotationId, currentUser, tx, true)
      if (source.status !== 'sent' && source.status !== 'accepted' && source.status !== 'voided') {
        throw this.invalid('草稿不能创建新版本，请先处理当前版本')
      }
      if ((source.rootQuoteId ?? source.id) !== rootQuoteId) throw this.invalid('报价版本来源不一致')
      const seriesId = root.seriesId ?? `legacy-${root.id}`
      const seriesNo = root.seriesNo ?? root.quotationNo
      if (typeof (tx as { select?: unknown }).select === 'function') {
        const latest = await QuotationRepository.latestBySeriesWithLock(seriesId, tx)
        if (latest && latest.id !== source.id && latest.status === 'draft') {
          throw this.invalid('当前报价系列已有未发布草稿，请先编辑或发布当前版本')
        }
      }
      const version = (typeof (tx as { select?: unknown }).select === 'function'
        ? await QuotationRepository.maxVersionBySeriesWithLock(seriesId, tx)
        : await QuotationRepository.maxVersionWithLock(rootQuoteId, tx)) + 1
      const quotationNo = `${seriesNo}-R${version}`
      if (quotationNo.length > 32) throw this.invalid('报价版本编号超出长度限制')
      const quoteDate = new Date(endOfBusinessDay(new Date()).getTime() - (23 * 60 * 60 + 59 * 60 + 59) * 1000)
      const validUntil = new Date(quoteDate.getTime() + 7 * 24 * 60 * 60 * 1000)
      const sourceItems = await QuotationRepository.listItemsByQuotationId(source.id, tx)
      if (sourceItems.length === 0) throw this.invalid('源报价没有报价明细')
      const { id } = await QuotationRepository.create({
        quotationNo, name: stableQuoteTitle(source.name || source.opportunityName || ''), version,
        seriesId, seriesNo,
        rootQuoteId, sourceQuoteId: source.id,
        customerId: source.customerId, opportunityId: source.opportunityId, contactId: source.contactId,
        ownerUserId: source.ownerUserId, status: 'draft', quoteDate, validUntil,
        netCents: source.netCents, taxCents: source.taxCents, totalCents: source.totalCents,
        discountAmountCents: source.discountAmountCents, publicDiscountDescription: source.publicDiscountDescription,
        internalDiscountReason: source.internalDiscountReason, remark: source.remark,
        creatorId: currentUser.id, updaterId: currentUser.id,
      }, tx)
      await QuotationRepository.replaceItems(id, sourceItems.map(item => ({
        quotationId: id, productId: item.productId, productNameSnapshot: item.productNameSnapshot,
        description: item.description, unitSnapshot: item.unitSnapshot, quantityCents: item.quantityCents,
        unitPriceCents: item.unitPriceCents, discountBp: item.discountBp, taxRateBp: item.taxRateBp,
        lineAmountCents: item.lineAmountCents, sortOrder: item.sortOrder,
      })), tx)
      const detail = await QuotationRepository.findDetailById(id, tx)
      if (!detail) throw this.invalid('新版本创建失败')
      await ActivityRepository.create({
        customerId: source.customerId, entityType: 'customer', entityId: source.customerId, entityRefType: 'customer',
        category: 'business', type: 'quote_version_created',
        content: `创建报价新版本「${source.opportunityName || source.name}」 V${source.version} → V${version}`,
        metadata: { eventType: 'quote_version_created', quotationId: id, sourceQuoteId: source.id, rootQuoteId,
          fromVersion: source.version, version, opportunityId: source.opportunityId, quotationName: detail.head.name, totalCents: source.totalCents },
        operatorUserId: currentUser.id,
      }, tx)
      return { ...detail, share: null }
    })
  }

  /**
   * 编辑 draft 报价：仅 draft 状态可整体改主表 + items；其它状态抛 NOT_EDITABLE。
   * items 整体替换；customerId 等可白名单字段若未传则保留旧值。
   */
  async updateDraft(quotationId: number, input: QuotationUpdateReq, currentUser: DataScopeUser): Promise<QuotationDetailResp> {
    return dbManager.transaction(async (tx) => {
      const locked = await QuotationRepository.findByIdWithLock(quotationId, tx)
      if (!locked) throw new BusinessError(CrmErrorCode.CRM_QUOTATION_NOT_FOUND, '报价单不存在')
      this.assertVisible(locked, currentUser)
      if (locked.status !== 'draft') throw new BusinessError(CrmErrorCode.CRM_QUOTATION_NOT_EDITABLE, '只有草稿状态的报价单可以编辑')
      if (locked.hasShare) throw new BusinessError(CrmErrorCode.CRM_QUOTATION_NOT_EDITABLE, '已生成分享链接的报价不能编辑')
      if (input.name !== undefined && (!input.name.trim() || input.name.trim().length > 100)) throw this.invalid('报价名称必填且最多100个字符')
      const customerId = input.customerId ?? locked.customerId
      const opportunityId = input.opportunityId ?? locked.opportunityId
      const contactId = input.contactId ?? locked.contactId
      await this.validateContext(customerId, opportunityId, contactId, currentUser, tx)
      const quoteDate = input.quoteDate ? new Date(input.quoteDate) : locked.quoteDate
      const validUntil = input.validUntil ? new Date(input.validUntil) : locked.validUntil
      this.validateDates(quoteDate, validUntil)
      const oldItems = await QuotationRepository.listItemsByQuotationId(quotationId, tx)
      const totals = computeItemsTotals(input.items ?? oldItems.map(item => ({ ...item, description: item.description ?? undefined, unitSnapshot: item.unitSnapshot ?? undefined })), input.discountAmountCents ?? locked.discountAmountCents)
      if (totals.items.length === 0) throw this.invalid('至少需要一条报价明细')
      const updated = await QuotationRepository.update(quotationId, {
        name: input.name?.trim(), customerId, opportunityId, contactId, quoteDate, validUntil,
        netCents: totals.netCents, taxCents: totals.taxCents, totalCents: totals.totalCents,
        discountAmountCents: totals.discountAmountCents, remark: input.remark, updaterId: currentUser.id,
        publicDiscountDescription: totals.discountAmountCents > 0 ? (input.publicDiscountDescription ?? locked.publicDiscountDescription)?.trim() || null : null,
        internalDiscountReason: totals.discountAmountCents > 0 ? (input.internalDiscountReason ?? locked.internalDiscountReason)?.trim() || null : null,
      }, tx)
      if (!updated) throw this.invalid('报价单不存在')
      const items = await QuotationRepository.replaceItems(quotationId, totals.items.map(it => ({ ...it, quotationId })), tx)
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
      this.assertVisible(locked, currentUser)
      if (locked.hasShare) throw new BusinessError(CrmErrorCode.CRM_QUOTATION_NOT_EDITABLE, '已生成分享链接的报价不能删除')
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
      this.assertVisible(locked, currentUser)
      const opportunity = await this.validateContext(locked.customerId, locked.opportunityId, locked.contactId, currentUser, tx)
      if (!['solution', 'quotation', 'negotiation'].includes(opportunity.stage)) throw this.invalid('当前商机阶段不能发送报价')
      if (!Number.isSafeInteger(locked.totalCents) || locked.totalCents <= 0) throw this.invalid('报价金额必须大于零')
      this.validateDates(locked.quoteDate, locked.validUntil)
      const businessDay = (value: Date) => value.toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' })
      if (businessDay(locked.validUntil!) < businessDay(new Date())) throw this.invalid('报价有效期已过')
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
      if (opportunity.stage === 'solution') await new OpportunityService().advanceStage({
        id: opportunity.id, input: { toStage: 'quotation' }, currentUser, tx,
      })
      await this.writeActivity(updated, 'quote_sent', currentUser, tx)
      return { head: updated, items }
    })
  }

  /** 销售确认当前已发送版本；重复请求不重复写动态。 */
  async acceptQuotation(quotationId: number, currentUser: DataScopeUser): Promise<QuotationDetailResp> {
    return dbManager.transaction(async tx => {
      const locked = await this.getAccessibleQuotation(quotationId, currentUser, tx, true)
      await this.assertCurrentVersion(locked, tx)
      if (locked.status !== 'accepted' && locked.status !== 'sent') throw new BusinessError(CrmErrorCode.CRM_QUOTATION_NOT_SENT, '只有已发送的报价单可以确认')
      const items = await QuotationRepository.listItemsByQuotationId(locked.id, tx)
      if (locked.status === 'accepted') return { head: locked, items }
      const updated = await QuotationRepository.update(locked.id, {
        status: 'accepted', acceptedAt: new Date(), acceptedBy: currentUser.id, updaterId: currentUser.id,
      }, tx)
      if (!updated) throw this.invalid('报价单不存在')
      await QuotationRepository.createStatusLog({ quotationId: locked.id, fromStatus: 'sent', toStatus: 'accepted', operatorUserId: currentUser.id }, tx)
      await ActivityRepository.create({
        customerId: locked.customerId, entityType: 'customer', entityId: locked.customerId, entityRefType: 'customer',
        category: 'business', type: 'quote_confirmed',
        content: '确认了 V' + locked.version + ' 报价「' + locked.name + '」\n报价金额 ¥' + (locked.totalCents / 100).toLocaleString('zh-CN'),
        metadata: { quotationId: locked.id, version: locked.version, opportunityId: locked.opportunityId, totalCents: locked.totalCents },
        operatorUserId: currentUser.id,
      }, tx)
      return { head: updated, items }
    })
  }

  async revokeConfirmation(quotationId: number, input: QuotationRevokeConfirmationReq, currentUser: DataScopeUser): Promise<QuotationDetailResp> {
    const reasons = { mistake: '误操作', customer_unconfirmed: '客户尚未确认', other: '其他' }
    const reason = reasons[input.reason]
    if (!reason || (input.remark?.length ?? 0) > 500) throw this.invalid('撤销原因无效')
    return dbManager.transaction(async tx => {
      const locked = await this.getAccessibleQuotation(quotationId, currentUser, tx, true)
      await this.assertCurrentVersion(locked, tx)
      if (locked.status !== 'accepted') throw this.invalid('只有已确认的报价可以撤销确认')
      if (await ContractRepository.findByQuotationId(locked.id, tx, true)) throw this.invalid('当前报价已生成合同，不能撤销确认')
      const remark = input.remark?.trim() || null
      const updated = await QuotationRepository.update(locked.id, {
        status: 'sent', acceptedAt: null, acceptedBy: null, updaterId: currentUser.id,
      }, tx)
      if (!updated) throw this.invalid('报价单不存在')
      await QuotationRepository.createStatusLog({ quotationId: locked.id, fromStatus: 'accepted', toStatus: 'sent', operatorUserId: currentUser.id, reason: [reason, remark].filter(Boolean).join('：') }, tx)
      await ActivityRepository.create({
        customerId: locked.customerId, entityType: 'customer', entityId: locked.customerId, entityRefType: 'customer',
        category: 'business', type: 'quote_confirmation_revoked',
        content: '撤销了 V' + locked.version + ' 报价确认「' + locked.name + '」\n原因：' + reason + (remark ? ' · ' + remark : ''),
        metadata: { quotationId: locked.id, version: locked.version, opportunityId: locked.opportunityId, reason, remark },
        operatorUserId: currentUser.id,
      }, tx)
      return { head: updated, items: await QuotationRepository.listItemsByQuotationId(locked.id, tx) }
    })
  }

  private async assertCurrentVersion(row: QuotationRow, tx: AppQueryDb) {
    if (row.seriesId) {
      const latest = await QuotationRepository.latestBySeriesWithLock(row.seriesId, tx)
      if (!latest || latest.id !== row.id) throw this.invalid('历史版本只读，请操作当前版本')
    }
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
   * 可见性判定：与 CustomerService 的数据范围风格一致。
   * 无权 → 抛 NOT_FOUND 而不是 403，避免泄漏存在性。
   */
  private invalid(message: string) { return new BusinessError(CrmErrorCode.CRM_QUOTATION_INVALID, message) }
  private validateDates(quoteDate: Date | null, validUntil: Date | null) {
    if (!quoteDate || !validUntil || !Number.isFinite(quoteDate.getTime()) || !Number.isFinite(validUntil.getTime()) || validUntil < quoteDate) throw this.invalid('报价日期必填，有效期不能早于报价日期')
  }
  private async validateContext(customerId: number, opportunityId: number | null | undefined, contactId: number | null | undefined, user: DataScopeUser, tx: AppQueryDb) {
    if (!opportunityId) throw this.invalid('报价必须关联商机')
    const opportunity = await OpportunityRepository.findByIdWithLock(opportunityId, tx)
    if (!opportunity) throw this.invalid('关联商机不存在')
    const scope = computeDataScope(user)
    if (scope.ownerUserIds !== null && !scope.ownerUserIds.includes(opportunity.ownerId ?? -1) && !(scope.ownerDepartmentIds ?? []).includes(opportunity.ownerDepartmentId ?? -1)) throw this.invalid('无权访问关联商机')
    if (opportunity.customerId !== customerId || !await CustomerRepository.findById(customerId, tx)) throw this.invalid('商机与客户关联不一致')
    const contact = contactId ? await ContactRepository.findById(contactId, tx) : null
    if (!contact || contact.customerId !== customerId) throw new BusinessError(CrmErrorCode.CRM_CONTACT_CUSTOMER_MISMATCH, '联系人必须属于当前客户')
    return opportunity
  }
  private assertVisible(row: QuotationRow, user: DataScopeUser) {
    const scope = computeDataScope(user)
    if (scope.ownerUserIds !== null && !scope.ownerUserIds.includes(row.ownerUserId) && !(scope.ownerDepartmentIds ?? []).includes(row.ownerDepartmentId ?? -1)) throw new BusinessError(CrmErrorCode.CRM_QUOTATION_NOT_FOUND, '报价单不存在或无权访问')
  }
  private async writeActivity(row: QuotationRow, eventType: 'quote_created' | 'quote_sent' | 'quote_share_created' | 'quote_share_revoked' | 'quote_first_viewed', user: DataScopeUser, tx: AppQueryDb) {
    const labels = {
      quote_created: '创建报价',
      quote_sent: '发送报价',
      quote_share_created: '生成报价分享链接',
      quote_share_revoked: '停用报价分享链接',
      quote_first_viewed: '客户查看报价',
    } as const
    await ActivityRepository.create({ customerId: row.customerId, entityType: 'customer', entityId: row.customerId, entityRefType: 'customer',
      category: 'business', type: eventType, content: labels[eventType] + '「' + row.name + '」 ¥' + (row.totalCents / 100).toLocaleString('zh-CN'),
      metadata: { eventType, quotationId: row.id, opportunityId: row.opportunityId, quotationName: row.name, totalCents: row.totalCents }, operatorUserId: user.id,
    }, tx)
  }

  private async getAccessibleQuotation(quotationId: number, currentUser: DataScopeUser, db?: AppQueryDb, lock = false): Promise<QuotationRow> {
    const row = lock && db ? await QuotationRepository.findByIdWithLock(quotationId, db) : await QuotationRepository.findById(quotationId, db)
    if (!row) throw new BusinessError(CrmErrorCode.CRM_QUOTATION_NOT_FOUND, '报价单不存在或已删除')
    this.assertVisible(row, currentUser)

    return row
  }
}

export const quotationStatusLabels = STATUS_LABELS
export { QUOTATION_STATUS }
