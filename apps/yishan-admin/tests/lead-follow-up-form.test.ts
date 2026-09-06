import dayjs from 'dayjs';
import { toLeadActivityInput } from '../src/modules/crm/pages/leads/leadFollowUpForm';

describe('写跟进弹窗表单', () => {
  it('提交时整理内容并保留所选的下次跟进时间', () => {
    expect(
      toLeadActivityInput({
        type: 'phone',
        content: '  客户确认下周演示  ',
        nextFollowUpAt: dayjs('2026-09-10T10:00:00.000Z'),
      }),
    ).toEqual({
      type: 'phone',
      content: '客户确认下周演示',
      nextFollowUpAt: '2026-09-10T10:00:00.000Z',
    });
  });
});
