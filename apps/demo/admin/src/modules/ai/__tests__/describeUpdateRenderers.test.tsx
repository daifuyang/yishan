import { fireEvent, render, screen } from '@testing-library/react';
import type { UIMessage } from 'ai';
import React from 'react';
import { toToolCalls } from '../tools/adapter';
import { ToolCallList } from '../tools/components/ToolCallList';

/**
 * `describe_operation` / `update_form_draft` 的展示契约。
 *
 * 两条硬要求：
 *
 * 1. **只记录一件事**——读到了 / 写进草稿了；
 * 2. **默认收起**，用户展开后只有一句自然中文，不出现原始 JSON、工具参数、
 *    完整字段定义，也不出现第二层折叠。
 */

const message = (parts: unknown[]): UIMessage =>
  ({ id: 'm', role: 'assistant', parts: parts as UIMessage['parts'] }) as UIMessage;

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

const describeOperation = toolPart('c1', 'describe_operation', 'output-available', {
  input: { operationId: 'user.create' },
  output: {
    ok: true,
    data: {
      id: 'user.create',
      name: '新增用户',
      fields: [
        { name: 'phone', label: '手机号码', required: true, pattern: '^1\\d{10}$' },
      ],
      schema: { type: 'object', properties: { phone: { type: 'string' } } },
    },
    progress: { action: 'describe', kind: 'form', subject: '新增用户', outcome: 'ready' },
  },
});

const updateDraft = toolPart('c2', 'update_form_draft', 'output-available', {
  input: { conversationId: 'c1', values: { phone: '13800000000' } },
  output: {
    ok: true,
    data: { draftId: 'draft-1', draftVersion: 2 },
    progress: { action: 'draft', kind: 'draft', subject: '新增用户', outcome: 'saved' },
  },
});

function renderList(parts: unknown[]) {
  return render(<ToolCallList message={message(parts)} streaming={false} />);
}

it('titles the two records in natural Chinese', () => {
  const tools = toToolCalls(message([describeOperation, updateDraft]), false);
  expect(tools.map((tool) => tool.title)).toEqual([
    '查看新增用户填写要求',
    '准备新增用户信息',
  ]);
  expect(tools.map((tool) => tool.resultSummary)).toEqual(['已完成', '已完成']);
});

it('keeps both records collapsed until the user expands them', () => {
  renderList([describeOperation, updateDraft]);
  expect(screen.queryByText('已获取需要填写的信息及校验规则')).toBeNull();
  expect(screen.queryByText('已将提供的信息填入表单草稿')).toBeNull();
  expect(screen.getByText('查看新增用户填写要求')).toBeTruthy();
  expect(screen.getByText('准备新增用户信息')).toBeTruthy();
});

it('expands the read record into one Chinese sentence without the raw schema', () => {
  renderList([describeOperation]);
  fireEvent.click(screen.getByText('查看新增用户填写要求'));
  expect(screen.getByText('已获取需要填写的信息及校验规则')).toBeTruthy();
  // 原始 Schema、字段定义、工具参数都不是给人看的。
  expect(screen.queryByText(/schema/)).toBeNull();
  expect(screen.queryByText(/pattern/)).toBeNull();
  expect(screen.queryByText(/手机号码/)).toBeNull();
  expect(screen.queryByText(/operationId/)).toBeNull();
  expect(screen.queryByText(/\{/)).toBeNull();
});

it('expands the draft record into one Chinese sentence without the filled fields', () => {
  renderList([updateDraft]);
  fireEvent.click(screen.getByText('准备新增用户信息'));
  expect(screen.getByText('已将提供的信息填入表单草稿')).toBeTruthy();
  // 已填字段不在工具记录里重复出现，工具参数也不出现。
  expect(screen.queryByText('13800000000')).toBeNull();
  expect(screen.queryByText(/conversationId/)).toBeNull();
  expect(screen.queryByText(/values/)).toBeNull();
});

it('offers no completion entry and no business widget on the draft record', () => {
  renderList([updateDraft]);
  fireEvent.click(screen.getByText('准备新增用户信息'));
  expect(screen.queryByRole('button', { name: '继续填写' })).toBeNull();
  expect(screen.queryByRole('button', { name: /填写/ })).toBeNull();
  expect(screen.queryByRole('combobox')).toBeNull();
  expect(screen.queryByRole('textbox')).toBeNull();
});

it('keeps the user expansion across a later streaming update', () => {
  const { rerender } = render(
    <ToolCallList message={message([describeOperation])} streaming={false} />,
  );
  fireEvent.click(screen.getByText('查看新增用户填写要求'));
  expect(screen.getByText('已获取需要填写的信息及校验规则')).toBeTruthy();
  // 流式更新把同一条记录重画一遍：用户展开的状态不能被覆盖。
  rerender(
    <ToolCallList message={message([describeOperation])} streaming={true} />,
  );
  expect(screen.getByText('已获取需要填写的信息及校验规则')).toBeTruthy();
});

it('reports a failed run instead of claiming the record was written', () => {
  const failed = toolPart('c3', 'update_form_draft', 'output-error', {
    errorText: '草稿写入失败',
  });
  renderList([failed]);
  fireEvent.click(screen.getByText('更新表单草稿'));
  expect(screen.getByText('草稿写入失败')).toBeTruthy();
  expect(screen.queryByText('已将提供的信息填入表单草稿')).toBeNull();
});
