import { fireEvent, render, screen } from '@testing-library/react';
import type { UIMessage } from 'ai';
import React from 'react';
import { toToolCalls } from '../tools/adapter';
import { ToolCallList } from '../tools/components/ToolCallList';
import type { ToolCallViewModel } from '../tools/model';

const message = (parts: unknown[]): UIMessage =>
  ({
    id: 'm',
    role: 'assistant',
    parts: parts as UIMessage['parts'],
  }) as UIMessage;

const toolPart = (
  id: string,
  toolName: string,
  state: string,
  extra: Record<string, unknown> = {},
) => ({
  type: `tool-${toolName}`,
  toolCallId: id,
  state,
  input: {},
  ...extra,
});

const discover = toolPart('c1', 'discover_operations', 'output-available', {
  output: {
    ok: true,
    data: {
      operations: [
        {
          id: 'user.list',
          name: '用户列表',
          presentation: { kind: 'list', subject: '用户' },
        },
      ],
    },
    progress: {
      action: 'discover',
      kind: 'operations',
      subject: '用户',
      outcome: 'ready',
      count: 1,
    },
  },
});

const describeOperation = toolPart(
  'c2',
  'describe_operation',
  'output-available',
  {
    output: {
      ok: true,
      data: {
        id: 'user.create',
        name: '新增用户',
        presentation: { kind: 'form', subject: '用户' },
      },
      progress: {
        action: 'describe',
        kind: 'form',
        subject: '用户',
        outcome: 'ready',
      },
    },
  },
);

const query = toolPart('c3', 'query_business_data', 'output-available', {
  input: { operationId: 'user.list', params: { keyword: '张三' } },
  output: {
    ok: true,
    data: { items: [{ id: 1 }], total: 20, returned: 1, truncated: true },
    progress: {
      action: 'query',
      kind: 'list',
      subject: '用户',
      outcome: 'ready',
      count: 20,
      returnedCount: 1,
    },
  },
});

const draft = toolPart('c4', 'update_form_draft', 'output-available', {
  output: {
    ok: true,
    data: { draftId: 'draft-1', draftVersion: 2 },
    progress: {
      action: 'draft',
      kind: 'draft',
      subject: '用户',
      outcome: 'saved',
    },
  },
});

function renderList(parts: unknown[]) {
  return render(<ToolCallList message={message(parts)} streaming={false} />);
}

it('names the action, the subject and the outcome from real tool events', () => {
  const tools = toToolCalls(
    message([discover, describeOperation, query, draft]),
    false,
  );
  expect(tools.map((tool) => tool.title)).toEqual([
    '检索业务操作',
    '查看用户填写要求',
    '查询业务记录',
    '准备用户信息',
  ]);
  expect(tools.every((tool) => tool.subtitle === '用户')).toBe(true);
  expect(tools.map((tool) => tool.resultSummary)).toEqual([
    '命中 1 项',
    '已完成',
    '共 20 条，返回 1 条',
    '已完成',
  ]);
  expect(tools.every((tool) => tool.status === 'success')).toBe(true);
});

it('falls back to the tool name when the server declares no semantics', () => {
  const tools = toToolCalls(
    message([
      toolPart('c9', 'query_business_data', 'output-available', {
        output: { ok: true, data: {} },
      }),
    ]),
    false,
  );
  expect(tools[0].title).toBe('查询业务数据');
  expect(tools[0].resultSummary).toBe('已完成');
});

it('reports empty and failed runs without claiming business success', () => {
  const empty = toToolCalls(
    message([
      toolPart('e1', 'discover_operations', 'output-available', {
        output: {
          ok: true,
          data: { operations: [] },
          progress: {
            action: 'discover',
            kind: 'operations',
            subject: '用户',
            outcome: 'empty',
            count: 0,
          },
        },
      }),
      toolPart('e2', 'query_business_data', 'output-error', {
        errorText: '无权查询',
      }),
    ]),
    false,
  );
  expect(empty[0].resultSummary).toBe('无匹配');
  expect(empty[0].empty).toBe(true);
  expect(empty[1].status).toBe('error');
  expect(empty[1].details.error?.message).toBe('无权查询');
  expect(empty[1].resultSummary).toBe('未完成');
});

it('shows the running and cancelled wording of a call that never finished', () => {
  const running = toToolCalls(
    message([toolPart('r1', 'query_business_data', 'input-available')]),
    true,
  );
  expect(running[0].status).toBe('running');
  expect(running[0].resultSummary).toBe('处理中');
  const pending = toToolCalls(
    message([toolPart('r2', 'query_business_data', 'input-streaming')]),
    true,
  );
  expect(pending[0].status).toBe('pending');
  expect(pending[0].resultSummary).toBe('准备中');
  const stopped = toToolCalls(
    message([toolPart('r3', 'query_business_data', 'input-available')]),
    false,
  );
  expect(stopped[0].status).toBe('cancelled');
  expect(stopped[0].resultSummary).toBe('已中止');
});

it('never shows the raw tool name in the visible card', () => {
  renderList([query]);
  expect(screen.getByText('查询业务记录')).toBeTruthy();
  expect(screen.queryByText('query_business_data')).toBeNull();
  expect(screen.queryByText('执行完成')).toBeNull();
});

it('groups consecutive preparation steps without nesting their individual disclosures', () => {
  renderList([
    describeOperation,
    toolPart('c5', 'describe_operation', 'output-available', {
      output: {
        ok: true,
        data: { id: 'user.create', name: '新增用户' },
        progress: {
          action: 'describe',
          kind: 'form',
          subject: '用户',
          outcome: 'ready',
        },
      },
    }),
    query,
  ]);
  fireEvent.click(screen.getByRole('button', { name: /已完成信息准备/ }));
  expect(screen.getAllByText('查看用户填写要求')).toHaveLength(2);
  expect(screen.getByText('查询业务记录')).toBeTruthy();
});

it('degrades gracefully when the title, the subtitle and the summary are missing', () => {
  const tool: ToolCallViewModel = {
    id: 'x',
    toolName: '',
    operationId: '',
    title: '',
    subtitle: '',
    status: 'running',
    resultSummary: '',
    summary: [],
    empty: false,
    presentation: { type: 'generic' },
    details: {},
  };
  render(
    <ToolCallList
      message={message([toolPart('x', 'unknown_tool', 'input-available')])}
      streaming
    />,
  );
  expect(screen.getByText('Unknown Tool')).toBeTruthy();
  expect(tool.title).toBe('');
});

it('expands the details on demand and keeps secrets out of them', () => {
  renderList([
    toolPart('s1', 'query_business_data', 'output-available', {
      input: {
        operationId: 'user.list',
        params: { keyword: '张三', password: 'never-show' },
      },
      output: {
        ok: true,
        data: { items: [{ id: 1 }] },
        render: { kind: 'user.table', payload: { items: [{ id: 1 }] } },
      },
    }),
  ]);
  expect(screen.queryByText(/never-show/)).toBeNull();
  fireEvent.click(screen.getByText('查询业务记录'));
  expect(screen.getByText(/工具：query_business_data/)).toBeTruthy();
  expect(screen.queryByText(/never-show/)).toBeNull();
});
