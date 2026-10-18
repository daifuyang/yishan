import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { useTypewriterText } from '../hooks/useTypewriterText';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it('continues typing when React checks effect cleanup in StrictMode', () => {
  const { result } = renderHook(() => useTypewriterText('逐字', true), {
    wrapper: ({ children }) => <React.StrictMode>{children}</React.StrictMode>,
  });
  act(() => jest.advanceTimersByTime(18));
  expect(result.current.text).toBe('逐');
});

it('reveals a batched final answer one character at a time instead of flushing on completion', () => {
  const { result, rerender } = renderHook(
    ({ content }) => useTypewriterText(content, true),
    { initialProps: { content: '' } },
  );
  rerender({ content: '你好世界' });
  expect(result.current.text).toBe('');
  act(() => jest.advanceTimersByTime(18));
  expect(result.current.text).toBe('你');
  expect(result.current.pending).toBe(true);
  for (let tick = 0; tick < 3; tick += 1)
    act(() => jest.advanceTimersByTime(18));
  expect(result.current).toEqual({ text: '你好世界', pending: false });
});

it('keeps displaying incoming chunks progressively even when chunks arrive faster than the timer', () => {
  const { result, rerender } = renderHook(
    ({ content }) => useTypewriterText(content, true),
    { initialProps: { content: '你' } },
  );
  act(() => jest.advanceTimersByTime(8));
  rerender({ content: '你好' });
  act(() => jest.advanceTimersByTime(10));
  expect(result.current.text).toBe('你');
  rerender({ content: '你好🌏' });
  for (let tick = 0; tick < 2; tick += 1)
    act(() => jest.advanceTimersByTime(18));
  expect(result.current.text).toBe('你好🌏');
});

it('renders loaded history immediately and cancels queued text when animation is disabled', () => {
  const { result, rerender, unmount } = renderHook(
    ({ content, animate }) => useTypewriterText(content, animate),
    { initialProps: { content: '历史消息', animate: false } },
  );
  expect(result.current.text).toBe('历史消息');
  rerender({ content: '待输出消息', animate: true });
  rerender({ content: '另一会话的历史', animate: false });
  expect(result.current).toEqual({ text: '另一会话的历史', pending: false });
  unmount();
  expect(jest.getTimerCount()).toBe(0);
});
