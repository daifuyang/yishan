import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  registerAiFormCompletion,
  registerNativeFormOperation,
} from '@yishan/core-admin/form-assistance';

// 这个仓库的 babel 链没有 TS preset，类型位置不能引用 import 绑定，
// 因此类型用 `import(...)` 内联写法。
type AiCompletionField = import('@yishan/core-admin/form-assistance').AiCompletionField;
type AiFormCompletionHandle = import('@yishan/core-admin/form-assistance').AiFormCompletionHandle;
type AiFormCompletionProps = import('@yishan/core-admin/form-assistance').AiFormCompletionProps;
import React, { forwardRef, useImperativeHandle } from 'react';
import { AiFormCompletion } from '../components/AiFormCompletion';

/**
 * 补全面板的验收契约。
 *
 * 面板独立于工具记录，但与工具记录**共享同一份草稿**。它要做的事只有一件：
 * 把还缺的字段**一次性**收齐 → 合并进草稿 → 请用户确认 → 走原有业务接口创建。
 *
 * 三条不可放宽的规则：
 *
 * 1. AI 已经填过的信息不再重复要求用户填写；
 * 2. 密码这类敏感值**不进草稿**，只随这一次提交走；
 * 3. 正式创建**只在用户确认之后**发生。
 */

const mockGetDraft = jest.fn();
const mockPatchDraft = jest.fn();
jest.mock('../services/actionDraftService', () => ({
  getActionDraft: (...args: unknown[]) => mockGetDraft(...args),
  patchActionDraft: (...args: unknown[]) => mockPatchDraft(...args),
}));

/** 补全表单收集到的值；每次校验返回它。 */
let collected: Record<string, unknown> = {};
/** 让校验失败（模拟原生表单自己的校验没过）。 */
let validateFails = false;

const FakeForm = forwardRef<AiFormCompletionHandle, AiFormCompletionProps>(
  function FakeForm(props, ref) {
    useImperativeHandle(ref, () => ({
      validate: async () => {
        if (validateFails) throw new Error('校验未通过');
        return collected;
      },
    }));
    return (
      <div>
        {props.fields.map((field: AiCompletionField) => (
          <label key={field.name}>
            {field.label}
            <input
              aria-label={field.label}
              onChange={(event) =>
                props.onChange({
                  ...props.values,
                  [field.name]: event.target.value,
                })
              }
            />
          </label>
        ))}
      </div>
    );
  },
);

const submit = jest.fn();

const draft = {
  draftId: 'draft-1', conversationId: 'c1', ownerId: 7, module: 'system',
  action: 'user.create', schemaVersion: 1,
  formData: { phone: '13800000000', realName: '张三' },
  missingFields: [],
  validationErrors: [],
  draftVersion: 2, status: 'collecting', resultRef: null, failureReason: null,
  createdAt: '2026-10-21T00:00:00.000Z', updatedAt: '2026-10-21T00:00:00.000Z',
  expiresAt: '2026-10-22T00:00:00.000Z',
  completionFields: [
    { name: 'password', label: '用户密码', required: true, sensitive: true, selector: 'password', constraints: {}, draftWritable: false, invalid: false },
    { name: 'deptIds', label: '归属部门', required: false, sensitive: false, selector: 'deptTree', constraints: {}, draftWritable: true, invalid: false },
  ],
};

let unregisterCompletion: () => void;
let unregisterOperation: () => void;

beforeEach(() => {
  jest.clearAllMocks();
  validateFails = false;
  collected = { password: 'Secret123', deptIds: [7] };
  mockGetDraft.mockResolvedValue(draft);
  mockPatchDraft.mockImplementation(async () => ({
    ...draft,
    draftVersion: 3,
    formData: { ...draft.formData, deptIds: [7] },
  }));
  submit.mockResolvedValue({ ok: true, message: '用户创建成功' });
  unregisterCompletion = registerAiFormCompletion('user.create', {
    render: FakeForm,
    submit,
  });
  unregisterOperation = registerNativeFormOperation({
    operationId: 'user.create', name: '新增用户', route: '/system/user',
    fieldLabels: {}, assistancePrompt: '',
  });
});
afterEach(() => {
  unregisterCompletion();
  unregisterOperation();
});

function renderPanel() {
  return render(<AiFormCompletion draftId="draft-1" operationId="user.create" />);
}

it('shows every missing field at once and never asks for what the AI already filled', async () => {
  renderPanel();
  expect(await screen.findByText('还需要你补全以下信息')).toBeTruthy();
  expect(screen.getByLabelText('用户密码')).toBeTruthy();
  expect(screen.getByLabelText('归属部门')).toBeTruthy();
  // AI 已经填好的字段不再出现。
  expect(screen.queryByLabelText('手机号码')).toBeNull();
  expect(screen.queryByLabelText('真实姓名')).toBeNull();
  expect(screen.queryByText('13800000000')).toBeNull();
  expect(screen.queryByText('张三')).toBeNull();
});

it('never writes the password into the draft', async () => {
  renderPanel();
  await screen.findByText('还需要你补全以下信息');
  fireEvent.click(screen.getByRole('button', { name: '完成补充' }));
  await waitFor(() => expect(mockPatchDraft).toHaveBeenCalled());
  const [, , patch] = mockPatchDraft.mock.calls[0] as unknown as [
    string, number, Record<string, unknown>,
  ];
  expect(patch).toEqual({ deptIds: [7] });
  expect(JSON.stringify(patch)).not.toContain('Secret123');
  expect(JSON.stringify(patch)).not.toContain('password');
});

it('does not call the business create API before the user confirms', async () => {
  renderPanel();
  await screen.findByText('还需要你补全以下信息');
  fireEvent.click(screen.getByRole('button', { name: '完成补充' }));
  await waitFor(() => expect(mockPatchDraft).toHaveBeenCalled());
  expect(submit).not.toHaveBeenCalled();
  expect(await screen.findByText('新增用户信息已准备好')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '确认创建' }));
  await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
});

it('sends the collected values to the business submit, including the password', async () => {
  renderPanel();
  await screen.findByText('还需要你补全以下信息');
  fireEvent.click(screen.getByRole('button', { name: '完成补充' }));
  await waitFor(() => expect(mockPatchDraft).toHaveBeenCalled());
  fireEvent.click(screen.getByRole('button', { name: '确认创建' }));
  await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
  const [submission] = submit.mock.calls[0] as unknown as [{ values: Record<string, unknown> }];
  expect(submission.values.phone).toBe('13800000000');
  expect(submission.values.password).toBe('Secret123');
});

it('blocks the submission when the native validation fails', async () => {
  validateFails = true;
  renderPanel();
  await screen.findByText('还需要你补全以下信息');
  fireEvent.click(screen.getByRole('button', { name: '完成补充' }));
  await waitFor(() => expect(mockPatchDraft).not.toHaveBeenCalled());
  expect(submit).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: '确认创建' })).toBeNull();
});

it('keeps editing when the server reports fields that need correction', async () => {
  mockPatchDraft.mockResolvedValue({
    ...draft,
    draftVersion: 3,
    validationErrors: [{ field: 'deptIds', label: '归属部门', code: 'required', message: '请选择归属部门' }],
  });
  renderPanel();
  await screen.findByText('还需要你补全以下信息');
  fireEvent.click(screen.getByRole('button', { name: '完成补充' }));
  expect(await screen.findByText(/请选择归属部门/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: '确认创建' })).toBeNull();
  expect(submit).not.toHaveBeenCalled();
});

it('goes straight to the confirmation when nothing is missing', async () => {
  mockGetDraft.mockResolvedValue({ ...draft, completionFields: [] });
  renderPanel();
  expect(await screen.findByText('新增用户信息已准备好')).toBeTruthy();
  expect(screen.queryByText('还需要你补全以下信息')).toBeNull();
  expect(screen.queryByRole('button', { name: '完成补充' })).toBeNull();
  expect(submit).not.toHaveBeenCalled();
});

it('guards against duplicate submissions', async () => {
  mockGetDraft.mockResolvedValue({ ...draft, completionFields: [] });
  renderPanel();
  const button = await screen.findByRole('button', { name: '确认创建' });
  fireEvent.click(button);
  fireEvent.click(button);
  await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
});

it('reports the business outcome only after the API confirms', async () => {
  mockGetDraft.mockResolvedValue({ ...draft, completionFields: [] });
  renderPanel();
  fireEvent.click(await screen.findByRole('button', { name: '确认创建' }));
  expect(await screen.findByText('用户创建成功')).toBeTruthy();
});

it('does not present a closed draft as editable', async () => {
  mockGetDraft.mockResolvedValue({ ...draft, status: 'completed' });
  renderPanel();
  expect(await screen.findByText('这份草稿已经结束，不能再补全或提交')).toBeTruthy();
  expect(screen.queryByRole('button', { name: '完成补充' })).toBeNull();
  expect(submit).not.toHaveBeenCalled();
});

it('does not execute any tool from the completion panel', async () => {
  renderPanel();
  await screen.findByText('还需要你补全以下信息');
  expect(mockGetDraft).toHaveBeenCalledTimes(1);
  expect(mockPatchDraft).not.toHaveBeenCalled();
  expect(submit).not.toHaveBeenCalled();
});
