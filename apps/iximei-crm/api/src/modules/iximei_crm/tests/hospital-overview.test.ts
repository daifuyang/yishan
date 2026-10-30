import Fastify from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthErrorCode } from '@yishan/core-api/business-codes/auth'
import { ROLE_IDS } from '@/modules/iximei_crm/role-codes'
import { currentCrmDataScope } from '@/modules/iximei_crm/access-scope'
import { DashboardRepository } from '../repositories/dashboard.repository.js'
import { DashboardService } from '../services/dashboard.service.js'
import dashboardRoutes from '../routes/v1/dashboard/index.js'

/**
 * 路由层的 scope 现在来自 `currentCrmDataScope()`（读 system 的 data-scope 上下文
 * 再查 sys_role），不再是旧基座写在 `currentUser.dataScope` 上的缓存值。
 *
 * 本文件测的是「路由是否把 scope 正确传给 service」，所以只替换 scope 的取值来源，
 * 保留 DATA_SCOPE 常量与真实实现。`currentCrmDataScope` 自身的判定规则见
 * access-scope 的独立用例。
 */
vi.mock('@/modules/iximei_crm/access-scope', async importOriginal => {
  const actual = await importOriginal<typeof import('@/modules/iximei_crm/access-scope')>()
  return { ...actual, currentCrmDataScope: vi.fn(async () => actual.DATA_SCOPE.ALL) }
})

function result(rows: unknown[]) {
  return [rows, []]
}

function dumpSql(node: any, seen = new WeakSet()): string {
  if (node == null) return ''
  if (typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean') return String(node)
  if (node instanceof Date) return node.toISOString()
  if (typeof node !== 'object' || seen.has(node)) return ''
  seen.add(node)
  if (Array.isArray(node.value) && node.value.every((value: unknown) => typeof value === 'string')) {
    return node.value.join('')
  }
  if (Array.isArray(node.queryChunks)) return node.queryChunks.map((chunk: any) => dumpSql(chunk, seen)).join('')
  if (node.constructor?.name === 'Param' || node.constructor?.name === 'Placeholder') {
    return dumpSql(node.value, seen)
  }
  if (node.sql) return dumpSql(node.sql, seen)
  return ''
}

describe('DashboardRepository.getHospitalOverview', () => {
  it('normalizes oral, plastic, and unknown groups with numeric zero-rate metrics', async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce(result([{
        total: '4', oral_count: '2', plastic_count: '1', unknown_count: '1', period_new: '2',
      }]))
      .mockResolvedValueOnce(result([
        { category: 'oral', hospital_count: '2' },
        { category: 'plastic', hospital_count: '1' },
        { category: 'other-value', hospital_count: '1' },
      ]))
      .mockResolvedValueOnce(result([
        { province_code: 11, province_name: 'Beijing', hospital_count: '4' },
      ]))
      .mockResolvedValueOnce(result([
        { province_code: 11, province_name: 'Beijing', city_code: 1101, city_name: 'Beijing', hospital_count: '4' },
      ]))
      .mockResolvedValueOnce(result([
        { category: 'oral', dispatch_count: '2', arrived_count: '1', deal_count: '1' },
        { category: 'plastic', dispatch_count: '0', arrived_count: '0', deal_count: '0' },
        { category: null, dispatch_count: '1', arrived_count: '0', deal_count: '0' },
      ]))

    const overview = await (DashboardRepository as any).getHospitalOverview({
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-01-31T00:00:00.000Z'),
      provinceCode: 11,
      cityCode: 1101,
      status: 1,
    }, { execute })

    expect(overview.summary).toEqual({
      total: 4,
      oral: 2,
      plastic: 1,
      unknown: 1,
      periodNew: 2,
    })
    expect(overview.byCategory).toEqual([
      { category: 'oral', hospitalCount: 2 },
      { category: 'plastic', hospitalCount: 1 },
      { category: 'unknown', hospitalCount: 1 },
    ])
    expect(overview.businessByCategory).toEqual([
      { category: 'oral', dispatchCount: 2, arrivedCount: 1, dealCount: 1, arrivedRate: 50, dealRate: 50 },
      { category: 'plastic', dispatchCount: 0, arrivedCount: 0, dealCount: 0, arrivedRate: 0, dealRate: 0 },
      { category: 'unknown', dispatchCount: 1, arrivedCount: 0, dealCount: 0, arrivedRate: 0, dealRate: 0 },
    ])
    expect(overview.byProvince).toEqual([
      { provinceCode: 11, provinceName: 'Beijing', hospitalCount: 4 },
    ])
    expect(overview.byCity).toEqual([
      { provinceCode: 11, provinceName: 'Beijing', cityCode: 1101, cityName: 'Beijing', hospitalCount: 4 },
    ])
    expect(overview.byCategory.reduce((total: number, row: any) => total + row.hospitalCount, 0)).toBe(overview.summary.total)
    expect(overview.byProvince.reduce((total: number, row: any) => total + row.hospitalCount, 0)).toBe(overview.summary.total)
    expect(overview.byCity.reduce((total: number, row: any) => total + row.hospitalCount, 0)).toBe(overview.summary.total)
    expect(execute).toHaveBeenCalledTimes(5)
  })

  it('binds soft-delete, date, category, region, and status filters to every aggregate query', async () => {
    const execute = vi.fn().mockResolvedValue(result([]))
    await (DashboardRepository as any).getHospitalOverview({
      startDate: new Date('2025-12-31T16:00:00.000Z'),
      endDate: new Date('2026-01-30T16:00:00.000Z'),
      category: 'unknown',
      provinceCode: 11,
      cityCode: 1101,
      status: 1,
    }, { execute })

    const statements = execute.mock.calls.map(([query]: any[]) => dumpSql(query))
    expect(execute).toHaveBeenCalledTimes(5)
    for (const statement of statements) {
      expect(statement).toContain('h.deleted_at IS NULL')
      expect(statement).toContain('h.category')
      expect(statement).toContain('unknown')
      expect(statement).toContain('h.province_id')
      expect(statement).toContain('11')
      expect(statement).toContain('h.city_id')
      expect(statement).toContain('1101')
      expect(statement).toContain('h.status')
    }
    expect(statements[0]).toContain('h.created_at')
    expect(statements[0]).toContain('2025-12-31T16:00:00.000Z')
    expect(statements[0]).toContain('2026-01-31T16:00:00.000Z')
    expect(statements[4]).toContain('d.deleted_at IS NULL')
    expect(statements[4]).toContain('d.created_at')
    expect(statements[4]).toContain('2025-12-31T16:00:00.000Z')
    expect(statements[4]).toContain('2026-01-31T16:00:00.000Z')
  })

  it('reconciles aggregate and detail totals from the generated SQL predicates', async () => {
    const filters = {
      startDate: new Date('2025-12-31T16:00:00.000Z'),
      endDate: new Date('2026-01-30T16:00:00.000Z'),
      category: 'oral' as const,
      provinceCode: 11,
      cityCode: 1101,
      status: 1,
    }
    const hospitals = [
      { id: 1, category: 'oral', provinceCode: 11, provinceName: 'Beijing', cityCode: 1101, cityName: 'Beijing', status: 1, createdAt: '2026-01-03T00:00:00.000Z', deletedAt: null },
      { id: 2, category: 'oral', provinceCode: 11, provinceName: 'Beijing', cityCode: 1101, cityName: 'Beijing', status: 1, createdAt: '2026-01-20T00:00:00.000Z', deletedAt: null },
      { id: 3, category: 'oral', provinceCode: 11, provinceName: 'Beijing', cityCode: 1101, cityName: 'Beijing', status: 1, createdAt: '2026-01-09T00:00:00.000Z', deletedAt: '2026-01-10T00:00:00.000Z' },
      { id: 4, category: 'plastic', provinceCode: 11, provinceName: 'Beijing', cityCode: 1101, cityName: 'Beijing', status: 1, createdAt: '2026-01-11T00:00:00.000Z', deletedAt: null },
      { id: 5, category: 'oral', provinceCode: 11, provinceName: 'Beijing', cityCode: 1101, cityName: 'Beijing', status: 0, createdAt: '2026-01-12T00:00:00.000Z', deletedAt: null },
      { id: 6, category: 'oral', provinceCode: 31, provinceName: 'Shanghai', cityCode: 3101, cityName: 'Shanghai', status: 1, createdAt: '2026-01-13T00:00:00.000Z', deletedAt: null },
      { id: 7, category: 'oral', provinceCode: 11, provinceName: 'Beijing', cityCode: 1102, cityName: 'Xicheng', status: 1, createdAt: '2026-01-14T00:00:00.000Z', deletedAt: null },
      { id: 8, category: 'oral', provinceCode: 11, provinceName: 'Beijing', cityCode: 1101, cityName: 'Beijing', status: 1, createdAt: '2026-02-01T00:00:00.000Z', deletedAt: null },
    ]
    const dispatches = [
      { id: 1, hospitalId: 1, status: 3, createdAt: '2026-01-10T00:00:00.000Z', deletedAt: null },
      { id: 2, hospitalId: 1, status: 4, createdAt: '2026-02-02T00:00:00.000Z', deletedAt: null },
      { id: 3, hospitalId: 1, status: 4, createdAt: '2026-01-15T00:00:00.000Z', deletedAt: '2026-01-16T00:00:00.000Z' },
      { id: 4, hospitalId: 2, status: 3, createdAt: '2025-12-20T00:00:00.000Z', deletedAt: null },
      { id: 5, hospitalId: 2, status: 4, createdAt: '2026-01-20T00:00:00.000Z', deletedAt: null },
      // Every hospital excluded by one overview predicate has a unique metric tuple.
      { id: 6, hospitalId: 3, status: 3, createdAt: '2026-01-11T00:00:00.000Z', deletedAt: null },
      { id: 7, hospitalId: 4, status: 4, createdAt: '2026-01-12T00:00:00.000Z', deletedAt: null },
      { id: 8, hospitalId: 4, status: 4, createdAt: '2026-01-13T00:00:00.000Z', deletedAt: null },
      { id: 9, hospitalId: 5, status: 3, createdAt: '2026-01-14T00:00:00.000Z', deletedAt: null },
      { id: 10, hospitalId: 5, status: 4, createdAt: '2026-01-15T00:00:00.000Z', deletedAt: null },
      { id: 11, hospitalId: 5, status: 4, createdAt: '2026-01-16T00:00:00.000Z', deletedAt: null },
      { id: 12, hospitalId: 6, status: 3, createdAt: '2026-01-17T00:00:00.000Z', deletedAt: null },
      { id: 13, hospitalId: 6, status: 3, createdAt: '2026-01-18T00:00:00.000Z', deletedAt: null },
      { id: 14, hospitalId: 6, status: 4, createdAt: '2026-01-19T00:00:00.000Z', deletedAt: null },
      { id: 15, hospitalId: 6, status: 4, createdAt: '2026-01-20T00:00:00.000Z', deletedAt: null },
      { id: 16, hospitalId: 7, status: 3, createdAt: '2026-01-21T00:00:00.000Z', deletedAt: null },
      { id: 17, hospitalId: 7, status: 3, createdAt: '2026-01-22T00:00:00.000Z', deletedAt: null },
      { id: 18, hospitalId: 7, status: 3, createdAt: '2026-01-23T00:00:00.000Z', deletedAt: null },
      { id: 19, hospitalId: 7, status: 4, createdAt: '2026-01-24T00:00:00.000Z', deletedAt: null },
      { id: 20, hospitalId: 7, status: 4, createdAt: '2026-01-25T00:00:00.000Z', deletedAt: null },
      { id: 21, hospitalId: 8, status: 3, createdAt: '2026-01-23T00:00:00.000Z', deletedAt: null },
      { id: 22, hospitalId: 8, status: 3, createdAt: '2026-01-24T00:00:00.000Z', deletedAt: null },
      { id: 23, hospitalId: 8, status: 3, createdAt: '2026-01-25T00:00:00.000Z', deletedAt: null },
      { id: 24, hospitalId: 8, status: 4, createdAt: '2026-01-26T00:00:00.000Z', deletedAt: null },
      { id: 25, hospitalId: 8, status: 4, createdAt: '2026-01-27T00:00:00.000Z', deletedAt: null },
      { id: 26, hospitalId: 8, status: 4, createdAt: '2026-01-28T00:00:00.000Z', deletedAt: null },
    ]
    const predicateNumber = (statement: string, column: string) => Number(
      statement.match(new RegExp(`${column.replace('.', '\\.')} = (-?\\d+)`))?.[1],
    )
    const dateRange = (statement: string, column: string) => {
      const escapedColumn = column.replace('.', '\\.')
      const isoDate = '\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z'
      const match = statement.match(new RegExp(`${escapedColumn} >= (${isoDate}).*?${escapedColumn} < (${isoDate})`))
      return match ? [new Date(match[1]), new Date(match[2])] : undefined
    }
    const categoryFor = (hospital: (typeof hospitals)[number]) => (
      hospital.category === 'oral' || hospital.category === 'plastic' ? hospital.category : 'unknown'
    )
    const matchingHospitals = (statement: string, includeCreatedDate = false) => {
      const category = statement.match(/END = '?(oral|plastic|unknown)'?/)?.[1]
      const createdRange = dateRange(includeCreatedDate ? statement : statement.slice(statement.lastIndexOf('WHERE')), 'h.created_at')
      return hospitals.filter((hospital) => (
        (!statement.includes('h.deleted_at IS NULL') || hospital.deletedAt == null)
        && (!category || categoryFor(hospital) === category)
        && (!statement.includes('h.province_id =') || hospital.provinceCode === predicateNumber(statement, 'h.province_id'))
        && (!statement.includes('h.city_id =') || hospital.cityCode === predicateNumber(statement, 'h.city_id'))
        && (!statement.includes('h.status =') || hospital.status === predicateNumber(statement, 'h.status'))
        && (!createdRange || (new Date(hospital.createdAt) >= createdRange[0] && new Date(hospital.createdAt) < createdRange[1]))
      ))
    }
    const matchingDispatches = (statement: string, hospitalId: number) => {
      const range = dateRange(statement, 'd.created_at')
      return dispatches.filter((dispatch) => (
        dispatch.hospitalId === hospitalId
        && (!statement.includes('d.deleted_at IS NULL') || dispatch.deletedAt == null)
        && (!range || (new Date(dispatch.createdAt) >= range[0] && new Date(dispatch.createdAt) < range[1]))
      ))
    }
    const isDetailRowsQuery = (statement: string) => (
      /FROM crm_hospital h[\s\S]*GROUP BY h\.id\b/.test(statement)
      && statement.includes('COUNT(d.id) AS dispatch_count')
    )
    const execute = vi.fn(async (query: unknown) => {
      const statement = dumpSql(query)
      const matchedHospitals = matchingHospitals(statement)
      const countBy = (key: 'category' | 'provinceCode' | 'cityCode') => Array.from(
        matchedHospitals.reduce((groups, hospital) => {
          const value = String(hospital[key])
          groups.set(value, (groups.get(value) ?? 0) + 1)
          return groups
        }, new Map<string, number>()),
      )

      if (statement.includes('AS period_new')) {
        const periodNew = matchingHospitals(statement, true).length
        return result([{
          total: String(matchedHospitals.length),
          oral_count: String(matchedHospitals.filter((hospital) => categoryFor(hospital) === 'oral').length),
          plastic_count: String(matchedHospitals.filter((hospital) => categoryFor(hospital) === 'plastic').length),
          unknown_count: String(matchedHospitals.filter((hospital) => categoryFor(hospital) === 'unknown').length),
          period_new: String(periodNew),
        }])
      }
      if (isDetailRowsQuery(statement)) {
        return result(matchedHospitals
          .slice()
          .sort((left, right) => right.id - left.id)
          .map((hospital) => {
            const rows = matchingDispatches(statement, hospital.id)
            return {
              id: hospital.id,
              hospital_name: `Hospital ${hospital.id}`,
              category: categoryFor(hospital),
              province_name: hospital.provinceName,
              city_name: hospital.cityName,
              status: hospital.status,
              dispatch_count: rows.length,
              arrived_count: rows.filter((dispatch) => dispatch.status === 3).length,
              deal_count: rows.filter((dispatch) => dispatch.status === 4).length,
              latest_dispatch_at: rows.at(-1)?.createdAt ?? null,
            }
          }))
      }
      if (statement.includes('SELECT COUNT(*) AS total FROM crm_hospital h')) {
        return result([{ total: String(matchedHospitals.length) }])
      }
      if (statement.includes('GROUP BY h.province_id, province.name, h.city_id, city.name')) {
        return result(countBy('cityCode').map(([cityCode, hospitalCount]) => {
          const hospital = matchedHospitals.find((row) => String(row.cityCode) === cityCode)!
          return { province_code: hospital.provinceCode, province_name: hospital.provinceName, city_code: cityCode, city_name: hospital.cityName, hospital_count: hospitalCount }
        }))
      }
      if (statement.includes('GROUP BY h.province_id, province.name')) {
        return result(countBy('provinceCode').map(([provinceCode, hospitalCount]) => {
          const hospital = matchedHospitals.find((row) => String(row.provinceCode) === provinceCode)!
          return { province_code: provinceCode, province_name: hospital.provinceName, hospital_count: hospitalCount }
        }))
      }
      if (statement.includes('COUNT(d.id) AS dispatch_count')) {
        return result(Array.from(new Set(matchedHospitals.map(categoryFor))).map((category) => {
          const rows = matchedHospitals
            .filter((hospital) => categoryFor(hospital) === category)
            .flatMap((hospital) => matchingDispatches(statement, hospital.id))
          return {
            category,
            dispatch_count: rows.length,
            arrived_count: rows.filter((dispatch) => dispatch.status === 3).length,
            deal_count: rows.filter((dispatch) => dispatch.status === 4).length,
          }
        }))
      }
      if (statement.includes('AS hospital_count')) {
        return result(countBy('category').map(([category, hospitalCount]) => ({ category, hospital_count: hospitalCount })))
      }
      throw new Error(`Unexpected overview query: ${statement}`)
    })

    const overview = await (DashboardRepository as any).getHospitalOverview(filters, { execute })
    const details = await (DashboardRepository as any).getHospitalOverviewDetails({ ...filters, page: 1, pageSize: 10 }, { execute })

    expect(overview.summary).toEqual({ total: 3, oral: 3, plastic: 0, unknown: 0, periodNew: 2 })
    expect(overview.byCategory).toEqual([
      { category: 'oral', hospitalCount: 3 },
      { category: 'plastic', hospitalCount: 0 },
      { category: 'unknown', hospitalCount: 0 },
    ])
    expect(overview.byProvince).toEqual([{ provinceCode: 11, provinceName: 'Beijing', hospitalCount: 3 }])
    expect(overview.byCity).toEqual([{
      provinceCode: 11, provinceName: 'Beijing', cityCode: 1101, cityName: 'Beijing', hospitalCount: 3,
    }])
    expect(overview.businessByCategory).toEqual([
      { category: 'oral', dispatchCount: 8, arrivedCount: 4, dealCount: 4, arrivedRate: 50, dealRate: 50 },
      { category: 'plastic', dispatchCount: 0, arrivedCount: 0, dealCount: 0, arrivedRate: 0, dealRate: 0 },
      { category: 'unknown', dispatchCount: 0, arrivedCount: 0, dealCount: 0, arrivedRate: 0, dealRate: 0 },
    ])
    expect(details).toEqual({
      total: 3,
      list: [
        {
          id: 8, hospitalName: 'Hospital 8', category: 'oral', provinceName: 'Beijing', cityName: 'Beijing', status: 1,
          dispatchCount: 6, arrivedCount: 3, dealCount: 3, latestDispatchAt: '2026-01-28T00:00:00.000Z',
        },
        {
          id: 2, hospitalName: 'Hospital 2', category: 'oral', provinceName: 'Beijing', cityName: 'Beijing', status: 1,
          dispatchCount: 1, arrivedCount: 0, dealCount: 1, latestDispatchAt: '2026-01-20T00:00:00.000Z',
        },
        {
          id: 1, hospitalName: 'Hospital 1', category: 'oral', provinceName: 'Beijing', cityName: 'Beijing', status: 1,
          dispatchCount: 1, arrivedCount: 1, dealCount: 0, latestDispatchAt: '2026-01-10T00:00:00.000Z',
        },
      ],
    })
    const newFilters = { ...filters, hospitalScope: 'period-new' as const }
    const newOverview = await DashboardRepository.getHospitalOverview(newFilters, { execute })
    const newDetails = await DashboardRepository.getHospitalOverviewDetails({ ...newFilters, page: 1, pageSize: 10 }, { execute })
    expect(newOverview.summary).toEqual({ total: 2, oral: 2, plastic: 0, unknown: 0, periodNew: 2 })
    expect(newOverview.byCategory[0].hospitalCount).toBe(2)
    expect(newOverview.byProvince[0].hospitalCount).toBe(2)
    expect(newOverview.byCity[0].hospitalCount).toBe(2)
    expect(newOverview.businessByCategory[0]).toMatchObject({ dispatchCount: 2, arrivedCount: 1, dealCount: 1 })
    expect(newDetails.total).toBe(2)
    expect(newDetails.list.map((row) => row.id)).toEqual([2, 1])
  })

  it('falls back to unknown when the deferred category column is unavailable', async () => {
    const unknownColumn = Object.assign(new Error('Unknown column category'), {
      cause: { code: 'ER_BAD_FIELD_ERROR' },
    })
    let calls = 0
    const execute = vi.fn(async () => {
      calls += 1
      if (calls <= 5) throw unknownColumn
      return result(calls === 6
        ? [{ total: '2', oral_count: '0', plastic_count: '0', unknown_count: '2', period_new: '1' }]
        : [])
    })

    const overview = await (DashboardRepository as any).getHospitalOverview({
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-01-31T00:00:00.000Z'),
    }, { execute })

    expect(overview.summary).toEqual({ total: 2, oral: 0, plastic: 0, unknown: 2, periodNew: 1 })
    expect(overview.byCategory).toEqual([
      { category: 'oral', hospitalCount: 0 },
      { category: 'plastic', hospitalCount: 0 },
      { category: 'unknown', hospitalCount: 0 },
    ])
    expect(execute).toHaveBeenCalledTimes(10)
  })
})

describe('DashboardRepository.getHospitalOverviewDetails', () => {
  it('applies creation dates and missing-region predicates to every aggregate and detail query', async () => {
    const execute = vi.fn(async () => result([]))
    const filters = { hospitalScope: 'period-new', provinceCode: 'missing', cityCode: 'missing', category: 'oral',
      startDate: new Date('2025-12-31T16:00:00.000Z'), endDate: new Date('2026-01-30T16:00:00.000Z') }
    await (DashboardRepository as any).getHospitalOverview(filters, { execute })
    await (DashboardRepository as any).getHospitalOverviewDetails({ ...filters, page: 1, pageSize: 10 }, { execute })
    const statements = execute.mock.calls.map(([query]: any[]) => dumpSql(query))
    expect(statements).toHaveLength(7)
    for (const statement of statements) {
      expect(statement).toContain('h.province_id IS NULL')
      expect(statement).toContain('h.city_id IS NULL')
      expect(statement).toContain('h.created_at >= 2025-12-31T16:00:00.000Z')
      expect(statement).toContain('h.created_at < 2026-01-31T16:00:00.000Z')
    }
  })

  it('returns named missing-region buckets instead of zero codes', async () => {
    const execute = vi.fn().mockResolvedValueOnce(result([])).mockResolvedValueOnce(result([]))
      .mockResolvedValueOnce(result([{ province_code: null, province_name: '', hospital_count: 1 }]))
      .mockResolvedValueOnce(result([{ province_code: 11, province_name: 'Beijing', city_code: null, city_name: '', hospital_count: 1 }]))
      .mockResolvedValueOnce(result([]))
    const data = await DashboardRepository.getHospitalOverview({}, { execute })
    expect(data.byProvince[0]).toMatchObject({ provinceCode: 'missing', provinceName: '未填写省份' })
    expect(data.byCity[0]).toMatchObject({ cityCode: 'missing', cityName: '未填写城市' })
  })
  it('uses the overview filters and returns per-hospital operating metrics', async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce(result([{
        id: 9,
        hospital_name: 'Union Hospital',
        category: 'oral',
        province_name: 'Beijing',
        city_name: 'Beijing',
        status: 1,
        dispatch_count: '3',
        arrived_count: '2',
        deal_count: '1',
        latest_dispatch_at: '2026-01-20T00:00:00.000Z',
      }]))
      .mockResolvedValueOnce(result([{ total: '1' }]))

    const details = await (DashboardRepository as any).getHospitalOverviewDetails({
      startDate: new Date('2025-12-31T16:00:00.000Z'),
      endDate: new Date('2026-01-30T16:00:00.000Z'),
      category: 'oral',
      provinceCode: 11,
      cityCode: 1101,
      status: 1,
      page: 1,
      pageSize: 10,
    }, { execute })

    expect(details).toEqual({
      list: [{
        id: 9,
        hospitalName: 'Union Hospital',
        category: 'oral',
        provinceName: 'Beijing',
        cityName: 'Beijing',
        status: 1,
        dispatchCount: 3,
        arrivedCount: 2,
        dealCount: 1,
        latestDispatchAt: '2026-01-20T00:00:00.000Z',
      }],
      total: 1,
    })

    const statements = execute.mock.calls.map(([query]: any[]) => dumpSql(query))
    expect(statements[0]).toContain('h.deleted_at IS NULL')
    expect(statements[0]).toContain('h.category')
    expect(statements[0]).toContain('h.province_id')
    expect(statements[0]).toContain('h.city_id')
    expect(statements[0]).toContain('h.status')
    expect(statements[0]).toContain('d.created_at')
    expect(statements[0]).toContain('2025-12-31T16:00:00.000Z')
    expect(statements[0]).toContain('2026-01-31T16:00:00.000Z')
  })
})

describe('DashboardService.getHospitalOverview', () => {
  it('passes inclusive Shanghai date boundaries to the repository', async () => {
    const overview = {
      summary: { total: 0, oral: 0, plastic: 0, unknown: 0, periodNew: 0 },
      byCategory: [], byProvince: [], byCity: [], businessByCategory: [],
    }
    const spy = vi.spyOn(DashboardRepository as any, 'getHospitalOverview').mockResolvedValue(overview)

    const response = await (DashboardService as any).getHospitalOverview(
      1,
      [ROLE_IDS.SUPER_ADMIN],
      1,
      { startDate: '2026-01-01', endDate: '2026-01-31' },
    )

    expect(response.summary.total).toBe(0)
    expect(response.filters).toEqual({ startDate: '2026-01-01', endDate: '2026-01-31' })
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({
      startDate: new Date('2025-12-31T16:00:00.000Z'),
      endDate: new Date('2026-01-30T16:00:00.000Z'),
    }))
  })

  it('rejects hospital accounts before querying the aggregate', async () => {
    const spy = vi.spyOn(DashboardRepository as any, 'getHospitalOverview')

    await expect((DashboardService as any).getHospitalOverview(
      3,
      [ROLE_IDS.HOSPITAL_ACCOUNT],
      1,
      {},
    )).rejects.toMatchObject({ code: AuthErrorCode.FORBIDDEN })

    expect(spy).not.toHaveBeenCalled()
  })

  it('allows a regular backend role with the all-data scope', async () => {
    const overview = {
      summary: { total: 0, oral: 0, plastic: 0, unknown: 0, periodNew: 0 },
      byCategory: [], byProvince: [], byCity: [], businessByCategory: [],
    }
    const spy = vi.spyOn(DashboardRepository as any, 'getHospitalOverview').mockResolvedValue(overview)

    await expect((DashboardService as any).getHospitalOverview(
      2,
      [ROLE_IDS.CUSTOMER_SERVICE],
      1,
      {},
    )).resolves.toMatchObject({ summary: { total: 0 } })

    expect(spy).toHaveBeenCalledOnce()
  })

  it('lets super admins access the overview even when they also have the hospital role', async () => {
    const overview = {
      summary: { total: 0, oral: 0, plastic: 0, unknown: 0, periodNew: 0 },
      byCategory: [], byProvince: [], byCity: [], businessByCategory: [],
    }
    const spy = vi.spyOn(DashboardRepository as any, 'getHospitalOverview').mockResolvedValue(overview)

    await expect((DashboardService as any).getHospitalOverview(
      1,
      [ROLE_IDS.HOSPITAL_ACCOUNT, ROLE_IDS.SUPER_ADMIN],
      5,
      {},
    )).resolves.toMatchObject({ summary: { total: 0 } })

    expect(spy).toHaveBeenCalledOnce()
  })

  it('rejects restricted data scopes until a hospital scope mapping exists', async () => {
    const spy = vi.spyOn(DashboardRepository as any, 'getHospitalOverview')

    await expect((DashboardService as any).getHospitalOverview(
      4,
      [ROLE_IDS.CUSTOMER_SERVICE],
      5,
      {},
    )).rejects.toMatchObject({ code: AuthErrorCode.FORBIDDEN })

    expect(spy).not.toHaveBeenCalled()
  })
})

describe('hospital overview route', () => {
  afterEach(() => vi.restoreAllMocks())

  it.each([['hospital-overview', 'getHospitalOverview'], ['hospital-overview/details', 'getHospitalOverviewDetails']])(
    'accepts and forwards missing regions and creation scope for %s', async (path, method) => {
      const service = vi.spyOn(DashboardService as any, method).mockResolvedValue({
        generatedAt: '2026-01-31T00:00:00.000Z', filters: { provinceCode: 'missing', cityCode: 'missing', hospitalScope: 'period-new' },
        summary: { total: 0, oral: 0, plastic: 0, unknown: 0, periodNew: 0 },
        byCategory: [], byProvince: [], byCity: [], businessByCategory: [], list: [], total: 0,
      })
      const app = Fastify()
      app.decorate('authenticate', async (request: any) => { request.currentUser = { id: 1, roleIds: [1], dataScope: 1 } })
      app.decorate('requirePermission', () => async () => {})
      await app.register(dashboardRoutes, { prefix: '/api/iximei-crm/v1' })
      const response = await app.inject({ method: 'GET', url: `/api/iximei-crm/v1/dashboard/${path}?provinceCode=missing&cityCode=missing&hospitalScope=period-new` })
      expect(response.statusCode).toBe(200)
      expect(service).toHaveBeenCalledWith(1, [1], 1, expect.objectContaining({ provinceCode: 'missing', cityCode: 'missing', hospitalScope: 'period-new' }))
      if (path === 'hospital-overview') expect(response.json().data.filters.hospitalScope).toBe('period-new')
      await app.close()
    },
  )

  it.each([[1, [1], true], [5, [4], false], [1, [4], true], [1, [3], false]])(
    'advertises overview capability for scope %s and roles %s', async (dataScope, roleIds, allowed) => {
      vi.mocked(currentCrmDataScope).mockResolvedValue(dataScope as any)
      const app = Fastify()
      app.decorate('authenticate', async (request: any) => { request.currentUser = { id: 1, roleIds, dataScope } })
      app.decorate('requirePermission', () => async () => {})
      await app.register(dashboardRoutes, { prefix: '/api/iximei-crm/v1' })
      const response = await app.inject({ method: 'GET', url: '/api/iximei-crm/v1/dashboard/capabilities' })
      expect(response.statusCode).toBe(200)
      expect(response.json().data.hospitalOverview).toBe(allowed)
      await app.close()
    },
  )

  it('serves the aggregate contract with all supported filters', async () => {
    vi.spyOn(DashboardService as any, 'getHospitalOverview').mockResolvedValue({
      generatedAt: '2026-01-31T00:00:00.000Z',
      filters: {
        startDate: '2026-01-01', endDate: '2026-01-31', category: 'oral', provinceCode: 11, cityCode: 1101, status: 1,
      },
      summary: { total: 0, oral: 0, plastic: 0, unknown: 0, periodNew: 0 },
      byCategory: [], byProvince: [], byCity: [], businessByCategory: [],
    })
    const app = Fastify()
    app.decorate('authenticate', async (request: any) => {
      request.currentUser = { id: 1, roleIds: [ROLE_IDS.SUPER_ADMIN], dataScope: 1 }
    })
    app.decorate('requirePermission', () => async () => {})
    await app.register(dashboardRoutes, { prefix: '/api/iximei-crm/v1' })

    const response = await app.inject({
      method: 'GET',
      url: '/api/iximei-crm/v1/dashboard/hospital-overview?startDate=2026-01-01&endDate=2026-01-31&category=oral&provinceCode=11&cityCode=1101&status=1',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().data).toMatchObject({
      generatedAt: '2026-01-31T00:00:00.000Z',
      filters: {
        startDate: '2026-01-01', endDate: '2026-01-31', category: 'oral', provinceCode: 11, cityCode: 1101, status: 1,
      },
      summary: { total: 0, oral: 0, plastic: 0, unknown: 0, periodNew: 0 },
      byCategory: [], byProvince: [], byCity: [], businessByCategory: [],
    })
    await app.close()
  })

  it('rejects impossible calendar dates with 400 before invoking the service', async () => {
    const service = vi.spyOn(DashboardService as any, 'getHospitalOverview')
    const app = Fastify()
    app.decorate('authenticate', async (request: any) => {
      request.currentUser = { id: 1, roleIds: [ROLE_IDS.SUPER_ADMIN], dataScope: 1 }
    })
    app.decorate('requirePermission', () => async () => {})
    await app.register(dashboardRoutes, { prefix: '/api/iximei-crm/v1' })

    const response = await app.inject({
      method: 'GET',
      url: '/api/iximei-crm/v1/dashboard/hospital-overview?startDate=2026-02-31&endDate=2026-03-01',
    })

    expect(response.statusCode).toBe(400)
    expect(service).not.toHaveBeenCalled()
    await app.close()
  })

  it('returns a paginated hospital detail response with the overview metric fields', async () => {
    vi.spyOn(DashboardService as any, 'getHospitalOverviewDetails').mockResolvedValue({
      list: [{
        id: 9,
        hospitalName: 'Union Hospital',
        category: 'oral',
        provinceName: 'Beijing',
        cityName: 'Beijing',
        status: 1,
        dispatchCount: 3,
        arrivedCount: 2,
        dealCount: 1,
        latestDispatchAt: '2026-01-20T00:00:00.000Z',
      }],
      total: 1,
    })
    const app = Fastify()
    app.decorate('authenticate', async (request: any) => {
      request.currentUser = { id: 1, roleIds: [ROLE_IDS.SUPER_ADMIN], dataScope: 1 }
    })
    app.decorate('requirePermission', () => async () => {})
    await app.register(dashboardRoutes, { prefix: '/api/iximei-crm/v1' })

    const response = await app.inject({
      method: 'GET',
      url: '/api/iximei-crm/v1/dashboard/hospital-overview/details?page=1&pageSize=10&category=oral',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      data: [{ dispatchCount: 3, arrivedCount: 2, dealCount: 1, latestDispatchAt: '2026-01-20T00:00:00.000Z' }],
      pagination: { page: 1, pageSize: 10, total: 1 },
    })
    await app.close()
  })

  it.each(['provinceCode=0', 'cityCode=0', 'status=2'])(
    'rejects invalid overview filter %s before invoking the service',
    async (query) => {
      const service = vi.spyOn(DashboardService as any, 'getHospitalOverview')
      const app = Fastify()
      app.decorate('authenticate', async (request: any) => {
        request.currentUser = { id: 1, roleIds: [ROLE_IDS.SUPER_ADMIN], dataScope: 1 }
      })
      app.decorate('requirePermission', () => async () => {})
      await app.register(dashboardRoutes, { prefix: '/api/iximei-crm/v1' })

      const response = await app.inject({
        method: 'GET',
        url: `/api/iximei-crm/v1/dashboard/hospital-overview?${query}`,
      })

      expect(response.statusCode).toBe(400)
      expect(service).not.toHaveBeenCalled()
      await app.close()
    },
  )
})
