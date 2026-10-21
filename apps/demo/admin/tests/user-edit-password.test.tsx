import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Form, Button } from 'antd';
import React from 'react';
import { UserCreateFields } from '@yishan/core-system-admin/pages/user/components/UserCreateFields';
jest.mock('@umijs/max', () => ({ request: jest.fn() }));
const channelDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  'MessageChannel',
);
beforeAll(() => {
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
});
afterAll(() => {
  if (channelDescriptor)
    Object.defineProperty(globalThis, 'MessageChannel', channelDescriptor);
  else Reflect.deleteProperty(globalThis, 'MessageChannel');
});
it('keeps the minimum password length when editing without AI form metadata', async () => {
  const save = jest.fn();
  render(
    <Form onFinish={save}>
      <UserCreateFields
        definition={null}
        only={['password']}
        isEdit
        genderOptions={[]}
        statusOptions={[]}
        roleRequest={async () => []}
      />
      <Button htmlType="submit">保存</Button>
    </Form>,
  );
  fireEvent.change(screen.getByPlaceholderText('不输入则保持原密码'), {
    target: { value: '123' },
  });
  fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }));
  expect(await screen.findByText('至少6位')).toBeTruthy();
  expect(save).not.toHaveBeenCalled();
  fireEvent.change(screen.getByPlaceholderText('不输入则保持原密码'), {
    target: { value: '' },
  });
  fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
});
