import { fireEvent, render, screen } from '@testing-library/react';
import type { UIMessage } from 'ai';
import React from 'react';
import { ToolCallList } from '../tools/components/ToolCallList';

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

/** 真实返回形状：两个业务能力定义（一个表单定义、一个创建操作）。 */
const discover = toolPart('d1', 'discover_operations', 'output-available', {
  input: { keyword: '新建用户' },
  output: {
    ok: true,
    data: {
      operations: [
        {
          id: 'user.create.form',
          name: '新增用户表单定义',
          type: 'query',
          aliases: ['新建用户表单'],
          presentation: { kind: 'form', subject: '新增用户' },
          module: 'system',
        },
        {
          id: 'user.create',
          name: '新增用户',
          type: 'create',
          formKey: 'user.create',
          aliases: ['新建用户'],
          presentation: { kind: 'draft', subject: '新增用户' },
          describeCapability: 'prepare_user_form_draft',
          references: { deptIds: 'department.list' },
          module: 'system',
        },
      ],
    },
    progress: {
      action: 'discover',
      kind: 'operations',
      subject: '新建用户',
      outcome: 'ready',
      count: 2,
    },
  },
});

const renderList = (parts: unknown[], streaming = false) =>
  render(<ToolCallList message={message(parts)} streaming={streaming} />);

it('shows a plain Chinese title and folds the results by default', () => {
  renderList([discover]);
  expect(screen.getByText('查找新建用户功能')).toBeTruthy();
  expect(screen.getByText('已完成')).toBeTruthy();
  // 默认收起：结果不进 DOM
  expect(screen.queryByText('已找到用户信息填写入口')).toBeNull();
  expect(screen.queryByRole('table')).toBeNull();
});

it('expands the results in natural Chinese without technical ids', () => {
  renderList([discover]);
  fireEvent.click(screen.getByText('查找新建用户功能'));
  expect(screen.getByText('已找到用户信息填写入口')).toBeTruthy();
  expect(screen.getByText('已找到用户创建功能')).toBeTruthy();
  // 技术 ID、内部分类、原始参数都不出现
  expect(screen.queryByText('user.create.form')).toBeNull();
  expect(screen.queryByText('user.create')).toBeNull();
  expect(screen.queryByText('创建操作')).toBeNull();
  expect(screen.queryByText(/prepare_user_form_draft/)).toBeNull();
  expect(screen.queryByText(/关键词/)).toBeNull();
  // 没有第二层详情折叠入口
  expect(screen.queryByText('查看调用详情')).toBeNull();
});

it('keeps the results of other business objects in plain Chinese', () => {
  renderList([
    toolPart('d5', 'discover_operations', 'output-available', {
      input: { keyword: '新建客户' },
      output: {
        ok: true,
        data: {
          operations: [
            {
              id: 'customer.create.form',
              name: '新增客户表单定义',
              type: 'query',
              presentation: { kind: 'form', subject: '新增客户' },
            },
            {
              id: 'customer.create',
              name: '新增客户',
              type: 'create',
              presentation: { kind: 'draft', subject: '新增客户' },
            },
          ],
        },
        progress: {
          action: 'discover',
          kind: 'operations',
          subject: '新建客户',
          outcome: 'ready',
          count: 2,
        },
      },
    }),
  ]);
  fireEvent.click(screen.getByText('查找新建客户功能'));
  expect(screen.getByText('已找到客户信息填写入口')).toBeTruthy();
  expect(screen.getByText('已找到客户创建功能')).toBeTruthy();
});

it('degrades to the business name when the action cannot be recognised', () => {
  renderList([
    toolPart('d3', 'discover_operations', 'output-available', {
      input: { keyword: '库存' },
      output: {
        ok: true,
        data: {
          operations: [
            { id: 'stock.mystery', name: '库存魔法', type: 'mysteryType' },
          ],
        },
        progress: {
          action: 'discover',
          kind: 'operations',
          subject: '库存',
          outcome: 'ready',
          count: 1,
        },
      },
    }),
  ]);
  fireEvent.click(screen.getByText('查找库存功能'));
  expect(screen.getByText('已找到：库存魔法')).toBeTruthy();
  expect(screen.queryByText('stock.mystery')).toBeNull();
});

it('separates an empty result from a failed run', () => {
  renderList([
    toolPart('d2', 'discover_operations', 'output-available', {
      input: { keyword: '新建用户' },
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
  ]);
  // 执行成功，只是没有匹配结果
  expect(screen.getByText('已完成')).toBeTruthy();
  fireEvent.click(screen.getByText('查找新建用户功能'));
  expect(screen.getByText('暂未找到匹配的功能')).toBeTruthy();
});

it('reports a failed run with a readable summary', () => {
  renderList([
    toolPart('d6', 'discover_operations', 'output-error', {
      input: { keyword: '新建用户' },
      errorText: '无权访问业务能力目录',
    }),
  ]);
  expect(screen.getByText('执行失败')).toBeTruthy();
  fireEvent.click(screen.getByText('查找新建用户功能'));
  expect(screen.getByText('无权访问业务能力目录')).toBeTruthy();
});

it('shows the running state without claiming success', () => {
  renderList(
    [
      toolPart('d7', 'discover_operations', 'input-available', {
        input: { keyword: '新建用户' },
      }),
    ],
    true,
  );
  expect(screen.getByText('正在查找新建用户功能…')).toBeTruthy();
  expect(screen.queryByText('已完成')).toBeNull();
  expect(screen.queryByText('已找到用户创建功能')).toBeNull();
});

it('keeps the user expansion across streaming updates', () => {
  const { rerender } = render(
    <ToolCallList message={message([discover])} streaming={false} />,
  );
  fireEvent.click(screen.getByText('查找新建用户功能'));
  expect(screen.getByText('已找到用户创建功能')).toBeTruthy();
  // 后续的流式更新不得把用户展开的状态关掉
  rerender(<ToolCallList message={message([discover])} streaming={true} />);
  expect(screen.getByText('已找到用户创建功能')).toBeTruthy();
});
