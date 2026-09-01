import { describe, expect, it } from 'vitest'
import { computeDataScope } from '../schemas/data-scope.js'

describe('computeDataScope', () => {
  it('super_admin → ALL（ownerUserIds/ownerDepartmentIds 都 null）', () => {
    const scope = computeDataScope({ id: 1, roleCodes: ['super_admin'], deptIds: [10] })
    expect(scope.ownerUserIds).toBeNull()
    expect(scope.ownerDepartmentIds).toBeNull()
  })

  it('普通销售 → SELF（ownerUserIds=[me]，ownerDepartmentIds=null）', () => {
    const scope = computeDataScope({ id: 7, roleCodes: ['sales'], deptIds: [10] })
    expect(scope.ownerUserIds).toEqual([7])
    expect(scope.ownerDepartmentIds).toBeNull()
  })

  it('销售主管 → DEPARTMENT（ownerUserIds=[me]，ownerDepartmentIds=deptIds）', () => {
    const scope = computeDataScope({ id: 7, roleCodes: ['sales_lead'], deptIds: [10, 11] })
    expect(scope.ownerUserIds).toEqual([7])
    expect(scope.ownerDepartmentIds).toEqual([10, 11])
  })

  it('销售主管但 deptIds 为空 → 退化为 SELF', () => {
    const scope = computeDataScope({ id: 7, roleCodes: ['sales_lead'], deptIds: [] })
    expect(scope.ownerUserIds).toEqual([7])
    expect(scope.ownerDepartmentIds).toBeNull()
  })

  it('空 roleCodes → SELF', () => {
    const scope = computeDataScope({ id: 7, roleCodes: [], deptIds: [10] })
    expect(scope.ownerUserIds).toEqual([7])
    expect(scope.ownerDepartmentIds).toBeNull()
  })

  it('缺省 roleCodes / deptIds → SELF', () => {
    const scope = computeDataScope({ id: 7 })
    expect(scope.ownerUserIds).toEqual([7])
    expect(scope.ownerDepartmentIds).toBeNull()
  })

  it('super_admin 优先级最高（即使同时有 sales_lead）', () => {
    const scope = computeDataScope({
      id: 7,
      roleCodes: ['super_admin', 'sales_lead'],
      deptIds: [10, 11],
    })
    expect(scope.ownerUserIds).toBeNull()
    expect(scope.ownerDepartmentIds).toBeNull()
  })
})
