import { describe, expect, it } from 'vitest'
import {
  computeHospitalAccountCodes,
  HOSPITAL_ACCOUNT_DISPATCH_DENY,
} from '@/modules/iximei_crm/seed-role-permissions'

/**
 * 医院账号(hospital_account)的权限码绑定断言。
 *
 * 历史背景：2026-09 用户反馈 hospital_account 登录后进 /crm/dispatches 报"权限不足"。
 * 根因是 seed 里 hospitalAccountCodes 用**显式白名单**列了 5 条 crm:dispatches 派生 perm，
 * 漏配了 crm:dispatches:log —— 前端"派单跟进"按钮触发该 perm 的接口 → 403。
 *
 * 修复方案：seed 改为 `crm:dispatches:` 前缀匹配 + 黑名单,未来新增派生 perm 会自动跟随,
 * 但 :update / :delete / :view-mobile-logs / :view-hospital-log 这些 admin/super 专用权限
 * 由黑名单显式拒绝。本测试守住这两个核心不变量：
 *   1) 派生 perm 全部跟随(包括未来新增的)
 *   2) 危险 perm 一律黑名单拦截
 */
describe('hospital_account 角色权限码绑定', () => {
  // 模拟 listPermissions() 在 catalog 里注册的全量 perm codes。包含 crm / system 全族,
  // 以及一些未来新增的派生 perm,验证"前缀匹配 + 黑名单"对未来 perm 的覆盖能力。
  const ALL_CODES = [
    // crm:hospitals:
    'crm:hospitals:list',
    'crm:hospitals:create',
    'crm:hospitals:update',
    'crm:hospitals:delete',
    'crm:hospitals:rename',
    'crm:hospitals:manage-account',
    'crm:hospitals:options',
    // crm:customers:
    'crm:customers:list',
    'crm:customers:create',
    'crm:customers:update',
    'crm:customers:delete',
    'crm:customers:dispatch',
    // crm:dispatches:
    'crm:dispatches:list',
    'crm:dispatches:update',
    'crm:dispatches:delete',
    'crm:dispatches:reply',
    'crm:dispatches:log',
    'crm:dispatches:view-mobile',
    'crm:dispatches:view-mobile-logs',
    'crm:dispatches:view-hospital-log',
    'crm:dispatches:future-perm',     // 模拟未来新增的派生 perm
    // crm:members:
    'crm:members:list',
    'crm:members:create',
    'crm:members:update',
    'crm:members:delete',
    'crm:members:remark',
    'crm:members:follow_up',
    'crm:members:assign',
    'crm:members:tag',
    'crm:members:invalidate',
    'crm:members:restore',
    'crm:members:export',
    // crm:dashboard / hospital-dashboard
    'crm:dashboard:view',
    'crm:hospital-dashboard:view',
    'crm:hospital-dashboard:future',  // 模拟未来新增的看板 perm
    // system:
    'system:user:list',
    'system:role:list',
    'system:menu:authorized',
    // region:
    'region:tree',
    'region:path',
    'region:list',
    'region:read',
    // auth:
    'auth:login',
  ]

  const codes = computeHospitalAccountCodes(ALL_CODES)
  const codeSet = new Set(codes)

  it('派生 perm 全部跟随:含 crm:dispatches:list', () => {
    expect(codeSet.has('crm:dispatches:list')).toBe(true)
  })

  it('派生 perm 全部跟随:含 crm:dispatches:reply', () => {
    expect(codeSet.has('crm:dispatches:reply')).toBe(true)
  })

  it('派生 perm 全部跟随:含 crm:dispatches:log (历史漏配,本次修复回归点)', () => {
    expect(codeSet.has('crm:dispatches:log')).toBe(true)
  })

  it('派生 perm 全部跟随:含 crm:dispatches:view-mobile', () => {
    expect(codeSet.has('crm:dispatches:view-mobile')).toBe(true)
  })

  it('医院看板 perm:含 crm:hospital-dashboard:view', () => {
    expect(codeSet.has('crm:hospital-dashboard:view')).toBe(true)
  })

  it('医院看板未来新增 perm 也会自动跟随(前缀匹配)', () => {
    expect(codeSet.has('crm:hospital-dashboard:future')).toBe(true)
  })

  it('派单未来新增 perm 也会自动跟随(前缀匹配 + 黑名单外)', () => {
    expect(codeSet.has('crm:dispatches:future-perm')).toBe(true)
  })

  it('不允许编辑派单:crm:dispatches:update 一律不在', () => {
    expect(codeSet.has('crm:dispatches:update')).toBe(false)
  })

  it('不允许删除派单:crm:dispatches:delete 一律不在', () => {
    expect(codeSet.has('crm:dispatches:delete')).toBe(false)
  })

  it('不允许看手机号查看审计日志:crm:dispatches:view-mobile-logs 一律不在', () => {
    expect(codeSet.has('crm:dispatches:view-mobile-logs')).toBe(false)
  })

  it('不允许看医院查看日志:crm:dispatches:view-hospital-log 一律不在', () => {
    expect(codeSet.has('crm:dispatches:view-hospital-log')).toBe(false)
  })

  it('不允许管医院账号:crm:hospitals:manage-account 一律不在', () => {
    expect(codeSet.has('crm:hospitals:manage-account')).toBe(false)
  })

  it('不允许新建/删除/改名医院:crm:hospitals:create/delete/rename 一律不在 (显式白名单)', () => {
    expect(codeSet.has('crm:hospitals:create')).toBe(false)
    expect(codeSet.has('crm:hospitals:delete')).toBe(false)
    expect(codeSet.has('crm:hospitals:rename')).toBe(false)
  })

  it('允许编辑自己医院资料:crm:hospitals:update 在', () => {
    expect(codeSet.has('crm:hospitals:update')).toBe(true)
  })

  it('不允许访问客户/会员业务:customer_service 范围 perm 一律不在', () => {
    for (const c of [
      'crm:customers:list',
      'crm:customers:create',
      'crm:customers:update',
      'crm:customers:delete',
      'crm:customers:dispatch',
      'crm:members:list',
      'crm:members:create',
      'crm:members:update',
      'crm:members:delete',
      'crm:members:remark',
      'crm:members:follow_up',
      'crm:members:assign',
      'crm:members:tag',
      'crm:members:invalidate',
      'crm:members:restore',
      'crm:members:export',
    ]) {
      expect(codeSet.has(c)).toBe(false)
    }
  })

  it('不允许看总后台数据看板:crm:dashboard:view 一律不在', () => {
    expect(codeSet.has('crm:dashboard:view')).toBe(false)
  })

  it('不允许访问 system 下拉:system:user:list / system:role:list 一律不在', () => {
    expect(codeSet.has('system:user:list')).toBe(false)
    expect(codeSet.has('system:role:list')).toBe(false)
  })

  it('region 一族只给 tree + path,不给 list/read', () => {
    expect(codeSet.has('region:tree')).toBe(true)
    expect(codeSet.has('region:path')).toBe(true)
    expect(codeSet.has('region:list')).toBe(false)
    expect(codeSet.has('region:read')).toBe(false)
  })

  it('黑名单集合覆盖所有危险 perm', () => {
    expect(HOSPITAL_ACCOUNT_DISPATCH_DENY.has('crm:dispatches:update')).toBe(true)
    expect(HOSPITAL_ACCOUNT_DISPATCH_DENY.has('crm:dispatches:delete')).toBe(true)
    expect(HOSPITAL_ACCOUNT_DISPATCH_DENY.has('crm:dispatches:view-mobile-logs')).toBe(true)
    expect(HOSPITAL_ACCOUNT_DISPATCH_DENY.has('crm:dispatches:view-hospital-log')).toBe(true)
  })

  it('输出结果保留输入顺序(去重由调用方 replaceRolePermissions 用 Set 承担)', () => {
    // computeHospitalAccountCodes 是纯过滤函数,不去重;
    // sys_role_permission 表里的去重由 bindRolePermissionsByDefault 内的
    // `[...new Set(permissionCodes)]` 负责。这里只验证白名单过滤 + 黑名单过滤行为。
    const withDup = [
      'crm:dispatches:list',
      'crm:dispatches:list',           // 重复
      'crm:hospitals:list',
      'crm:hospital-dashboard:view',
      'region:tree',
      'crm:dispatches:delete',          // 黑名单应过滤
      'crm:hospitals:create',           // 显式白名单应过滤
    ]
    const result = computeHospitalAccountCodes(withDup)
    expect(result).toEqual([
      'crm:dispatches:list',
      'crm:dispatches:list',
      'crm:hospitals:list',
      'crm:hospital-dashboard:view',
      'region:tree',
    ])
  })

  it('空输入 → 空输出', () => {
    expect(computeHospitalAccountCodes([])).toEqual([])
  })

  it('与 CRM 路由层 requirePermission 一致:派单主路径 perm 全部覆盖', () => {
    // 派单模块 route 注册的 perm 应当全部落在医院账号白名单里,
    // 否则 hospital_account 进 /crm/dispatches 会 403。
    // 路由层声明见 apps/yishan-api/src/modules/crm/routes/v1/dispatches/index.ts。
    const routePerms = [
      'crm:dispatches:list',          // GET statuses / list / detail / export
      'crm:dispatches:reply',         // POST /dispatches/:id/reply
      'crm:dispatches:log',           // POST /dispatches/:id/logs
      'crm:dispatches:view-mobile',   // POST /dispatches/:id/view-mobile
    ]
    for (const perm of routePerms) {
      expect(codeSet.has(perm)).toBe(true)
    }
  })

  it('与医院看板 route 一致:HOSPITAL_DASHBOARD_VIEW / DISPATCH_LIST 覆盖', () => {
    // 路由层见 apps/yishan-api/src/modules/crm/routes/v1/hospital-dashboard/index.ts:
    //   /hospital/dashboard/stats  → HOSPITAL_DASHBOARD_VIEW
    //   /hospital/dispatches/unviewed-count → DISPATCH_LIST  (菜单 Badge)
    //   /hospital/dashboard/trend  → HOSPITAL_DASHBOARD_VIEW
    expect(codeSet.has('crm:hospital-dashboard:view')).toBe(true)
    expect(codeSet.has('crm:dispatches:list')).toBe(true)
  })
})
