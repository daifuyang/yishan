/**
 * 草稿关联的用户创建：原子回执与幂等（Task 5）。
 *
 * 这里守的是**结构性质**，不是某个入口的接线：
 *
 *   1. 带 `draftSubmission` 的请求在**没有参与者**时被拒绝 —— 绝不降级成普通创建。
 *      这是整条链最危险的一处降级：静默降级等于「助手以为幂等、后台以为没有」。
 *   2. 授权判定、唯一性、业务校验与真正的 INSERT 在**同一个事务**里。
 *      事务之外先判后写，中间任何一次权限回收都能写出一个越权用户。
 *   3. 草稿字段是唯一可信来源：请求里的非敏感字段必须与服务端草稿一致（规范化之后）。
 *   4. claim / complete / 审计任何一步失败都整体回滚，草稿与用户都不落地。
 *   5. 提交后的缓存刷新 / 生命周期通知失败**不会**触发第二次创建。
 *   6. `replay` 只回读**已验证回执**里的 userId，不接受调用方给的任意 id。
 *
 * 事务边界用假的 `UserRepository.transaction` 表达：它记录回调抛没抛，
 * 抛了就是回滚。真实并发由 Task 10 用真实数据库验证。
 */
import { afterEach, describe, expect, it, vi } from './runtime-fixture'
import { testRuntime } from './runtime-fixture'
import { UserService } from '../src/core/services/user.service'
import { UserRepository, type CreateUserInput } from '../src/core/repositories/user.repository'
import { PermissionRepository } from '../src/core/repositories/permission.repository'
import { PermissionService } from '../src/core/services/permission.service'
import { DeptRepository } from '../src/core/repositories/dept.repository'
import { mergeDraftFields } from '../src/core/services/user-creation'
import type { UserCreationParticipant } from '../src/core/services/user-creation'
import type { AppTx } from '../src/db'
import { UserErrorCode } from '@yishan/core-api/business-codes/user'
import { BusinessError } from '@yishan/core-api/errors'

const ACTOR_ID = 7
const PASSWORD = 'Password1'

function userResp(id = 21) {
  return {
    id,
    username: 'zhangsan',
    email: null,
    phone: '13800000000',
    realName: null,
    nickname: null,
    avatar: null,
    gender: '0',
    genderName: '未知',
    status: '1',
    statusName: '启用',
    loginCount: 0,
    creatorId: ACTOR_ID,
    updaterId: ACTOR_ID,
    createdAt: '2026-10-17T00:00:00.000Z',
    updatedAt: '2026-10-17T00:00:00.000Z',
    deptIds: [10],
    roleIds: [2],
  } as never
}

function userDetailRow(id = 21) {
  return {
    id,
    username: 'zhangsan',
    email: null,
    phone: '13800000000',
    realName: null,
    nickname: null,
    avatar: null,
    gender: 0,
    birthDate: null,
    status: 1,
    lastLoginTime: null,
    lastLoginIp: null,
    loginCount: 0,
    creatorId: ACTOR_ID,
    updaterId: ACTOR_ID,
    createdAt: new Date('2026-10-17T00:00:00.000Z'),
    updatedAt: new Date('2026-10-17T00:00:00.000Z'),
    creatorName: null,
    updaterName: null,
    deptIds: [10],
    roleIds: [2],
  } as never
}

const DRAFT_FIELDS = {
  username: 'zhangsan',
  phone: '13800000000',
  realName: '张三',
  deptIds: [10],
  roleIds: [2],
} as never

/** 事务句柄的替身：只标记身份，不做任何 SQL。 */
const FAKE_TX = { __tx: true } as unknown as AppTx

interface Harness {
  commit: () => boolean
  rollbacks: () => number
  txSeenBy: () => unknown[]
}

/**
 * 假的 `UserRepository.transaction`。
 *
 * 回调抛异常 = 回滚（与真实事务语义一致），我们用它来断言「失败时什么都没落地」。
 */
function harness(options: { onCreate?: () => Promise<unknown> } = {}): Harness {
  let committed = false
  let rolledBack = 0
  const txSeenBy: unknown[] = []
  vi.spyOn(UserRepository, 'transaction').mockImplementation(async (fn: never) => {
    try {
      const result = await (fn as (tx: AppTx) => Promise<unknown>)(FAKE_TX)
      committed = true
      return result
    } catch (error) {
      rolledBack += 1
      throw error
    }
  })
  vi.spyOn(UserRepository, 'create').mockImplementation(async (input: CreateUserInput, db?: unknown) => {
    txSeenBy.push(db)
    if (options.onCreate) await options.onCreate()
    void input
    return userDetailRow()
  })
  return {
    commit: () => committed,
    rollbacks: () => rolledBack,
    txSeenBy: () => txSeenBy,
  }
}

function superAdminActor(): void {
  vi.spyOn(PermissionRepository, 'loadPermissionsByRole').mockImplementation(async ids => new Map(ids.filter(id => id === 2).map(id => [id, { code: null, perms: new Set<string>() }])))
  vi.spyOn(DeptRepository, 'findEnabledIdsByIds').mockImplementation(async ids => ids.filter(id => id === 10))
  vi.spyOn(PermissionRepository, 'loadActiveRoleIdsByUserId').mockResolvedValue([1])
  vi.spyOn(UserRepository, 'loadActiveDeptIdsByUserId').mockResolvedValue([10])
  vi.spyOn(PermissionService, 'loadForRoleIds').mockResolvedValue({
    perms: new Set(['__super_admin__']),
    roleCodes: new Set(['super_admin']),
  })
}

function uniqueFieldsFree(): void {
  vi.spyOn(UserRepository, 'findIdByUsername').mockResolvedValue(null)
  vi.spyOn(UserRepository, 'findIdByEmail').mockResolvedValue(null)
  vi.spyOn(UserRepository, 'findIdByPhone').mockResolvedValue(null)
}

/** 一个走通全流程的参与者。 */
function createParticipant(overrides: Partial<UserCreationParticipant> = {}) {
  const complete = vi.fn().mockResolvedValue(undefined)
  const fail = vi.fn().mockResolvedValue(undefined)
  const participant: UserCreationParticipant = {
    claim: vi.fn().mockResolvedValue({ kind: 'create', fields: DRAFT_FIELDS }),
    complete,
    fail,
    ...overrides,
  } as UserCreationParticipant
  setParticipant(participant)
  return { participant, complete, fail }
}

function setParticipant(participant?: UserCreationParticipant): void {
  ;(testRuntime().options as { userCreationParticipant?: UserCreationParticipant }).userCreationParticipant = participant
}

function request(overrides: Record<string, unknown> = {}) {
  return { password: PASSWORD, draftSubmission: { draftId: 'd-1', draftVersion: 3 }, ...overrides }
}

afterEach(() => {
  vi.restoreAllMocks()
  setParticipant(undefined)
})

describe('无参与者时的草稿提交必须被拒绝', () => {
  it('拒绝而不是降级成普通创建，且不落库', async () => {
    uniqueFieldsFree()
    superAdminActor()
    const h = harness()
    setParticipant(undefined)

    await expect(UserService.createUser(request() as never, ACTOR_ID)).rejects.toBeInstanceOf(BusinessError)
    expect(h.commit()).toBe(false)
    expect(UserRepository.create).not.toHaveBeenCalled()
  })

  it('普通创建（不带 draftSubmission）完全不受影响', async () => {
    uniqueFieldsFree()
    superAdminActor()
    const h = harness()
    setParticipant(undefined)

    await expect(
      UserService.createUser({ phone: '13800000000', password: PASSWORD, deptIds: [10] } as never, ACTOR_ID),
    ).resolves.toMatchObject({ id: 21 })
    expect(h.commit()).toBe(true)
  })
})

describe('草稿字段是唯一可信来源', () => {
  it('请求里的非敏感字段与服务端草稿不一致时拒绝', async () => {
    uniqueFieldsFree()
    superAdminActor()
    const h = harness()
    createParticipant()

    await expect(
      UserService.createUser(request({ phone: '13900000000' }) as never, ACTOR_ID),
    ).rejects.toMatchObject({ code: UserErrorCode.USER_INFO_INCOMPLETE })
    expect(UserRepository.create).not.toHaveBeenCalled()
    expect(h.rollbacks()).toBe(1)
  })

  it('头像仅来自最终业务请求，不进入对话草稿', () => {
    const merged = mergeDraftFields(DRAFT_FIELDS, { avatar: '/uploads/avatar.png' } as never)
    expect(merged.avatar).toBe('/uploads/avatar.png')
    expect(DRAFT_FIELDS).not.toHaveProperty('avatar')
  })

  it('规范化之后相同即视为一致（空白、数组顺序、去重不算差异）', () => {
    const merged = mergeDraftFields(DRAFT_FIELDS, {
      username: ' zhangsan ',
      deptIds: [10, 10],
      roleIds: [2],
    } as never)
    expect(merged).toMatchObject({ username: 'zhangsan', deptIds: [10], roleIds: [2] })
  })

  /**
   * 日期字段按**规范形式**比，不按写法比。
   *
   * 草稿里存的是模型给的 ISO 时间戳（原生表单回填也会回写成 ISO），
   * 提交上来的永远是 `YYYY-MM-DD`（HTTP 契约 `format: "date"`）。
   * 不折就等于拿两种形状比事实，于是每一次带草稿的创建都被判「与服务端草稿不一致」。
   */
  it('草稿里存 ISO、提交 YYYY-MM-DD：视为同一个日期，落库用规范形式', () => {
    const merged = mergeDraftFields(
      { ...DRAFT_FIELDS, birthDate: '1996-10-02T00:00:00.000Z' } as never,
      { birthDate: '1996-10-02' } as never,
    )
    expect(merged.birthDate).toBe('1996-10-02')
  })

  it('日期真的不同仍然拒绝（归一不放松实质冲突）', () => {
    expect(() => mergeDraftFields(
      { ...DRAFT_FIELDS, birthDate: '1996-10-02' } as never,
      { birthDate: '1996-10-03' } as never,
    )).toThrow(/与服务端草稿不一致/)
  })

  it('折不出来的日期原样保留，不制造假差异', () => {
    const merged = mergeDraftFields(
      { ...DRAFT_FIELDS, birthDate: '1996-13-01' } as never,
      { birthDate: '1996-13-01' } as never,
    )
    expect(merged.birthDate).toBe('1996-13-01')
  })

  it('缺失的非敏感字段从服务端草稿补齐，password 只用于本次创建', async () => {
    uniqueFieldsFree()
    superAdminActor()
    const h = harness()
    createParticipant()
    const create = vi.mocked(UserRepository.create)

    await UserService.createUser(request() as never, ACTOR_ID)

    const input = create.mock.calls[0][0]
    expect(input).toMatchObject({ username: 'zhangsan', phone: '13800000000', realName: '张三', deptIds: [10], roleIds: [2] })
    expect(input.passwordHash).not.toBe(PASSWORD)
  })

  it('draftSubmission 永远不会进入用户字段', async () => {
    uniqueFieldsFree()
    superAdminActor()
    harness()
    createParticipant()
    const create = vi.mocked(UserRepository.create)

    await UserService.createUser(request() as never, ACTOR_ID)

    expect(Object.keys(create.mock.calls[0][0])).not.toContain('draftSubmission')
    expect(JSON.stringify(create.mock.calls[0][0])).not.toContain('draftId')
  })
})

describe('原子回执：创建、回执与草稿完成态同生共死', () => {
  it('成功时 complete 在同一事务里被调用', async () => {
    uniqueFieldsFree()
    superAdminActor()
    const h = harness()
    const { participant, complete } = createParticipant()

    await UserService.createUser(request() as never, ACTOR_ID)

    expect(vi.mocked(participant.claim).mock.calls[0][0]).toBe(FAKE_TX)
    expect(complete).toHaveBeenCalledTimes(1)
    expect(complete.mock.calls[0][0]).toBe(FAKE_TX)
    expect(complete.mock.calls[0][1]).toBe(ACTOR_ID)
    expect(complete.mock.calls[0][2]).toEqual({ draftId: 'd-1', draftVersion: 3 })
    expect(h.commit()).toBe(true)
  })

  it('授权判定与唯一性查询在事务句柄上执行', async () => {
    uniqueFieldsFree()
    superAdminActor()
    const h = harness()
    createParticipant()

    await UserService.createUser(request() as never, ACTOR_ID)

    // 唯一性查询必须收到事务句柄；否则「查完到写入之间」用户名被别人抢走。
    expect(vi.mocked(UserRepository.findIdByPhone).mock.calls[0][1]).toBe(FAKE_TX)
    expect(h.txSeenBy()).toEqual([FAKE_TX])
  })

  it('claim 失败 -> 回滚，且不记录 failed（草稿仍可重试）', async () => {
    uniqueFieldsFree()
    superAdminActor()
    const h = harness()
    const { fail } = createParticipant({
      claim: vi.fn().mockRejectedValue(Object.assign(new Error('草稿版本已更新'), { statusCode: 409 })),
    })

    await expect(UserService.createUser(request() as never, ACTOR_ID)).rejects.toMatchObject({ statusCode: 409 })
    expect(h.rollbacks()).toBe(1)
    expect(UserRepository.create).not.toHaveBeenCalled()
    expect(fail).not.toHaveBeenCalled()
  })

  it('complete 失败 -> 整体回滚，用户不会留下', async () => {
    uniqueFieldsFree()
    superAdminActor()
    const h = harness()
    const { fail } = createParticipant({
      // 审计/连接类故障：没有 statusCode，也不是 BusinessError。
      complete: vi.fn().mockRejectedValue(new Error('ai_audit 写入失败')),
    })

    await expect(UserService.createUser(request() as never, ACTOR_ID)).rejects.toMatchObject({
      message: 'ai_audit 写入失败',
    })
    expect(h.commit()).toBe(false)
    expect(h.rollbacks()).toBe(1)
    expect(fail).not.toHaveBeenCalled()
  })

  it('提交后的缓存/通知失败不会触发第二次创建', async () => {
    uniqueFieldsFree()
    superAdminActor()
    const h = harness()
    const { complete } = createParticipant()
    const redis = { get: vi.fn(), setex: vi.fn().mockRejectedValue(new Error('redis down')), del: vi.fn() }

    await expect(
      UserService.createUser(request() as never, ACTOR_ID, { redis, log: { warn: vi.fn(), error: vi.fn() } } as never),
    ).resolves.toMatchObject({ id: 21 })

    // 事务已经提交过一次；提交后的副作用再失败也不回到「可以再创建一次」。
    expect(h.commit()).toBe(true)
    expect(complete).toHaveBeenCalledTimes(1)
    expect(UserRepository.create).toHaveBeenCalledTimes(1)
  })
})

describe('业务失败保留草稿', () => {
  it('明确的业务失败回滚创建并以版本条件记录 failed', async () => {
    uniqueFieldsFree()
    vi.spyOn(PermissionRepository, 'loadActiveRoleIdsByUserId').mockResolvedValue([2])
    vi.spyOn(UserRepository, 'loadActiveDeptIdsByUserId').mockResolvedValue([10])
    vi.spyOn(PermissionService, 'loadForRoleIds').mockResolvedValue({
      perms: new Set(['system:user:list']),
      roleCodes: new Set<string>(),
    })
    const h = harness()
    const { fail } = createParticipant()

    await expect(UserService.createUser(request() as never, ACTOR_ID)).rejects.toMatchObject({
      code: UserErrorCode.USER_CREATE_FORBIDDEN,
    })
    expect(h.rollbacks()).toBe(1)
    expect(UserRepository.create).not.toHaveBeenCalled()
    expect(fail).toHaveBeenCalledTimes(1)
    expect(fail.mock.calls[0][0]).toMatchObject({
      actorId: ACTOR_ID,
      submission: { draftId: 'd-1', draftVersion: 3 },
    })
  })

  it('基础设施故障不记录 failed（由数据库回滚恢复，不凭结果猜测）', async () => {
    uniqueFieldsFree()
    superAdminActor()
    const h = harness()
    const { fail } = createParticipant({
      complete: vi.fn().mockRejectedValue(Object.assign(new Error('connection lost'), { statusCode: 503 })),
    })

    await expect(UserService.createUser(request() as never, ACTOR_ID)).rejects.toMatchObject({ statusCode: 503 })
    expect(fail).not.toHaveBeenCalled()
  })

  it('记录 failed 本身失败不掩盖原始错误', async () => {
    uniqueFieldsFree()
    superAdminActor()
    harness()
    createParticipant({ fail: vi.fn().mockRejectedValue(new Error('audit down')) })

    await expect(
      UserService.createUser(request({ phone: '13900000000' }) as never, ACTOR_ID),
    ).rejects.toMatchObject({ code: UserErrorCode.USER_INFO_INCOMPLETE })
  })
})

describe('replay：只回读已验证回执，不变成按 id 查用户', () => {
  it('重放不广播 user.created —— 用户不是这一次创建的', async () => {
    // 回归：重复点击一次已经完成的草稿时，`user.created` 不该再发一次。
    // 扩展消费者（Demo 资料同步、欢迎消息）会为同一个用户被触发两次，
    // 而这次请求既没有 INSERT，也没有发生任何权限变更。
    superAdminActor()
    harness()
    createParticipant({ claim: vi.fn().mockResolvedValue({ kind: 'replay', userId: 21 }) })
    vi.spyOn(UserRepository, 'findById').mockResolvedValue(userDetailRow(21))
    const notify = vi.spyOn(testRuntime(), 'notifyUser')

    await expect(UserService.createUser(request() as never, ACTOR_ID)).resolves.toMatchObject({ id: 21 })
    expect(notify).not.toHaveBeenCalled()
  })

  it('真正创建时仍然广播 user.created', async () => {
    uniqueFieldsFree()
    superAdminActor()
    harness()
    createParticipant()
    const notify = vi.spyOn(testRuntime(), 'notifyUser').mockResolvedValue()

    await UserService.createUser(request() as never, ACTOR_ID)
    expect(notify).toHaveBeenCalledTimes(1)
    expect(notify.mock.calls[0][0]).toMatchObject({ type: 'user.created', actorId: ACTOR_ID })
  })

  it('已完成时读取既有结果且不创建', async () => {
    superAdminActor()
    const h = harness()
    createParticipant({ claim: vi.fn().mockResolvedValue({ kind: 'replay', userId: 21 }) })
    const findById = vi.spyOn(UserRepository, 'findById').mockResolvedValue(userDetailRow(21))

    await expect(UserService.createUser(request() as never, ACTOR_ID)).resolves.toMatchObject({ id: 21 })
    expect(UserRepository.create).not.toHaveBeenCalled()
    // 第四个参数 forUpdate=true：重放读取必须是事务内的当前读（FOR UPDATE），
    // 否则并发重放会停在 A 提交之前的一致性快照上，读不到刚建的用户。
    expect(findById).toHaveBeenCalledWith(21, FAKE_TX, false, true)
  })

  it('重放仍然重算当前创建权限：权限被回收后不能借回执读取结果', async () => {
    vi.spyOn(PermissionRepository, 'loadActiveRoleIdsByUserId').mockResolvedValue([2])
    vi.spyOn(UserRepository, 'loadActiveDeptIdsByUserId').mockResolvedValue([10])
    vi.spyOn(PermissionService, 'loadForRoleIds').mockResolvedValue({
      perms: new Set(['system:user:list']),
      roleCodes: new Set<string>(),
    })
    harness()
    createParticipant({ claim: vi.fn().mockResolvedValue({ kind: 'replay', userId: 21 }) })
    const findById = vi.spyOn(UserRepository, 'findById')

    await expect(UserService.createUser(request() as never, ACTOR_ID)).rejects.toMatchObject({
      code: UserErrorCode.USER_CREATE_FORBIDDEN,
    })
    expect(findById).not.toHaveBeenCalled()
  })

  it('记录的结果已被删除时返回明确的已完成状态，绝不再次创建', async () => {
    superAdminActor()
    const h = harness()
    createParticipant({ claim: vi.fn().mockResolvedValue({ kind: 'replay', userId: 21 }) })
    vi.spyOn(UserRepository, 'findById').mockResolvedValue(null)

    await expect(UserService.createUser(request() as never, ACTOR_ID)).rejects.toMatchObject({
      code: UserErrorCode.USER_NOT_FOUND,
    })
    expect(UserRepository.create).not.toHaveBeenCalled()
    expect(h.rollbacks()).toBe(1)
  })
})
