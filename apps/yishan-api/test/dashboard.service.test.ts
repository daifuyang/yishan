import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserRepository } from '../src/core/repositories/user.repository.js';
import { DeptRepository } from '../src/core/repositories/dept.repository.js';
import { LoginLogRepository } from '../src/core/repositories/login-log.repository.js';

const { DashboardService } = await import('../src/core/services/dashboard.service.js');

describe('DashboardService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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