import { act, render, waitFor } from '@testing-library/react';
import React from 'react';

const mockSetIdentity = jest.fn();
const mockRuntimeConfigGet = jest.fn();
let mockLocation = { pathname: '/system/user' };
let mockPermissions: string[] = ['ai:chat:use'];

jest.mock('@umijs/max', () => ({
  history: {
    get location() {
      return mockLocation;
    },
    listen: () => () => {},
  },
  useModel: () => ({
    initialState: {
      currentUser: { id: 7, permissions: mockPermissions },
    },
  }),
}));
jest.mock('@/services/generated/ai', () => ({
  aiRuntimeConfigGet: () => mockRuntimeConfigGet(),
}));
jest.mock('../src/modules/ai/hooks/useAiChat', () => ({
  useAiChat: () => ({ setIdentity: mockSetIdentity }),
}));

import { AiChatIdentityBridge } from '../src/modules/ai/components/AiChatIdentityBridge';

beforeEach(() => {
  jest.clearAllMocks();
  mockLocation = { pathname: '/system/user' };
  mockPermissions = ['ai:chat:use'];
  mockRuntimeConfigGet.mockResolvedValue({ success: true, data: { enabled: true } });
});

test('hands the identity over once the switch reports on', async () => {
  render(<AiChatIdentityBridge />);
  await waitFor(() => expect(mockSetIdentity).toHaveBeenLastCalledWith('7'));
});

test('withholds the identity while the switch is off, so the launcher never mounts', async () => {
  mockRuntimeConfigGet.mockResolvedValue({ success: true, data: { enabled: false } });
  render(<AiChatIdentityBridge />);
  await waitFor(() => expect(mockRuntimeConfigGet).toHaveBeenCalled());
  await waitFor(() => expect(mockSetIdentity).toHaveBeenLastCalledWith(null));
});

test('withholds the identity when the switch cannot be read', async () => {
  mockRuntimeConfigGet.mockRejectedValue(new Error('offline'));
  render(<AiChatIdentityBridge />);
  await waitFor(() => expect(mockSetIdentity).toHaveBeenLastCalledWith(null));
});

test('never asks for the switch of a user without the AI permission', async () => {
  mockPermissions = ['system:user:read'];
  render(<AiChatIdentityBridge />);
  await act(async () => {});
  expect(mockRuntimeConfigGet).not.toHaveBeenCalled();
  expect(mockSetIdentity).toHaveBeenLastCalledWith(null);
});