import { getLeadWorkspaceLayout } from '../src/modules/crm/pages/leads/leadWorkspaceLayout';

describe('线索详情工作区布局', () => {
  it('在宽屏为动态工作区保留固定轨道，并让正文延伸至视口可用高度', () => {
    expect(getLeadWorkspaceLayout(true)).toEqual({
      gridTemplateColumns: 'minmax(0, 1fr) 420px',
      width: '100%',
      minHeight: 'calc(100dvh - 208px)',
      activityBorderLeft: '1px solid #eaecf0',
      activityPaddingLeft: 28,
      detailMaxWidth: 880,
    });
  });

  it('在窄屏切换为单列，移除仅桌面需要的分割线与内缩进', () => {
    expect(getLeadWorkspaceLayout(false)).toEqual({
      gridTemplateColumns: 'minmax(0, 1fr)',
      width: '100%',
      minHeight: 'auto',
      activityBorderLeft: undefined,
      activityPaddingLeft: 0,
      detailMaxWidth: 880,
    });
  });
});
