import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import React from 'react';

const mockGet = jest.fn();
const mockSave = jest.fn();
const mockTest = jest.fn();
let mockCanUpdate = true;
let mockCanRead = true;
jest.mock('@/services/generated/ai', () => ({
  aiSettingsGet: (...args: unknown[]) => mockGet(...args),
  aiSettingsSave: (...args: unknown[]) => mockSave(...args),
  aiSettingsTest: (...args: unknown[]) => mockTest(...args),
}));
jest.mock('@/utils/permission', () => ({
  usePermission: () => (code: string) =>
    code.endsWith(':read') ? mockCanRead : mockCanUpdate,
}));
jest.mock('@ant-design/pro-components', () => {
  const actual = jest.requireActual('@ant-design/pro-components');
  return {
    ...actual,
    PageContainer: ({ children }: { children: import('react').ReactNode }) => (
      <div>{children}</div>
    ),
  };
});

import Settings from '../src/modules/ai/pages/settings';

const messageChannelDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  'MessageChannel',
);
beforeAll(() => {
  Object.defineProperty(globalThis, 'MessageChannel', {
    configurable: true,
    value: class {
      port1 = { onmessage: null as (() => void) | null, close() {} };
      port2 = {
        postMessage: () => {
          setTimeout(() => this.port1.onmessage?.(), 0);
        },
        close() {},
      };
    },
  });
});
afterAll(() => {
  if (messageChannelDescriptor)
    Object.defineProperty(
      globalThis,
      'MessageChannel',
      messageChannelDescriptor,
    );
  else Reflect.deleteProperty(globalThis, 'MessageChannel');
});

const saved = {
  baseUrl: 'https://gateway.example/v1',
  model: 'claude-model',
  hasApiKey: true,
  source: 'database',
};
beforeEach(() => {
  jest.clearAllMocks();
  mockCanUpdate = true;
  mockCanRead = true;
  mockGet.mockResolvedValue({ success: true, data: saved });
  mockSave.mockResolvedValue({ success: true, data: saved });
  mockTest.mockResolvedValue({
    success: true,
    data: { ok: true, message: '连接成功' },
  });
});

test('loads only key status and retains existing key on a blank save', async () => {
  render(<Settings />);
  await screen.findByDisplayValue('claude-model');
  expect(screen.queryByRole('switch')).toBeNull();
  expect((screen.getByLabelText('API Key') as HTMLInputElement).value).toBe('');
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: '保存设置' }));
  });
  await waitFor(() =>
    expect(mockSave).toHaveBeenCalledWith({
      baseUrl: 'https://gateway.example/v1',
      model: 'claude-model',
    }),
  );
});

test('keeps entered key after failure and clears it only after successful save', async () => {
  mockSave.mockRejectedValueOnce(new Error('upstream secret'));
  render(<Settings />);
  await screen.findByDisplayValue('claude-model');
  const key = screen.getByLabelText('API Key') as HTMLInputElement;
  await act(async () => {
    fireEvent.change(key, { target: { value: 'new-secret' } });
  });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: '保存设置' }));
  });
  await screen.findByText('保存失败，请重试');
  expect(key.value).toBe('new-secret');
  expect(screen.queryByText('upstream secret')).toBeNull();
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: '保存设置' }));
  });
  await waitFor(() => expect(key.value).toBe(''));
});

test('requires a new key on first database save even when environment has a key', async () => {
  mockGet.mockResolvedValueOnce({
    success: true,
    data: { ...saved, source: 'environment' },
  });
  render(<Settings />);
  await screen.findByDisplayValue('claude-model');
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: '保存设置' }));
  });
  await screen.findByText('首次保存请输入 API Key');
  expect(mockSave).not.toHaveBeenCalled();
});

test('tests saved configuration only and blocks tests while edits are unsaved', async () => {
  render(<Settings />);
  await screen.findByDisplayValue('claude-model');
  const button = screen.getByRole('button', {
    name: '测试已保存配置',
  }) as HTMLButtonElement;
  await act(async () => {
    fireEvent.click(button);
  });
  await waitFor(() => expect(mockTest).toHaveBeenCalledWith());
  await act(async () => {
    fireEvent.change(screen.getByLabelText('模型名称'), {
      target: { value: 'other-model' },
    });
  });
  expect(button.disabled).toBe(true);
});

test('blocks saving after load failure', async () => {
  mockGet.mockRejectedValueOnce(new Error('load failure'));
  render(<Settings />);
  await screen.findByText('加载设置失败，请刷新页面重试');
  expect(
    (screen.getByRole('button', { name: '保存设置' }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
});

test('read-only users see configuration without mutation actions', async () => {
  mockCanUpdate = false;
  render(<Settings />);
  await screen.findByDisplayValue('claude-model');
  expect(screen.queryByRole('button', { name: '保存设置' })).toBeNull();
  expect(screen.queryByRole('button', { name: '测试已保存配置' })).toBeNull();
});

test('users without read permission cannot load settings', async () => {
  mockCanRead = false;
  render(<Settings />);
  await screen.findByText('无权查看 AI 设置');
  expect(mockGet).not.toHaveBeenCalled();
  expect(screen.queryByLabelText('API Key')).toBeNull();
});
