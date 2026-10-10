import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { checkPermission } from '@yishan/core-admin/permission';

const mockSetInitialState = jest.fn();
jest.mock('@umijs/max', () => ({
  useIntl: () => ({ formatMessage: ({ defaultMessage }: { defaultMessage: string }) => defaultMessage }),
  useModel: () => ({ initialState: { currentUser: { id: 1, permissions: [] } }, setInitialState: mockSetInitialState }),
}));
jest.mock('antd-style', () => ({ createStyles: () => () => ({ styles: {} }) }));
jest.mock('antd', () => {
  const Container = ({ children }: { children?: import('react').ReactNode }) => <div>{children}</div>;
  return {
    Avatar: Container, Col: Container, Row: Container, Space: Container, Spin: Container, Tag: Container,
    Card: Object.assign(Container, { Meta: () => null }),
    Descriptions: Object.assign(Container, { Item: Container }),
  };
});
jest.mock('@ant-design/pro-components', () => ({
  PageContainer: ({ children }: { children?: import('react').ReactNode }) => <div>{children}</div>,
  GridContent: ({ children }: { children?: import('react').ReactNode }) => <div>{children}</div>,
}));
jest.mock('@yishan/core-system-admin/services/auth', () => ({
  authGetCurrentUser: async () => ({ success: true, data: { id: 1, username: 'reader' } }),
}));
jest.mock('../src/pages/account/center/components/SecurityPanel', () => ({ SecurityPanel: () => null }));
jest.mock('../src/pages/account/center/components/ApiTokenPanel', () => ({ ApiTokenPanel: () => null }));
jest.mock('../src/pages/account/center/components/ProfilePanel', () => ({
  ProfilePanel: ({ onSaved }: { onSaved: (user: { id: number; nickname: string }) => void }) => (
    <button type="button" onClick={() => onSaved({ id: 1, nickname: 'updated' })}>Save profile</button>
  ),
}));
import Center from '../src/pages/account/center';

test('saving identity-only profile data preserves capability permissions and denied buttons', async () => {
  render(<Center />);
  fireEvent.click(await screen.findByRole('button', { name: 'Save profile' }));
  const update = mockSetInitialState.mock.calls[0][0] as (state: { currentUser: { id: number; permissions: string[] } }) => { currentUser: { id: number; nickname: string; permissions: string[] } };
  const permissions = ['system.user.read'];
  const updated = update({ currentUser: { id: 1, permissions } });
  expect(updated.currentUser.nickname).toBe('updated');
  expect(updated.currentUser.permissions).toBe(permissions);
  expect(checkPermission(updated.currentUser.permissions, 'system.user.create')).toBe(false);
  expect(checkPermission(updated.currentUser.permissions, 'system.user.read')).toBe(true);
});
