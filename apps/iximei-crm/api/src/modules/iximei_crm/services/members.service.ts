import { BusinessError } from '@yishan/core-api/errors'
import { ResourceErrorCode } from '@yishan/core-api/business-codes/resource'
import { AuthErrorCode } from '@yishan/core-api/business-codes/auth'
import { ValidationErrorCode } from '@yishan/core-api/business-codes/validation'
import { withDbErrorMapping, isDuplicateNumberIdError } from '@/modules/iximei_crm/utils/db-error'
import { MembersRepository } from '../repositories/members.repository.js'
import { CustomersRepository } from '../repositories/customers.repository.js'
import { compact, pageArgs } from './_shared.js'
import { DATA_SCOPE, type DataScopeCode } from '@/modules/iximei_crm/access-scope'
import {
  requireString,
  optionalString,
  optionalPhone,
  optionalQq,
  optionalWechat,
  parseDateOrThrow,
  trimOrNull,
} from '../_validation.js'
import { dateUtils } from '@/modules/iximei_crm/utils/date'

/** owner 字段过滤：SELF 限定，其它档位(ALL)保留全量 */
function ownerScopeFor(scope: DataScopeCode, userId: number): number | undefined {
  if (scope === DATA_SCOPE.SELF) return userId
  return undefined
}

/**
 * 解析纯文本标签字符串为标签名数组。
 * 分隔符：英文逗号、中文逗号、顿号、换行、空白。
 * 例子："VIP, 高净值、复购\n投诉" → ["VIP", "高净值", "复购", "投诉"]
 */
function splitTagsText(text: string | null | undefined): string[] {
  if (!text) return []
  return String(text)
    .split(/[,,、\n\r\s]+/g)
    .map(s => s.trim())
    .filter(Boolean)
}

/**
 * 解析 tagNames / tagIds / tagsText 混合输入为最终的 tag ID 列表。
 * - 已存在的标签名复用其 ID；
 * - 不存在的标签名自动创建（去重 + 去空白）；
 * - tagIds 与 tagNames 合并返回，按出现顺序去重。
 */
async function resolveTagIds(args: {
  tagsText?: string | null
  tagNames?: string[] | null
  tagIds?: number[] | null
  userId: number
}): Promise<number[]> {
  const result: number[] = []
  if (Array.isArray(args.tagIds)) {
    for (const id of args.tagIds) if (Number.isFinite(id)) result.push(Number(id))
  }
  const names: string[] = []
  if (args.tagsText) names.push(...splitTagsText(args.tagsText))
  if (Array.isArray(args.tagNames)) names.push(...args.tagNames)
  if (names.length) {
    const seen = new Set<string>()
    for (const raw of names) {
      const name = String(raw ?? '').trim()
      if (!name || seen.has(name)) continue
      seen.add(name)
      const tag = await MembersRepository.createTag({
        name,
        creatorId: args.userId,
      })
      if (tag?.id) result.push(Number(tag.id))
    }
  }
  return [...new Set(result)]
}

export class MembersService {

  // ── 列表 ──

  static async list(q: any, userId: number, scope: DataScopeCode = DATA_SCOPE.ALL) {
    const p = pageArgs(q)
    const ownerUserId = ownerScopeFor(scope, userId)
    return { ...(await MembersRepository.list({ ...q, ...p, ownerUserId })), ...p }
  }

  // ── 概览（顶部卡片） ──

  static async overview(userId: number, scope: DataScopeCode = DATA_SCOPE.ALL) {
    const ownerUserId = ownerScopeFor(scope, userId)

    const now = new Date()
    const todayStart = dateUtils.shanghaiDayStart(now)
    const todayEnd = new Date(dateUtils.shanghaiNextDayStart(now).getTime() - 1)
    const monthStart = dateUtils.shanghaiMonthStart(now)
    const monthEnd = new Date(dateUtils.shanghaiAddMonths(monthStart, 1).getTime() - 1)

    const stats = await MembersRepository.overview({
      todayStart, todayEnd, monthStart, monthEnd, now, ownerUserId,
    })

    return { ...stats, generatedAt: now.toISOString() }
  }

  // ── 详情 ──

  static async getById(id: number, userId: number, scope: DataScopeCode = DATA_SCOPE.ALL, includeAll = false) {
    const m: any = await MembersRepository.findById(id, {
      includeTags: includeAll,
      includeFollowUps: includeAll,
      includeAssignmentHistory: includeAll,
    })
    if (!m) return null
    // Data scope check
    if (ownerScopeFor(scope, userId) === userId && m.ownerUserId !== userId) return null
    // Record browse
    if (includeAll) {
      await MembersRepository.recordBrowse(id, userId).catch(() => {})
    }
    return m
  }

  // ── 轻量详情（列表行快速查看） ──

  static async getBrief(id: number, userId: number, scope: DataScopeCode = DATA_SCOPE.ALL) {
    return this.getById(id, userId, scope, false)
  }

  // ── 内部：create 路径重试，6 位 base36 随机尾段有极小生日冲突概率（单日 1000 条
  //   ~0.023%），靠 UNIQUE 索引抛 1062 后重试 5 次。仍冲突才把错误抛给前端。
  // 注意：要在 withDbErrorMapping 外面捕获原始 errno 1062——包了之后就被翻译成 BusinessError 了。
  private static async _createWithNumberIdRetry(data: any) {
    const MAX_NUMBER_RETRIES = 5
    let lastDupError: unknown
    for (let attempt = 0; attempt < MAX_NUMBER_RETRIES; attempt++) {
      try {
        return await MembersRepository.create({
          ...data,
          numberId: MembersRepository.nextNumber(),
        })
      } catch (err) {
        if (isDuplicateNumberIdError(err)) {
          lastDupError = err
          continue
        }
        return await withDbErrorMapping(() => { throw err })
      }
    }
    throw lastDupError ?? new Error('会员编号生成失败，请重试')
  }

  // ── 从客户转会员 ──

  static async createFromCustomer(input: any, userId: number, scope: DataScopeCode = DATA_SCOPE.ALL) {
    const { customerId, tagIds, tagNames, tagsText, firstContactRecord, ...memberFields } = input

    // 检查客户是否存在
    const customer = await CustomersRepository.findById(customerId)
    if (!customer) throw new BusinessError(ResourceErrorCode.NOT_FOUND, '客户不存在')
    if (customer.deletedAt) throw new BusinessError(ResourceErrorCode.ALREADY_EXISTS, '客户已作废')

    // 检查客户是否已是会员
    const existingMember = await MembersRepository.findByCustomerId(customerId)
    if (existingMember) {
      throw new BusinessError(
        ValidationErrorCode.PARAMETER_FORMAT_ERROR,
        '该客户已是会员顾客',
        JSON.stringify({ existingMemberId: existingMember.id }),
      )
    }

    // 检查权限
    if (ownerScopeFor(scope, userId) === userId && customer.ownerUserId !== userId) {
      throw new BusinessError(AuthErrorCode.FORBIDDEN, '无权操作该客户')
    }

    // 数据准备（numberId 在重试循环里每次重生成，先不放进 data）
    const data = compact({
      customerId,
      name: customer.name,
      gender: customer.gender,
      birthday: customer.birthday,
      mobile: customer.mobile,
      wechat: customer.wechat,
      qq: customer.qq,
      provinceId: customer.provinceId,
      cityId: customer.cityId,
      districtId: customer.districtId,
      address: customer.address,
      source: 'from_customer',
      businessCategory: optionalString(memberFields.businessCategory, { field: '业务分类', max: 50 }) ?? undefined,
      intentionProject: optionalString(memberFields.intentionProject, { field: '意向项目', max: 255 }) ?? undefined,
      memberStage: memberFields.memberStage ?? 'new',
      intentionLevel: memberFields.intentionLevel ?? 'unset',
      budgetRange: optionalString(memberFields.budgetRange, { field: '预算范围', max: 50 }) ?? undefined,
      expectedDate: parseDateOrThrow(memberFields.expectedDate, '预计到院日期'),
      preferredHospitalId: memberFields.preferredHospitalId === undefined ? undefined : Number(memberFields.preferredHospitalId),
      memberStatus: 'active',
      joinedAt: new Date(),
      ownerUserId: memberFields.ownerUserId ? Number(memberFields.ownerUserId) : customer.ownerUserId,
      creatorId: userId,
      updaterId: userId,
      nextFollowUpAt: memberFields.nextFollowUpAt ? new Date(memberFields.nextFollowUpAt) : undefined,
      remark: trimOrNull(memberFields.remark) ?? undefined,
    })

    const member = await MembersService._createWithNumberIdRetry(data)

    // Set tags (支持纯文本输入，自动 find-or-create)
    const resolvedTagIds = await resolveTagIds({ tagsText, tagNames, tagIds, userId })
    if (resolvedTagIds.length) {
      await withDbErrorMapping(() => MembersRepository.setMemberTags(member.id, resolvedTagIds))
      member.tags = await MembersRepository.getMemberTagIds(member.id)
    }

    // Create initial follow-up if first contact provided
    if (firstContactRecord) {
      await withDbErrorMapping(() => MembersRepository.createFollowUp({
        memberId: member.id,
        operatorUserId: userId,
        followUpMethod: 'other',
        content: firstContactRecord,
        result: 'contacted',
        stageAfter: data.memberStage,
        intentionLevelAfter: data.intentionLevel,
        nextFollowUpAt: data.nextFollowUpAt,
      }))
    }

    return MembersRepository.findById(member.id, { includeTags: true })
  }

  // ── 直接新增会员 ──

  static async createDirect(input: any, userId: number, scope: DataScopeCode = DATA_SCOPE.ALL) {
    const { tagIds, tagNames, tagsText, firstContactRecord, sourceChannel, ...rest } = input
    requireString(rest.name, { field: '会员姓名', min: 1, max: 50 })

    // Check mobile uniqueness
    const mobile = optionalPhone(rest.mobile, '手机号')
    if (mobile) {
      const byMobile = await MembersRepository.findByMobile(mobile)
      if (byMobile) {
        throw new BusinessError(
          ValidationErrorCode.PARAMETER_FORMAT_ERROR,
          '该手机号已是会员顾客',
          JSON.stringify({ existingMemberId: byMobile.id }),
        )
      }

      // Check if mobile exists in customers
      const customersList = await CustomersRepository.list({
        keyword: mobile,
        pageSize: 1, page: 1,
      })
      if (customersList.list.length > 0) {
        throw new BusinessError(
          ValidationErrorCode.PARAMETER_FORMAT_ERROR,
          '该手机号已存在客户记录，建议从已有客户转为会员',
          JSON.stringify({ existingCustomerId: customersList.list[0].id }),
        )
      }
    }

    const data = compact({
      name: rest.name,
      gender: rest.gender === undefined ? undefined : Number(rest.gender),
      birthday: parseDateOrThrow(rest.birthday, '生日'),
      mobile,
      wechat: optionalWechat(rest.wechat, '微信号'),
      qq: optionalQq(rest.qq, 'QQ 号'),
      provinceId: rest.provinceId === undefined ? undefined : Number(rest.provinceId),
      cityId: rest.cityId === undefined ? undefined : Number(rest.cityId),
      districtId: rest.districtId === undefined ? undefined : Number(rest.districtId),
      address: optionalString(rest.address, { field: '地址', max: 255 }) ?? undefined,
      source: 'direct',
      businessCategory: optionalString(rest.businessCategory, { field: '业务分类', max: 50 }) ?? undefined,
      intentionProject: optionalString(rest.intentionProject, { field: '意向项目', max: 255 }) ?? undefined,
      memberStage: rest.memberStage ?? 'new',
      intentionLevel: rest.intentionLevel ?? 'unset',
      budgetRange: optionalString(rest.budgetRange, { field: '预算范围', max: 50 }) ?? undefined,
      expectedDate: parseDateOrThrow(rest.expectedDate, '预计到院日期'),
      preferredHospitalId: rest.preferredHospitalId === undefined ? undefined : Number(rest.preferredHospitalId),
      memberStatus: 'active',
      joinedAt: new Date(),
      ownerUserId: rest.ownerUserId ? Number(rest.ownerUserId) : userId,
      creatorId: userId,
      updaterId: userId,
      nextFollowUpAt: rest.nextFollowUpAt ? new Date(rest.nextFollowUpAt) : undefined,
      remark: trimOrNull(rest.remark) ?? undefined,
    })

    const member = await MembersService._createWithNumberIdRetry(data)

    // Set tags (支持纯文本输入，自动 find-or-create)
    const resolvedTagIds = await resolveTagIds({ tagsText, tagNames, tagIds, userId })
    if (resolvedTagIds.length) {
      await withDbErrorMapping(() => MembersRepository.setMemberTags(member.id, resolvedTagIds))
      member.tags = await MembersRepository.getMemberTagIds(member.id)
    }

    // Create initial follow-up
    if (firstContactRecord) {
      await withDbErrorMapping(() => MembersRepository.createFollowUp({
        memberId: member.id,
        operatorUserId: userId,
        followUpMethod: 'other',
        content: firstContactRecord,
        result: 'contacted',
        stageAfter: data.memberStage,
        intentionLevelAfter: data.intentionLevel,
        nextFollowUpAt: data.nextFollowUpAt,
      }))
    }

    return MembersRepository.findById(member.id, { includeTags: true })
  }

  // ── 更新会员 ──

  static async update(id: number, input: any, userId: number, scope: DataScopeCode = DATA_SCOPE.ALL) {
    const existing = await this.getById(id, userId, scope)
    if (!existing) throw new BusinessError(ResourceErrorCode.NOT_FOUND, '会员不存在或无权访问')

    const { tagIds, tagNames, tagsText, ...fields } = input
    if (fields.name !== undefined) {
      requireString(fields.name, { field: '会员姓名', min: 1, max: 50 })
    }
    const mobile = fields.mobile === undefined ? undefined : optionalPhone(fields.mobile, '手机号')

    // Mobile uniqueness check
    if (mobile && mobile !== existing.mobile) {
      const byMobile = await MembersRepository.findByMobile(mobile)
      if (byMobile && byMobile.id !== id) {
        throw new BusinessError(ValidationErrorCode.PARAMETER_FORMAT_ERROR, '该手机号已被其他会员使用')
      }
    }

    const data = compact({
      ...(fields.name !== undefined ? { name: fields.name } : {}),
      gender: fields.gender === undefined ? undefined : Number(fields.gender),
      birthday: fields.birthday === undefined ? undefined : parseDateOrThrow(fields.birthday, '生日'),
      mobile,
      wechat: fields.wechat === undefined ? undefined : optionalWechat(fields.wechat, '微信号'),
      qq: fields.qq === undefined ? undefined : optionalQq(fields.qq, 'QQ 号'),
      provinceId: fields.provinceId === undefined ? undefined : Number(fields.provinceId),
      cityId: fields.cityId === undefined ? undefined : Number(fields.cityId),
      districtId: fields.districtId === undefined ? undefined : Number(fields.districtId),
      address: fields.address === undefined ? undefined : optionalString(fields.address, { field: '地址', max: 255 }) ?? undefined,
      businessCategory: fields.businessCategory === undefined ? undefined : (optionalString(fields.businessCategory, { field: '业务分类', max: 50 }) ?? undefined),
      intentionProject: fields.intentionProject === undefined ? undefined : (optionalString(fields.intentionProject, { field: '意向项目', max: 255 }) ?? undefined),
      memberStage: fields.memberStage,
      intentionLevel: fields.intentionLevel,
      budgetRange: fields.budgetRange === undefined ? undefined : (optionalString(fields.budgetRange, { field: '预算范围', max: 50 }) ?? undefined),
      expectedDate: fields.expectedDate === undefined ? undefined : parseDateOrThrow(fields.expectedDate, '预计到院日期'),
      preferredHospitalId: fields.preferredHospitalId === undefined ? undefined : Number(fields.preferredHospitalId),
      ownerUserId: fields.ownerUserId === undefined ? undefined : Number(fields.ownerUserId),
      nextFollowUpAt: fields.nextFollowUpAt ? new Date(fields.nextFollowUpAt) : undefined,
      remark: fields.remark === undefined ? undefined : trimOrNull(fields.remark) ?? undefined,
      updaterId: userId,
    })

    await withDbErrorMapping(() => MembersRepository.update(id, data))

    // Update tags (支持纯文本输入，自动 find-or-create)
    if (tagsText !== undefined || tagNames !== undefined || tagIds !== undefined) {
      const resolvedTagIds = await resolveTagIds({ tagsText, tagNames, tagIds, userId })
      await withDbErrorMapping(() => MembersRepository.setMemberTags(id, resolvedTagIds))
    }

    return MembersRepository.findById(id, { includeTags: true })
  }

  // ── 添加跟进 ──

  static async addFollowUp(id: number, input: any, userId: number, scope: DataScopeCode = DATA_SCOPE.ALL) {
    const existing = await this.getById(id, userId, scope)
    if (!existing) throw new BusinessError(ResourceErrorCode.NOT_FOUND, '会员不存在或无权访问')

    const record = await withDbErrorMapping(() => MembersRepository.createFollowUp({
      memberId: id,
      operatorUserId: userId,
      followUpMethod: optionalString(input.followUpMethod, { field: '跟进方式', max: 20 }) ?? 'other',
      content: requireString(input.content, { field: '跟进内容', min: 1, max: 5000 }),
      result: optionalString(input.result, { field: '跟进结果', max: 30 }) ?? 'contacted',
      stageAfter: optionalString(input.memberStage, { field: '阶段', max: 30 }) ?? undefined,
      intentionLevelAfter: optionalString(input.intentionLevel, { field: '意向等级', max: 20 }) ?? undefined,
      nextFollowUpAt: input.nextFollowUpAt ? new Date(input.nextFollowUpAt) : undefined,
    }))

    // Update member's last follow-up time, stage, intention level, next follow-up
    const updateData: any = {
      lastFollowUpAt: new Date(),
      updaterId: userId,
    }
    if (input.memberStage) updateData.memberStage = input.memberStage
    if (input.intentionLevel) updateData.intentionLevel = input.intentionLevel
    if (input.nextFollowUpAt) {
      updateData.nextFollowUpAt = new Date(input.nextFollowUpAt)
    } else if (input.result === 'unreachable') {
      // 未接通必须设置下次跟进时间 — 由前端校验
    }

    await withDbErrorMapping(() => MembersRepository.update(id, updateData))

    return record
  }

  // ── 作废会员 ──

  static async invalidate(id: number, userId: number, scope: DataScopeCode = DATA_SCOPE.ALL) {
    const existing = await this.getById(id, userId, scope)
    if (!existing) throw new BusinessError(ResourceErrorCode.NOT_FOUND, '会员不存在或无权访问')
    if (existing.memberStatus === 'invalid') throw new BusinessError(ResourceErrorCode.ALREADY_EXISTS, '该会员已作废')

    await withDbErrorMapping(() => MembersRepository.update(id, {
      memberStatus: 'invalid',
      previousStage: existing.memberStage,
      invalidAt: new Date(),
      invalidBy: userId,
      updaterId: userId,
    }))

    return MembersRepository.findById(id, { includeTags: true })
  }

  // ── 批量作废 ──

  static async batchInvalidate(memberIds: number[], userId: number, scope: DataScopeCode = DATA_SCOPE.ALL) {
    const results: any[] = []
    for (const id of memberIds) {
      try {
        results.push(await this.invalidate(id, userId, scope))
      } catch (e: any) {
        results.push({ id, error: e.message })
      }
    }
    return results
  }

  // ── 恢复会员 ──

  static async restore(id: number, input: any, userId: number, scope: DataScopeCode = DATA_SCOPE.ALL) {
    const existing = await MembersRepository.findById(id)
    if (!existing) throw new BusinessError(ResourceErrorCode.NOT_FOUND, '会员不存在')
    if (existing.memberStatus !== 'invalid') throw new BusinessError(ValidationErrorCode.INVALID_STATE, '该会员不是作废状态')

    await withDbErrorMapping(() => MembersRepository.update(id, {
      memberStatus: 'active',
      memberStage: input.memberStage ?? existing.previousStage ?? 'new',
      invalidAt: null,
      invalidBy: null,
      previousStage: null,
      updaterId: userId,
    }))

    return MembersRepository.findById(id, { includeTags: true })
  }

  // ── 批量分配客服 ──

  static async batchAssign(memberIds: number[], toUserId: number, reason: string | undefined, userId: number, scope: DataScopeCode = DATA_SCOPE.ALL) {
    const results: any[] = []
    for (const id of memberIds) {
      try {
        const existing = await this.getById(id, userId, scope)
        if (!existing) throw new BusinessError(ResourceErrorCode.NOT_FOUND, '会员不存在或无权访问')

        const fromUserId = existing.ownerUserId

        // Update owner
        await withDbErrorMapping(() => MembersRepository.update(id, { ownerUserId: toUserId, updaterId: userId }))

        // Record assignment history
        await withDbErrorMapping(() => MembersRepository.createAssignmentRecord({
          memberId: id,
          fromUserId: fromUserId !== toUserId ? fromUserId : null,
          toUserId,
          operatorUserId: userId,
          reason: optionalString(reason, { field: '分配原因', max: 255 }) ?? null,
        }))

        results.push({ id, success: true })
      } catch (e: any) {
        results.push({ id, error: e.message })
      }
    }
    return results
  }

  // ── 批量打标签 ──

  static async batchAddTags(
    memberIds: number[],
    tags: { tagIds?: number[]; tagNames?: string[]; tagsText?: string },
    userId: number,
    scope: DataScopeCode = DATA_SCOPE.ALL,
  ) {
    const tagIds = await resolveTagIds({ tagsText: tags.tagsText, tagNames: tags.tagNames, tagIds: tags.tagIds, userId })
    if (!tagIds.length) return { success: true, affected: memberIds.length, tagIds: [] as number[] }
    await withDbErrorMapping(() => MembersRepository.batchSetMemberTags(memberIds, tagIds))
    return { success: true, affected: memberIds.length, tagIds }
  }

  // ── 标签管理 ──

  static async listTags() {
    return MembersRepository.listTags()
  }

  static async createTag(input: any, userId: number) {
    return withDbErrorMapping(() => MembersRepository.createTag({
      name: requireString(input.name, { field: '标签名', min: 1, max: 50 }),
      color: optionalString(input.color, { field: '颜色', max: 20 }) ?? undefined,
      creatorId: userId,
    }))
  }

  static async deleteTag(tagId: number) {
    return withDbErrorMapping(() => MembersRepository.deleteTag(tagId))
  }

  // ── 可选择的客户 ──

  static async listSelectableCustomers(q: any, userId: number, scope: DataScopeCode = DATA_SCOPE.ALL) {
    const p = pageArgs(q)
    const ownerUserId = ownerScopeFor(scope, userId)
    return { ...(await MembersRepository.listSelectableCustomers({ ...q, ...p, ownerUserId })), ...p }
  }

  // ── 获取跟进记录 ──

  static async listFollowUps(id: number, userId: number, scope: DataScopeCode = DATA_SCOPE.ALL) {
    const existing = await this.getById(id, userId, scope)
    if (!existing) throw new BusinessError(ResourceErrorCode.NOT_FOUND, '会员不存在或无权访问')
    return MembersRepository.listFollowUps(id)
  }
}
