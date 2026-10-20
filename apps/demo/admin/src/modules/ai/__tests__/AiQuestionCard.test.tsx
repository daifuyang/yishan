import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AiQuestionCard } from '../components/AiQuestionCard';

const mockList = jest.fn();
const mockAnswer = jest.fn();
jest.mock('../services/draftQuestionService', () => ({
  listDraftQuestions: (...args: unknown[]) => mockList(...args),
  answerDraftQuestion: (...args: unknown[]) => mockAnswer(...args),
}));
const question = {
  questionId: 'd1:3:deptIds',
  draftId: 'd1',
  draftVersion: 3,
  field: 'deptIds',
  title: '选择归属部门',
  multiple: true,
  allowEmpty: true,
  truncated: false,
  options: [
    { value: 10, label: '上海 / 销售部' },
    { value: 11, label: '北京 / 销售部' },
  ],
};
beforeEach(() => {
  jest.clearAllMocks();
  mockList.mockResolvedValue({ questions: [question] });
});

it('does not submit on history replay and preserves failed selections for an explicit retry', async () => {
  mockAnswer
    .mockRejectedValueOnce(new Error('权限已更新，请重试'))
    .mockResolvedValueOnce({ draftVersion: 4 });
  const onAnswered = jest.fn();
  render(
    <AiQuestionCard
      draftId="d1"
      conversationId="c1"
      draftVersion={3}
      onAnswered={onAnswered}
    />,
  );
  await screen.findByText('上海 / 销售部');
  expect(mockAnswer).not.toHaveBeenCalled();
  fireEvent.click(screen.getByLabelText('上海 / 销售部'));
  fireEvent.click(screen.getByRole('button', { name: '确认选择' }));
  await screen.findByText('权限已更新，请重试');
  expect(
    (screen.getByLabelText('上海 / 销售部') as HTMLInputElement).checked,
  ).toBe(true);
  mockList.mockResolvedValue({ questions: [] });
  fireEvent.click(screen.getByRole('button', { name: '确认选择' }));
  await waitFor(() => expect(onAnswered).toHaveBeenCalled());
  expect(mockAnswer).toHaveBeenLastCalledWith('d1', {
    conversationId: 'c1',
    questionId: 'd1:3:deptIds',
    draftVersion: 3,
    values: [10],
  });
  expect(
    await screen.findByText('选择已保存到草稿，请在原生表单核对后提交。'),
  ).toBeTruthy();
});

it('retains a useful load error and allows refreshing an expired question', async () => {
  mockList.mockRejectedValueOnce(new Error('问题已过期'));
  render(<AiQuestionCard draftId="d1" conversationId="c1" draftVersion={3} />);
  await screen.findByText('问题已过期');
  fireEvent.click(screen.getByRole('button', { name: '重新读取问题' }));
  expect(await screen.findByText('北京 / 销售部')).toBeTruthy();
  expect(mockAnswer).not.toHaveBeenCalled();
});
