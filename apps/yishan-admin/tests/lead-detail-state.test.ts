import {
  closeLeadDetail,
  openLeadDetail,
} from '../src/modules/crm/pages/leads/leadDetailState';
import type { LeadRow } from '../src/services/crm';

const lead = {
  id: 42,
  name: '王小明',
  companyName: '移山科技',
  mobile: '13800138000',
  phone: null,
  email: 'wang@example.com',
  wechat: 'wangxm-wx',
  qq: null,
  sourceId: 1,
  sourceName: '官网咨询',
  intention: '需要 CRM 方案',
  status: 'pending',
  ownerUserId: 7,
  ownerUserName: '销售一部',
  ownerDepartmentId: 3,
  createdBy: 7,
  createdByUserName: '李四',
  lastFollowUpAt: null,
  nextFollowUpAt: null,
  disqualifyReason: null,
  disqualifyCode: null,
  convertedCustomerId: null,
  convertedContactId: null,
  convertedAt: null,
  isConverted: false,
  createdAt: '2026-09-06T09:00:00.000Z',
  updatedAt: '2026-09-06T09:00:00.000Z',
} satisfies LeadRow;

describe('线索详情抽屉状态', () => {
  it('查看操作打开被点击线索的详情', () => {
    expect(openLeadDetail(lead)).toEqual(lead);
  });

  it('关闭操作清空当前详情', () => {
    expect(closeLeadDetail()).toBeNull();
  });
});
