import {
  clampLeadDrawerSize,
  getInitialLeadDrawerSize,
  MIN_LEAD_DRAWER_SIZE,
} from '../src/modules/crm/pages/leads/leadDrawerSize';

describe('线索详情抽屉初始尺寸', () => {
  it('使用视口宽度的 80%', () => {
    expect(getInitialLeadDrawerSize(1600)).toBe(1280);
  });

  it('视口小时钳到最小宽度，避免抽屉塌缩', () => {
    expect(getInitialLeadDrawerSize(400)).toBe(MIN_LEAD_DRAWER_SIZE);
  });

  it('导出最小宽度常量', () => {
    expect(MIN_LEAD_DRAWER_SIZE).toBe(1100);
  });

  it('resize 回调把低于下限的拖拽值夹回最小宽度', () => {
    expect(clampLeadDrawerSize(360)).toBe(MIN_LEAD_DRAWER_SIZE);
    expect(clampLeadDrawerSize(1100)).toBe(1100);
    expect(clampLeadDrawerSize(1280.6)).toBe(1281);
  });
});
