import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { AiFormCompletion } from '../components/AiFormCompletion';
import { AiFormAssistanceContext } from '../context/formAssistance';

const mockGetDraft = jest.fn();
const mockSubmit = jest.fn();
const mockPatchDraft = jest.fn();
jest.mock('../services/actionDraftService', () => ({
  getActionDraft: (...args: unknown[]) => mockGetDraft(...args),
  patchActionDraft: (...args: unknown[]) => mockPatchDraft(...args),
}));
jest.mock('@yishan/core-admin/form-assistance', () => ({
  peekNativeFormOperation: () => ({ name: '新增用户' }),
  peekAiFormCompletion: () => ({
    render: () => <input aria-label="用户密码" />,
    submit: mockSubmit,
  }),
}));
const draft = {
  draftId: 'draft-1',
  draftVersion: 2,
  status: 'ready',
  formData: { phone: '13800000000', realName: '张三' },
  missingFields: [
    {
      name: 'password',
      label: '初始密码',
      required: true,
      sensitive: true,
      mustCompleteInForm: true,
    },
  ],
  completionFields: [],
  validationErrors: [],
};
const requestRestore = jest.fn();
function renderPanel(outcomes = {}) {
  return render(
    <AiFormAssistanceContext.Provider
      value={{
        identityEpoch: 1,
        outcomes,
        requestRestore,
        setOutcome: jest.fn(),
        bindHandlers: jest.fn(),
        flush: jest.fn(),
      }}
    >
      <AiFormCompletion draftId="draft-1" operationId="user.create" />
    </AiFormAssistanceContext.Provider>,
  );
}
beforeEach(() => {
  jest.clearAllMocks();
  mockGetDraft.mockResolvedValue(draft);
});
it('hands off to the existing native form without a second editor or create action', async () => {
  renderPanel();
  const button = await screen.findByRole('button', { name: '继续填写表单' });
  expect(screen.queryByRole('button', { name: '确认创建' })).toBeNull();
  expect(screen.queryByLabelText('用户密码')).toBeNull();
  fireEvent.click(button);
  expect(requestRestore).toHaveBeenCalledWith('draft-1');
  expect(mockSubmit).not.toHaveBeenCalled();
  expect(mockPatchDraft).not.toHaveBeenCalled();
});
it('does not treat empty completion fields as permission to create', async () => {
  renderPanel();
  expect(await screen.findByText(/初始密码/)).toBeTruthy();
  expect(screen.queryByText(/信息已准备好/)).toBeNull();
  expect(mockSubmit).not.toHaveBeenCalled();
});
it('shows the actual native submission outcome without another submit button', async () => {
  renderPanel({ 'draft-1': { status: 'completed', message: '用户创建成功' } });
  expect(await screen.findByText('用户创建成功')).toBeTruthy();
  await waitFor(() => expect(mockGetDraft).toHaveBeenCalled());
  expect(screen.queryByRole('button', { name: '继续填写表单' })).toBeNull();
});
it('does not resume an ended draft', async () => {
  mockGetDraft.mockResolvedValue({ ...draft, status: 'expired' });
  renderPanel();
  expect(await screen.findByText(/草稿已结束/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: '继续填写表单' })).toBeNull();
});
it('shows read failures and permits a read-only retry', async () => {
  mockGetDraft.mockRejectedValueOnce(new Error('读取失败'));
  renderPanel();
  expect(await screen.findByText('读取失败')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '重新读取' }));
  expect(
    await screen.findByRole('button', { name: '继续填写表单' }),
  ).toBeTruthy();
  expect(mockSubmit).not.toHaveBeenCalled();
});
it('allows read-only reconciliation while submitting and ignores stale failure text after success', async () => {
  mockGetDraft
    .mockResolvedValueOnce({ ...draft, status: 'submitting' })
    .mockResolvedValueOnce({ ...draft, status: 'completed' });
  renderPanel({ 'draft-1': { status: 'failed', message: '上次请求失败' } });
  fireEvent.click(await screen.findByRole('button', { name: '核对提交结果' }));
  expect(await screen.findByText('新增用户已创建')).toBeTruthy();
  expect(screen.queryByText('上次请求失败')).toBeNull();
  expect(mockSubmit).not.toHaveBeenCalled();
});
