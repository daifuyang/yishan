import {
  clampDrawerSize,
  getInitialDrawerSize,
  MIN_DRAWER_SIZE,
} from '../src/modules/crm/components/drawer/_shared/useResizableDrawer';

describe('CRM 抽屉初始尺寸', () => {
  it('使用视口宽度的 80%', () => {
    expect(getInitialDrawerSize(1600)).toBe(1280);
  });

  it('视口小时钳到最小宽度，避免抽屉塌缩', () => {
    expect(getInitialDrawerSize(400)).toBe(MIN_DRAWER_SIZE);
  });

  it('导出最小宽度常量', () => {
    expect(MIN_DRAWER_SIZE).toBe(1100);
  });

  it('resize 回调把低于下限的拖拽值夹回最小宽度', () => {
    expect(clampDrawerSize(360)).toBe(MIN_DRAWER_SIZE);
    expect(clampDrawerSize(1100)).toBe(1100);
    expect(clampDrawerSize(1280.6)).toBe(1281);
  });
});
