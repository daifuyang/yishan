import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { ToolCallCard } from '../tools/components/ToolCallCard';
import { ToolStatus } from '../tools/components/ToolStatus';
import type { ToolCallStatus, ToolCallViewModel } from '../tools/model';

function tool(overrides: Partial<ToolCallViewModel> = {}): ToolCallViewModel {
  return {
    id: 'tool-1',
    toolName: 'query_business_data',
    operationId: 'user.list',
    title: '查询业务记录',
    subtitle: '用户',
    status: 'success',
    resultSummary: '找到 3 条',
    summary: [{ label: '关键词', value: '张三' }],
    empty: false,
    presentation: { type: 'generic' },
    details: {},
    ...overrides,
  };
}

it('renders every status with a shape and a label, not only a colour', () => {
  const statuses: ToolCallStatus[] = [
    'pending',
    'running',
    'success',
    'error',
    'cancelled',
  ];
  for (const status of statuses) {
    const { unmount } = render(<ToolStatus status={status} empty={false} />);
    const label = screen.getByLabelText(/等待执行|执行中|执行完成|执行失败|已取消/);
    expect(label.getAttribute('aria-label')).toBeTruthy();
    expect(label.querySelector('svg')).toBeTruthy();
    unmount();
  }
});

it('marks an empty result differently from a successful one', () => {
  render(<ToolStatus status="success" empty />);
  expect(screen.getByLabelText('无匹配结果')).toBeTruthy();
});

it('falls back to a generic title when the tool has none', () => {
  render(<ToolCallCard tool={tool({ title: '', subtitle: '' })} />);
  expect(screen.getByText('工具调用')).toBeTruthy();
});

it('keeps the summary out of the header when there is none', () => {
  render(<ToolCallCard tool={tool({ summary: [], resultSummary: '' })} />);
  expect(screen.queryByText('关键词：张三')).toBeNull();
});

it('expands and collapses the details', () => {
  render(
    <ToolCallCard tool={tool({ details: { input: { keyword: '张三' } } })}>
      <div>结果内容</div>
    </ToolCallCard>,
  );
  expect(screen.queryByText('结果内容')).toBeNull();
  fireEvent.click(screen.getByText('查询业务记录'));
  expect(screen.getByText('结果内容')).toBeTruthy();
  fireEvent.click(screen.getByText('查询业务记录'));
  expect(screen.queryByText('结果内容')).toBeNull();
});

it('never prints a secret in the details, even when the model sent one', () => {
  render(
    <ToolCallCard
      tool={tool({
        details: { input: { password: 'never-show', apiKey: 'also-secret' } },
      })}
    />,
  );
  fireEvent.click(screen.getByText('查询业务记录'));
  expect(screen.queryByText(/never-show/)).toBeNull();
  expect(screen.queryByText(/also-secret/)).toBeNull();
});

it('keeps a very long value inside the card instead of breaking the layout', () => {
  const long = 'x'.repeat(4000);
  render(
    <ToolCallCard
      tool={tool({ title: long, summary: [{ label: '说明', value: long }] })}
    />,
  );
  expect(screen.getByText(long)).toBeTruthy();
  expect(screen.getByText(`说明：${long}`)).toBeTruthy();
});
