import { CrmRepository } from '../repositories/crm.repository.js'
import sanitizeHtml from 'sanitize-html'
import { hashPassword } from '../../../../utils/password.js'

export type PageQuery = { page?: number; pageSize?: number; keyword?: string; startTime?: string; endTime?: string }

const SUPER_ADMIN_ID = 1
const DUPLICATE_CUSTOMER_STATUS_ID = 3
const isSuperAdmin = (userId: number) => userId === SUPER_ADMIN_ID
const pageArgs = (query: PageQuery) => ({ page: Math.max(1, Number(query.page ?? 1)), pageSize: Math.max(0, Number(query.pageSize ?? 10)) })
const asDate = (value: unknown) => { if (!value) return undefined; const date = new Date(String(value)); return Number.isNaN(date.getTime()) ? undefined : date }
const compact = <T extends Record<string, unknown>>(input: T) => Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as T
const sanitizeReplyContent = (content: string) => sanitizeHtml(content, {
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    img: ['alt', 'src', 'title'],
    mark: ['data-color'],
    p: ['style'],
    span: ['style'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedStyles: {
    '*': {
      'background-color': [/^#[0-9a-f]{3,8}$/i, /^rgb\([\d\s,]+\)$/i],
      color: [/^#[0-9a-f]{3,8}$/i, /^rgb\([\d\s,]+\)$/i],
      'text-align': [/^(left|right|center|justify)$/],
    },
  },
  allowedTags: ['a', 'blockquote', 'br', 'code', 'em', 'h1', 'h2', 'h3', 'h4', 'img', 'li', 'mark', 'ol', 'p', 'pre', 's', 'span', 'strong', 'sub', 'sup', 'u', 'ul'],
})
const hasReplyContent = (content: string) => /<img\b/i.test(content) || Boolean(sanitizeHtml(content, { allowedAttributes: {}, allowedTags: [] }).replaceAll('&nbsp;', ' ').trim())
const sanitizeDispatchReplies = (dispatch: any) => ({
  ...dispatch,
  replies: dispatch.replies?.map((reply: any) => ({
    ...reply,
    content: sanitizeReplyContent(reply.content),
  })),
})
function normalizeContractPhotos(value: unknown) { if (value === undefined) return undefined; if (value === null || value === '') return null; if (typeof value === 'string') { try { return JSON.parse(value) } catch { return [{ url: value, name: '' }] } }; return value }

/** CRM use cases. Persistence is deliberately delegated to CrmRepository. */
export class CrmService {
  static async listHospitals(query: PageQuery & { status?: string }) { const page = pageArgs(query); const result = await CrmRepository.listHospitals({ ...query, ...page }); return { ...result, ...page } }
  static getHospital(id: number) { return CrmRepository.findHospital(id) }
  static async saveHospital(input: any, currentUserId: number, id?: number) {
    const data = compact({ accountUserId: input.accountUserId === null ? null : input.accountUserId === undefined ? undefined : Number(input.accountUserId), hospitalName: input.hospitalName, provinceId: input.provinceId === undefined ? undefined : Number(input.provinceId), cityId: input.cityId === undefined ? undefined : Number(input.cityId), districtId: input.districtId === undefined ? undefined : Number(input.districtId), hospitalAddress: input.hospitalAddress, hospitalPhone: input.hospitalPhone, hospitalSelling: input.hospitalSelling, hospitalWebsite: input.hospitalWebsite, hospitalNature: input.hospitalNature === undefined ? undefined : Number(input.hospitalNature), doctorName: input.doctorName, doctorPhone: input.doctorPhone, doctorQq: input.doctorQq, receptionName: input.receptionName, receptionPhone: input.receptionPhone, receptionQq: input.receptionQq, busStation: input.busStation, busAddress: input.busAddress, subwayStation: input.subwayStation, subwayAddress: input.subwayAddress, taxiFare: input.taxiFare, vipDiscount: input.vipDiscount, returnPoint: input.returnPoint, hospitalIntroduction: input.hospitalIntroduction, contractPhotos: normalizeContractPhotos(input.contractPhotos), wechatOpenid: input.wechatOpenid, status: input.status === undefined ? undefined : Number(input.status), updaterId: currentUserId })
    return id ? CrmRepository.updateHospital(id, data) : CrmRepository.createHospital({ ...data, hospitalName: input.hospitalName, creatorId: currentUserId, updaterId: currentUserId })
  }
  static deleteHospital(id: number, currentUserId: number) { return CrmRepository.updateHospital(id, { deletedAt: new Date(), updaterId: currentUserId }) }
  static async listCustomerStatuses() { await CrmRepository.ensureDefaultStatuses(); return CrmRepository.listCustomerStatuses() }
  static async listDispatchStatuses() { await CrmRepository.ensureDefaultStatuses(); return CrmRepository.listDispatchStatuses() }

  static async listCustomers(query: PageQuery & { statusId?: number }, currentUserId: number) { const page = pageArgs(query); const result = await CrmRepository.listCustomers({ ...query, ...page, ownerUserId: isSuperAdmin(currentUserId) ? undefined : currentUserId }); return { ...result, ...page } }
  static async getCustomer(id: number, currentUserId: number) { const customer = await CrmRepository.findCustomer(id, true); return !customer || (!isSuperAdmin(currentUserId) && customer.ownerUserId !== currentUserId) ? null : customer }
  static async saveCustomer(input: any, currentUserId: number, id?: number) {
    await CrmRepository.ensureDefaultStatuses(); const statusId = input.statusId === undefined ? undefined : Number(input.statusId)
    if (statusId === DUPLICATE_CUSTOMER_STATUS_ID && !input.remark) throw new Error('重单客户必须填写重单理由')
    const data = compact({ numberId: input.numberId, name: input.name, gender: input.gender === undefined ? undefined : Number(input.gender), birthday: asDate(input.birthday), telphone: input.telphone, mobile: input.mobile, qq: input.qq, wechat: input.wechat, provinceId: input.provinceId === undefined ? undefined : Number(input.provinceId), cityId: input.cityId === undefined ? undefined : Number(input.cityId), districtId: input.districtId === undefined ? undefined : Number(input.districtId), address: input.address, plastic: input.plastic, statusId, remark: input.remark, ownerUserId: input.ownerUserId === undefined ? undefined : Number(input.ownerUserId), updaterId: currentUserId })
    if (id) { if (!await this.getCustomer(id, currentUserId)) throw new Error('客户不存在或无权访问'); return CrmRepository.updateCustomer(id, data) }
    return CrmRepository.createCustomer({ ...data, numberId: input.numberId || await CrmRepository.nextCustomerNumber(), name: input.name, statusId: statusId || 1, ownerUserId: input.ownerUserId ? Number(input.ownerUserId) : currentUserId, creatorId: currentUserId, updaterId: currentUserId })
  }
  static async dispatchCustomer(customerId: number, input: any, currentUserId: number) { await CrmRepository.ensureDefaultStatuses(); if (!await this.getCustomer(customerId, currentUserId)) throw new Error('客户不存在或无权访问'); const hospitalIds = Array.from(new Set<number>((input.hospitalIds || []).map(Number).filter(Boolean))); if (!hospitalIds.length) throw new Error('请选择派单医院'); return CrmRepository.dispatchCustomer(customerId, hospitalIds, input.statusId ? Number(input.statusId) : 1, currentUserId, input.reply || '此客户是贵医院潜在客户，请跟进') }

  static async listMembers(query: PageQuery, currentUserId: number) { const page = pageArgs(query); const result = await CrmRepository.listMembers({ ...query, ...page, ownerUserId: isSuperAdmin(currentUserId) ? undefined : currentUserId }); return { ...result, ...page } }
  static async getMember(id: number, currentUserId: number, recordBrowse = false) { const member = await CrmRepository.findMember(id); if (!member || (!isSuperAdmin(currentUserId) && member.ownerUserId !== currentUserId)) return null; if (recordBrowse) await CrmRepository.recordMemberBrowse(id, currentUserId); return member }
  static async saveMember(input: any, currentUserId: number, id?: number) { const data = compact({ numberId: input.numberId, name: input.name, gender: input.gender === undefined ? undefined : Number(input.gender), birthday: asDate(input.birthday), address: input.address, mobile: input.mobile, project: input.project, ownerUserId: input.ownerUserId === undefined ? undefined : Number(input.ownerUserId), updaterId: currentUserId }); if (id) { if (!await this.getMember(id, currentUserId)) throw new Error('会员不存在或无权访问'); return CrmRepository.updateMember(id, data) }; return CrmRepository.createMember({ ...data, numberId: input.numberId || await CrmRepository.nextMemberNumber(), name: input.name, ownerUserId: input.ownerUserId ? Number(input.ownerUserId) : currentUserId, creatorId: currentUserId, updaterId: currentUserId }) }
  static async addMemberRemark(memberId: number, content: string, currentUserId: number) { if (!await this.getMember(memberId, currentUserId)) throw new Error('会员不存在或无权访问'); if (!content) throw new Error('备注内容不能为空'); return CrmRepository.addMemberRemark(memberId, currentUserId, content) }

  static async getAccessibleHospitalIds(userId: number): Promise<number[] | null> { if (isSuperAdmin(userId)) return null; return (await CrmRepository.accessibleHospitalIds(userId)).map((row) => row.hospitalId) }
  static async listDispatches(query: PageQuery & { statusId?: number }, currentUserId: number) { const page = pageArgs(query); const ids = await this.getAccessibleHospitalIds(currentUserId); if (ids?.length === 0) return { list: [], total: 0, ...page }; const result = await CrmRepository.listDispatches({ ...query, ...page, hospitalIds: ids ?? undefined }); return { ...result, ...page } }
  static async getDispatch(id: number, currentUserId: number) { const dispatch = await CrmRepository.findDispatch(id); if (!dispatch) return null; const ids = await this.getAccessibleHospitalIds(currentUserId); return ids !== null && !ids.includes(dispatch.hospitalId) ? null : sanitizeDispatchReplies(dispatch) }
  static async updateDispatch(id: number, input: any, currentUserId: number) { if (!await this.getDispatch(id, currentUserId)) throw new Error('派单不存在或无权访问'); return CrmRepository.updateDispatch(id, compact({ hospitalId: input.hospitalId === undefined ? undefined : Number(input.hospitalId), statusId: input.statusId === undefined ? undefined : Number(input.statusId), image: input.image, receiveQq: input.receiveQq, receiveWechat: input.receiveWechat, finishedAt: asDate(input.finishedAt), createdAt: asDate(input.createdAt), updaterId: currentUserId })) }
  static async addDispatchReply(id: number, input: any, currentUserId: number) { if (!await this.getDispatch(id, currentUserId)) throw new Error('派单不存在或无权访问'); const content = input.content === undefined ? undefined : sanitizeReplyContent(input.content); if (content !== undefined && !hasReplyContent(content)) throw new Error('留言不能为空'); return CrmRepository.replyDispatch(id, compact({ receiveQq: input.receiveQq, receiveWechat: input.receiveWechat, image: input.image, statusId: input.statusId === undefined ? undefined : Number(input.statusId), updaterId: currentUserId }), currentUserId, content) }
  static async addDispatchLog(id: number, content: string, currentUserId: number) { if (!await this.getDispatch(id, currentUserId)) throw new Error('派单不存在或无权访问'); if (!content) throw new Error('跟进内容不能为空'); return CrmRepository.addDispatchLog(id, currentUserId, content) }
  static listHospitalAccounts(hospitalId: number) { return CrmRepository.listHospitalAccounts(hospitalId) }
  static async createHospitalAccount(hospitalId: number, input: any, currentUserId: number) { const { username, phone, realName, email, password, role, remark } = input; if (!username) throw new Error('用户名不能为空'); if (!phone) throw new Error('手机号不能为空'); if (!password) throw new Error('密码不能为空'); if (!['owner', 'admin', 'member'].includes(role)) throw new Error('无效的角色'); return CrmRepository.createHospitalAccount(hospitalId, { username, phone, realName, email, passwordHash: await hashPassword(password), status: 1, creatorId: currentUserId, updaterId: currentUserId }, { hospitalId, userId: 0, role, status: 1, remark, creatorId: currentUserId, updaterId: currentUserId }) }
  static async assignHospitalAccount(hospitalId: number, input: any, currentUserId: number) { const { userId, role, remark } = input; if (!userId) throw new Error('用户ID不能为空'); if (!['owner', 'admin', 'member'].includes(role)) throw new Error('无效的角色'); if ((await CrmRepository.findHospitalAccount(hospitalId, userId))[0]) throw new Error('该用户已是医院账号'); if (!(await CrmRepository.findUser(userId))[0]) throw new Error('用户不存在'); return CrmRepository.assignHospitalAccount({ hospitalId, userId, role, status: 1, remark, creatorId: currentUserId, updaterId: currentUserId }) }
  static async updateHospitalAccount(hospitalId: number, userId: number, input: any, currentUserId: number) { const existing = (await CrmRepository.findHospitalAccount(hospitalId, userId))[0]; if (!existing) throw new Error('医院账号关系不存在'); const { role, status, remark, username, realName, phone, email, password } = input; if (role && !['owner', 'admin', 'member'].includes(role)) throw new Error('无效的角色'); if (existing.role === 'owner' && role && role !== 'owner' && status !== 0 && Number((await CrmRepository.countOwners(hospitalId))[0]?.total) <= 1) throw new Error('不能取消最后一个负责人身份'); if (username !== undefined && (await CrmRepository.findOtherUserByUsername(username, userId))[0]) throw new Error('账号已被其他用户使用'); const userUpdates = compact({ username, realName, phone, email, passwordHash: password ? await hashPassword(password) : undefined, updaterId: currentUserId }); if (Object.keys(userUpdates).length > 1) await CrmRepository.updateUser(userId, userUpdates); return CrmRepository.updateHospitalAccount(existing.id, compact({ role: role || undefined, status: status === undefined ? undefined : Number(status), remark, updaterId: currentUserId })) }
  static async deleteHospitalAccount(hospitalId: number, userId: number, currentUserId: number) { const existing = (await CrmRepository.findHospitalAccount(hospitalId, userId))[0]; if (!existing) throw new Error('医院账号关系不存在'); if (existing.role === 'owner' && Number((await CrmRepository.countOwners(hospitalId))[0]?.total) <= 1) throw new Error('不能解除最后一个负责人'); return CrmRepository.updateHospitalAccount(existing.id, { deletedAt: new Date(), updaterId: currentUserId }) }
  static async bindWechatOpenid(hospitalId: number, signature: string, openid: string) { const crypto = await import('node:crypto'); if (crypto.createHash('md5').update(`hospital_bind${hospitalId}`).digest('hex') !== signature) throw new Error('微信绑定签名无效'); return CrmRepository.bindWechatOpenid(hospitalId, openid) }
}
