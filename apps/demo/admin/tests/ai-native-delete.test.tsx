import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { SystemAdminProvider } from '@yishan/core-system-admin';
import UserList from '@yishan/core-system-admin/pages/user';
import {
  clearAiPrefill,
  setAiPrefill,
  subscribeAiPrefillResults,
} from '@yishan/core-system-admin/ai-prefill';
const mockRequest = jest.fn();
jest.mock('@umijs/max', () => ({
  request: (...args: unknown[]) => mockRequest(...args),
}));
const nativeGetComputedStyle = window.getComputedStyle;
const row = {
  id: 7,
  username: 'target',
  realName: '待删除用户',
  phone: '13800000007',
  status: '1',
  gender: '0',
  deptIds: [],
  roleIds: [],
};
beforeAll(() => {
  jest
    .spyOn(window, 'getComputedStyle')
    .mockImplementation((element) => nativeGetComputedStyle(element));
  Object.defineProperty(global, 'ResizeObserver', {
    configurable: true,
    value: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  });
  Object.defineProperty(global, 'MessageChannel', {
    configurable: true,
    value: class {
      port1: { onmessage?: () => void } = {};
      port2 = {
        postMessage: () => {
          setTimeout(() => this.port1.onmessage?.(), 0);
        },
      };
    },
  });
});
beforeEach(() => {
  mockRequest.mockReset();
  clearAiPrefill();
  mockRequest.mockImplementation(
    async (url: string, options?: { method?: string }) => {
      if (options?.method === 'DELETE')
        return { success: true, message: '删除成功' };
      if (/\/users\/7$/.test(url)) return { success: true, data: row };
      if (/\/users\/?$/.test(url))
        return { success: true, data: [row], pagination: { total: 1 } };
      if (url.includes('create-form'))
        return {
          success: true,
          data: {
            fields: [],
            editableFields: [],
            defaults: {},
            missingFields: [],
          },
        };
      return { success: true, data: [] };
    },
  );
});
afterEach(clearAiPrefill);
function renderPage() {
  return render(
    <SystemAdminProvider
      value={{ currentUser: { id: 1, username: 'admin' } as never }}
    >
      <UserList />
    </SystemAdminProvider>,
  );
}
const deletes = () =>
  mockRequest.mock.calls.filter(([, options]) => options?.method === 'DELETE');
it('opens native confirmation and never deletes when the user cancels', async () => {
  renderPage();
  act(() =>
    setAiPrefill({
      target: 'user.delete',
      fields: { id: 7 },
      missing: [],
      requestId: 'delete-1',
    }),
  );
  await screen.findByRole('button', { name: '确认删除' });
  expect(deletes()).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: /取\s*消/ }));
  expect(deletes()).toHaveLength(0);
});
it('only calls the existing delete endpoint after explicit confirmation and reports its real result', async () => {
  const result = jest.fn();
  const unsubscribe = subscribeAiPrefillResults(result);
  try {
    renderPage();
    act(() =>
      setAiPrefill({
        target: 'user.delete',
        fields: { id: 7 },
        missing: [],
        requestId: 'delete-2',
      }),
    );
    await screen.findByRole('button', { name: '确认删除' });
    expect(deletes()).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: '确认删除' }));
    await waitFor(() => expect(deletes()).toHaveLength(1));
    await waitFor(() =>
      expect(result).toHaveBeenCalledWith(
        expect.objectContaining({ requestId: 'delete-2', status: 'completed' }),
      ),
    );
    expect(deletes()[0][0]).toMatch(/\/users\/7$/);
  } finally {
    unsubscribe();
  }
});
