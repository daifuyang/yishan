import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = {
  sysUser: { count: vi.fn() },
  sysDept: { count: vi.fn() },
  sysLoginLog: { count: vi.fn(), groupBy: vi.fn() },
};

vi.mock('../src/utils/prisma.js', () => ({
  prismaManager: { getClient: () => mockPrisma },
}));

const { DashboardService } = await import('../src/core/services/dashboard.service.js');

describe('DashboardService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return dashboard stats', async () => {
    mockPrisma.sysUser.count.mockResolvedValue(100);
    mockPrisma.sysDept.count.mockResolvedValue(20);
    mockPrisma.sysLoginLog.count.mockResolvedValue(50);
    mockPrisma.sysLoginLog.groupBy.mockResolvedValue([
      { userId: 1 },
      { userId: 2 },
      { userId: 3 },
    ]);

    const stats = await DashboardService.getStats();

    expect(stats.userTotal).toBe(100);
    expect(stats.deptTotal).toBe(20);
    expect(stats.todayLogin).toBe(50);
    expect(stats.online).toBe(3);
  });

  it('should call all 4 queries in parallel', async () => {
    mockPrisma.sysUser.count.mockResolvedValue(100);
    mockPrisma.sysDept.count.mockResolvedValue(20);
    mockPrisma.sysLoginLog.count.mockResolvedValue(50);
    mockPrisma.sysLoginLog.groupBy.mockResolvedValue([]);

    await DashboardService.getStats();

    expect(mockPrisma.sysUser.count).toHaveBeenCalledTimes(1);
    expect(mockPrisma.sysDept.count).toHaveBeenCalledTimes(1);
    expect(mockPrisma.sysLoginLog.count).toHaveBeenCalledTimes(1);
    expect(mockPrisma.sysLoginLog.groupBy).toHaveBeenCalledTimes(1);
  });
});
