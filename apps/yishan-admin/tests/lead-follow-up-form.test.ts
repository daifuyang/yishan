import dayjs from 'dayjs';
import { toLeadActivityInput } from '../src/modules/crm/pages/leads/leadFollowUpForm';

describe('写跟进弹窗表单', () => {
  it('提交时整理内容，并把选择的跟进状态传给接口', () => {
    expect(
      toLeadActivityInput({
        type: 'phone',
        content: '  客户确认下周演示  ',
        followUpStatus: 'contact_valid',
        nextFollowUpAt: dayjs('2026-09-10T10:00:00.000Z'),
      }),
    ).toEqual({
      type: 'phone',
      content: '客户确认下周演示',
      followUpStatus: 'contact_valid',
      nextFollowUpAt: '2026-09-10T10:00:00.000Z',
    });
  });
});
