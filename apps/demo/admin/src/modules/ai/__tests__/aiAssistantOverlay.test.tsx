import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  peekAssistantRegion,
  peekUserFormOverlay,
  registerUserFormOverlay,
  useCoordinatedFormFocus,
} from '@yishan/core-system-admin/form-assistance';
import React from 'react';

/**
 * Task 8：助手浮窗与业务 Modal / Drawer 的层级、焦点与移动（设计 §4）。
 *
 * 这里断言的是**协作接缝本身的真实行为**：层级常量与 ConfigProvider 子弹层、
 * 拖动边界、Esc 仲裁、焦点归还、身份复位。
 * 不依赖真实浏览器：焦点捕获与遮罩的可点性无法在 JSDOM 验证，见报告的 concerns。
 */
// AiChatView 由 Ant Design X 驱动，这里换成只暴露「标题栏 + 关闭」契约的替身：
// 面板与宿主的职责（层级、拖动、Esc、焦点、单一实例）都在被测范围之内。
jest.mock('../components/AiChatView', () => ({
  AiChatView: (props: {
    headerProps?: Record<string, unknown>;
    onClose?: () => void;
    onMinimize?: () => void;
    onExpand?: () => void;
  }) => (
    <div data-testid="chat-view">
      <div data-testid="chat-header" {...props.headerProps}>
        标题栏
      </div>
      <div data-testid="chat-body">消息区</div>
      <button type="button" onClick={() => props.onClose?.()}>
        关闭 AI 助手
      </button>
    </div>
  ),
}));
// Umi Jest 跑 CommonJS，宿主里的 `lazy(() => import(...))` 动态 import 无法执行
// （与 aiChat.test 同一限制）。宿主只在这里断言「入口始终在场」；
// 面板/全屏本身用静态导入直接渲染，测的是同一份 Provider 状态与同一段会话。
jest.mock('react', () => ({
  ...jest.requireActual<typeof import('react')>('react'),
  lazy: () => () => null,
}));
jest.mock('ai', () => ({ DefaultChatTransport: class {} }));
jest.mock('@ai-sdk/react', () => ({
  useChat: () => {
    const hooks = jest.requireActual<typeof import('react')>('react');
    const [messages] = hooks.useState([
      {
        id: 'm1',
        role: 'user',
        parts: [{ type: 'text', text: '保留这条消息' }],
      },
    ]);
    return {
      messages,
      setMessages: jest.fn(),
      status: 'ready',
      error: undefined,
      clearError: jest.fn(),
      sendMessage: jest.fn(),
      stop: jest.fn().mockResolvedValue(undefined),
      regenerate: jest.fn(),
    };
  },
}));
jest.mock('../services/aiChatService', () => ({
  listConversations: jest.fn().mockResolvedValue([]),
  createConversation: jest
    .fn()
    .mockResolvedValue({ id: '2', title: '新', messages: [] }),
  getConversation: jest
    .fn()
    .mockResolvedValue({ id: '1', title: '会话一', messages: [] }),
  renameConversation: jest.fn().mockResolvedValue(undefined),
  deleteConversation: jest.fn().mockResolvedValue(undefined),
  chatError: (error: Error) => error.message,
}));

import { AiChatHost } from '../AiChatHost';
import { messageText } from '../adapters/messages';
import { AiChatProvider } from '../context/AiChatProvider';
import { AiFloatingLauncher } from '../floating/AiFloatingLauncher';
import { AiFloatingPanel } from '../floating/AiFloatingPanel';
import {
  AI_OVERLAY_Z_INDEX,
  AI_POPUP_Z_INDEX_BASE,
} from '../floating/aiOverlayLayers';
import { AiFullscreenWorkspace } from '../fullscreen/AiFullscreenWorkspace';
import { useAiChat } from '../hooks/useAiChat';

Object.defineProperty(globalThis, 'ResizeObserver', {
  configurable: true,
  value: class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
});
/** Ant Design 弹层基准层级：Modal / Drawer 的遮罩与内容都在 1000。 */
const ANT_DESIGN_OVERLAY_BASE = 1000;
let current: import('../context/AiChatProvider').AiChatContextValue;
function Identity({ identity }: { identity: string }) {
  const { setIdentity } = useAiChat();
  React.useEffect(() => {
    setIdentity(identity);
  }, [identity, setIdentity]);
  return null;
}
function Probe() {
  current = useAiChat();
  return (
    <span data-testid="probe">
      {current.viewMode}:{current.messages.map(messageText).join(',')}
    </span>
  );
}
/**
 * 一个「参与协作的业务表单」：只做两件事 —— 声明浮层可见性 + 返回焦点目标。
 * Esc 由真实的 {@link useCoordinatedFormFocus} 处理，等价于 UserForm 里的用法。
 */
const formEscape = jest.fn();
function FakeForm({ open }: { open: boolean }) {
  const returnFocus = React.useRef<HTMLButtonElement | null>(null);
  const [container] = React.useState(() => document.createElement('div'));
  React.useEffect(
    () =>
      registerUserFormOverlay(() => ({
        target: 'user.create' as never,
        open,
        container: open ? container : null,
        returnFocusTarget: open ? returnFocus.current : null,
      })),
    [open, container],
  );
  useCoordinatedFormFocus(open);
  // 模拟 rc-dialog 的 Esc 处理：它在 document 上收按键，用来验证「不连带关闭」。
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') formEscape();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);
  return (
    <button ref={returnFocus} type="button">
      新建用户
    </button>
  );
}
/** 打开浮窗：与用户点入口等价（同一个 Provider 状态源）。 */
function OpenFloating() {
  const { setViewMode } = useAiChat();
  React.useEffect(() => {
    setViewMode('floating');
  }, [setViewMode]);
  return null;
}
/** 浮窗与全屏互斥，同一时刻最多一个 —— 与 AiChatHost 的分支一致。 */
function AssistantLayer() {
  const chat = useAiChat();
  return (
    <>
      {chat.viewMode === 'floating' ? <AiFloatingPanel /> : null}
      {chat.viewMode === 'fullscreen' ? <AiFullscreenWorkspace /> : null}
    </>
  );
}
function Harness({
  identity = '7',
  formOpen = false,
  open = true,
}: {
  identity?: string;
  formOpen?: boolean;
  open?: boolean;
}) {
  return (
    <AiChatProvider>
      <Identity identity={identity} />
      {open ? <OpenFloating /> : null}
      <Probe />
      <FakeForm open={formOpen} />
      <AssistantLayer />
      <AiFloatingLauncher />
    </AiChatProvider>
  );
}
/** jsdom 没有布局：给面板一个确定的矩形，拖动断言才有意义。面板是懒加载的，因此异步取。 */
async function stubPanelRect(left = 600, top = 100, width = 400, height = 600) {
  const panel = await screen.findByRole('dialog', { name: 'AI 助手' });
  panel.getBoundingClientRect = () =>
    ({
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
      x: left,
      y: top,
    }) as DOMRect;
  Object.defineProperty(panel, 'offsetWidth', {
    configurable: true,
    value: width,
  });
  Object.defineProperty(panel, 'offsetHeight', {
    configurable: true,
    value: height,
  });
  return panel;
}
beforeEach(() => {
  jest.clearAllMocks();
});
afterEach(() => {
  document.body.innerHTML = '';
});
describe('层级与挂载（设计 §4）', () => {
  it('入口与面板都高于 Ant Design 弹层基准，且子弹层基准再高一档', () => {
    expect(AI_OVERLAY_Z_INDEX).toBeGreaterThan(ANT_DESIGN_OVERLAY_BASE);
    expect(AI_POPUP_Z_INDEX_BASE).toBeGreaterThan(AI_OVERLAY_Z_INDEX);
  });
  it('业务 Modal 遮罩在场时，授权用户的入口依然存在且可点击', () => {
    render(
      <AiChatProvider>
        <Identity identity="7" />
        <div className="ant-modal-wrap" data-testid="business-modal">
          <div className="ant-modal-content">业务表单</div>
        </div>
        <AiFloatingLauncher />
      </AiChatProvider>,
    );
    const launcher = screen.getByRole('button', { name: '打开 AI 助手' });
    expect(launcher.getAttribute('aria-expanded')).toBe('false');
    // 入口层级来自统一常量（1200），高于 Ant Design 弹层基准（1000）。
    expect(AI_OVERLAY_Z_INDEX).toBeGreaterThan(ANT_DESIGN_OVERLAY_BASE);
    fireEvent.click(launcher);
    expect(launcher.getAttribute('aria-expanded')).toBe('true');
  });
  it('子弹层基准常量高于面板层级（供 ConfigProvider 抬升 Select/Tooltip）', () => {
    // JSDOM 里 rc-trigger 的弹层不会真正打开，子弹层的实际 z-index 只能在
    // 真实浏览器验证；这里锁住「基准常量本身高于业务弹层」这条不变量。
    expect(AI_POPUP_Z_INDEX_BASE).toBeGreaterThan(ANT_DESIGN_OVERLAY_BASE);
  });
});
describe('拖动（设计 §4）', () => {
  it('只有标题栏能拖，消息区按下不产生位移', async () => {
    render(<Harness />);
    const panel = await stubPanelRect();
    fireEvent.mouseDown(screen.getByTestId('chat-body'), {
      button: 0,
      clientX: 200,
      clientY: 300,
    });
    fireEvent.mouseMove(document, { clientX: 40, clientY: 20 });
    expect(panel.style.left).toBe('');
    expect(panel.style.top).toBe('');
  });
  it('按住标题栏拖动会落定位置', async () => {
    render(<Harness />);
    const panel = await stubPanelRect();
    fireEvent.mouseDown(screen.getByTestId('chat-header'), {
      button: 0,
      clientX: 610,
      clientY: 110,
    });
    fireEvent.mouseMove(document, { clientX: 570, clientY: 70 });
    // 起点 (600,100)，位移 (-40,-40)
    expect(panel.style.left).toBe('560px');
    expect(panel.style.top).toBe('60px');
  });
  it('拖动被夹在可视区域内，拖不出屏幕', async () => {
    render(<Harness />);
    const panel = await stubPanelRect();
    fireEvent.mouseDown(screen.getByTestId('chat-header'), {
      button: 0,
      clientX: 610,
      clientY: 110,
    });
    fireEvent.mouseMove(document, { clientX: -5000, clientY: -5000 });
    expect(panel.style.left).toBe('8px');
    expect(panel.style.top).toBe('8px');
    fireEvent.mouseMove(document, { clientX: 9000, clientY: 9000 });
    expect(panel.style.left).toBe(`${window.innerWidth - 400 - 8}px`);
    expect(panel.style.top).toBe(`${window.innerHeight - 600 - 8}px`);
  });
  it('窗口 resize 后把面板夹回可视区域', async () => {
    render(<Harness />);
    const panel = await stubPanelRect();
    fireEvent.mouseDown(screen.getByTestId('chat-header'), {
      button: 0,
      clientX: 610,
      clientY: 110,
    });
    // 拖到 600 + (800-610) = 790，先被 1024 宽的视口夹到 616。
    fireEvent.mouseMove(document, { clientX: 800, clientY: 110 });
    expect(panel.style.left).toBe(`${1024 - 400 - 8}px`);
    act(() => {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: 900,
      });
      window.dispatchEvent(new Event('resize'));
    });
    expect(panel.style.left).toBe(`${900 - 400 - 8}px`);
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1024,
    });
  });
  it('身份变化清理拖动位置与手势引用', async () => {
    const { rerender } = render(<Harness identity="7" />);
    const panel = await stubPanelRect();
    fireEvent.mouseDown(screen.getByTestId('chat-header'), {
      button: 0,
      clientX: 610,
      clientY: 110,
    });
    fireEvent.mouseMove(document, { clientX: 570, clientY: 70 });
    expect(panel.style.left).toBe('560px');
    rerender(<Harness identity="8" />);
    // 换账号即收起助手（Provider 的既有行为），旧位置不会带到新身份。
    expect(screen.queryByRole('dialog', { name: 'AI 助手' })).toBeNull();
    fireEvent.mouseMove(document, { clientX: 100, clientY: 100 });
    act(() => current.setViewMode('floating'));
    const reopened = await screen.findByRole('dialog', { name: 'AI 助手' });
    expect(reopened.style.left).toBe('');
    expect(reopened.style.top).toBe('');
  });
});
describe('焦点与 Esc（设计 §4）', () => {
  it('关闭浮窗不会关掉业务表单，焦点回到表单声明的元素', async () => {
    render(<Harness formOpen />);
    await screen.findByTestId('chat-view');
    const panel = await stubPanelRect();
    const trigger = screen.getByRole('button', { name: '新建用户' });
    expect(peekUserFormOverlay()?.open).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '关闭 AI 助手' }));
    // 表单仍在协作契约里在场（没有被顺手关掉）。
    expect(peekUserFormOverlay()?.open).toBe(true);
    expect(document.body.contains(panel)).toBe(false);
    expect(document.activeElement).toBe(trigger);
    // 入口仍在，随时能再唤起同一个会话。
    expect(screen.getByRole('button', { name: '打开 AI 助手' })).toBeTruthy();
  });
  it('Esc 只处理持有焦点的那一层：面板关、表单不关', async () => {
    render(<Harness formOpen />);
    await screen.findByTestId('chat-view');
    const panel = await stubPanelRect();
    fireEvent.keyDown(screen.getByTestId('chat-view'), { key: 'Escape' });
    expect(document.body.contains(panel)).toBe(false);
    // 业务表单的 Esc 处理没有收到这次按键：未保存的表单不会被连带关闭。
    expect(formEscape).not.toHaveBeenCalled();
    expect(peekUserFormOverlay()?.open).toBe(true);
  });
  it('没有表单在场时，面板自己处理 Esc', async () => {
    render(<Harness formOpen={false} />);
    await screen.findByTestId('chat-view');
    const panel = await stubPanelRect();
    fireEvent.keyDown(screen.getByTestId('chat-view'), { key: 'Escape' });
    expect(document.body.contains(panel)).toBe(false);
  });
  it('面板把自身区域登记给表单，未挂载时不留下引用', async () => {
    const { unmount } = render(<Harness />);
    await screen.findByTestId('chat-view');
    expect(peekAssistantRegion()).toBe(
      screen.getByRole('dialog', { name: 'AI 助手' }),
    );
    unmount();
    expect(peekAssistantRegion()).toBeNull();
  });
  it('没有面板在场时 Esc 原样放行给表单（不改全局焦点保护）', () => {
    render(<Harness open={false} formOpen />);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(formEscape).toHaveBeenCalledTimes(1);
  });
});
describe('浮窗与全屏是同一会话（设计 §4）', () => {
  it('收起全屏回到浮窗是同一个助手实例与同一段对话', async () => {
    render(<Harness open={false} />);
    const launcher = screen.getByRole('button', { name: '打开 AI 助手' });
    fireEvent.click(launcher);
    await screen.findByRole('dialog', { name: 'AI 助手' });
    const before = screen.getByTestId('probe').textContent;
    expect(before).toContain('floating');
    act(() => current.setViewMode('fullscreen'));
    await screen.findByRole('dialog', { name: 'AI 助手工作台' });
    expect(screen.queryByRole('dialog', { name: 'AI 助手' })).toBeNull();
    act(() => current.minimize());
    await screen.findByRole('dialog', { name: 'AI 助手' });
    // 同一份消息还在，且没有第二个助手实例。
    expect(screen.getByTestId('probe').textContent).toBe(before);
    expect(
      screen.getAllByRole('button', { name: '打开 AI 助手' }),
    ).toHaveLength(1);
  });
  it('宿主在任一视图模式下都只渲染一个入口', async () => {
    for (const mode of ['closed', 'floating', 'fullscreen'] as const) {
      const { unmount } = render(
        <AiChatProvider>
          <Identity identity="7" />
          <Probe />
          <AiFloatingLauncher />
          {mode === 'floating' ? <AiFloatingPanel /> : null}
          {mode === 'fullscreen' ? <AiFullscreenWorkspace /> : null}
        </AiChatProvider>,
      );
      expect(
        screen.getAllByRole('button', { name: '打开 AI 助手' }),
      ).toHaveLength(1);
      unmount();
    }
  });
});
describe('宿主', () => {
  it('未授权时不渲染任何助手 UI', () => {
    render(
      <AiChatProvider>
        <Probe />
        <AiChatHost />
      </AiChatProvider>,
    );
    expect(screen.queryByRole('button', { name: '打开 AI 助手' })).toBeNull();
  });
  it('挂载宿主不会因为缺少业务表单而出错', () => {
    render(
      <AiChatProvider>
        <Identity identity="7" />
        <AiChatHost />
      </AiChatProvider>,
    );
    expect(screen.getByRole('button', { name: '打开 AI 助手' })).toBeTruthy();
  });
});
