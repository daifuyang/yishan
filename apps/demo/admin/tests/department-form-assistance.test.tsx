import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { SystemAdminProvider } from '@yishan/core-system-admin';
import {
  clearUserCreateFormHandle,
  peekUserCreateFormHandle,
  registerUserCreateDraftLink,
} from '@yishan/core-system-admin/form-assistance';
import DepartmentList from '@yishan/core-system-admin/pages/department';
import React from 'react';
const mockRequest = jest.fn();
jest.mock('@umijs/max', () => ({
  request: (...args: unknown[]) => mockRequest(...args),
}));
beforeEach(() => {
  clearUserCreateFormHandle();
  mockRequest
    .mockReset()
    .mockImplementation(async (url: string) => ({
      success: true,
      data: url.includes('tree') ? [] : { id: 77 },
    }));
});
function mount() {
  return render(
    <SystemAdminProvider
      value={{
        currentUser: { id: 1 } as never,
        dictDataMap: { default_status: [{ label: '启用', value: '1' }] },
      }}
    >
      <DepartmentList />
    </SystemAdminProvider>,
  );
}
it('部门复用原生表单增量填写，保护手改字段且仅人工提交原API', async () => {
  mount();
  await waitFor(() =>
    expect(peekUserCreateFormHandle('department.create')).not.toBeNull(),
  );
  const handle = peekUserCreateFormHandle('department.create')!;
  await act(async () => {
    await handle.open();
  });
  const apply = async (fields: Record<string, string | number>) => {
    const snapshot = handle.snapshot();
    let result: unknown;
    await act(async () => {
      result = await handle.apply({
        instanceId: snapshot.instanceId,
        baseRevision: snapshot.revision,
        fields,
      });
    });
    return result;
  };
  expect(await apply({ name: '研发部', sort_order: 3 })).toMatchObject({
    applied: true,
  });
  expect(
    ((await screen.findByPlaceholderText('请输入部门名称')) as HTMLInputElement)
      .value,
  ).toBe('研发部');
  expect(
    mockRequest.mock.calls.some((call) => call[1]?.method === 'POST'),
  ).toBe(false);
  fireEvent.change(screen.getByPlaceholderText('请输入部门名称'), {
    target: { value: '人工名称' },
  });
  expect(await apply({ name: '旧模型名称' })).toMatchObject({
    applied: false,
    conflicts: ['name'],
  });
  expect(await apply({ description: '第二轮' })).toMatchObject({
    applied: true,
  });
  const unlink = registerUserCreateDraftLink(
    {
      prepare: async () => ({ draftId: 'dept-draft', draftVersion: 4 }),
      reconcile: async () => 'unknown',
    },
    'department.create',
  );
  fireEvent.click(screen.getByRole('button', { name: /确 定|确定/ }));
  await waitFor(() =>
    expect(
      mockRequest.mock.calls.some((call) => call[1]?.method === 'POST'),
    ).toBe(true),
  );
  const posted = mockRequest.mock.calls.find(
    (call) => call[1]?.method === 'POST',
  )!;
  expect(posted[1].data).toMatchObject({
    name: '人工名称',
    sort_order: 3,
    description: '第二轮',
    draftSubmission: { draftId: 'dept-draft', draftVersion: 4 },
  });
  unlink();
});

const resizeObserverDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  'ResizeObserver',
);
const messageChannelDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  'MessageChannel',
);
const nativeGetComputedStyle = window.getComputedStyle;

beforeAll(() => {
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    value: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  });
  // rc-field-form 用 MessageChannel 派发校验通知，jsdom 没有。
  Object.defineProperty(globalThis, 'MessageChannel', {
    configurable: true,
    value: class {
      port1: { onmessage?: (event: { data: unknown }) => void } = {};
      port2 = {
        postMessage: (data: unknown) =>
          setTimeout(() => this.port1.onmessage?.({ data }), 0),
      };
    },
  });
  // jsdom 没有伪元素布局；表格只量滚动条宽度。
  jest
    .spyOn(window, 'getComputedStyle')
    .mockImplementation((element) => nativeGetComputedStyle(element));
});

afterAll(() => {
  jest.restoreAllMocks();
  if (resizeObserverDescriptor) {
    Object.defineProperty(
      globalThis,
      'ResizeObserver',
      resizeObserverDescriptor,
    );
  } else {
    Reflect.deleteProperty(globalThis, 'ResizeObserver');
  }
  if (messageChannelDescriptor) {
    Object.defineProperty(
      globalThis,
      'MessageChannel',
      messageChannelDescriptor,
    );
  } else {
    Reflect.deleteProperty(globalThis, 'MessageChannel');
  }
});
