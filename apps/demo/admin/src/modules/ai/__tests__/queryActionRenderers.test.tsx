import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  clearAiPrefill,
  peekAiPrefill,
} from '@yishan/core-system-admin/ai-prefill';
import { AiFormAssistanceContext } from '../context/formAssistance';
import { QueryRenderer } from '../tools/renderers/QueryRenderer';
import { ActionResultRenderer } from '../tools/renderers/ActionResultRenderer';

type ToolCallViewModel = import('../tools/model').ToolCallViewModel;

const mockPush = jest.fn();
jest.mock('@umijs/max', () => ({
  history: { push: (...args: unknown[]) => mockPush(...args) },
}));

function queryTool(data: unknown): ToolCallViewModel {
  return {
    id: 'query-1',
    toolName: 'lookup',
    operationId: 'lookup',
    title: '查询结果',
    subtitle: '',
    status: 'success',
    resultSummary: '查询完成',
    summary: [],
    empty: false,
    presentation: { type: 'query', data: data as never },
    details: {},
  };
}

function actionTool(data: unknown): ToolCallViewModel {
  return {
    ...queryTool({}),
    id: 'confirm-1',
    title: '删除用户',
    presentation: { type: 'action-result', data: data as never },
  };
}

function expandResult() {
  fireEvent.click(screen.getByText('查询结果'));
}

afterEach(() => {
  jest.clearAllMocks();
  clearAiPrefill();
});

it.each([undefined, null, 'invalid', { rows: [null, 4, 'broken'] }, { rows: [] }])(
  'keeps an empty or malformed query compact without a table: %p',
  (data) => {
    render(<QueryRenderer tool={queryTool(data)} />);
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByText(/未找到|暂无|无可展示/)).toBeTruthy();
  },
);

it('collapses rows initially and derives safe columns without rendering objects as React children', () => {
  render(
    <QueryRenderer
      tool={queryTool({
        rows: [{ id: 1, name: '研发', metadata: { region: '华东' } }],
        truncated: false,
      })}
    />,
  );
  expect(screen.queryByRole('table')).toBeNull();
  expandResult();
  expect(screen.getByRole('table')).toBeTruthy();
  expect(screen.getByText('研发')).toBeTruthy();
  expect(screen.getByText(/华东/)).toBeTruthy();
});

it('renders a single object as read-only descriptions with trusted labels and status formatting', () => {
  render(
    <QueryRenderer
      tool={queryTool({
        record: { username: 'alice', status: 1 },
        columns: [
          { key: 'username', label: '用户名' },
          { key: 'status', label: '状态', format: 'status' },
        ],
        truncated: false,
      })}
    />,
  );
  expandResult();
  expect(screen.getByText('用户名')).toBeTruthy();
  expect(screen.getByText('alice')).toBeTruthy();
  expect(screen.getByText('启用')).toBeTruthy();
  expect(screen.queryByRole('table')).toBeNull();
});

it('paginates loaded rows locally and preserves the server total and truncation notice', () => {
  render(
    <QueryRenderer
      tool={queryTool({
        rows: Array.from({ length: 12 }, (_, index) => ({
          id: index + 1,
          name: `用户${index + 1}`,
        })),
        total: 40,
        truncated: true,
      })}
    />,
  );
  expandResult();
  expect(screen.getByText(/共 40 条/)).toBeTruthy();
  expect(screen.getByText(/截断/)).toBeTruthy();
  expect(screen.queryByText('用户12')).toBeNull();
  fireEvent.click(screen.getByTitle('2'));
  expect(screen.getByText('用户12')).toBeTruthy();
});

it('accepts only known navigation targets and uses the local route', () => {
  const { rerender } = render(
    <ActionResultRenderer
      tool={actionTool({
        mode: 'navigate',
        target: 'role_list',
        path: 'https://untrusted.test',
      })}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: /前往角色管理/ }));
  expect(mockPush).toHaveBeenCalledWith('/system/role');
  rerender(
    <ActionResultRenderer
      tool={actionTool({ mode: 'navigate', target: 'https://untrusted.test' })}
    />,
  );
  expect(screen.queryByRole('button', { name: /前往/ })).toBeNull();
});

it.each([0, -1, 1.5, '7', undefined])(
  'refuses an invalid native confirmation id: %p',
  (id) => {
    render(
      <ActionResultRenderer
        tool={actionTool({ mode: 'confirm', target: 'user.delete', id })}
      />,
    );
    expect(screen.queryByRole('button', { name: '打开删除确认' })).toBeNull();
    expect(screen.getByText(/目标无效/)).toBeTruthy();
    expect(peekAiPrefill()).toBeNull();
  },
);

it('waits for an explicit click and opens native confirmation once without saving', () => {
  render(
    <ActionResultRenderer
      tool={actionTool({ mode: 'confirm', target: 'user.delete', id: 7, label: '张三' })}
    />,
  );
  expect(peekAiPrefill()).toBeNull();
  expect(mockPush).not.toHaveBeenCalled();
  const button = screen.getByRole('button', { name: '打开删除确认' });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(peekAiPrefill()).toMatchObject({
    target: 'user.delete',
    fields: { id: 7 },
    requestId: 'confirm-1',
  });
  expect(mockPush).toHaveBeenCalledTimes(1);
  expect(mockPush).toHaveBeenCalledWith('/system/user');
  expect(screen.queryByText(/删除成功/)).toBeNull();
});

it('shows formal success only after the native form records completed and suppresses the action', () => {
  const requestPrefill = jest.fn();
  const assist = {
    identityEpoch: 1,
    outcomes: {},
    setOutcome: jest.fn(),
    bindHandlers: () => () => {},
    requestRestore: jest.fn(),
    requestPrefill,
    flush: async () => {},
  };
  const tool = actionTool({ mode: 'confirm', target: 'user.delete', id: 7 });
  const { rerender } = render(
    <AiFormAssistanceContext.Provider value={assist}>
      <ActionResultRenderer tool={tool} />
    </AiFormAssistanceContext.Provider>,
  );
  expect(screen.queryByText('删除成功')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '打开删除确认' }));
  expect(requestPrefill).toHaveBeenCalledWith({
    target: 'user.delete',
    fields: { id: 7 },
    missing: [],
    requestId: 'confirm-1',
  });
  expect(mockPush).not.toHaveBeenCalled();
  rerender(
    <AiFormAssistanceContext.Provider
      value={{
        ...assist,
        outcomes: {
          'confirm-1': { status: 'completed', message: '删除成功' },
        },
      }}
    >
      <ActionResultRenderer tool={tool} />
    </AiFormAssistanceContext.Provider>,
  );
  expect(screen.getAllByText('删除成功').length).toBeGreaterThan(0);
  expect(screen.queryByRole('button', { name: '打开删除确认' })).toBeNull();
});
