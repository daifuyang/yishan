import { describe, it, expect, vi, beforeEach } from './runtime-fixture';
import { LoginLogRepository } from '../src/core/repositories/login-log.repository.js';
import { BusinessError } from '@yishan/core-api/errors';
import { SystemManageErrorCode } from '@yishan/core-api/business-codes/system';
import type { LoginLogDetailRow } from '../src/core/mappers/login-log.mapper.js';

const { LoginLogService } = await import('../src/core/services/login-log.service.js');

const createdAt = new Date('2026-10-13T08:00:00.000Z');
const updatedAt = new Date('2026-10-13T08:30:00.000Z');

function makeRow(overrides: Partial<LoginLogDetailRow> = {}): LoginLogDetailRow {
  return {
    id: 42,
    userId: 7,
    username: 'demo',
    realName: '演示用户',
    status: 1,
    message: '登录成功',
    ipAddress: '127.0.0.1',
    userAgent: 'vitest',
    createdAt,
    updatedAt,
    ...overrides,
  };
}

describe('LoginLogService.getMyLoginLogById', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('maps the owner row returned by the constrained lookup', async () => {
    const findByIdForUser = vi
      .spyOn(LoginLogRepository, 'findByIdForUser')
      .mockResolvedValueOnce(makeRow());

    const resp = await LoginLogService.getMyLoginLogById(7, 42);

    expect(findByIdForUser).toHaveBeenCalledWith(42, 7);
    expect(resp).toEqual({
      id: 42,
      userId: 7,
      username: 'demo',
      realName: '演示用户',
      status: '1',
      message: '登录成功',
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
      createdAt: '2026-10-13T08:00:00.000Z',
      updatedAt: '2026-10-13T08:30:00.000Z',
    });
  });

  it('throws LOGIN_LOG_NOT_FOUND when the row does not exist', async () => {
    vi.spyOn(LoginLogRepository, 'findByIdForUser').mockResolvedValueOnce(null);

    await expect(LoginLogService.getMyLoginLogById(7, 42)).rejects.toMatchObject({
      name: 'BusinessError',
      code: SystemManageErrorCode.LOGIN_LOG_NOT_FOUND,
    });
    await expect(LoginLogService.getMyLoginLogById(7, 42)).rejects.toBeInstanceOf(BusinessError);
  });

  it('throws the same error when the row belongs to another user', async () => {
    const findByIdForUser = vi
      .spyOn(LoginLogRepository, 'findByIdForUser')
      .mockResolvedValue(null);
    vi.spyOn(LoginLogRepository, 'findById').mockResolvedValue(makeRow({ userId: 8 }));

    await expect(LoginLogService.getMyLoginLogById(7, 42)).rejects.toMatchObject({
      name: 'BusinessError',
      code: SystemManageErrorCode.LOGIN_LOG_NOT_FOUND,
    });
    // The service must never fall back to the unconstrained admin lookup.
    expect(findByIdForUser).toHaveBeenCalledWith(42, 7);
    expect(LoginLogRepository.findById).not.toHaveBeenCalled();
  });
});
