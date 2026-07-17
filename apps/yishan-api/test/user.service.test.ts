import { afterEach, describe, expect, it, vi } from 'vitest';
import { UserService } from '../src/core/services/user.service';
import { UserRepository } from '../src/core/repositories/user.repository';
import { PermissionService } from '../src/core/services/permission.service';
import { UserErrorCode } from '../src/constants/business-codes/user';
import { hashPassword } from '../src/utils/password';

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

describe('UserService persistence input mapping', () => {
  it('maps a create request to typed persistence data without passing plaintext password to the model', async () => {
    mockUniqueFields();
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
    const find = vi.spyOn(UserRepository, 'findById');

    const result = await UserService.getUserById(2, { redis, log: { warn: vi.fn() } } as any);

    expect(result).toMatchObject({ id: 2, roleIds: [2], deptIds: [3] });
    expect(find).not.toHaveBeenCalled();
  });

  it('writes a repository result to the user-detail cache on a cache miss', async () => {
    const redis = { get: vi.fn().mockResolvedValue(null), setex: vi.fn(), del: vi.fn() };
    vi.spyOn(UserRepository, 'findById').mockResolvedValue(mockUserDetail);

    await expect(UserService.getUserById(2, { redis, log: { warn: vi.fn() } } as any)).resolves.toMatchObject({ id: 2 });
    expect(redis.setex).toHaveBeenCalledWith('user:detail:2', expect.any(Number), expect.any(String));
  });

  it('refreshes the detail cache and invalidates both old and new role permissions after an update', async () => {
    mockUniqueFields();
    const redis = { get: vi.fn(), setex: vi.fn(), del: vi.fn() };
    vi.spyOn(UserRepository, 'findById').mockResolvedValue({ ...mockUserDetail, roleIds: [1] });
    vi.spyOn(UserRepository, 'updateInTransaction').mockResolvedValue({ ...mockUserDetail, roleIds: [2] });
    const invalidate = vi.spyOn(PermissionService, 'invalidate').mockImplementation(() => undefined as any);

    await UserService.updateUser(2, { roleIds: [2] }, 1, { redis, log: { warn: vi.fn() } } as any);

    expect(redis.setex).toHaveBeenCalledWith('user:detail:2', expect.any(Number), expect.any(String));
    expect(invalidate).toHaveBeenCalledWith([1, 2]);
  });

  it('soft-deletes an existing user, clears the cache, and rejects a missing user', async () => {
    const redis = { get: vi.fn(), setex: vi.fn(), del: vi.fn() };
    vi.spyOn(UserRepository, 'findById').mockResolvedValue(mockUserDetail);
    const remove = vi.spyOn(UserRepository, 'deleteUserInTransaction').mockResolvedValue();

    await expect(UserService.deleteUser(2, { redis, log: { warn: vi.fn() } } as any)).resolves.toEqual({ id: 2, deleted: true });
    expect(remove).toHaveBeenCalledWith(2);
    expect(redis.del).toHaveBeenCalledWith('user:detail:2');

    vi.spyOn(UserRepository, 'findById').mockResolvedValue(null);
    await expect(UserService.deleteUser(404)).rejects.toMatchObject({ code: UserErrorCode.USER_NOT_FOUND });
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
