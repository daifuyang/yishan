import { afterEach, describe, expect, it, vi } from './runtime-fixture';
import { testRuntime } from './runtime-fixture';
import { UserService } from '../src/core/services/user.service';
import { UserRepository } from '../src/core/repositories/user.repository';
import { PermissionRepository } from '../src/core/repositories/permission.repository';
import { PermissionService } from '../src/core/services/permission.service';
import { DeptRepository } from '../src/core/repositories/dept.repository';
import { UserErrorCode } from '@yishan/core-api/business-codes/user';
import { hashPassword } from '../src/utils/password';
import { eq } from 'drizzle-orm';
import { sysUser } from '../src/db/schema';
import { runWithDataScope, runWithoutDataScope } from '../src/core/auth/data-scope';

const userResponse = {
  id: 2,
  phone: '13800000000',
  gender: '0',
  genderName: '未知',
  status: '1',
  statusName: '启用',
  loginCount: 0,
  creatorId: 1,
  updaterId: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const mockUserDetail = {
  id: 2,
  username: null,
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
  creatorId: 1,
  updaterId: 1,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  creatorName: null,
  updaterName: null,
  deptIds: [],
  roleIds: [],
};

afterEach(() => vi.restoreAllMocks());

function mockUniqueFields(): void {
  vi.spyOn(UserRepository, 'findIdByUsername').mockResolvedValue(null);
  vi.spyOn(UserRepository, 'findIdByEmail').mockResolvedValue(null);
  vi.spyOn(UserRepository, 'findIdByPhone').mockResolvedValue(null);
}

/**
 * 创建用户现在会走统一的授权规则（user-creation-policy）。这条用例只关心**输入
 * 映射**，因此把操作者装成超管（种子数据里 id=1 就是），让它通过授权后继续。
 * 规则本身的用例在 test/user-creation-policy.test.ts。
 *
 * 光装操作者还不够：超管跳过的是范围比较，不是「引用必须存在」。策略仍然会查被
 * 分配的角色/部门是否真实存在且启用，查不到就报「选择的角色不存在或已被停用」。
 * 这一条不测策略，所以直接把两个仓储按「传入的都存在」桩掉。
 */
function mockSuperAdminActor(): void {
  vi.spyOn(PermissionRepository, 'loadActiveRoleIdsByUserId').mockResolvedValue([1]);
  vi.spyOn(UserRepository, 'loadActiveDeptIdsByUserId').mockResolvedValue([]);
  vi.spyOn(PermissionService, 'loadForRoleIds').mockResolvedValue({
    perms: new Set(['__super_admin__']),
    roleCodes: new Set(['super_admin']),
  });
  vi.spyOn(PermissionRepository, 'loadPermissionsByRole').mockImplementation(
    async (roleIds: number[]) => new Map(roleIds.map((id) => [id, { perms: new Set<string>(), code: null }])),
  );
  vi.spyOn(DeptRepository, 'findEnabledIdsByIds').mockImplementation(async (ids: number[]) => ids);
}

describe('UserService persistence input mapping', () => {
  it('maps a create request to typed persistence data without passing plaintext password to the model', async () => {
    mockUniqueFields();
    mockSuperAdminActor();
    const create = vi.spyOn(UserRepository, 'create').mockResolvedValue(mockUserDetail);

    await UserService.createUser(
      {
        phone: '13800000000',
        password: 'Password1',
        gender: '1',
        status: '0',
        birthDate: '2000-01-02',
        deptIds: [1, 1],
        roleIds: [2, 2],
      },
      1,
    );

    const input = create.mock.calls[0][0];
    expect(input).toMatchObject({
      phone: '13800000000',
      gender: 1,
      status: 0,
      creatorId: 1,
      updaterId: 1,
      deptIds: [1, 1],
      roleIds: [2, 2],
    });
    expect(input.birthDate).toEqual(new Date('2000-01-02'));
    expect(input.passwordHash).not.toBe('Password1');
    expect(input).not.toHaveProperty('password');
  });

  it('keeps an omitted birth date undefined during a partial update', async () => {
    mockUniqueFields();
    vi.spyOn(UserRepository, 'findById').mockResolvedValue(mockUserDetail);
    const update = vi.spyOn(UserRepository, 'update').mockResolvedValue(mockUserDetail);

    await UserService.updateUser(2, { nickname: 'new name' }, 1);

    const input = update.mock.calls[0][1];
    expect(input.nickname).toBe('new name');
    expect(input.birthDate).toBeUndefined();
    expect(input.passwordHash).toBeUndefined();
  });

  it('maps an empty birth date to null for an explicit clear', async () => {
    mockUniqueFields();
    vi.spyOn(UserRepository, 'findById').mockResolvedValue(mockUserDetail);
    const update = vi.spyOn(UserRepository, 'update').mockResolvedValue(mockUserDetail);

    await UserService.updateUser(2, { birthDate: '' }, 1);

    expect(update.mock.calls[0][1].birthDate).toBeNull();
  });
});

describe('UserService business rules and side effects', () => {
  // 后台新建用户与 AI 草稿提交共用同一套授权规则：越权在落库之前就拒绝。
  it('refuses to create a user when the actor lacks the create permission', async () => {
    mockUniqueFields();
    vi.spyOn(PermissionRepository, 'loadActiveRoleIdsByUserId').mockResolvedValue([2]);
    vi.spyOn(UserRepository, 'loadActiveDeptIdsByUserId').mockResolvedValue([10]);
    vi.spyOn(PermissionService, 'loadForRoleIds').mockResolvedValue({
      perms: new Set(['system:user:list']),
      roleCodes: new Set<string>(),
    });
    const persist = vi.spyOn(UserRepository, 'createInTransaction');

    await expect(
      UserService.createUser({ phone: '13800000000', password: 'Password1', deptIds: [10] }, 9),
    ).rejects.toMatchObject({ code: UserErrorCode.USER_CREATE_FORBIDDEN });
    expect(persist).not.toHaveBeenCalled();
  });

  it.each([
    ['too short', 'Ab123'],
    ['no digit', 'Password'],
    ['no letter', '12345678'],
    ['unsupported symbol', 'Password1#'],
    ['too long', `A1${'a'.repeat(49)}`],
  ])('rejects a %s password on create', async (_name, password) => {
    await expect(UserService.createUser({ phone: '13800000000', password }, 1)).rejects.toMatchObject({
      code: UserErrorCode.PASSWORD_WEAK,
    });
  });

  it.each([
    ['username', 'findIdByUsername', { username: 'duplicate-user' }],
    ['email', 'findIdByEmail', { email: 'duplicate@example.com' }],
    ['phone', 'findIdByPhone', { phone: '13800000000' }],
  ] as const)('rejects an existing %s', async (_field, method, identity) => {
    mockUniqueFields();
    vi.spyOn(UserRepository, method).mockResolvedValue(9);

    await expect(
      UserService.createUser({ phone: '13800000000', password: 'Password1', ...identity }, 1),
    ).rejects.toMatchObject({ code: UserErrorCode.USER_ALREADY_EXISTS });
  });

  it('permits an unchanged unique identity when updating the same user', async () => {
    mockUniqueFields();
    vi.spyOn(UserRepository, 'findIdByUsername').mockResolvedValue(2);
    vi.spyOn(UserRepository, 'findById').mockResolvedValue(mockUserDetail);
    vi.spyOn(UserRepository, 'updateInTransaction').mockResolvedValue(mockUserDetail);

    await expect(UserService.updateUser(2, { username: 'same-user' }, 1)).resolves.toMatchObject({ id: 2 });
  });

  it('rejects an update for a missing user before mutating data', async () => {
    vi.spyOn(UserRepository, 'findById').mockResolvedValue(null);
    const update = vi.spyOn(UserRepository, 'updateInTransaction');

    await expect(UserService.updateUser(404, { nickname: 'nobody' }, 1)).rejects.toMatchObject({
      code: UserErrorCode.USER_NOT_FOUND,
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('normalizes list pagination and converts date filters before querying the repository', async () => {
    const list = vi.spyOn(UserRepository, 'list').mockResolvedValue([mockUserDetail]);
    vi.spyOn(UserRepository, 'count').mockResolvedValue(1);

    const result = await UserService.getUserList({
      page: 0,
      pageSize: 999,
      startTime: '2026-01-01T00:00:00.000Z',
      endTime: '2026-01-31T23:59:59.999Z',
    });

    expect(result).toMatchObject({ page: 1, pageSize: 100, total: 1 });
    expect(list).toHaveBeenCalledWith(expect.objectContaining({
      page: 1,
      pageSize: 100,
      startTime: expect.any(Date),
      endTime: expect.any(Date),
    }));
  });

  it('uses a cached user detail and normalizes relation ids without querying MySQL', async () => {
    const redis = {
      get: vi.fn().mockResolvedValue(JSON.stringify({ ...userResponse, roleIds: ['2', 'bad'], deptIds: ['3'] })),
      setex: vi.fn(),
      del: vi.fn(),
    };
    const find = vi.spyOn(UserRepository, 'findByIdWithScope');

    // 免过滤路径：登录解析当前用户自己走的就是这条，缓存里存的是全量详情。
    const result = await runWithoutDataScope(() => UserService.getUserById(2, { redis, log: { warn: vi.fn() } } as any));

    expect(result).toMatchObject({ id: 2, roleIds: [2], deptIds: [3] });
    expect(find).not.toHaveBeenCalled();
  });

  it('writes a repository result to the user-detail cache on a cache miss', async () => {
    const redis = { get: vi.fn().mockResolvedValue(null), setex: vi.fn(), del: vi.fn() };
    vi.spyOn(UserRepository, 'findByIdWithScope').mockResolvedValue(mockUserDetail);

    await expect(
      runWithoutDataScope(() => UserService.getUserById(2, { redis, log: { warn: vi.fn() } } as any)),
    ).resolves.toMatchObject({ id: 2 });
    expect(redis.setex).toHaveBeenCalledWith(`${testRuntime().config.cacheNamespace}:user:detail:2`, expect.any(Number), expect.any(String));
  });

  it('never serves a scoped request from the unrestricted detail cache', async () => {
    // 回归：缓存键只有 userId。若受限请求也读它，「换个 id 猜缓存」就绕过了
    // dataScope —— 受限请求必须每次都回到带 where 的查询。
    const redis = {
      get: vi.fn().mockResolvedValue(JSON.stringify(userResponse)),
      setex: vi.fn(),
      del: vi.fn(),
    };
    const find = vi.spyOn(UserRepository, 'findByIdWithScope').mockResolvedValue(mockUserDetail);

    const result = await runWithDataScope(
      { userId: 7, roleIds: [3], deptIds: [10], superAdmin: false, permissionCode: 'system:user:update' },
      () => UserService.getUserById(2, { redis, log: { warn: vi.fn() } } as any),
    );

    expect(redis.get).not.toHaveBeenCalled();
    expect(redis.setex).not.toHaveBeenCalled();
    expect(find).toHaveBeenCalled();
    expect(result).toMatchObject({ id: 2 });
  });

  it('refreshes the detail cache and invalidates both old and new role permissions after an update', async () => {
    mockUniqueFields();
    const redis = { get: vi.fn(), setex: vi.fn(), del: vi.fn() };
    vi.spyOn(UserRepository, 'findById').mockResolvedValue({ ...mockUserDetail, roleIds: [1] });
    vi.spyOn(UserRepository, 'updateInTransaction').mockResolvedValue({ ...mockUserDetail, roleIds: [2] });
    const invalidate = vi.spyOn(PermissionService, 'invalidate').mockImplementation(() => undefined as any);

    await UserService.updateUser(2, { roleIds: [2] }, 1, { redis, log: { warn: vi.fn() } } as any);

    expect(redis.setex).toHaveBeenCalledWith(`${testRuntime().config.cacheNamespace}:user:detail:2`, expect.any(Number), expect.any(String));
    expect(invalidate).toHaveBeenCalledWith([1, 2]);
  });

  it('soft-deletes an existing user, clears the cache, and rejects a missing user', async () => {
    const redis = { get: vi.fn(), setex: vi.fn(), del: vi.fn() };
    vi.spyOn(UserRepository, 'findById').mockResolvedValue(mockUserDetail);
    const remove = vi.spyOn(UserRepository, 'deleteUserInTransaction').mockResolvedValue();

    await expect(UserService.deleteUser(2, undefined, { redis, log: { warn: vi.fn() } } as any)).resolves.toEqual({ id: 2, deleted: true });
    expect(remove).toHaveBeenCalledWith(2);
    expect(redis.del).toHaveBeenCalledWith(`${testRuntime().config.cacheNamespace}:user:detail:2`);

    vi.spyOn(UserRepository, 'findById').mockResolvedValue(null);
    await expect(UserService.deleteUser(404)).rejects.toMatchObject({ code: UserErrorCode.USER_NOT_FOUND });
  });

  // 两条删除保护必须在 service 层：AI 能力等绕过 HTTP 的调用方不会经过 route 闭包。
  it('refuses to delete the system administrator and refuses self-deletion, regardless of caller', async () => {
    const remove = vi.spyOn(UserRepository, 'deleteUserInTransaction').mockResolvedValue();
    vi.spyOn(UserRepository, 'findById').mockResolvedValue(mockUserDetail);

    await expect(UserService.deleteUser(1)).rejects.toMatchObject({
      code: UserErrorCode.USER_STATUS_ERROR,
    });
    await expect(UserService.deleteUser(1, 7)).rejects.toMatchObject({
      code: UserErrorCode.USER_STATUS_ERROR,
    });
    await expect(UserService.deleteUser(7, 7)).rejects.toMatchObject({
      code: UserErrorCode.USER_STATUS_ERROR,
    });
    // 操作者与目标不同才允许删除
    await expect(UserService.deleteUser(2, 7)).resolves.toEqual({ id: 2, deleted: true });

    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith(2);
  });

  it('changes a password only when the old password matches, then revokes tokens through the transactional repository method', async () => {
    const oldHash = await hashPassword('OldPassword1');
    vi.spyOn(UserRepository, 'findPasswordHashById').mockResolvedValue(oldHash);
    const change = vi.spyOn(UserRepository, 'changePasswordInTransaction').mockResolvedValue();

    await UserService.changePassword(2, 'OldPassword1', 'NewPassword1');
    expect(change).toHaveBeenCalledWith(2, expect.not.stringContaining('NewPassword1'));

    await expect(UserService.changePassword(2, 'wrong-password', 'NewPassword1')).rejects.toMatchObject({
      code: UserErrorCode.PASSWORD_ERROR,
    });
  });

  it('reports a missing user while changing a password', async () => {
    vi.spyOn(UserRepository, 'findPasswordHashById').mockResolvedValue(null);

    await expect(UserService.changePassword(404, 'OldPassword1', 'NewPassword1')).rejects.toMatchObject({
      code: UserErrorCode.USER_NOT_FOUND,
    });
  });
});

/**
 * 行级数据范围（sys_role.data_scope）。
 *
 * 关键回归点是「缓存不能绕过过滤」：user:detail 缓存里存的是全量详情，
 * 若先命中缓存再放行，按任意 id 就能读到范围外的用户。
 */
describe('UserService row-level data scope', () => {
  const deptScopedUser = { ...mockUserDetail, deptIds: [10] };

  it('skips the detail cache when the request carries a row-level restriction', async () => {
    const redis = { get: vi.fn(), setex: vi.fn(), del: vi.fn() };
    const scoped = vi.spyOn(UserRepository, 'dataScopeCondition').mockResolvedValue(
      eq(sysUser.id, -1) as never,
    );
    vi.spyOn(UserRepository, 'findByIdWithScope').mockResolvedValue(deptScopedUser);

    await UserService.getUserById(2, { redis, log: { warn: vi.fn() } } as any);

    expect(scoped).toHaveBeenCalledWith(true);
    // 既不读也不写缓存——缓存装的是全量详情，混进来就越权了。
    expect(redis.get).not.toHaveBeenCalled();
    expect(redis.setex).not.toHaveBeenCalled();
  });

  it('resolves identity without a row-level restriction so a self-scoped role can still log in', async () => {
    const redis = { get: vi.fn().mockResolvedValue(null), setex: vi.fn(), del: vi.fn() };
    const scoped = vi.spyOn(UserRepository, 'dataScopeCondition').mockResolvedValue(undefined);
    vi.spyOn(UserRepository, 'findByIdWithScope').mockResolvedValue(mockUserDetail);

    await UserService.getUserById(7, { redis, log: { warn: vi.fn() } } as any, false);

    expect(scoped).toHaveBeenCalledWith(false);
    expect(redis.setex).toHaveBeenCalled();
  });
});

/**
 * 「列表与统计同范围」是由结构保证的：`UserRepository.list` 与 `count`
 * 都把 `dataScopeCondition()` 的结果交给同一个 `buildUserWhere`。
 * 这里不重复断言（单测里 mock 掉 list/count 反而绕过了被测逻辑），
 * 该性质由 `resolveDataScope` 的用例与集成测试覆盖。
 */
