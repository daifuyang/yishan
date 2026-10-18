import { act, render, screen } from '@testing-library/react';
import React from 'react';
import { AiChatView } from '../components/AiChatView';

const mockChat = {
  activeId: 'a',
  authorized: true,
  busy: false,
  loading: false,
  messages: [
    {
      id: 'history',
      role: 'assistant',
      parts: [{ type: 'text', text: '旧回复' }],
    },
  ],
  conversations: [],
  loadConversations: jest.fn(),
  draft: '',
  setDraft: jest.fn(),
};
jest.mock('../hooks/useAiChat', () => ({ useAiChat: () => mockChat }));
jest.mock('@umijs/max', () => ({ history: { push: jest.fn() } }));

const resizeObserverDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  'ResizeObserver',
);
const intersectionObserverDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  'IntersectionObserver',
);
beforeAll(() => {
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    value: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  });
  Object.defineProperty(globalThis, 'IntersectionObserver', {
    configurable: true,
    value: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  });
});
afterAll(() => {
  if (resizeObserverDescriptor)
    Object.defineProperty(
      globalThis,
      'ResizeObserver',
      resizeObserverDescriptor,
    );
  else Reflect.deleteProperty(globalThis, 'ResizeObserver');
  if (intersectionObserverDescriptor)
    Object.defineProperty(
      globalThis,
      'IntersectionObserver',
      intersectionObserverDescriptor,
    );
  else Reflect.deleteProperty(globalThis, 'IntersectionObserver');
});

afterEach(() => jest.useRealTimers());

it('renders history immediately, types the live final chunk, and stops old text on conversation switch', () => {
  jest.useFakeTimers();
  const { rerender } = render(<AiChatView floating />);
  expect(screen.getByText('旧回复')).toBeTruthy();
  mockChat.busy = true;
  rerender(<AiChatView floating />);
  mockChat.messages = [
    ...mockChat.messages,
    {
      id: 'live',
      role: 'assistant',
      parts: [{ type: 'text', text: '新回复文字' }],
    },
  ];
  mockChat.busy = false;
  rerender(<AiChatView floating />);
  expect(screen.queryByText('新回复文字')).toBeNull();
  act(() => jest.advanceTimersByTime(18));
  expect(screen.getByText('新')).toBeTruthy();
  act(() => jest.advanceTimersByTime(18));
  expect(screen.getByText('新回')).toBeTruthy();
  mockChat.activeId = 'b';
  mockChat.messages = [
    {
      id: 'other-history',
      role: 'assistant',
      parts: [{ type: 'text', text: '另一会话历史' }],
    },
  ];
  rerender(<AiChatView floating />);
  expect(screen.getByText('另一会话历史')).toBeTruthy();
  act(() => jest.advanceTimersByTime(500));
  expect(screen.queryByText('新回复文字')).toBeNull();
});
