import { canAssignPoolLead } from '../src/modules/crm/pages/lead-pool/leadPoolAccess';
import { getLeadAssignmentDialogCopy } from '../src/modules/crm/pages/leads/leadAssignmentDialog';

describe('线索公海操作权限', () => {
  it.each([
    ['super_admin'],
    ['admin'],
    ['sales_lead'],
  ])('允许 %s 在公海分配线索', (roleCode) => {
    expect(canAssignPoolLead([roleCode])).toBe(true);
  });

  it('不向普通销售显示分配入口', () => {
    expect(canAssignPoolLead(['sales'])).toBe(false);
  });

  it('为公海分配使用分配语义而非转移语义', () => {
    expect(getLeadAssignmentDialogCopy('assign')).toEqual({
      title: '分配线索',
      submitText: '确认分配',
      targetLabel: '分配给',
      targetPlaceholder: '请选择负责人',
      requiredMessage: '请选择负责人',
      successMessage: '线索已分配',
    });
  });
});
