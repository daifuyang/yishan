import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SystemAdminProvider } from '@yishan/core-system-admin';
import { AttachmentSelect } from '@yishan/core-system-admin/components/AttachmentSelect';
import { App } from 'antd';
import React, { useState } from 'react';

jest.mock('@umijs/max', () => ({ request: jest.fn() }));
const upload = jest.fn();

function Field({
  beforeUpload,
}: {
  beforeUpload?: (file: File) => Promise<File | null>;
}) {
  const [value, setValue] =
    useState<
      import('@yishan/core-system-admin/components/AttachmentLibraryModal/types').AttachmentSelectValue
    >();
  return (
    <App>
      <SystemAdminProvider value={{ uploadAttachmentFile: upload }}>
        <AttachmentSelect
          compact
          kind="image"
          uploadText="上传头像"
          value={value}
          onChange={setValue}
          beforeUpload={beforeUpload}
        />
      </SystemAdminProvider>
    </App>
  );
}

it('uses one compact upload entry and allows replacement and removal through the existing upload service', async () => {
  upload.mockResolvedValue({ success: true, data: [{ path: '/avatar.png' }] });
  const { container } = render(<Field />);
  expect(screen.getByRole('button', { name: /上传头像/ })).toBeTruthy();
  expect(screen.queryByRole('button', { name: '选择图片' })).toBeNull();
  expect(
    container.querySelector('.ant-upload-picture-card-wrapper'),
  ).toBeNull();
  const input = container.querySelector('input[type="file"]');
  if (!input) throw new Error('Missing upload input');
  fireEvent.change(input, {
    target: {
      files: [new File(['image'], 'avatar.png', { type: 'image/png' })],
    },
  });
  expect(await screen.findByRole('button', { name: /更\s*换/ })).toBeTruthy();
  expect(container.querySelector('img')?.getAttribute('src')).toBe(
    '/avatar.png',
  );
  fireEvent.click(screen.getByRole('button', { name: /删\s*除/ }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /上传头像/ })).toBeTruthy(),
  );
  expect(container.querySelector('img')).toBeNull();
});

it('retains validation and displays upload failures without replacing the current value', async () => {
  const beforeUpload = jest.fn(async (file: File) => file);
  upload.mockResolvedValue({ success: false, message: '图片超过大小限制' });
  const { container } = render(<Field beforeUpload={beforeUpload} />);
  const input = container.querySelector('input[type="file"]');
  if (!input) throw new Error('Missing upload input');
  fireEvent.change(input, {
    target: {
      files: [new File(['image'], 'avatar.png', { type: 'image/png' })],
    },
  });
  expect(await screen.findByRole('alert')).toHaveProperty(
    'textContent',
    '图片超过大小限制',
  );
  expect(beforeUpload).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: /上传头像/ })).toBeTruthy();
  expect(container.querySelector('img')).toBeNull();
});
