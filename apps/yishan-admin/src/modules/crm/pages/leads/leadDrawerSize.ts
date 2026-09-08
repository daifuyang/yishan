/**
 * 线索详情抽屉最小宽度（像素）。
 *
 * 配合 activity 轨道固定 420px + 28px padding + 48px drawer 内边距，
 * 留出约 604px 的左侧正文给字段 Grid，每列 ~266px，长公司名/邮箱
 * 等字段不再换行，活动轨道也可观。低于此值的 resize 会被 clamp 拦下。
 */
export const MIN_LEAD_DRAWER_SIZE = 1100;

export const getInitialLeadDrawerSize = (viewportWidth: number): number => {
  const desired = Math.round(viewportWidth * 0.8);
  return Math.max(MIN_LEAD_DRAWER_SIZE, desired);
};

/**
 * Resize 回调里调用：把用户拖出来的新宽度钳制到 [MIN, ∞)。
 * antd Drawer 的 resizable 不直接支持 minWidth，这里手动 clamp。
 */
export const clampLeadDrawerSize = (next: number): number =>
  Math.max(MIN_LEAD_DRAWER_SIZE, Math.round(next));
