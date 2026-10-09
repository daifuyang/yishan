import React from 'react';
import { render, screen } from '@testing-library/react';
import { SystemAdminProvider, useSystemAdmin } from '@yishan/core-system-admin';
import RegionList from '@yishan/core-system-admin/pages/region';

jest.mock('@umijs/max', () => ({
  request: async () => ({
    success: true,
    data: [{ code: 110000, name: '北京市', level: 1, parentCode: 0, sortOrder: 0 }],
  }),
}));

const resizeObserverDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'ResizeObserver');
const messageChannelDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'MessageChannel');
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
  Object.defineProperty(globalThis, 'MessageChannel', {
    configurable: true,
    value: class {
      port1: { onmessage?: (event: { data: unknown }) => void } = {};
      port2 = {
        postMessage: (data: unknown) => setTimeout(() => this.port1.onmessage?.({ data }), 0),
      };
    },
  });
  // jsdom has no pseudo-element layout; the table measures only scrollbar width.
  jest.spyOn(window, 'getComputedStyle').mockImplementation((element) => nativeGetComputedStyle(element));
});

afterAll(() => {
  jest.restoreAllMocks();
  if (resizeObserverDescriptor) Object.defineProperty(globalThis, 'ResizeObserver', resizeObserverDescriptor);
  else Reflect.deleteProperty(globalThis, 'ResizeObserver');
  if (messageChannelDescriptor) Object.defineProperty(globalThis, 'MessageChannel', messageChannelDescriptor);
  else Reflect.deleteProperty(globalThis, 'MessageChannel');
});

function StatusLabel() {
  const { initialState } = useSystemAdmin();
  return <span>{initialState.dictDataMap?.default_status?.[0]?.label}</span>;
}

test('System components receive dictionary changes from the product runtime', () => {
  const view = render(
    <SystemAdminProvider value={{ dictDataMap: { default_status: [{ label: '启用', value: '1' }] } }}>
      <StatusLabel />
    </SystemAdminProvider>,
  );
  expect(screen.getByText('启用')).toBeTruthy();
  view.rerender(
    <SystemAdminProvider value={{ dictDataMap: { default_status: [{ label: '禁用', value: '0' }] } }}>
      <StatusLabel />
    </SystemAdminProvider>,
  );
  expect(screen.getByText('禁用')).toBeTruthy();
});

test('a real System page loads through the public package export and displays service data', async () => {
  render(<RegionList />);
  expect(await screen.findByText('北京市')).toBeTruthy();
});
