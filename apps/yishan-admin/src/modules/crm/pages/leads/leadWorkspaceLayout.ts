export const getLeadWorkspaceLayout = (isDesktop: boolean) => ({
  gridTemplateColumns: isDesktop ? 'minmax(0, 1fr) 420px' : 'minmax(0, 1fr)',
  width: '100%',
  minHeight: isDesktop ? 'calc(100dvh - 208px)' : 'auto',
  activityBorderLeft: isDesktop ? '1px solid #eaecf0' : undefined,
  activityPaddingLeft: isDesktop ? 28 : 0,
  detailMaxWidth: 880,
});
