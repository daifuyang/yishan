import { describe, it, expect, vi, beforeEach } from './runtime-fixture';
import { UserRepository } from '../src/core/repositories/user.repository.js';
import { DeptRepository } from '../src/core/repositories/dept.repository.js';
import { LoginLogRepository } from '../src/core/repositories/login-log.repository.js';
import type { FastifyInstance } from 'fastify';
import { runWithDataScope } from '../src/core/auth/data-scope';

const { DashboardService } = await import('../src/core/services/dashboard.service.js');

describe('DashboardService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not read or populate the global cache for a restricted caller', async () => {
    const get = vi.fn(async () => JSON.stringify({ userTotal: 999, todayLogin: 999, online: 999, deptTotal: 20 }));
    const setex = vi.fn();
    const app = { redis: { get, setex }, log: { warn: vi.fn() } } as unknown as FastifyInstance;
    vi.spyOn(UserRepository, 'count').mockResolvedValue(0);
    vi.spyOn(DeptRepository, 'count').mockResolvedValue(20);
    vi.spyOn(LoginLogRepository, 'count').mockResolvedValue(0);
    vi.spyOn(LoginLogRepository, 'countDistinctUsersInWindow').mockResolvedValue(0);
    const stats = await runWithDataScope({ userId: 7, roleIds: [], deptIds: [], superAdmin: false, permissionCode: 'system:dashboard:read' }, () => DashboardService.getStats(app));
    expect(stats.userTotal).toBe(0);
    expect(get).not.toHaveBeenCalled();
    expect(setex).not.toHaveBeenCalled();
  });

  it('should return dashboard stats', async () => {
    vi.spyOn(UserRepository, 'count').mockResolvedValueOnce(100);
    vi.spyOn(DeptRepository, 'count').mockResolvedValueOnce(20);
    vi.spyOn(LoginLogRepository, 'count').mockResolvedValueOnce(50);
    vi.spyOn(LoginLogRepository, 'countDistinctUsersInWindow').mockResolvedValueOnce(3);

    const stats = await DashboardService.getStats();

    expect(stats.userTotal).toBe(100);
    expect(stats.deptTotal).toBe(20);
    expect(stats.todayLogin).toBe(50);
    expect(stats.online).toBe(3);
  });

  it('should call all 4 repository methods in parallel', async () => {
    vi.spyOn(UserRepository, 'count').mockResolvedValueOnce(100);
    vi.spyOn(DeptRepository, 'count').mockResolvedValueOnce(20);
    vi.spyOn(LoginLogRepository, 'count').mockResolvedValueOnce(50);
    vi.spyOn(LoginLogRepository, 'countDistinctUsersInWindow').mockResolvedValueOnce(0);

    await DashboardService.getStats();

    expect(UserRepository.count).toHaveBeenCalledTimes(1);
    expect(DeptRepository.count).toHaveBeenCalledTimes(1);
    expect(LoginLogRepository.count).toHaveBeenCalledTimes(1);
    expect(LoginLogRepository.countDistinctUsersInWindow).toHaveBeenCalledTimes(1);
  });
});
