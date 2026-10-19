import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import React from 'react';

const mockSend = jest.fn();
// Umi Jest runs CommonJS; isolate only the lazy view loader, leaving Ant Design Popover real.
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  lazy: () => () => '浮层聊天内容',
}));
const mockStop = jest.fn().mockResolvedValue(undefined);
const mockRegenerate = jest.fn().mockResolvedValue(undefined);
const mockCreate = jest.fn();
const mockDetail = jest.fn();
let mockOnError: (error: Error) => void = () => {};
let mockOnFinish: (event: {
  message: import('ai').UIMessage;
  isAbort: boolean;
  isError: boolean;
}) => void = () => {};
let mockCurrentUser: { id: number; permissions?: string[] } | undefined;
let mockRouteChange: (update: {
  location: { pathname: string; search: string; hash: string };
}) => void = () => {};
jest.mock('@umijs/max', () => ({
  useModel: () => ({ initialState: { currentUser: mockCurrentUser } }),
  useLocation: () => ({ pathname: '/demo/todos' }),
  history: {
    location: { pathname: '/demo/todos', search: '', hash: '' },
    listen: (callback: typeof mockRouteChange) => {
      mockRouteChange = callback;
      return () => {};
    },
  },
}));
let mockSetMessages: (messages: import('ai').UIMessage[]) => void = () => {};
type mockUIMessage = import('ai').UIMessage;
let mockEngineMounts = 0;
jest.mock('ai', () => ({ DefaultChatTransport: class {} }));
jest.mock('@ai-sdk/react', () => ({
  useChat: (options: {
    onError?: (error: Error) => void;
    onFinish?: typeof mockOnFinish;
  }) => {
    mockOnFinish = options.onFinish || (() => {});
    mockOnError = options.onError || (() => {});
    const hooks = jest.requireActual<typeof import('react')>('react');
    const [messages, setMessages] = hooks.useState([] as mockUIMessage[]);
    mockSetMessages = setMessages;
    hooks.useEffect(() => {
      mockEngineMounts += 1;
    }, []);
    return {
      messages,
      setMessages,
      status: 'ready',
      error: undefined,
      clearError: jest.fn(),
      sendMessage: mockSend,
      stop: mockStop,
      regenerate: mockRegenerate,
    };
  },
}));
jest.mock('../services/aiChatService', () => ({
  listConversations: jest.fn().mockResolvedValue([
    {
      id: '1',
      title: '会话一',
      createdAt: '2026-10-16',
      updatedAt: '2026-10-16',
    },
  ]),
  createConversation: (...args: unknown[]) => mockCreate(...args),
  getConversation: (...args: unknown[]) => mockDetail(...args),
  renameConversation: jest.fn().mockResolvedValue(undefined),
  deleteConversation: jest.fn().mockResolvedValue(undefined),
  chatError: (error: Error) => error.message,
}));

import { AiChatHost } from '../AiChatHost';
import {
  messageText,
  normalizeCodeLanguage,
  toBubbleItems,
  visibleAssistantText,
} from '../adapters/messages';
import { AiChatIdentityBridge } from '../components/AiChatIdentityBridge';
import { AiChatProvider } from '../context/AiChatProvider';
import { useAiChat } from '../hooks/useAiChat';

let current: import('../context/AiChatProvider').AiChatContextValue;
function Consumer({ view }: { view: string }) {
  current = useAiChat();
  return (
    <div>
      {view}:{current.draft}:{current.messages.map(messageText).join(',')}
    </div>
  );
}
function Harness({
  view = '浮层',
  identity = '7',
}: {
  view?: string;
  identity?: string;
}) {
  return (
    <AiChatProvider>
      <Identity identity={identity} />
      <Consumer key={view} view={view} />
    </AiChatProvider>
  );
}
function Identity({ identity }: { identity: string }) {
  const { setIdentity } = useAiChat();
  React.useEffect(() => {
    setIdentity(identity || null);
  }, [identity, setIdentity]);
  return null;
}

// JSDOM has no layout observer; Popover's click and controlled-open behavior remain real.
Object.defineProperty(globalThis, 'ResizeObserver', {
  configurable: true,
  value: class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
});

beforeEach(() => {
  jest.clearAllMocks();
  mockEngineMounts = 0;
  mockSend.mockResolvedValue(undefined);
  mockCreate.mockResolvedValue({ id: '2', title: '新对话', messages: [] });
  mockDetail.mockResolvedValue({
    id: '1',
    title: '会话一',
    messages: [
      { id: 'u1', role: 'user', parts: [{ type: 'text', text: '历史' }] },
    ],
  });
});

it.each([
  ['js', 'javascript'],
  ['ts', 'typescript'],
  ['sh', 'bash'],
  ['py', 'python'],
  [' JS title="example"', 'javascript'],
  ['unknown-language', 'unknown-language'],
  ['constructor', 'constructor'],
  ['__proto__', '__proto__'],
  ['', 'text'],
])('代码语言 %s 正确规范为 %s，未知语言交给纯文本回退', (input, expected) => {
  expect(normalizeCodeLanguage(input)).toBe(expected);
});

it('从 UIMessage.parts 读取文本，忽略推理与工具数据', () => {
  expect(
    messageText({
      id: 'a',
      role: 'assistant',
      parts: [
        { type: 'text', text: '你好' },
        { type: 'reasoning', text: '内部推理' },
        { type: 'text', text: '世界' },
      ],
    }),
  ).toBe('你好世界');
});

it('适配 parts、角色、流式状态及等待占位，终止后刷新为最终内容', () => {
  const messages: import('ai').UIMessage[] = [
    { id: 'u', role: 'user', parts: [{ type: 'text', text: '问题' }] },
    {
      id: 'a',
      role: 'assistant',
      parts: [
        { type: 'text', text: '部分' },
        { type: 'reasoning', text: '隐藏' },
        { type: 'text', text: '回答' },
      ],
    },
  ];
  expect(toBubbleItems(messages, true)).toEqual([
    {
      key: 'u',
      role: 'user',
      content: '问题',
      streaming: false,
      status: 'success',
      loading: false,
    },
    {
      key: 'a',
      role: 'assistant',
      content: '部分回答',
      streaming: true,
      status: 'updating',
      loading: false,
    },
  ]);
  expect(toBubbleItems(messages, false)[1]).toMatchObject({
    streaming: false,
    status: 'success',
  });
  expect(toBubbleItems(messages.slice(0, 1), true)[1]).toMatchObject({
    role: 'assistant',
    loading: true,
  });
});

it('超长输入保留草稿并阻止请求', async () => {
  render(<Harness />);
  act(() => current.setDraft('字'.repeat(12001)));
  await act(async () => {
    await current.send(current.draft);
  });
  expect(mockSend).not.toHaveBeenCalled();
  expect(current.draft).toHaveLength(12001);
  expect(current.error).toContain('12000');
});

it('视图切换保留草稿且只挂载一个聊天引擎', async () => {
  const view = render(<Harness />);
  await act(async () => {
    current.setDraft('未发送');
  });
  view.rerender(<Harness view="页面" />);
  expect(screen.getByText('页面:未发送:')).toBeTruthy();
  expect(mockEngineMounts).toBe(1);
  expect(mockSend).not.toHaveBeenCalled();
  expect(mockStop).not.toHaveBeenCalled();
});

it('会话独立草稿，加载服务端 parts 历史', async () => {
  render(<Harness />);
  act(() => current.setDraft('新会话草稿'));
  await act(async () => {
    await current.selectConversation('1');
  });
  expect(current.draft).toBe('');
  expect(messageText(current.messages[0])).toBe('历史');
  act(() => current.setDraft('旧会话草稿'));
  act(() => current.newConversation());
  expect(current.draft).toBe('新会话草稿');
  await act(async () => {
    await current.selectConversation('1');
  });
  expect(current.draft).toBe('旧会话草稿');
});

it('同一发送周期只请求一次，生成时禁止新建/切换/删除，关闭浮层不会停止', async () => {
  let finish: () => void = () => {};
  mockSend.mockReturnValue(
    new Promise<void>((resolve) => {
      finish = resolve;
    }),
  );
  render(<Harness />);
  act(() => {
    void current.send('你好');
    void current.send('重复');
  });
  await waitFor(() => expect(mockSend).toHaveBeenCalledTimes(1));
  expect(current.busy).toBe(true);
  act(() => {
    current.newConversation();
    current.setViewMode('closed');
  });
  await act(async () => {
    await current.selectConversation('1');
    await current.removeConversation('2');
  });
  expect(current.activeId).toBe('2');
  expect(mockStop).not.toHaveBeenCalled();
  await act(async () => {
    finish();
  });
  expect(current.busy).toBe(false);
});

it('身份退出停止请求并清除消息、草稿和浮层', async () => {
  const view = render(<Harness />);
  act(() => {
    current.setDraft('私密内容');
    current.setViewMode('floating');
  });
  await act(async () => {
    await current.selectConversation('1');
  });
  view.rerender(<Harness identity="" />);
  await waitFor(() => expect(current.authorized).toBe(false));
  expect(current.messages).toEqual([]);
  expect(current.draft).toBe('');
  expect(current.viewMode).toBe('closed');
  expect(mockStop).toHaveBeenCalledTimes(1);
});

it('创建会话期间停止，不会在创建完成后开始生成', async () => {
  let created: (conversation: object) => void = () => {};
  mockCreate.mockReturnValue(
    new Promise((resolve) => {
      created = resolve;
    }),
  );
  render(<Harness />);
  act(() => {
    current.setDraft('待发送');
    void current.send('待发送');
  });
  await act(async () => {
    await current.stop();
  });
  await act(async () => {
    created({ id: '2', title: '新对话', messages: [] });
  });
  expect(mockSend).not.toHaveBeenCalled();
  expect(current.draft).toBe('待发送');
  expect(current.busy).toBe(false);
});

it('重新生成调用原生 regenerate，不追加新用户消息', async () => {
  render(<Harness />);
  await act(async () => {
    await current.selectConversation('1');
  });
  await act(async () => {
    await current.regenerate();
  });
  expect(mockRegenerate).toHaveBeenCalledWith({ messageId: undefined });
  expect(mockSend).not.toHaveBeenCalled();
});

it('身份变更期间等待旧请求停止，旧停止回调不能清空新用户消息', async () => {
  let stopped: () => void = () => {};
  mockStop.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      stopped = resolve;
    }),
  );
  const view = render(<Harness />);
  view.rerender(<Harness identity="8" />);
  await act(async () => {
    await current.selectConversation('1');
  });
  expect(current.messages).toEqual([]);
  await act(async () => {
    stopped();
  });
  await act(async () => {
    await current.selectConversation('1');
  });
  expect(messageText(current.messages[0])).toBe('历史');
});

it('Umi 身份桥在 Router 外工作，缺少权限不放行且登录页清除身份', async () => {
  mockCurrentUser = { id: 7 };
  const view = render(
    <AiChatProvider>
      <AiChatIdentityBridge />
      <Consumer view="桥" />
    </AiChatProvider>,
  );
  expect(current.authorized).toBe(false);
  mockCurrentUser = { id: 7, permissions: ['ai:chat:use'] };
  view.rerender(
    <AiChatProvider>
      <AiChatIdentityBridge />
      <Consumer view="桥" />
    </AiChatProvider>,
  );
  expect(current.authorized).toBe(true);
  act(() =>
    mockRouteChange({
      location: { pathname: '/user/login', search: '', hash: '' },
    }),
  );
  await waitFor(() => expect(current.authorized).toBe(false));
});

it('创建会话时编辑的新草稿不会被旧发送清空', async () => {
  let created: (conversation: object) => void = () => {};
  mockCreate.mockReturnValue(
    new Promise((resolve) => {
      created = resolve;
    }),
  );
  render(<Harness />);
  act(() => {
    current.setDraft('第一条');
    void current.send('第一条');
  });
  act(() => current.setDraft('下一条草稿'));
  await act(async () => {
    created({ id: '2', title: '新对话', messages: [] });
  });
  expect(current.draft).toBe('下一条草稿');
});

it('SDK onError 后 sendMessage 正常 resolve 时仍恢复原稿，保留之后编辑的草稿', async () => {
  mockSend.mockImplementation(async () => {
    mockOnError(new Error('服务尚未配置'));
  });
  render(<Harness />);
  act(() => current.setDraft('需保留的问题'));
  await act(async () => {
    await current.send('需保留的问题');
  });
  expect(current.draft).toBe('需保留的问题');
  expect(current.error).toBe('服务尚未配置');
  let failed: () => void = () => {};
  mockSend.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        failed = () => {
          mockOnError(new Error('网络中断'));
          resolve();
        };
      }),
  );
  act(() => {
    void current.send('需保留的问题');
  });
  act(() => current.setDraft('新草稿'));
  await act(async () => {
    failed();
  });
  expect(current.draft).toBe('新草稿');
});

it('重试先核对历史：未落库用户消息用同一 id 重发，已落库则 regenerate', async () => {
  render(<Harness />);
  await act(async () => {
    await current.selectConversation('1');
  });
  mockDetail.mockResolvedValueOnce({ id: '1', title: '会话一', messages: [] });
  await act(async () => {
    await current.retry();
  });
  expect(mockSend).toHaveBeenCalledWith({
    messageId: 'u1',
    role: 'user',
    parts: [{ type: 'text', text: '历史' }],
  });
  mockSend.mockClear();
  await act(async () => {
    await current.retry();
  });
  expect(mockRegenerate).toHaveBeenCalledWith();
  expect(mockSend).not.toHaveBeenCalled();
});

it('悬浮按钮从关闭态打开浮窗，全程只有一份聊天引擎', async () => {
  render(
    <AiChatProvider>
      <Identity identity="7" />
      <AiChatHost />
    </AiChatProvider>,
  );
  expect(screen.queryByText('浮层聊天内容')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '打开 AI 助手' }));
  await waitFor(() => expect(screen.getByText('浮层聊天内容')).toBeTruthy());
  expect(mockEngineMounts).toBe(1);
  expect(mockSend).not.toHaveBeenCalled();
  expect(mockStop).not.toHaveBeenCalled();
});

it('浮窗 ↔ 全屏 ↔ 关闭只改变展示态，不重建引擎也不清空会话', async () => {
  render(
    <AiChatProvider>
      <Identity identity="7" />
      <AiChatHost />
      <Consumer view="宿主" />
    </AiChatProvider>,
  );
  await act(async () => {
    current.setViewMode('floating');
  });
  await act(async () => {
    await current.selectConversation('1');
  });
  // 草稿按会话分键，因此必须在选中会话之后输入
  act(() => {
    current.setDraft('未发送的草稿');
  });

  act(() => {
    current.expand();
  });
  expect(current.viewMode).toBe('fullscreen');

  act(() => {
    current.minimize();
  });
  expect(current.viewMode).toBe('floating');

  act(() => {
    current.setViewMode('closed');
  });
  expect(current.viewMode).toBe('closed');

  act(() => {
    current.toggleFloating();
  });
  expect(current.viewMode).toBe('floating');
  // 形态来回切换不得重建 useChat，也不得丢失会话与草稿
  expect(mockEngineMounts).toBe(1);
  expect(mockStop).not.toHaveBeenCalled();
  expect(current.activeId).toBe('1');
  expect(current.draft).toBe('未发送的草稿');
});

it('带结果卡片时仍显示模型的对话正文，只去掉与卡片重复的那句 summary', () => {
  // 回归：正文曾被整段折进「补充说明」，而折叠条默认收起 —— 助手每轮都不出声。
  expect(
    visibleAssistantText('收到。我先把您说的两项存进草稿。', [
      '已提取 1 个字段',
    ]),
  ).toBe('收到。我先把您说的两项存进草稿。');
  expect(
    visibleAssistantText('已提取 1 个字段', ['已提取 1 个字段']),
  ).toBeNull();
  expect(visibleAssistantText('  ', ['x'])).toBeNull();
  expect(visibleAssistantText('已处理。', [])).toBeNull();
  expect(
    visibleAssistantText('已填入新建用户表单，请核对后自行保存。', [undefined]),
  ).toBe('已填入新建用户表单，请核对后自行保存。');
});

it.each([false, true])(
  '原生表单只响应本轮成功结束的消息，取消=%s',
  async (aborted) => {
    render(<Harness />);
    await act(async () => {
      await current.selectConversation('1');
    });
    const onPrefill = jest.fn();
    const unbind = current.formAssistance.bindHandlers({
      onPrefill,
      onUiRequest: () => {},
      onRestore: () => {},
      flush: async () => {},
    });
    mockSend.mockImplementationOnce(async () => {
      mockOnFinish({
        message: {
          id: 'a-new',
          role: 'assistant',
          parts: [
            {
              type: 'tool-prepare_user_create',
              toolCallId: 'new-prefill',
              state: 'output-available',
              input: {},
              output: {
                ok: true,
                render: {
                  kind: 'form.prefill',
                  payload: {
                    target: 'user.create',
                    fields: { nickname: '阿伦' },
                    missing: [],
                  },
                },
              },
            },
          ],
        },
        isAbort: aborted,
        isError: false,
      });
    });
    act(() => current.setDraft('新建用户'));
    await act(async () => {
      await current.send('新建用户');
    });
    expect(onPrefill).toHaveBeenCalledTimes(aborted ? 0 : 1);
    unbind();
  },
);

it('完整工具结果在模型尚未结束时就交给原生表单，完成回调不重复应用', async () => {
  render(<Harness />);
  await act(async () => {
    await current.selectConversation('1');
  });
  const onPrefill = jest.fn();
  current.formAssistance.bindHandlers({
    onPrefill,
    onUiRequest: () => {},
    onRestore: () => {},
    flush: async () => {},
  });
  let resolve: () => void = () => {};
  mockSend.mockImplementationOnce(
    () =>
      new Promise<void>((done) => {
        resolve = done;
      }),
  );
  let pending: Promise<void>;
  await act(async () => {
    pending = current.send('帮我新建用户');
  });
  const message = {
    id: 'live-form',
    role: 'assistant',
    parts: [
      {
        type: 'tool-prepare_user_create',
        toolCallId: 'immediate',
        state: 'output-available',
        input: {},
        output: {
          ok: true,
          render: {
            kind: 'form.prefill',
            payload: {
              target: 'user.create',
              fields: { nickname: '即时' },
              missing: [],
            },
          },
        },
      },
    ],
  } as import('ai').UIMessage;
  await act(async () => mockSetMessages([message]));
  expect(onPrefill).toHaveBeenCalledTimes(1);
  await act(async () => {
    mockOnFinish({ message, isAbort: false, isError: false });
    resolve();
    await pending;
  });
  expect(onPrefill).toHaveBeenCalledTimes(1);
});

it('同一请求内不同工具调用的草稿增量分别应用，不按请求级ID丢弃第二次', async () => {
  render(<Harness />);
  await act(async () => {
    await current.selectConversation('1');
  });
  const onUiRequest = jest.fn();
  current.formAssistance.bindHandlers({
    onUiRequest,
    onRestore: () => {},
    flush: async () => {},
  });
  mockSend.mockImplementationOnce(async () => {
    mockOnFinish({
      isAbort: false,
      isError: false,
      message: {
        id: 'drafts',
        role: 'assistant',
        parts: [1, 2].map((version) => ({
          type: 'tool-update_form_draft',
          toolCallId: 'draft-call-' + version,
          state: 'output-available',
          input: {},
          output: {
            ok: true,
            render: {
              kind: 'action.draft',
              payload: {
                uiRequestId: 'same-request',
                draftId: 'draft-1',
                draftVersion: version,
              },
            },
          },
        })),
      } as import('ai').UIMessage,
    });
  });
  await act(async () => {
    await current.send('补充当前草稿');
  });
  expect(onUiRequest).toHaveBeenCalledTimes(2);
});
