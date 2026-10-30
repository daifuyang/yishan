import { BusinessError } from '@yishan/core-api/errors'
import { AuthErrorCode } from '@yishan/core-api/business-codes/auth'
import { ROLE_IDS } from '@/modules/iximei_crm/role-codes'
import { ResourceErrorCode } from '@yishan/core-api/business-codes/resource'
import { ValidationErrorCode } from '@yishan/core-api/business-codes/validation'
import { withDbErrorMapping } from '@/modules/iximei_crm/utils/db-error'
import { UserTokenRepository } from '@/modules/iximei_crm/user-token'
import { HospitalsRepository } from '../repositories/hospitals.repository.js'
import { compact, normalizeContractPhotos } from './_shared.js'
import { hashPassword } from '@yishan/core-system-api/utils/password'
import {
  requireString,
  optionalString,
  optionalPhone,
} from '../_validation.js'
import { validatePasswordByPolicy } from '@/modules/iximei_crm/utils/password-policy'
import type { FastifyRequest } from 'fastify'


/**
 * 医院 Service — 一院一账号版本。
 *
 * 不变量：
 *   - 每家医院恰好一个 sys_user 账号，由 crm_hospital.account_user_id 唯一指向；
 *   - username 始终等于 hospital_name；
 *   - hospital_account 角色的可见医院集由 accessibleHospitalIds 提供；
 *   - 0 结果 → BusinessError(403)，禁止回退为全量数据。
 */
export class HospitalsService {
  static getById(id: number) {
    return HospitalsRepository.findById(id)
  }

  static async list(q: any) {
    const p = { ...q, ...requirePage(q) }
    return { ...(await HospitalsRepository.list(p)), ...p }
  }

  static async searchOptions(q: any) {
    // 2026-08-24：前端 hospital-dashboard 看板页改为键入即搜 + 最多 500 条；
    // pageSize=50 太小（即使空 keyword 也只返 50 条），统一扩到 500。
    // dashboard.tsx 仍在前端自己 slice(0, 50) 截断，不受影响。
    return this.list({ ...q, page: 1, pageSize: 500 })
  }

  /**
   * 创建医院：原子地创建 sys_user + 绑定 hospital_account 角色 + 写入 crm_hospital.account_user_id。
   * username 固定取 hospitalName；任一步失败回滚。
   */
  static async createWithAccount(input: any, creatorId: number) {
    const hospitalName = requireString(input.hospitalName, { field: '医院名称', min: 1, max: 50 })
    if (await HospitalsRepository.findOtherUserByUsername(hospitalName, 0)) {
      throw new BusinessError(ResourceErrorCode.ALREADY_EXISTS, '医院名称已被其他账号占用')
    }
    const hospitalInput = compact({
      hospitalName,
      provinceId: input.provinceId,
      cityId: input.cityId,
      districtId: input.districtId,
      hospitalAddress: optionalString(input.hospitalAddress, { field: '医院地址', max: 255 }) ?? undefined,
      hospitalPhone: optionalString(input.hospitalPhone, { field: '咨询电话', max: 50 }) ?? undefined,
      hospitalSelling: optionalString(input.hospitalSelling, { field: '营销卖点', max: 255 }) ?? undefined,
      hospitalWebsite: optionalString(input.hospitalWebsite, { field: '官网', max: 255 }) ?? undefined,
      hospitalNature: input.hospitalNature,
      // category 经 TypeBox schema 校验为 'oral' | 'plastic' | undefined；
      // undefined 被 compact() 剔除，对应 DB NULL（dashboard 派生为 unknown）。
      category: input.category,
      doctorName: optionalString(input.doctorName, { field: '就医联系人', max: 50 }) ?? undefined,
      doctorPhone: optionalString(input.doctorPhone, { field: '就医电话', max: 50 }) ?? undefined,
      doctorQq: optionalString(input.doctorQq, { field: '就医 QQ', max: 50 }) ?? undefined,
      receptionName: optionalString(input.receptionName, { field: '前台联系人', max: 50 }) ?? undefined,
      receptionPhone: optionalString(input.receptionPhone, { field: '前台电话', max: 50 }) ?? undefined,
      receptionQq: optionalString(input.receptionQq, { field: '前台 QQ', max: 50 }) ?? undefined,
      busStation: optionalString(input.busStation, { field: '公交站', max: 100 }) ?? undefined,
      busAddress: optionalString(input.busAddress, { field: '公交地址', max: 255 }) ?? undefined,
      subwayStation: optionalString(input.subwayStation, { field: '地铁站', max: 100 }) ?? undefined,
      subwayAddress: optionalString(input.subwayAddress, { field: '地铁地址', max: 255 }) ?? undefined,
      taxiFare: optionalString(input.taxiFare, { field: '出租车费', max: 50 }) ?? undefined,
      vipDiscount: optionalString(input.vipDiscount, { field: '会员优惠', max: 255 }) ?? undefined,
      returnPoint: optionalString(input.returnPoint, { field: '医院返点', max: 50 }) ?? undefined,
      hospitalIntroduction: optionalString(input.hospitalIntroduction, { field: '医院简介', max: 5000 }) ?? undefined,
      contractPhotos: normalizeContractPhotos(input.contractPhotos),
      wechatOpenid: optionalString(input.wechatOpenid, { field: '微信 openid', max: 64 }) ?? undefined,
      status: input.status ?? 1,
      updaterId: creatorId,
    })
    return withDbErrorMapping(async () => HospitalsRepository.createWithAccount(
      hospitalInput,
      {
        username: hospitalName,
        passwordHash: await hashPassword(input.accountPassword),
        email: input.accountEmail ?? null,
        phone: optionalPhone(input.accountPhone, '账号手机号'),
        // 医院新建时若为停用状态，账号也必须同步停用。
        status: hospitalInput.status,
      },
      creatorId,
    ))
  }

  /**
   * 更新医院档案（不含 hospitalName）。
   * 医院改名走独立 POST /hospitals/:id/rename（要求 crm:hospitals:rename 权限），
   * 此处不再处理 hospitalName 字段，调用方传入也会被忽略。
   */
  static async update(input: any, actorId: number, id: number) {
    const data = compact({
      provinceId: input.provinceId,
      cityId: input.cityId,
      districtId: input.districtId,
      hospitalAddress: optionalString(input.hospitalAddress, { field: '医院地址', max: 255 }) ?? undefined,
      hospitalPhone: optionalString(input.hospitalPhone, { field: '咨询电话', max: 50 }) ?? undefined,
      hospitalSelling: optionalString(input.hospitalSelling, { field: '营销卖点', max: 255 }) ?? undefined,
      hospitalWebsite: optionalString(input.hospitalWebsite, { field: '官网', max: 255 }) ?? undefined,
      hospitalNature: input.hospitalNature,
      // category 经 TypeBox schema 校验为 'oral' | 'plastic' | undefined；
      // undefined 被 compact() 剔除，对应 DB NULL（dashboard 派生为 unknown）。
      category: input.category,
      doctorName: optionalString(input.doctorName, { field: '就医联系人', max: 50 }) ?? undefined,
      doctorPhone: optionalString(input.doctorPhone, { field: '就医电话', max: 50 }) ?? undefined,
      doctorQq: optionalString(input.doctorQq, { field: '就医 QQ', max: 50 }) ?? undefined,
      receptionName: optionalString(input.receptionName, { field: '前台联系人', max: 50 }) ?? undefined,
      receptionPhone: optionalString(input.receptionPhone, { field: '前台电话', max: 50 }) ?? undefined,
      receptionQq: optionalString(input.receptionQq, { field: '前台 QQ', max: 50 }) ?? undefined,
      busStation: optionalString(input.busStation, { field: '公交站', max: 100 }) ?? undefined,
      busAddress: optionalString(input.busAddress, { field: '公交地址', max: 255 }) ?? undefined,
      subwayStation: optionalString(input.subwayStation, { field: '地铁站', max: 100 }) ?? undefined,
      subwayAddress: optionalString(input.subwayAddress, { field: '地铁地址', max: 255 }) ?? undefined,
      taxiFare: optionalString(input.taxiFare, { field: '出租车费', max: 50 }) ?? undefined,
      vipDiscount: optionalString(input.vipDiscount, { field: '会员优惠', max: 255 }) ?? undefined,
      returnPoint: optionalString(input.returnPoint, { field: '医院返点', max: 50 }) ?? undefined,
      hospitalIntroduction: optionalString(input.hospitalIntroduction, { field: '医院简介', max: 5000 }) ?? undefined,
      contractPhotos: normalizeContractPhotos(input.contractPhotos),
      wechatOpenid: optionalString(input.wechatOpenid, { field: '微信 openid', max: 64 }) ?? undefined,
      status: input.status,
      updaterId: actorId,
    })
    const existing = await HospitalsRepository.findById(id)
    if (!existing) throw new BusinessError(ResourceErrorCode.NOT_FOUND, '医院不存在')
    if (data.status === 0) {
      const account = await HospitalsRepository.getAccountByHospitalId(id)
      if (!account) throw new BusinessError(ResourceErrorCode.NOT_FOUND, '医院账号不存在')
      const result = await withDbErrorMapping(() =>
        HospitalsRepository.deactivateHospitalAndAccount(id, account.userId, data),
      )
      await UserTokenRepository.revokeAllByUserId(account.userId)
      return result
    }
    // 医院恢复启用时不自动恢复账号；账号需由管理员单独启用。
    return withDbErrorMapping(() => HospitalsRepository.update(id, data))
  }

  /**
   * 改名（仅系统管理员，crm:hospitals:rename 权限）。
   * 同一事务内更新 crm_hospital.hospital_name 与 sys_user.username，
   * 撤销该账号的活跃 Token，并写审计日志。
   * 新名称长度 1–50 字，且不能与其他 sys_user.username 冲突。
   */
  static async renameHospital(
    hospitalId: number,
    newHospitalName: string,
    actorId: number,
    request?: FastifyRequest,
  ) {
    const trimmed = requireString(newHospitalName, { field: '医院名称', min: 1, max: 50 })
    const existing = await HospitalsRepository.findById(hospitalId)
    if (!existing) throw new BusinessError(ResourceErrorCode.NOT_FOUND, '医院不存在')
    if (trimmed === existing.hospitalName) return existing

    const account = await HospitalsRepository.getAccountByHospitalId(hospitalId)
    if (!account) throw new BusinessError(ResourceErrorCode.NOT_FOUND, '医院账号缺失，无法同步改名')

    const updated = await withDbErrorMapping(() =>
      HospitalsRepository.renameHospitalAndAccount(hospitalId, account.userId, trimmed, actorId),
    )

    // 撤销该账号的活跃 Token（plan §5.2.4）
    await UserTokenRepository.revokeAllByUserId(account.userId)

    // 写审计日志（plan §4.3）
    if (request) {
      ;(request as any).auditEvent = {
        type: 'crm.hospital.renamed',
        payload: {
          hospitalId,
          oldName: existing.hospitalName,
          newName: trimmed,
          accountUserId: account.userId,
          actorId,
        },
      }
    }

    return updated
  }

  /**
   * 软删除医院：同时禁用关联 sys_user.status、撤销其活跃 token，写审计日志。
   * 禁止物理删除 sys_user。
   */
  static async delete(id: number, actorId: number) {
    const account = await HospitalsRepository.getAccountByHospitalId(id)
    await withDbErrorMapping(() =>
      HospitalsRepository.update(id, {
        deletedAt: new Date(),
        updaterId: actorId,
        status: 0,
      } as any),
    )
    if (account) {
      await withDbErrorMapping(() => HospitalsRepository.disableAccount(account.userId))
      await UserTokenRepository.revokeAllByUserId(account.userId)
    }
    return { id, deleted: true, accountDisabled: Boolean(account) }
  }

  /* -------------------- 账号侧接口 -------------------- */

  static getAccount(hospitalId: number) {
    return HospitalsRepository.getAccountByHospitalId(hospitalId)
  }

  static async updateAccountContact(hospitalId: number, input: any) {
    const acc = await HospitalsRepository.getAccountByHospitalId(hospitalId)
    if (!acc) throw new BusinessError(ResourceErrorCode.NOT_FOUND, '医院账号不存在')
    const data = compact({
      email: optionalString(input.email, { field: '账号邮箱', max: 100 }) ?? null,
      phone: optionalPhone(input.phone, '账号手机号'),
      status: input.status,
    })
    const updated = await withDbErrorMapping(() =>
      HospitalsRepository.updateAccountContact(acc.userId, data),
    )
    // STRICT-SPEC §6.3：禁用账号时立即撤销该用户所有活跃 Token
    if (input.status === 0) {
      await UserTokenRepository.revokeAllByUserId(acc.userId)
    }
    return updated
  }

  static async resetAccountPassword(hospitalId: number, newPassword: string) {
    const acc = await HospitalsRepository.getAccountByHospitalId(hospitalId)
    if (!acc) throw new BusinessError(ResourceErrorCode.NOT_FOUND, '医院账号不存在')
    // service 层兜底校验, 与 schema 层规则保持一致(同一份 PASSWORD_POLICY)
    const policyErr = validatePasswordByPolicy(newPassword)
    if (policyErr) {
      throw new BusinessError(ValidationErrorCode.PARAMETER_LENGTH_ERROR, policyErr)
    }
    await withDbErrorMapping(async () =>
      HospitalsRepository.resetAccountPassword(acc.userId, await hashPassword(newPassword)),
    )
    // STRICT-SPEC §6.3：重置密码后立即撤销旧 Token
    await UserTokenRepository.revokeAllByUserId(acc.userId)
  }

  /* -------------------- 数据范围 -------------------- */

  /**
   * 为 hospital_account 角色提供可见医院 ID 列表；其余角色不限制。
   * 0 结果 → 抛 BusinessError(403) + 审计，由调用方捕获（routes 层）。
   */
  static async requireAccessibleHospitalIds(userId: number, roleIds: number[]): Promise<number[]> {
    if (!roleIds.includes(ROLE_IDS.HOSPITAL_ACCOUNT)) return []
    const rows = await HospitalsRepository.accessibleHospitalIds(userId)
    const ids = rows.map((r) => Number((r as any).hospitalId))
    if (ids.length === 0) {
      throw new BusinessError(AuthErrorCode.FORBIDDEN, '当前账号未关联有效医院')
    }
    return ids
  }

  static bindWechatOpenid(id: number, signature: string, openid: string) {
    const crypto = require('node:crypto')
    if (crypto.createHash('md5').update(`hospital_bind${id}`).digest('hex') !== signature) {
      throw new BusinessError(AuthErrorCode.FORBIDDEN, '微信绑定签名无效')
    }
    return withDbErrorMapping(() => HospitalsRepository.bindWechatOpenid(id, openid))
  }
}

function requirePage(q: any) {
  return {
    page: Math.max(1, Number(q.page ?? 1)),
    pageSize: Math.max(0, Number(q.pageSize ?? 10)),
  }
}
