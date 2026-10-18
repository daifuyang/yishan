import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  clearAiPrefill,
  peekAiPrefill,
} from '@yishan/core-system-admin/ai-prefill';
import { AiToolResultCard } from '../components/AiToolResultCard';
// 注意：这个文件里有 `jest.mock`，`@umijs/test` 的 babel 链没有 TS preset，
// **类型位置引用 import 绑定**会报 "Cannot transform the imported binding"。
// 所以协作 context 只按值导入，值的类型让 TS 从字面量自己推断。
import { AiFormAssistanceContext } from '../context/formAssistance';

const mockPush = jest.fn();
jest.mock('@umijs/max', () => ({
  useNavigate: jest.requireActual('react-router-dom').useNavigate,
  history: { push: (...args: unknown[]) => mockPush(...args) },
}));

afterEach(() => {
  jest.clearAllMocks();
  clearAiPrefill();
});

it('renders and navigates outside Router, using only the local target whitelist', () => {
  render(
    <AiToolResultCard
      payload={{
        ok: true,
        render: {
          kind: 'navigate',
          payload: { target: 'role_list', path: 'https://untrusted.test' },
        },
      }}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: /前往角色管理/ }));
  expect(mockPush).toHaveBeenCalledWith('/system/role');
});

it('opens a prefilled form outside Router without saving anything', () => {
  render(
    <AiToolResultCard
      payload={{
        ok: true,
        render: {
          kind: 'form.prefill',
          payload: {
            target: 'user.create',
            fields: { realName: '测试用户' },
            missing: ['phone'],
          },
        },
      }}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: '打开表单并预填' }));
  expect(mockPush).toHaveBeenCalledWith('/system/user');
  expect(peekAiPrefill()?.fields).toEqual({ realName: '测试用户' });
});

it('shows and prefills clean values, never the model-facing quoted ones', () => {
  // `render.payload` 是给界面看的：服务端在那里放的是**未中性化**的原始值，
  // 引号形式只存在于模型侧的 `data`。模型回抄的值在进预填前也已脱掉引号，
  // 否则人点确定就会建出一个名字带单引号的部门。
  render(
    <AiToolResultCard
      payload={{
        ok: true,
        render: {
          kind: 'form.prefill',
          payload: {
            target: 'department.create',
            fields: { name: '研发部', parentId: 10 },
            missing: [],
          },
        },
      }}
    />,
  );
  expect(screen.getByText('研发部')).toBeTruthy();
  expect(screen.queryByText(String.raw`'研发部'`)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '打开表单并预填' }));
  // 写进表单暂存的也必须是干净的值。
  expect(peekAiPrefill()?.fields).toEqual({ name: '研发部', parentId: 10 });
});

it('shows an unsupported result notice instead of crashing for unknown table kinds', () => {
  render(
    <AiToolResultCard
      payload={{ ok: true, render: { kind: 'unknown.table', payload: {} } }}
    />,
  );
  expect(screen.getByText(/暂不支持展示/)).toBeTruthy();
});

it('does not navigate for an unrecognized target', () => {
  render(
    <AiToolResultCard
      payload={{
        ok: true,
        render: {
          kind: 'navigate',
          payload: { target: 'https://untrusted.test' },
        },
      }}
    />,
  );
  expect(screen.queryByRole('button')).toBeNull();
});

it('restores the draft named in data, never an empty id', () => {
  // 回归：draftId 在 `data` 上，不在结果顶层。曾经只读顶层，于是「继续填写」带着
  // `''` 去 `GET /ai/v1/drafts/`（`draftId must NOT have fewer than 1 characters`），
  // 而回执也因为按 `''` 查找而全部不显示。
  const requestRestore = jest.fn();
  const assist = {
    identityEpoch: 1,
    outcomes: {},
    setOutcome: jest.fn(),
    bindHandlers: () => () => {},
    requestRestore,
    flush: async () => {},
  };
  render(
    <AiFormAssistanceContext.Provider value={assist}>
      <AiToolResultCard
        payload={{
          ok: true,
          render: {
            kind: 'action.draft',
            payload: { draftId: 'draft-1', draftVersion: 2, uiRequestId: 'u-1' },
          },
          data: {
            draftId: 'draft-1',
            missingFields: [{ name: 'phone', label: '手机号', mustCompleteInForm: false }],
          },
        } as never}
      />
    </AiFormAssistanceContext.Provider>,
  );
  fireEvent.click(screen.getByRole('button', { name: '继续填写' }));
  expect(requestRestore).toHaveBeenCalledWith('draft-1');
  expect(screen.getByText(/已存在草稿里/)).toBeTruthy();
});

it('shows the recorded outcome once the draft id resolves', () => {
  const assist = {
    identityEpoch: 1,
    outcomes: {
      'draft-1': {
        status: 'notice' as const,
        message: '已填入新建用户表单，请核对后自行保存。',
      },
    },
    setOutcome: jest.fn(),
    bindHandlers: () => () => {},
    requestRestore: jest.fn(),
    flush: async () => {},
  };
  render(
    <AiFormAssistanceContext.Provider value={assist}>
      <AiToolResultCard
        payload={{
          ok: true,
          render: { kind: 'action.draft', payload: { draftId: 'draft-1' } },
          data: { draftId: 'draft-1' },
        } as never}
      />
    </AiFormAssistanceContext.Provider>,
  );
  expect(screen.getByText('已填入新建用户表单，请核对后自行保存。')).toBeTruthy();
});

it('renders nothing for model-only form context results', () => {
  // `form.schema` / `form.options` 是给模型的字段定义与候选名单，没有界面形态。
  // 掉进「暂不支持」兜底会让人以为功能坏了。
  for (const kind of ['form.schema', 'form.options']) {
    const { unmount } = render(
      <AiToolResultCard
        payload={{ ok: true, render: { kind, payload: { schemaVersion: 1 } } }}
      />,
    );
    expect(screen.queryByText(/暂不支持展示/)).toBeNull();
    expect(screen.queryByText(/新增用户表单共/)).toBeNull();
    unmount();
  }
});
