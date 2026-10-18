import { renderHook } from '@testing-library/react';
import type { UIMessage } from 'ai';
import { useLiveReplyIds } from '../hooks/useLiveReplyIds';

const reply = (id: string): UIMessage => ({
  id,
  role: 'assistant',
  parts: [{ type: 'text', text: '回复' }],
});

it('keeps history static and animates the reply arriving with the final batched chunk', () => {
  const { result, rerender } = renderHook(
    ({ messages, busy }) =>
      useLiveReplyIds(messages, busy, false, 'conversation'),
    { initialProps: { messages: [reply('history')], busy: false } },
  );
  expect([...result.current]).toEqual([]);
  rerender({ messages: [reply('history')], busy: true });
  rerender({ messages: [reply('history'), reply('live')], busy: false });
  expect([...result.current]).toEqual(['live']);
  rerender({ messages: [reply('history'), reply('live')], busy: false });
  expect([...result.current]).toEqual(['live']);
});

it('clears live replies when loading history or switching conversations', () => {
  const { result, rerender } = renderHook(
    ({ messages, busy, loading, id }) =>
      useLiveReplyIds(messages, busy, loading, id),
    {
      initialProps: {
        messages: [] as UIMessage[],
        busy: true,
        loading: false,
        id: 'a',
      },
    },
  );
  rerender({ messages: [reply('live')], busy: true, loading: false, id: 'a' });
  expect([...result.current]).toEqual(['live']);
  rerender({
    messages: [reply('history')],
    busy: false,
    loading: false,
    id: 'b',
  });
  expect([...result.current]).toEqual([]);
  rerender({
    messages: [reply('history')],
    busy: false,
    loading: true,
    id: 'b',
  });
  rerender({
    messages: [reply('another-history')],
    busy: false,
    loading: false,
    id: 'b',
  });
  expect([...result.current]).toEqual([]);
});
