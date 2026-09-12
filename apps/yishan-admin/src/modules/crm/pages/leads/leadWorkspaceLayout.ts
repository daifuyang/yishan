/**
 * 线索详情抽屉内部的工作区布局常量。
 *
 * 这个文件只保留 lead 特有的布局（420px 活动轨道 + 详情栏）。
 * 通用部分（z-index、resize、close button 等）见
 * `apps/yishan-admin/src/modules/crm/components/drawer/_shared/`。
 */
export const getLeadWorkspaceLayout = (isDesktop: boolean) => ({
  gridTemplateColumns: isDesktop ? 'minmax(0, 1fr) 420px' : 'minmax(0, 1fr)',
  width: '100%',
  minHeight: isDesktop ? 'calc(100dvh - 208px)' : 'auto',
  activityBorderLeft: isDesktop ? '1px solid #eaecf0' : undefined,
  activityPaddingLeft: isDesktop ? 28 : 0,
  detailMaxWidth: 880,
});
