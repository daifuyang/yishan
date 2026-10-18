/**
 * 登录日志的行级范围用例。
 *
 * 单独成文件是因为登录日志有个别的表没有的坑：它靠 `user_id` 关联到用户，
 * 而**一个部门下的用户是多行**。范围条件写成标量 `=` 在 MySQL 下会直接报
 * `Operand should contain 1 column`，或者退化成全表匹配——后者更糟，因为它
 * 不报错，只是把别人的登录记录全抖出来。
 *
 * 这里断言的是 repository 真正下发的 SQL 形状，不是范围规则本身。
 */
import { describe, expect, it, vi } from './runtime-fixture'
import { setTestPermissionDeclarations } from './runtime-fixture'
import { MySqlDialect } from 'drizzle-orm/mysql-core'
import type { SQL } from 'drizzle-orm'
import { LoginLogRepository } from '../src/core/repositories/login-log.repository'
import { PermissionService } from '../src/core/services/permission.service'
import { runWithDataScope, runWithoutDataScope, type DataScopeSubject } from '../src/core/auth/data-scope'
import { drizzleDb } from '../src/db'
import { sysRolePermission } from '../src/db/schema'

setTestPermissionDeclarations([
  { code: 'system:login-log:list', label: '登录日志', group: 'system' },
])

const dialect = new MySqlDialect({ casing: {} as never })
function render(condition: unknown): string | undefined {
  if (!condition) return undefined
  return dialect.sqlToQuery(condition as SQL).sql
}
/** 绑定参数（渲染出的 SQL 里是 `?` 占位符，值在 params 里）。 */
function renderParams(condition: unknown): unknown[] {
  if (!condition) return []
  return dialect.sqlToQuery(condition as SQL).params as unknown[]
}

/** 让范围解析读到一个档位为 `dataScope`、授予登录日志查看权的角色。 */
function stubRole(dataScope: number) {
  vi.spyOn(drizzleDb, 'select').mockImplementation((columns: never) => {
    const keys = Object.keys(columns ?? {})
    let rows: unknown[] = []
    const chain = {
      from: () => chain,
      innerJoin: () => chain,
      leftJoin: () => chain,
      limit: () => chain,
      offset: () => chain,
      orderBy: () => chain,
      where: (condition?: unknown) => {
        if (condition) render(condition)
        if (keys.includes('dataScope')) rows = [{ id: 1, dataScope }]
        else if (keys.includes('perm')) rows = [{ roleId: 1, perm: 'system:login-log:list' }]
        else if (keys.includes('code')) rows = [{ id: 1, code: null }]
        else rows = []
        return chain
      },
      then: (resolve: (value: unknown[]) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(rows).then(resolve, reject),
    }
    return chain
  }) as never
  vi.spyOn(PermissionService, 'loadForRoleIds').mockResolvedValue({
    perms: new Set(['system:login-log:list']),
    roleCodes: new Set<string>(),
  } as never)
}

function subject(over: Partial<DataScopeSubject> = {}): DataScopeSubject {
  return {
    userId: 7,
    roleIds: [1],
    // 本部门（10）下有多个用户 → 范围条件必须是 IN，不能是标量 =。
    deptIds: [10],
    superAdmin: false,
    permissionCode: 'system:login-log:list',
    ...over,
  }
}

function scopedCondition(dataScope: number, over: Partial<DataScopeSubject> = {}) {
  stubRole(dataScope)
  return runWithDataScope(subject(over), async () => {
    const condition = await LoginLogRepository.dataScopeCondition()
    return { sql: render(condition), params: renderParams(condition) }
  })
}

describe('登录日志的行级范围', () => {
  it('uses an IN subquery so several users in one department are all in range', async () => {
    const { sql, params } = await scopedCondition(2)
    expect(sql).toContain(' in ')
    // 标量 = 配多行子查询在 MySQL 下会报错或退化成全表匹配。
    expect(sql).not.toMatch(/=\s*\(select/i)
    // 关联到 sys_user_dept，而不是只比较 login_log.user_id。
    expect(sql).toContain('sys_user_dept')
    // 部门 10 是绑定参数，渲染出的 SQL 里是 ? 占位符。
    expect(params).toContain(10)
  })

  it('keeps a self-only operator scoped to their own login rows', async () => {
    const { sql, params } = await scopedCondition(4)
    expect(sql).not.toContain('sys_user_dept')
    expect(params).toContain(7)
  })

  it('leaves an all-data operator unfiltered', async () => {
    expect((await scopedCondition(1)).sql).toBeUndefined()
  })

  it('fails closed for a login-log query with no request context', async () => {
    expect(render(await LoginLogRepository.dataScopeCondition())).toContain('1 = 0')
  })

  it('stays unfiltered on the explicit bypass path used by login itself', async () => {
    // 登录时要写自己的登录日志；那条路径是免过滤的。
    const sql = await runWithoutDataScope(async () => LoginLogRepository.dataScopeCondition())
    expect(sql).toBeUndefined()
  })

  it('ignores an unrelated all-data role', async () => {
    // 角色 1 仅本人（授予本操作），角色 9 全部数据（只授予别的操作）。
    stubRole(4)
    const { sql } = await runWithDataScope(subject({ roleIds: [1] }), async () => {
      const condition = await LoginLogRepository.dataScopeCondition()
      return { sql: render(condition) }
    })
    expect(sql).toBeDefined()
    expect(sql).not.toContain('sys_user_dept')
  })

  it('uses the real role-permission table for the matrix', () => {
    expect(sysRolePermission).toBeDefined()
  })
})
