import { render, screen } from '@testing-library/react';
import type { UIMessage } from 'ai';
import React from 'react';
import { toBubbleItems } from '../adapters/messages';
import { AiMessageProgress } from '../components/AiMessageProgress';

const message = (parts: UIMessage['parts']): UIMessage => ({
  id: 'm',
  role: 'assistant',
  parts,
});

it('shows streamed reasoning before any answer text and releases bubble loading', () => {
  const value = message([
    { type: 'reasoning', text: '核对用户查询范围', state: 'streaming' },
  ]);
  expect(toBubbleItems([value], true)?.[0].loading).toBe(false);
  render(<AiMessageProgress message={value} streaming />);
  expect(screen.getByText('核对用户查询范围')).toBeTruthy();
  expect(screen.getByText('思考中')).toBeTruthy();
});

it('updates actual tool stages through completion and reports business failures', () => {
  const value = (
    state: 'input-streaming' | 'input-available' | 'output-available',
    output?: unknown,
  ) =>
    message([
      {
        type: 'tool-list_users',
        toolCallId: 'c',
        state,
        input: {},
        output,
      } as UIMessage['parts'][number],
    ]);
  const { rerender } = render(
    <AiMessageProgress message={value('input-streaming')} streaming />,
  );
  expect(screen.getByText('正在准备参数')).toBeTruthy();
  rerender(<AiMessageProgress message={value('input-available')} streaming />);
  expect(screen.getByText('正在执行')).toBeTruthy();
  rerender(
    <AiMessageProgress
      message={value('output-available', { ok: false, error: '无权查询' })}
      streaming={false}
    />,
  );
  expect(screen.getByText('执行失败')).toBeTruthy();
  expect(screen.queryByText('正在执行')).toBeNull();
});

it('marks interrupted pending tools without an endless loading state', () => {
  render(
    <AiMessageProgress
      message={message([
        {
          type: 'tool-list_users',
          toolCallId: 'c',
          state: 'input-available',
          input: {},
        },
      ])}
      streaming={false}
    />,
  );
  expect(screen.getByText('已中止')).toBeTruthy();
});
