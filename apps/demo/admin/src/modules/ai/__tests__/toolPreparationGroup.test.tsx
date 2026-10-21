import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { ToolCallList } from '../tools/components/ToolCallList';

function message(state = 'output-available', failed = false) {
  return {
    id: 'm',
    role: 'assistant' as const,
    parts: [
      'discover_operations',
      'describe_operation',
      'update_form_draft',
    ].map((name, i) => ({
      type: `tool-${name}` as const,
      toolCallId: `t${i}`,
      state: i === 2 ? state : 'output-available',
      input: { operationId: 'user.create', keyword: '新建用户' },
      output: {
        ok: !(failed && i === 2),
        error: failed && i === 2 ? '无权更新草稿' : undefined,
        data: { operations: [], draftId: i === 2 ? 'd' : undefined },
        progress: {
          action: ['discover', 'describe', 'draft'][i],
          kind: ['operations', 'form', 'draft'][i],
          subject: '新建用户',
          outcome: 'ready',
        },
      },
    })),
  } as import('ai').UIMessage;
}

it('collapses completed preparation into one accessible disclosure with read-only steps', () => {
  const { container } = render(
    <ToolCallList message={message()} streaming={false} />,
  );
  const group = screen.getByRole('button', { name: /已完成信息准备/ });
  expect(group.getAttribute('aria-expanded')).toBe('false');
  expect(screen.getByText('3 项操作')).toBeTruthy();
  expect(screen.queryByText('准备新建用户信息')).toBeNull();
  fireEvent.click(group);
  expect(screen.getByText('准备新建用户信息')).toBeTruthy();
  expect(screen.getAllByRole('button')).toHaveLength(1);
  expect(container.querySelectorAll('[data-icon="check-circle"]')).toHaveLength(
    1,
  );
  expect(container.textContent).not.toMatch(
    /update_form_draft|operationId|user.create/,
  );
});

it('automatically collapses on completion but preserves either explicit user choice', () => {
  const { rerender } = render(
    <ToolCallList message={message('input-available')} streaming />,
  );
  expect(
    screen
      .getByRole('button', { name: /正在准备信息/ })
      .getAttribute('aria-expanded'),
  ).toBe('true');
  rerender(<ToolCallList message={message()} streaming={false} />);
  const group = screen.getByRole('button', { name: /已完成信息准备/ });
  expect(group.getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(group);
  rerender(<ToolCallList message={message()} streaming />);
  expect(group.getAttribute('aria-expanded')).toBe('true');
  fireEvent.click(group);
  rerender(<ToolCallList message={message('input-available')} streaming />);
  expect(group.getAttribute('aria-expanded')).toBe('false');
});

it('keeps errors visible even when the group is collapsed', () => {
  render(
    <ToolCallList
      message={message('output-available', true)}
      streaming={false}
    />,
  );
  expect(screen.getByRole('button', { name: /信息准备失败/ })).toBeTruthy();
  expect(screen.getByText('无权更新草稿')).toBeTruthy();
  expect(screen.queryByText('已完成信息准备')).toBeNull();
});

it('shows cancellation rather than success after an interrupted call', () => {
  render(
    <ToolCallList message={message('input-available')} streaming={false} />,
  );
  expect(screen.getByRole('button', { name: /信息准备已取消/ })).toBeTruthy();
});

it('preserves the explicit choice when a single preparation becomes a group', () => {
  const first = message('input-available');
  first.parts = first.parts.slice(0, 1);
  const { rerender } = render(<ToolCallList message={first} streaming />);
  const button = screen.getByRole('button');
  fireEvent.click(button);
  expect(button.getAttribute('aria-expanded')).toBe('true');
  rerender(<ToolCallList message={message()} streaming={false} />);
  expect(
    screen
      .getByRole('button', { name: /已完成信息准备/ })
      .getAttribute('aria-expanded'),
  ).toBe('true');
});
