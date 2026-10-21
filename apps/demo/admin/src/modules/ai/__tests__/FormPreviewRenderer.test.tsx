import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { registerNativeFormOperation } from '@yishan/core-admin/form-assistance';
import { clearAiPrefill, peekAiPrefill } from '@yishan/core-system-admin/ai-prefill';
import { AiFormAssistanceContext } from '../context/formAssistance';
import { FormPreviewRenderer } from '../tools/renderers/FormPreviewRenderer';

// 这个仓库的 babel 链没有 TS preset，类型位置不能引用 import 绑定，
// 因此类型用 `import(...)` 内联写法。
type FormPreviewData = import('../tools/model').FormPreviewData;

const mockRead = jest.fn();
const mockPatch = jest.fn();
const mockPush = jest.fn();
jest.mock('../services/actionDraftService', () => ({
  getActionDraft: (...args: unknown[]) => mockRead(...args),
  patchActionDraft: (...args: unknown[]) => mockPatch(...args),
}));
jest.mock('@umijs/max', () => ({ history: { push: (...args: unknown[]) => mockPush(...args) } }));

const draft = {
  draftId: 'draft-1', conversationId: 'conversation-1', action: 'user.create',
  draftVersion: 4, status: 'collecting',
  formData: { realName: '服务器姓名', nickname: '', password: 'never-display', accessToken: 'secret-token' },
  missingFields: [
    { name: 'phone', label: '手机号码', required: true, sensitive: false, mustCompleteInForm: false },
    { name: 'nickname', label: '昵称', required: false, sensitive: false, mustCompleteInForm: false },
    { name: 'password', label: '密码', required: true, sensitive: true, mustCompleteInForm: true },
  ],
  validationErrors: [{ field: 'phone', label: '手机号码', message: '格式不正确', code: 'format' }],
};
const preview: FormPreviewData = {
  mode: 'draft', operationId: 'user.create', draftId: 'draft-1', draftVersion: 1,
  status: 'collecting', fields: { realName: '历史姓名' }, collectedFields: ['realName'],
  fieldDefinitions: [
    { name: 'realName', label: '真实姓名', required: true, sensitive: false },
    { name: 'nickname', label: '昵称', required: false, sensitive: false },
    { name: 'phone', label: '手机号码', required: true, sensitive: false },
    { name: 'password', label: '密码', required: true, sensitive: true },
  ],
  missingFields: [], validationErrors: [],
};
function tool(data: FormPreviewData = preview) {
  return {
    id: 'tool-1', toolName: 'form.draft', operationId: data.operationId,
    title: '创建用户', subtitle: '', status: 'success' as const, resultSummary: '', summary: [],
    empty: false, presentation: { type: 'form-preview' as const, data }, details: {},
  };
}
function assistance() {
  return {
    identityEpoch: 1, outcomes: {}, setOutcome: jest.fn(), bindHandlers: () => () => {},
    requestRestore: jest.fn(), requestPrefill: jest.fn(), flush: jest.fn(async () => {}),
  };
}
beforeEach(() => { jest.clearAllMocks(); mockRead.mockResolvedValue(draft); });
afterEach(() => { clearAiPrefill(); });

it('reduces a draft record to one natural-Chinese line', async () => {
  const assist = assistance();
  render(<AiFormAssistanceContext.Provider value={assist}><FormPreviewRenderer tool={tool()} /></AiFormAssistanceContext.Provider>);
  // 默认收起：展开后才有一行自然中文说明。
  expect(screen.queryByText('已将提供的信息填入表单草稿')).toBeNull();
  fireEvent.click(screen.getByText('创建用户'));
  expect(await screen.findByText('已将提供的信息填入表单草稿')).toBeTruthy();
  // 工具记录里不再重复已填字段，也不再出现表单控件。
  expect(screen.queryByText('服务器姓名')).toBeNull();
  expect(screen.queryByText('历史姓名')).toBeNull();
  expect(screen.queryByText('真实姓名（必填）')).toBeNull();
  expect(screen.queryByRole('textbox')).toBeNull();
});

it('never exposes the draft values, the field definitions or the raw JSON', async () => {
  const assist = assistance();
  render(<AiFormAssistanceContext.Provider value={assist}><FormPreviewRenderer tool={tool()} /></AiFormAssistanceContext.Provider>);
  fireEvent.click(screen.getByText('创建用户'));
  await screen.findByText('已将提供的信息填入表单草稿');
  expect(screen.queryByText(/never-display/)).toBeNull();
  expect(screen.queryByText(/secret-token/)).toBeNull();
  expect(screen.queryByText(/mustCompleteInForm/)).toBeNull();
  expect(screen.queryByText(/missingFields/)).toBeNull();
  expect(screen.queryByText(/formData/)).toBeNull();
});

it('offers no inline completion entry on the draft record', async () => {
  const assist = assistance();
  render(<AiFormAssistanceContext.Provider value={assist}><FormPreviewRenderer tool={tool()} /></AiFormAssistanceContext.Provider>);
  fireEvent.click(screen.getByText('创建用户'));
  await screen.findByText('已将提供的信息填入表单草稿');
  expect(screen.queryByRole('button', { name: '继续填写' })).toBeNull();
  expect(screen.queryByRole('button', { name: /填写/ })).toBeNull();
  expect(assist.requestRestore).not.toHaveBeenCalled();
  expect(assist.flush).not.toHaveBeenCalled();
  expect(mockPatch).not.toHaveBeenCalled();
});

it('reports a failed draft run instead of claiming the draft was filled', async () => {
  const assist = assistance();
  const failed = {
    ...tool(),
    status: 'error' as const,
    details: { error: { message: '草稿写入失败' } },
  };
  render(<AiFormAssistanceContext.Provider value={assist}><FormPreviewRenderer tool={failed} /></AiFormAssistanceContext.Provider>);
  expect(await screen.findByText('草稿写入失败')).toBeTruthy();
  expect(screen.queryByText('已将提供的信息填入表单草稿')).toBeNull();
});

it('uses native field labels when schema is absent and keeps prefill routes on the local whitelist', () => {
  const unregister = registerNativeFormOperation({ operationId: 'department.create', route: '/system/department', fieldLabels: { name: '部门名称' }, assistancePrompt: '' });
  render(<FormPreviewRenderer tool={tool({ ...preview, mode: 'prefill', operationId: 'department.create', draftId: undefined, fieldDefinitions: [], fields: { name: '研发部' } })} />);
  expect(screen.getByText('部门名称')).toBeTruthy();
  expect(mockPush).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '打开表单核对并提交' }));
  expect(mockPush).toHaveBeenCalledWith('/system/department');
  expect(peekAiPrefill()?.fields).toEqual({ name: '研发部' });
  unregister();
});

it('does not navigate for an unrecognized prefill operation', () => {
  render(<FormPreviewRenderer tool={tool({ ...preview, mode: 'prefill', operationId: 'https://untrusted.test' })} />);
  expect(screen.queryByRole('button', { name: '打开表单核对并提交' })).toBeNull();
});
