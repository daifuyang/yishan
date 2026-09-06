import type { LeadRow } from '@/services/crm';

/** 线索详情/编辑/转移三类弹窗共用的 open/close 状态。 */
export type LeadDetailState = LeadRow | null;

/** 线索详情只由"查看"操作显式打开，避免行点击等隐式入口。 */
export const openLeadDetail = (lead: LeadRow): LeadDetailState => lead;

/** 关闭抽屉后不保留已选线索，避免下一次打开显示旧数据。 */
export const closeLeadDetail = (): LeadDetailState => null;
