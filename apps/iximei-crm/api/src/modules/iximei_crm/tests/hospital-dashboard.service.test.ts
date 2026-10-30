/**
 * HospitalDashboardService — 访问矩阵 / 越权测试
 *
 * 覆盖新加的 resolveHospitalScope：
 *   1. super_admin 不传 hospitalId → 全院汇总（allActiveHospitalIds）
 *   2. super_admin 传 hospitalId → 单院
 *   3. hospital_account 不传 → 自动本院（单院）
 *   4. hospital_account 传 == 本院 → 单院
 *   5. hospital_account 传 != 本院 → 403
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BusinessError } from '@yishan/core-api/errors';
import { AuthErrorCode } from '@yishan/core-api/business-codes/auth';
import { ROLE_IDS } from '@/modules/iximei_crm/role-codes';
import { HospitalsRepository } from '../repositories/hospitals.repository.js';
import { HospitalDashboardRepository } from '../repositories/hospital-dashboard.repository.js';
import { HospitalDashboardService } from '../services/hospital-dashboard.service.js';

vi.mock('../repositories/hospitals.repository.js', () => ({
  HospitalsRepository: {
    allActiveHospitalIds: vi.fn(),
    accessibleHospitalIds: vi.fn(),
  },
}));

vi.mock('../repositories/hospital-dashboard.repository.js', () => ({
  HospitalDashboardRepository: {
    getStats: vi.fn(),
    getUnviewedCount: vi.fn(),
    getTrend: vi.fn(),
  },
}));

const SUPER_ADMIN = [ROLE_IDS.SUPER_ADMIN];
const HOSPITAL = [ROLE_IDS.HOSPITAL_ACCOUNT];
const ADMIN = [ROLE_IDS.ADMIN];

beforeEach(() => {
  vi.clearAllMocks();
  (HospitalDashboardRepository.getStats as any).mockResolvedValue({
    todayCount: 1, monthCount: 2, yearCount: 3, totalCount: 4,
    viewedCount: 2, unviewedCount: 2,
  });
  (HospitalDashboardRepository.getUnviewedCount as any).mockResolvedValue(5);
  (HospitalDashboardRepository.getTrend as any).mockResolvedValue({
    daily: [], statusBreakdown: { viewed: 0, unviewed: 0 },
  });
});

describe('resolveHospitalScope — 访问矩阵', () => {
  it('super_admin 不传 hospitalId → 全院汇总（allActiveHospitalIds）', async () => {
    (HospitalsRepository.allActiveHospitalIds as any).mockResolvedValue([
      { id: 1 }, { id: 2 }, { id: 3 },
    ]);
    await HospitalDashboardService.getStats(10, SUPER_ADMIN, {});
    expect(HospitalsRepository.allActiveHospitalIds).toHaveBeenCalledTimes(1);
    expect(HospitalDashboardRepository.getStats).toHaveBeenCalledWith(
      [1, 2, 3], undefined, undefined,
    );
  });

  it('super_admin 传 hospitalId → 只看单院', async () => {
    await HospitalDashboardService.getStats(10, SUPER_ADMIN, { hospitalId: 7 });
    expect(HospitalsRepository.allActiveHospitalIds).not.toHaveBeenCalled();
    expect(HospitalDashboardRepository.getStats).toHaveBeenCalledWith(
      [7], undefined, undefined,
    );
  });

  it('super_admin 传 startDate/endDate → 透传到 repository', async () => {
    await HospitalDashboardService.getStats(10, SUPER_ADMIN, {
      hospitalId: 7, startDate: '2026-08-01', endDate: '2026-08-20',
    });
    expect(HospitalDashboardRepository.getStats).toHaveBeenCalledWith(
      [7], '2026-08-01', '2026-08-20',
    );
  });

  it('hospital_account 不传 hospitalId → 自动本院（单院）', async () => {
    (HospitalsRepository.accessibleHospitalIds as any).mockResolvedValue([
      { hospitalId: 3 },
    ]);
    await HospitalDashboardService.getUnviewedCount(20, HOSPITAL, {});
    expect(HospitalsRepository.accessibleHospitalIds).toHaveBeenCalledWith(20);
    expect(HospitalDashboardRepository.getUnviewedCount).toHaveBeenCalledWith([3]);
  });

  it('hospital_account 传 == 本院 → 单院', async () => {
    (HospitalsRepository.accessibleHospitalIds as any).mockResolvedValue([
      { hospitalId: 3 },
    ]);
    await HospitalDashboardService.getStats(20, HOSPITAL, { hospitalId: 3 });
    expect(HospitalDashboardRepository.getStats).toHaveBeenCalledWith(
      [3], undefined, undefined,
    );
  });

  it('hospital_account 传 != 本院 → 403', async () => {
    (HospitalsRepository.accessibleHospitalIds as any).mockResolvedValue([
      { hospitalId: 3 },
    ]);
    await expect(
      HospitalDashboardService.getStats(20, HOSPITAL, { hospitalId: 99 }),
    ).rejects.toThrow(BusinessError);
    await expect(
      HospitalDashboardService.getStats(20, HOSPITAL, { hospitalId: 99 }),
    ).rejects.toMatchObject({ code: AuthErrorCode.FORBIDDEN });
  });

  it('hospital_account 未绑定医院 → 返回空占位，不抛错', async () => {
    (HospitalsRepository.accessibleHospitalIds as any).mockResolvedValue([]);
    const result = await HospitalDashboardService.getStats(20, HOSPITAL, {});
    expect(HospitalDashboardRepository.getStats).not.toHaveBeenCalled();
    expect(result.totalCount).toBe(0);
  });

  it('非 super_admin / hospital_account 角色 → 403', async () => {
    await expect(
      HospitalDashboardService.getStats(30, ADMIN, {}),
    ).rejects.toMatchObject({ code: AuthErrorCode.FORBIDDEN });
  });
});
