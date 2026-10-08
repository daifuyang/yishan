import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

jest.mock('@public/images/login-bg.png', () => 'login-bg');
jest.mock('@public/images/login-brand.png', () => 'login-brand');
const mockLogin = jest.fn();
const mockToast = jest.fn();
jest.mock('@umijs/max', () => ({
  useIntl: () => ({ formatMessage: ({ defaultMessage }: { defaultMessage: string }) => defaultMessage }),
  useModel: () => ({ setInitialState: jest.fn() }),
  FormattedMessage: ({ defaultMessage }: { defaultMessage: string }) => defaultMessage,
}));
jest.mock('antd-style', () => ({ createStyles: () => () => ({ styles: {} }) }));
jest.mock('@/services/generated/auth', () => ({ authLogin: (...args: unknown[]) => mockLogin(...args), authGetCurrentUser: jest.fn() }));
jest.mock('antd', () => {
  const actual = jest.requireActual('antd');
  return { ...actual, App: { useApp: () => ({ message: { error: mockToast, success: jest.fn() } }) } };
});
import Login from '@/pages/user/login';

// JSDOM does not implement the task channel used by Ant Design forms.
Object.defineProperty(globalThis, 'MessageChannel', { value: class {
  port1 = { onmessage: () => {}, close: () => {} };
  port2 = { postMessage: () => setTimeout(() => this.port1.onmessage(), 0), close: () => {} };
}, configurable: true });

beforeEach(() => {
  jest.clearAllMocks();
  window.matchMedia = jest.fn().mockImplementation(() => ({ matches: false, addListener: jest.fn(), removeListener: jest.fn(), addEventListener: jest.fn(), removeEventListener: jest.fn() }));
});

it.each([
  ['HTTP 401', () => mockLogin.mockRejectedValue({ response: { status: 401, data: { success: false, message: '用户名或密码错误' } } })],
  ['失败信封', () => mockLogin.mockResolvedValue({ success: false, message: '用户名或密码错误' })],
])('%s 登录失败由表单展示一次，登录请求跳过全局错误处理', async (_label, setup) => {
  setup();
  render(React.createElement(Login));
  fireEvent.change(screen.getByPlaceholderText('用户名'), { target: { value: 'admin' } });
  fireEvent.change(screen.getByPlaceholderText('密码'), { target: { value: 'wrong-password' } });
  fireEvent.click(screen.getByRole('button', { name: '立即登录' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('用户名或密码错误'));
  expect(mockLogin).toHaveBeenCalledWith({ username: 'admin', password: 'wrong-password', rememberMe: false }, { skipErrorHandler: true });
  expect(mockToast).not.toHaveBeenCalled();
  expect(screen.getByPlaceholderText('密码')).toHaveProperty('value', 'wrong-password');
});
