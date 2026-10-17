import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  peekAssistantRegion,
  peekUserFormOverlay,
  registerUserFormOverlay,
  useCoordinatedFormFocus,
} from '@yishan/core-system-admin/form-assistance';
import { Select, theme } from 'antd';
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
        {/* 真实标题栏里标题文字被一层 flex:1 的 Flex 铺满 —— 手势必须仍然成立，
            否则可抓区域只剩左右十几像素 padding。 */}
        <div style={{ display: 'flex', gap: 8, minWidth: 0, flex: 1 }}>
          <span data-testid="chat-header-title">标题栏</span>
          {/* 真实标题栏里有展开 / 关闭按钮：mousedown 从按钮冒泡上来，
              手势必须被忽略，否则「按了关闭却把窗口拖走」。 */}
          <button type="button" data-testid="header-button">
            展开为页面
          </button>
          {/* 真实的关闭按钮在标题栏内且有 onClick：拖到它上面松手时
              浏览器仍会派发 click，面板不能因此自己关掉。 */}
          <button
            type="button"
            data-testid="header-close-button"
            onClick={() => props.onClose?.()}
          >
            关闭
          </button>
        </div>
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
import { AiOverlayProvider } from '../floating/AiOverlayProvider';
import {
  AI_OVERLAY_Z_INDEX,
  AI_POPUP_Z_INDEX_BASE,
} from '../floating/aiOverlayLayers';
import { SUPPRESS_CLICK_REAP_MS } from '../floating/useFloatingDrag';
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
/** Ant Design 弹层基准层级由 `theme.getDesignToken().zIndexPopupBase` 现场取，
 *  这里不再硬编码一份常量 —— 抄一份只会让后继读者以为基准被钉死了。 */
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
function FakeForm({
  open,
  detachedFocus = false,
}: {
  open: boolean;
  /** 焦点目标已脱离文档：用来验证 restoreFocus 的 isConnected 兜底。 */
  detachedFocus?: boolean;
}) {
  const returnFocus = React.useRef<HTMLButtonElement | null>(null);
  const [detached] = React.useState<HTMLButtonElement | null>(() =>
    detachedFocus ? document.createElement('button') : null,
  );
  React.useEffect(
    () =>
      registerUserFormOverlay(() => ({
        target: 'user.create' as never,
        open,
        returnFocusTarget: open ? (detached ?? returnFocus.current) : null,
      })),
    [open, detached],
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
  if (detachedFocus) return null;
  return (
    <button ref={returnFocus} type="button">
      新建用户
    </button>
  );
}
/**
 * 渲染一个 `open` 的 Select，读回它**真实**的下拉 z-index。
 *
 * 用 antd 自己的 Select/rc-trigger 而不是抄常量：这里断言的是「层级外壳确实
 * 把子弹层抬起来了」，写错了 ConfigProvider 的 token 同样会红。
 */
async function selectDropdownZIndex(
  Wrapper?: (
    props: import('react').PropsWithChildren,
  ) => import('react').ReactNode,
): Promise<number> {
  const select = <Select open options={[{ value: 'a', label: '选项 A' }]} />;
  const { container } = render(Wrapper ? <Wrapper>{select}</Wrapper> : select);
  let root = container.querySelector('.ant-select');
  for (let i = 0; i < 50 && !root; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    root = container.querySelector('.ant-select');
  }
  if (!root) throw new Error('Select 下拉没有渲染');
  // antd 6 用 CSS 变量下发弹层层级：`z-index: var(--ant-select-z-index-popup)`，
  // 因此读 Select 根节点上的变量才是它**实际**用到的层级。
  const raw = getComputedStyle(root).getPropertyValue(
    '--ant-select-z-index-popup',
  );
  return Number(raw.trim());
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
  detachedFocus = false,
}: {
  identity?: string;
  formOpen?: boolean;
  open?: boolean;
  detachedFocus?: boolean;
}) {
  return (
    <AiChatProvider>
      <Identity identity={identity} />
      {open ? <OpenFloating /> : null}
      <Probe />
      <FakeForm open={formOpen} detachedFocus={detachedFocus} />
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
    // 基准取自 antd 自己的设计令牌，而不是在这里再抄一份 1000。
    expect(AI_OVERLAY_Z_INDEX).toBeGreaterThan(
      theme.getDesignToken().zIndexPopupBase,
    );
    expect(AI_POPUP_Z_INDEX_BASE).toBeGreaterThan(AI_OVERLAY_Z_INDEX);
  });
  it('入口与面板的实际 z-index 高于 antd 自己的弹层基准', async () => {
    // 直接向 antd 要它自己的 zIndexPopupBase，而不是抄一份 1000 进来：
    // 这样「谁更高」永远是对当前 antd 版本的断言，不是自我循环。
    const antdBase = theme.getDesignToken().zIndexPopupBase;
    expect(antdBase).toBeGreaterThan(0);
    expect(AI_OVERLAY_Z_INDEX).toBeGreaterThan(antdBase);
    expect(AI_POPUP_Z_INDEX_BASE).toBeGreaterThan(antdBase);

    render(<Harness />);
    // antd-style 把样式真正注入到 head，因此这里读到的是**渲染后的计算值**，
    // 而不是我们期望的常量（写错了样式表同样会红）。
    const panel = await stubPanelRect();
    expect(Number(getComputedStyle(panel).zIndex)).toBe(AI_OVERLAY_Z_INDEX);
    const launcher = screen.getByRole('button', {
      name: '打开 AI 助手',
    }).parentElement;
    expect(Number(getComputedStyle(launcher as Element).zIndex)).toBe(
      AI_OVERLAY_Z_INDEX,
    );
    expect(
      Number(getComputedStyle(launcher as Element).zIndex),
    ).toBeGreaterThan(antdBase);
  });

  it('子弹层被抬到 antd 弹层之上（不只是抬入口）', async () => {
    const antdBase = theme.getDesignToken().zIndexPopupBase;
    // 反证：同一个 Select 下拉，**没有**助手层级外壳时落在 antd 默认基准上。
    const plain = await selectDropdownZIndex(undefined);
    const raised = await selectDropdownZIndex(AiOverlayProvider);
    expect(plain).toBeGreaterThan(0);
    expect(plain).toBeLessThan(AI_POPUP_Z_INDEX_BASE);
    expect(raised).toBeGreaterThanOrEqual(AI_POPUP_Z_INDEX_BASE);
    expect(raised).toBeGreaterThan(antdBase);
  });

  it('真实宿主挂载路径生效：lazy 之外的一切都照常渲染', () => {
    // 走的是 AiChatHost 本体（含 AiOverlayProvider + Suspense + 懒加载分支），
    // 不是测试里的 AssistantLayer 替身。
    render(
      <AiChatProvider>
        <Identity identity="7" />
        <AiChatHost />
      </AiChatProvider>,
    );
    expect(screen.getByRole('button', { name: '打开 AI 助手' })).toBeTruthy();
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
  it('标题栏里的按钮不会发起拖动', async () => {
    render(<Harness />);
    const panel = await stubPanelRect();
    // 按在「展开为页面」按钮上：手势必须被忽略，按钮照常拿焦点，位置不动。
    const button = screen.getByTestId('header-button');
    fireEvent.mouseDown(button, { button: 0, clientX: 610, clientY: 110 });
    fireEvent.mouseMove(document, { clientX: 400, clientY: 300 });
    expect(panel.style.left).toBe('');
    expect(panel.style.top).toBe('');
    fireEvent.mouseUp(document);
    // 按钮本身仍然是可点的，没有被 preventDefault 吃掉焦点。
    button.focus();
    fireEvent.click(button);
    expect(document.activeElement).toBe(button);
  });

  it('拖到关闭按钮上松手不会触发它的 click', async () => {
    render(<Harness />);
    await stubPanelRect();
    const close = screen.getByTestId('header-close-button');
    fireEvent.mouseDown(screen.getByTestId('chat-header-title'), {
      button: 0,
      clientX: 610,
      clientY: 110,
    });
    fireEvent.mouseMove(document, { clientX: 570, clientY: 70 });
    fireEvent.mouseUp(close);
    // 手势真的动过 → 紧随其后的这次 click 必须被吞掉。
    fireEvent.click(close);
    expect(screen.queryByRole('dialog', { name: 'AI 助手' })).toBeTruthy();
  });

  it('触摸拖动（touchend 不派发 click）之后仍能点到无关按钮', async () => {
    render(<Harness />);
    await stubPanelRect();
    fireEvent.touchStart(screen.getByTestId('chat-header-title'), {
      touches: [{ clientX: 610, clientY: 110 }],
    });
    fireEvent.touchMove(document, { touches: [{ clientX: 570, clientY: 70 }] });
    fireEvent.touchEnd(document);
    // 触摸松手**不会**跟着来一次 click，抑制器不会被消费掉。
    // 等过回收窗口后，页面上任意处的下一次点击都必须正常生效。
    await act(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, SUPPRESS_CLICK_REAP_MS + 60);
      });
    });
    fireEvent.click(screen.getByRole('button', { name: '关闭 AI 助手' }));
    expect(screen.queryByRole('dialog', { name: 'AI 助手' })).toBeFalsy();
  });

  it('下一次手势开始时会先清掉上一次遗留的抑制器', async () => {
    render(<Harness />);
    await stubPanelRect();
    // 一次「移动后松手但没有 click 跟随」的拖动，模拟遗留的抑制器。
    fireEvent.mouseDown(screen.getByTestId('chat-header'), {
      button: 0,
      clientX: 610,
      clientY: 110,
    });
    fireEvent.mouseMove(document, { clientX: 570, clientY: 70 });
    fireEvent.mouseUp(document);
    // 新手势开始的瞬间必须把旧抑制器摘掉，否则它会吞掉下一次点击。
    // 这次手势**不移动**：否则它自己又会装上一个新的抑制器，掩盖要测的那条路径。
    fireEvent.mouseDown(screen.getByTestId('chat-header'), {
      button: 0,
      clientX: 560,
      clientY: 60,
    });
    fireEvent.mouseUp(document);
    fireEvent.click(screen.getByRole('button', { name: '关闭 AI 助手' }));
    expect(screen.queryByRole('dialog', { name: 'AI 助手' })).toBeFalsy();
  });

  it('浮窗卸载时会摘掉挂在 document 上的抑制器', async () => {
    const view = render(<Harness />);
    await stubPanelRect();
    fireEvent.mouseDown(screen.getByTestId('chat-header'), {
      button: 0,
      clientX: 610,
      clientY: 110,
    });
    fireEvent.mouseMove(document, { clientX: 570, clientY: 70 });
    fireEvent.mouseUp(document);
    view.unmount();
    // 组件没了，但抑制器是挂在 document 上的全局监听：卸载必须把它摘掉。
    const outside = document.createElement('button');
    outside.textContent = '页面上的其他按钮';
    document.body.append(outside);
    const fired = jest.fn();
    outside.addEventListener('click', fired);
    fireEvent.click(outside);
    expect(fired).toHaveBeenCalledTimes(1);
  });

  it('在关闭按钮上普通点击仍然生效（不能被误吞）', async () => {
    render(<Harness />);
    await stubPanelRect();
    const close = screen.getByTestId('header-close-button');
    fireEvent.mouseDown(close, { button: 0, clientX: 610, clientY: 110 });
    fireEvent.mouseUp(close);
    // 指针没动过阈值 → 不抑制 click，按钮照常响应。
    fireEvent.click(close);
    expect(screen.queryByRole('dialog', { name: 'AI 助手' })).toBeFalsy();
  });

  it('按住标题文字拖动会落定位置（可抓区域不能只剩 padding）', async () => {
    render(<Harness />);
    const panel = await stubPanelRect();
    // 落点是标题文字本身，不是手柄根节点 —— 判定必须看「是否落进可交互元素」，
    // 而不是「是否精确命中手柄」，否则满幅标题区里只有 padding 能抓。
    fireEvent.mouseDown(screen.getByTestId('chat-header-title'), {
      button: 0,
      clientX: 610,
      clientY: 110,
    });
    fireEvent.mouseMove(document, { clientX: 570, clientY: 70 });
    fireEvent.mouseUp(document);
    expect(panel.style.left).toBe('560px');
    expect(panel.style.top).toBe('60px');
  });

  it('拖动不会把 body 的 userSelect 改成不可恢复的值', async () => {
    render(<Harness />);
    await stubPanelRect();
    // 模拟「按下后在文档外松手」：没有 mouseup 事件到达。
    fireEvent.mouseDown(screen.getByTestId('chat-header'), {
      button: 0,
      clientX: 610,
      clientY: 110,
    });
    fireEvent.mouseMove(document, { clientX: 570, clientY: 70 });
    expect(document.body.style.userSelect).not.toBe('none');
  });

  it('在标题栏上点一下不会把面板钉死在绝对坐标', async () => {
    render(<Harness />);
    const panel = await stubPanelRect();
    // 未越过阈值：即使指针坐标和按下时一样，也不得落定位置。
    fireEvent.mouseDown(screen.getByTestId('chat-header'), {
      button: 0,
      clientX: 610,
      clientY: 110,
    });
    fireEvent.mouseMove(document, { clientX: 612, clientY: 111 });
    fireEvent.mouseUp(document);
    expect(panel.style.left).toBe('');
    expect(panel.style.top).toBe('');
    // 越过阈值后才真正落定。
    fireEvent.mouseDown(screen.getByTestId('chat-header'), {
      button: 0,
      clientX: 610,
      clientY: 110,
    });
    fireEvent.mouseMove(document, { clientX: 570, clientY: 70 });
    fireEvent.mouseUp(document);
    expect(panel.style.left).toBe('560px');
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
  it('焦点目标已脱离文档时退到可见的兜底元素', async () => {
    // 表单声明的按钮已经不在文档里：直接 focus() 是静默无效的，
    // 键盘用户会回到 Tab 序列开头且看不到焦点环。
    render(<Harness formOpen detachedFocus />);
    await screen.findByTestId('chat-view');
    await stubPanelRect();
    expect(peekUserFormOverlay()?.returnFocusTarget?.isConnected).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: '关闭 AI 助手' }));
    // 兜底到助手入口：仍然可见、可聚焦。
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: '打开 AI 助手' }),
    );
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
