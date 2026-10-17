import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SystemAdminProvider } from '@yishan/core-system-admin';
import UserList from '@yishan/core-system-admin/pages/user';
import {
  clearUserCreateFormHandle,
  peekUserCreateFormHandle,
  registerUserCreateDraftLink,
  registerUserCreateFormHandle,
  publishUserCreateFormChange,
} from '@yishan/core-system-admin/form-assistance';
import { AiChatContext } from '../context/AiChatProvider';
import { AiFormAssistanceContext } from '../context/formAssistance';
import {
  AiNativeFormBridge,
  diffDraftFields,
} from '../components/AiNativeFormBridge';

/**
 * Task 9 行为测试：从**本轮**对话草稿到原生表单，再到人工提交。
 *
 * 三组断言，各自有真实行为：
 *  A. 自动路径：本轮 uiRequest 才自动开表单；旧身份 / 旧版本 / 已被用户改过的字段
 *     都不会被自动套用；未保存的编辑挡住自动导航；不支持的页面明说。
 *  B. 同步：用户手改按字段合并后 PATCH 回草稿，密码永不在载荷里；提交前必 flush。
 *  C. 提交：创建**只**由原生表单的「确定」发起，且必须等同步完成、带精确草稿版本；
 *     双击被本地锁挡住；网络异常只读查询草稿，绝不自动重发。
 *
 * 草稿网络客户端整体 mock 掉：这里要断的是**接线**，不是 HTTP。
 */
const mockRequest = jest.fn();
const mockPush = jest.fn();

jest.mock('@umijs/max', () => ({
  request: (...args: unknown[]) => mockRequest(...args),
  history: {
    push: (...args: unknown[]) => mockPush(...args),
    location: { pathname: '/system/user' },
  },
}));

const mockGetDraft = jest.fn();
const mockPatchDraft = jest.fn();

jest.mock('../services/actionDraftService', () => ({
  getActionDraft: (...args: unknown[]) => mockGetDraft(...args),
  patchActionDraft: (...args: unknown[]) => mockPatchDraft(...args),
  listConversationDrafts: jest.fn(),
  cancelActionDraft: jest.fn(),
}));

// Provider 只是这里的一个 context 容器；真正的聊天引擎与本文件无关，
// 而 ai-sdk 依赖 jsdom 没有的 TransformStream。
jest.mock('ai', () => ({ DefaultChatTransport: class {} }));
jest.mock('@ai-sdk/react', () => ({
  useChat: () => ({
    messages: [],
    status: 'ready',
    error: undefined,
    sendMessage: jest.fn(),
    regenerate: jest.fn(),
    stop: jest.fn(),
    setMessages: jest.fn(),
    clearError: jest.fn(),
  }),
}));

/* ------------------------------------------------------------------ 共享素材 */

const EDITABLE_FIELDS = [
  'username',
  'email',
  'phone',
  'realName',
  'nickname',
  'gender',
  'birthDate',
  'status',
  'deptIds',
  'roleIds',
];

const CREATE_FORM = {
  schemaVersion: 1,
  defaults: {},
  editableFields: EDITABLE_FIELDS,
  missingFields: [],
  fields: [
    { name: 'username', label: '登录名称', required: false, sensitive: false, selector: 'text', constraints: {} },
    { name: 'phone', label: '手机号码', required: true, sensitive: false, selector: 'text', constraints: { maxLength: 11 } },
    { name: 'email', label: '邮箱', required: false, sensitive: false, selector: 'email', constraints: {} },
    { name: 'realName', label: '真实姓名', required: false, sensitive: false, selector: 'text', constraints: {} },
    { name: 'nickname', label: '用户昵称', required: false, sensitive: false, selector: 'text', constraints: {} },
    { name: 'password', label: '用户密码', required: true, sensitive: true, selector: 'password', constraints: {} },
    { name: 'gender', label: '用户性别', required: false, sensitive: false, selector: 'enum', constraints: { enum: ['0', '1', '2'] } },
    { name: 'status', label: '状态', required: false, sensitive: false, selector: 'enum', constraints: { enum: ['0', '1', '2'] } },
    { name: 'birthDate', label: '出生日期', required: false, sensitive: false, selector: 'date', constraints: {} },
    { name: 'deptIds', label: '归属部门', required: false, sensitive: false, selector: 'deptTree', constraints: {} },
    { name: 'roleIds', label: '角色', required: false, sensitive: false, selector: 'roleOptions', constraints: {} },
  ],
};

const LIST_ROW = {
  id: 7,
  username: 'existing',
  realName: '已有用户',
  nickname: 'nick',
  email: 'a@b.com',
  phone: '13900000000',
  status: '1',
  gender: '0',
  deptIds: [],
  roleIds: [],
};

/** 一份可编辑草稿。 */
function draft(overrides: Record<string, unknown> = {}) {
  return {
    draftId: 'draft-1',
    ownerId: 1,
    conversationId: 'conv-1',
    module: 'system',
    action: 'user.create',
    schemaVersion: 1,
    formData: { username: 'zhangsan', realName: '张三' },
    missingFields: [
      { name: 'password', label: '初始密码', required: true, sensitive: true, mustCompleteInForm: true },
    ],
    validationErrors: [],
    draftVersion: 4,
    status: 'collecting',
    resultRef: null,
    failureReason: null,
    createdAt: '2026-10-17T00:00:00.000Z',
    updatedAt: '2026-10-17T00:00:00.000Z',
    expiresAt: '2026-10-18T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  mockRequest.mockReset();
  mockPush.mockReset();
  mockGetDraft.mockReset();
  mockPatchDraft.mockReset();
  clearUserCreateFormHandle();
  mockGetDraft.mockResolvedValue(draft());
  mockPatchDraft.mockImplementation(async (_id: string, version: number) =>
    draft({ draftVersion: version + 1 }),
  );
  mockRequest.mockImplementation(async (
    url: string,
    options?: { params?: Record<string, unknown>; method?: string },
  ) => {
    const params = options?.params ?? {};
    if (String(url).includes('/create-form')) return { success: true, data: CREATE_FORM };
    if (String(url).includes('/create-options')) {
      return {
        success: true,
        data: {
          departments: [{ id: 1, name: '总部', parentId: 0 }],
          roles: [{ id: 2, name: '普通角色' }],
          total: 1,
          page: 1,
          pageSize: 20,
          creatable: true,
        },
      };
    }
    if (String(url).includes('/admin/users') && options?.method !== 'POST') {
      return { success: true, data: [LIST_ROW], pagination: { total: 1 } };
    }
    return { success: true, data: { id: 99 } };
  });
});

const resizeObserverDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'ResizeObserver');
const messageChannelDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'MessageChannel');
const nativeGetComputedStyle = window.getComputedStyle;

beforeAll(() => {
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    value: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  });
  // rc-field-form 用 MessageChannel 派发校验通知，jsdom 没有。
  Object.defineProperty(globalThis, 'MessageChannel', {
    configurable: true,
    value: class {
      port1: { onmessage?: (event: { data: unknown }) => void } = {};
      port2 = {
        postMessage: (data: unknown) => setTimeout(() => this.port1.onmessage?.({ data }), 0),
      };
    },
  });
  jest
    .spyOn(window, 'getComputedStyle')
    .mockImplementation((element) => nativeGetComputedStyle(element));
});

afterAll(() => {
  jest.restoreAllMocks();
  if (resizeObserverDescriptor) {
    Object.defineProperty(globalThis, 'ResizeObserver', resizeObserverDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, 'ResizeObserver');
  }
  if (messageChannelDescriptor) {
    Object.defineProperty(globalThis, 'MessageChannel', messageChannelDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, 'MessageChannel');
  }
});

/* ------------------------------------------------------------ A. 自动路径 */

/** 一个假协作句柄：结构与真实句柄一致（只有 snapshot/open/apply）。 */
function fakeHandle(fields: Record<string, unknown> = {}, dirtyFields: string[] = []) {
  const state = {
    instanceId: 'user.create#1',
    revision: 7,
    fields: { ...fields },
    dirtyFields,
  };
  return {
    state,
    open: jest.fn(async () => ({ ...state })),
    snapshot: jest.fn(() => ({
      target: 'user.create' as const,
      instanceId: state.instanceId,
      revision: state.revision,
      fields: { ...state.fields },
      dirtyFields,
    })),
    apply: jest.fn(async () => ({ applied: true, conflicts: [] as string[] })),
  };
}

function renderBridge(options: { identityEpoch?: number } = {}) {
  const setOutcome = jest.fn();
  const minimize = jest.fn();
  const bound: { current: unknown } = { current: null };
  const assistance = {
    identityEpoch: options.identityEpoch ?? 3,
    outcomes: {},
    setOutcome,
    bindHandlers: (handlers: unknown) => {
      bound.current = handlers;
      return () => {
        bound.current = null;
      };
    },
    requestRestore: jest.fn(),
    flush: async () => {},
  };
  const view = render(
    <AiChatContext.Provider value={{ viewMode: 'floating', minimize, formAssistance: assistance } as never}>
      <AiFormAssistanceContext.Provider value={assistance as never}>
        <AiNativeFormBridge />
      </AiFormAssistanceContext.Provider>
    </AiChatContext.Provider>,
  );
  return { setOutcome, minimize, bound, view };
}

function liveRequest(overrides: Record<string, unknown> = {}) {
  return {
    uiRequestId: 'req-1',
    draftId: 'draft-1',
    draftVersion: 4,
    identityEpoch: 3,
    ...overrides,
  };
}

test('本轮活动请求自动打开原生表单并套用草稿字段', async () => {
  const handle = fakeHandle();
  const unregister = registerUserCreateFormHandle(handle as never);
  const { bound, setOutcome } = renderBridge();
  await act(async () => {
    (bound.current as { onUiRequest: (r: unknown) => void }).onUiRequest(liveRequest());
  });
  await waitFor(() => expect(handle.apply).toHaveBeenCalled());
  expect(handle.open).toHaveBeenCalledTimes(1);
  expect(handle.apply).toHaveBeenCalledWith({
    instanceId: 'user.create#1',
    baseRevision: 7,
    fields: { username: 'zhangsan', realName: '张三' },
  });
  expect(setOutcome).toHaveBeenCalledWith(
    'draft-1',
    expect.objectContaining({ status: 'notice' }),
  );
  unregister();
});

test('旧身份的请求完全不动作（换账号后迟到的结果不能改界面）', async () => {
  const handle = fakeHandle();
  const unregister = registerUserCreateFormHandle(handle as never);
  const { bound, setOutcome } = renderBridge({ identityEpoch: 7 });
  await act(async () => {
    (bound.current as { onUiRequest: (r: unknown) => void }).onUiRequest(
      liveRequest({ identityEpoch: 3 }),
    );
  });
  expect(handle.open).not.toHaveBeenCalled();
  expect(handle.apply).not.toHaveBeenCalled();
  expect(setOutcome).not.toHaveBeenCalled();
  unregister();
});

test('表单里有用户未保存的修改时，不自动导航也不自动填入', async () => {
  const handle = fakeHandle({ username: 'manual' }, ['username']);
  const unregister = registerUserCreateFormHandle(handle as never);
  const { bound, setOutcome } = renderBridge();
  await act(async () => {
    (bound.current as { onUiRequest: (r: unknown) => void }).onUiRequest(liveRequest());
  });
  await waitFor(() => expect(setOutcome).toHaveBeenCalled());
  expect(handle.open).not.toHaveBeenCalled();
  expect(handle.apply).not.toHaveBeenCalled();
  expect(mockPush).not.toHaveBeenCalled();
  expect(setOutcome).toHaveBeenCalledWith(
    'draft-1',
    expect.objectContaining({ status: 'blocked' }),
  );
  unregister();
});

test('没有协作表单时明说暂不支持，且不编造字段', async () => {
  const { bound, setOutcome } = renderBridge();
  await act(async () => {
    (bound.current as { onUiRequest: (r: unknown) => void }).onUiRequest(liveRequest());
  });
  // 等满「等句柄」的窗口之后才判定为不支持。
  await waitFor(() => expect(setOutcome).toHaveBeenCalled(), { timeout: 5000 });
  expect(setOutcome).toHaveBeenCalledWith(
    'draft-1',
    expect.objectContaining({ status: 'unsupported' }),
  );
});

test('表单已变（旧版本/已关闭）时不套用，也不弹确认', async () => {
  const handle = fakeHandle({ username: 'manual' }, ['username']);
  handle.apply.mockResolvedValue({
    applied: false,
    conflicts: ['__revision__'],
  } as never);
  const unregister = registerUserCreateFormHandle(handle as never);
  const { bound, setOutcome } = renderBridge();
  await act(async () => {
    (bound.current as { onRestore: (id: string) => void }).onRestore('draft-1');
  });
  await waitFor(() => expect(setOutcome).toHaveBeenCalled());
  expect(handle.apply).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(/确认覆盖/)).toBeNull();
  unregister();
});

test('覆盖用户改过的字段：先展示原值与新值，确认后只授权被确认的字段', async () => {
  const handle = fakeHandle({ username: 'manual-name' }, ['username']);
  handle.apply.mockResolvedValueOnce({
    applied: false,
    conflicts: ['username'],
  } as never);
  const unregister = registerUserCreateFormHandle(handle as never);
  const { bound } = renderBridge();
  // 用户主动恢复时才走这一段：自动路径在有未保存编辑时是直接停手的（上一条测试）。
  await act(async () => {
    (bound.current as { onRestore: (id: string) => void }).onRestore('draft-1');
  });
  await waitFor(() =>
    expect(screen.getByText(/确认覆盖你在表单里改过的内容/)).toBeTruthy(),
  );
  expect(screen.getByText('manual-name')).toBeTruthy();
  expect(screen.getByText('zhangsan')).toBeTruthy();

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: '确认覆盖' }));
  });
  await waitFor(() => expect(handle.apply).toHaveBeenCalledTimes(2));
  // 授权名单来自用户确认过的那份差异，而不是补丁的键集合。
  const retryInput = (handle.apply.mock.calls[1] as unknown as [
    { authorizedFields?: string[] },
  ])[0];
  expect(retryInput.authorizedFields).toEqual(['username']);
  unregister();
});

test('补丁写进去了但角色失效按提示处理，不重试', async () => {
  const handle = fakeHandle();
  handle.apply.mockResolvedValue({ applied: true, conflicts: ['roleIds'] } as never);
  const unregister = registerUserCreateFormHandle(handle as never);
  const { bound, setOutcome } = renderBridge();
  await act(async () => {
    (bound.current as { onUiRequest: (r: unknown) => void }).onUiRequest(liveRequest());
  });
  await waitFor(() => expect(setOutcome).toHaveBeenCalled());
  expect(handle.apply).toHaveBeenCalledTimes(1);
  expect(setOutcome).toHaveBeenCalledWith(
    'draft-1',
    expect.objectContaining({ status: 'conflict' }),
  );
  unregister();
});

test('已结束的草稿（已完成/提交中/取消）不会被自动复活', async () => {
  const handle = fakeHandle();
  const unregister = registerUserCreateFormHandle(handle as never);
  const { bound, setOutcome } = renderBridge();
  for (const status of ['completed', 'submitting', 'cancelled']) {
    mockGetDraft.mockResolvedValueOnce(draft({ status }));
    await act(async () => {
      (bound.current as { onUiRequest: (r: unknown) => void }).onUiRequest(
        liveRequest({ uiRequestId: `req-${status}` }),
      );
    });
  }
  await waitFor(() => expect(setOutcome).toHaveBeenCalledTimes(3));
  expect(handle.apply).not.toHaveBeenCalled();
  unregister();
});

test('只有用户点「继续填写」才读服务器最新草稿（历史渲染无副作用）', async () => {
  const handle = fakeHandle();
  const unregister = registerUserCreateFormHandle(handle as never);
  const { bound } = renderBridge();
  // 卡片被历史消息渲染出来时，没有任何自动动作发生。
  expect(mockGetDraft).not.toHaveBeenCalled();
  expect(handle.open).not.toHaveBeenCalled();

  mockGetDraft.mockResolvedValueOnce(draft({ formData: { username: 'server-newest' } }));
  await act(async () => {
    (bound.current as { onRestore: (id: string) => void }).onRestore('draft-1');
  });
  await waitFor(() => expect(handle.apply).toHaveBeenCalled());
  expect(mockGetDraft).toHaveBeenCalledWith('draft-1');
  const appliedInput = (handle.apply.mock.calls[0] as unknown as [
    { fields: unknown },
  ])[0];
  expect(appliedInput.fields).toEqual({ username: 'server-newest' });
  unregister();
});

/* --------------------------------------------------------------- B. 同步 */

test('字段差：密码永不入载荷，清空的键用 null，未变的省略', () => {
  const patch = diffDraftFields(
    { username: 'a', nickname: 'n', password: 'old-secret' },
    { username: 'a', nickname: 'n2', phone: '138', password: 'new-secret' },
  );
  expect(patch).toEqual({ nickname: 'n2', phone: '138' });
  expect(JSON.stringify(patch)).not.toContain('secret');
});

test('表单变化合并延迟后同步，且载荷里没有密码', async () => {
  jest.useFakeTimers();
  try {
    const handle = fakeHandle({ username: 'zhangsan', realName: '张三' });
    const unregister = registerUserCreateFormHandle(handle as never);
    const { bound } = renderBridge();
    await act(async () => {
      (bound.current as { onUiRequest: (r: unknown) => void }).onUiRequest(liveRequest());
    });
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    // 助手写入的值本来就来自草稿，没有可同步的差。
    expect(mockPatchDraft).not.toHaveBeenCalled();

    // 用户在表单里改了昵称 —— 合并延迟内不该发请求。
    await act(async () => {
      publishUserCreateFormChange({
        target: 'user.create',
        instanceId: 'user.create#1',
        revision: 8,
        fields: { username: 'zhangsan', realName: '张三', nickname: '小张' },
        dirtyFields: ['nickname'],
      });
    });
    expect(mockPatchDraft).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(mockPatchDraft).toHaveBeenCalledWith('draft-1', 4, { nickname: '小张' });

    // flush（发送下一轮消息前 / 人工提交前）把还没到延迟窗口的编辑立刻落地。
    handle.state.fields = {
      username: 'zhangsan',
      realName: '张三',
      nickname: '小张',
      email: 'a@b.c',
    };
    await act(async () => {
      publishUserCreateFormChange({
        target: 'user.create',
        instanceId: 'user.create#1',
        revision: 9,
        fields: { username: 'zhangsan', realName: '张三', nickname: '小张', email: 'a@b.c' },
        dirtyFields: ['nickname', 'email'],
      });
    });
    await act(async () => {
      await (bound.current as { flush: () => Promise<void> }).flush();
    });
    expect(mockPatchDraft).toHaveBeenLastCalledWith('draft-1', 5, { email: 'a@b.c' });
    const payload = JSON.stringify(mockPatchDraft.mock.calls);
    expect(payload).not.toContain('password');
    unregister();
  } finally {
    jest.useRealTimers();
  }
});

/* ------------------------------------------------------------- C. 人工提交 */

function renderUserList() {
  return render(
    <SystemAdminProvider
      value={{
        currentUser: { id: 1, username: 'admin' } as never,
        dictDataMap: {
          user_status: [{ label: '启用', value: '1' }],
          user_gender: [{ label: '未知', value: '0' }],
        },
      }}
    >
      <UserList />
    </SystemAdminProvider>,
  );
}

const createCalls = () =>
  mockRequest.mock.calls.filter(
    ([url, options]) =>
      String(url).includes('/admin/users') && (options as { method?: string })?.method === 'POST',
  );

async function fillCreateForm() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /新建/ }));
  });
  await waitFor(() => expect(peekUserCreateFormHandle()).not.toBeNull());
  await act(async () => {
    fireEvent.change(await screen.findByPlaceholderText('请输入登录名称'), {
      target: { value: 'zhangsan' },
    });
    fireEvent.change(screen.getByPlaceholderText('请输入手机号'), {
      target: { value: '13800000000' },
    });
    fireEvent.change(screen.getByPlaceholderText('请输入密码'), {
      target: { value: 'secret123' },
    });
  });
}

test('人工「确定」：等同步完成后带精确草稿版本调用一次创建，密码只在这一请求里', async () => {
  let release = () => {};
  const prepare = jest.fn(
    () =>
      new Promise<{ draftId: string; draftVersion: number }>((resolve) => {
        release = () => resolve({ draftId: 'draft-1', draftVersion: 9 });
      }),
  );
  const reconcile = jest.fn(async () => 'unknown' as const);
  const unregisterLink = registerUserCreateDraftLink({ prepare, reconcile });

  renderUserList();
  await fillCreateForm();

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /确 定|确定/ }));
  });
  // 同步没落定之前不得发起创建。
  expect(prepare).toHaveBeenCalledTimes(1);
  expect(createCalls()).toHaveLength(0);

  await act(async () => {
    release();
    await Promise.resolve();
  });
  await waitFor(() => expect(createCalls()).toHaveLength(1));
  const payload = (createCalls()[0][1] as { data: Record<string, unknown> }).data;
  expect(payload.draftSubmission).toEqual({ draftId: 'draft-1', draftVersion: 9 });
  expect(payload.password).toBe('secret123');
  expect(payload.username).toBe('zhangsan');
  unregisterLink();
});

test('双击「确定」只发一次创建（本地锁 + 服务端幂等）', async () => {
  const prepare = jest.fn(async () => ({ draftId: 'draft-1', draftVersion: 9 }));
  const unregisterLink = registerUserCreateDraftLink({
    prepare,
    reconcile: async () => 'unknown',
  });

  renderUserList();
  await fillCreateForm();

  const okButton = screen.getByRole('button', { name: /确 定|确定/ });
  await act(async () => {
    fireEvent.click(okButton);
  });
  await act(async () => {
    fireEvent.click(okButton);
  });
  await waitFor(() => expect(createCalls()).toHaveLength(1));
  expect(prepare).toHaveBeenCalledTimes(1);
  unregisterLink();
});

test('创建请求网络异常：只读查询草稿，绝不自动重发创建', async () => {
  mockRequest.mockImplementation(async (
    url: string,
    options?: { method?: string },
  ) => {
    const href = String(url);
    if (href.includes('/create-form')) return { success: true, data: CREATE_FORM };
    if (href.includes('/create-options')) {
      return { success: true, data: { departments: [], roles: [], total: 0, page: 1, pageSize: 20, creatable: true } };
    }
    if (href.includes('/admin/users') && options?.method !== 'POST') {
      return { success: true, data: [LIST_ROW], pagination: { total: 1 } };
    }
    if (href.includes('/admin/users') && options?.method === 'POST') {
      // 响应丢了：服务端可能已经创建成功。
      throw new Error('Network Error');
    }
    return { success: true, data: {} };
  });
  const reconcile = jest.fn(async () => 'unknown' as const);
  const unregisterLink = registerUserCreateDraftLink({
    prepare: async () => ({ draftId: 'draft-1', draftVersion: 9 }),
    reconcile,
  });

  renderUserList();
  await fillCreateForm();
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /确 定|确定/ }));
  });

  await waitFor(() => expect(reconcile).toHaveBeenCalledTimes(1));
  expect(createCalls()).toHaveLength(1);
  // 表单仍然开着，用户可以自己核对后再次保存。
  expect(document.querySelectorAll('.ant-modal')).toHaveLength(1);
  unregisterLink();
});

test('业务失败：表单数据与密码控件保留，创建不会被重发', async () => {
  mockRequest.mockImplementation(async (
    url: string,
    options?: { method?: string },
  ) => {
    const href = String(url);
    if (href.includes('/create-form')) return { success: true, data: CREATE_FORM };
    if (href.includes('/create-options')) {
      return { success: true, data: { departments: [], roles: [], total: 0, page: 1, pageSize: 20, creatable: true } };
    }
    if (href.includes('/admin/users') && options?.method === 'POST') {
      return { success: false, message: '登录名称已存在' };
    }
    if (href.includes('/admin/users')) {
      return { success: true, data: [LIST_ROW], pagination: { total: 1 } };
    }
    return { success: true, data: {} };
  });
  const unregisterLink = registerUserCreateDraftLink({
    prepare: async () => ({ draftId: 'draft-1', draftVersion: 9 }),
    reconcile: async () => 'unknown',
  });

  renderUserList();
  await fillCreateForm();
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /确 定|确定/ }));
  });
  await waitFor(() => expect(createCalls()).toHaveLength(1));

  expect(document.querySelectorAll('.ant-modal')).toHaveLength(1);
  const passwordInput = document.querySelector(
    'input[type="password"]',
  ) as HTMLInputElement | null;
  expect(passwordInput?.value).toBe('secret123');
  expect((screen.getByPlaceholderText('请输入登录名称') as HTMLInputElement).value).toBe(
    'zhangsan',
  );
  unregisterLink();
});
