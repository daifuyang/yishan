import type { CSSProperties } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FLOATING_VIEWPORT_MARGIN } from './aiOverlayLayers';

export interface FloatingPosition {
  left: number;
  top: number;
}

export interface FloatingDragApi {
  /** 挂到浮窗根节点上：拖动时用来量尺寸与初始位置。 */
  panelRef: React.RefObject<HTMLDivElement | null>;
  /** `null` = 仍用 CSS 默认锚点（右下角）；有值 = 用户拖到了具体位置。 */
  position: FloatingPosition | null;
  style: CSSProperties | undefined;
  /** 挂到**标题栏**上：只有按住标题栏才拖，消息区/输入区不会误拖。 */
  handleProps: {
    onMouseDown: (event: React.MouseEvent) => void;
    onTouchStart: (event: React.TouchEvent) => void;
  };
  reset: () => void;
}

/**
 * 把 `value` 夹在 `[margin, max - size - margin]`；空间不足时退化为 margin。
 *
 * 窄屏（≤768px）上浮窗宽度被写死成 `calc(100vw - 16px)`（见 AiFloatingPanel 的媒体查询），
 * 于是 `upper = max - size - margin` 恒等于 8：**水平方向夹住不动，只有纵向还能拖**。
 * 这是有意为之 —— 满幅浮层本来就该横向贴边，不是 clamp 失效。后继读者若在这里看到
 * 「横向拖不动」，那是设计决定而不是 bug。
 */
export function clampToViewport(
  value: number,
  max: number,
  size: number,
  margin: number = FLOATING_VIEWPORT_MARGIN,
): number {
  const upper = Math.max(margin, max - size - margin);
  return Math.min(Math.max(value, margin), upper);
}

/**
 * 判定为「拖动」所需的最小位移（px）。
 *
 * 没有这个阈值，**在标题栏上点一下**就会把面板从 CSS 角落锚点改成绝对 left/top，
 * 而且再也回不去锚点 —— 移动端 `100dvh` 收缩（地址栏收起）之后它就停在过期坐标上。
 */
export const DRAG_MOVE_THRESHOLD = 4;

/**
 * 抑制器的最长存活时间（ms）。
 *
 * **触摸拖动根本不会产生 click** —— `touchend` 不派发 click 是触摸的固有行为，
 * 不是边界情况。若只靠「被消费一次就注销」，每一次手指拖动都会把抑制器留到下一次
 * 手势为止，中间用户点的**任何**按钮（查询、提交、导航）都会被静默吞掉，表现为
 * 「第一下没反应，再点一次才行」。所以额外挂一个回收定时器兜底。
 *
 * 取 350ms：远大于拖动结束后浏览器补发合成 click 的时间，又短到用户察觉不到。
 */
export const SUPPRESS_CLICK_REAP_MS = 350;

/**
 * 浮窗拖动（设计 §4）：只在标题栏生效、限制在可视区域内、窗口 resize 后不跑出屏幕。
 *
 * 有三个刻意的约束：
 *
 * - **只有标题栏能拖，且手势不能来自可交互元素**：`handleProps` 挂在标题栏而不是浮窗根节点，
 *   否则用户在消息区选中文本时会连窗一起拖走；标题栏里的按钮按下时命中的是按钮自己，
 *   手势被忽略，按钮照常拿焦点。
 *
 *   注意这里判的是「落点是否可交互」，而不是「落点是否恰好是手柄本身」：标题文字被
 *   `<Flex style={{flex:1}}>` 铺满，若要求 target === currentTarget，只有左右十几像素的
 *   padding 还算手柄，触摸端等于没有拖动区域。
 * - **越过阈值才落定位置**：见 {@link DRAG_MOVE_THRESHOLD}。
 * - **身份变化即复位**：切换账号后旧位置与旧手势引用都作废，
 *   否则新用户会继承上一个用户的窗口位置与半截未松手的拖动。
 */
export function useFloatingDrag(identity: string | null): FloatingDragApi {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<FloatingPosition | null>(null);
  /** 手势过程存在 ref 里：它不需要触发渲染，只有落定的位置才需要。 */
  const drag = useRef<{
    pointerX: number;
    pointerY: number;
    rectLeft: number;
    rectTop: number;
    width: number;
    height: number;
    moved: boolean;
  } | null>(null);

  const clearDrag = useCallback(() => {
    drag.current = null;
  }, []);

  /** 待吞掉的一次 click（含它的回收定时器）。存在 ref 里，便于在所有退出路径上摘掉。 */
  const pendingClickSuppress = useRef<{
    handler: (event: MouseEvent) => void;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);

  const dropClickSuppress = useCallback(() => {
    const entry = pendingClickSuppress.current;
    if (!entry) return;
    pendingClickSuppress.current = null;
    clearTimeout(entry.timer);
    document.removeEventListener('click', entry.handler, true);
  }, []);

  /** 吞掉紧随拖动之后的**那一次** click，然后自己注销。 */
  const suppressNextClick = useCallback(() => {
    dropClickSuppress();
    const entry = {
      handler: (event: MouseEvent) => {
        event.stopPropagation();
        event.preventDefault();
        dropClickSuppress();
      },
      timer: setTimeout(dropClickSuppress, SUPPRESS_CLICK_REAP_MS),
    };
    pendingClickSuppress.current = entry;
    document.addEventListener('click', entry.handler, true);
  }, [dropClickSuppress]);

  const endDrag = useCallback(() => {
    if (!drag.current) return;
    clearDrag();
  }, [clearDrag]);

  const move = useCallback((clientX: number, clientY: number) => {
    const current = drag.current;
    const panel = panelRef.current;
    if (!current || !panel) return;
    // 未越过阈值前一律不落定位置：一次普通点击不应该把面板永久钉死。
    if (
      !current.moved &&
      Math.abs(clientX - current.pointerX) < DRAG_MOVE_THRESHOLD &&
      Math.abs(clientY - current.pointerY) < DRAG_MOVE_THRESHOLD
    ) {
      return;
    }
    current.moved = true;
    const next = {
      left: clampToViewport(
        current.rectLeft + (clientX - current.pointerX),
        window.innerWidth,
        current.width || panel.offsetWidth,
      ),
      top: clampToViewport(
        current.rectTop + (clientY - current.pointerY),
        window.innerHeight,
        current.height || panel.offsetHeight,
      ),
    };
    setPosition((previous) =>
      previous && previous.left === next.left && previous.top === next.top
        ? previous
        : next,
    );
  }, []);

  const startDrag = useCallback(
    (clientX: number, clientY: number) => {
      const panel = panelRef.current;
      if (!panel) return;
      // 上一次手势若留下了没等到 click 的抑制器（松手后没有 click 跟随），先摘掉，
      // 否则它会一直挂在 document 上吞掉页面上后续所有的点击。
      dropClickSuppress();
      const rect = panel.getBoundingClientRect();
      drag.current = {
        pointerX: clientX,
        pointerY: clientY,
        rectLeft: rect.left,
        rectTop: rect.top,
        width: rect.width,
        height: rect.height,
        moved: false,
      };
      // 这里**不**写 document.body.style.userSelect：手势中途在文档外松手时没有 mouseup，
      // 整页会一直不能选中文本。手柄自身已有 CSS `user-select: none`，够用了。
      // 注意：这里**不**立刻 move —— 落定位置要等越过阈值，
      // 否则「点一下标题栏」就会把窗口钉死在绝对坐标上。
    },
    [dropClickSuppress],
  );

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      if (!drag.current) return;
      move(event.clientX, event.clientY);
    };
    const onTouchMove = (event: TouchEvent) => {
      if (!drag.current) return;
      const touch = event.touches[0];
      if (touch) move(touch.clientX, touch.clientY);
    };
    const onUp = () => {
      // 手势真的动过 → 吞掉紧随其后的那一次 click。
      // 按住标题文字拖 100px 再松手在「关闭」按钮上时，浏览器仍会派发 click，
      // 面板会莫名其妙自己关掉（round 2 把可抓区域从十几像素扩到整条标题栏，
      // 命中概率显著上升）。只吞这一次，且只有真的动过才吞 —— 普通点击必须照常生效。
      if (drag.current?.moved) {
        suppressNextClick();
      }
      endDrag();
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onTouchMove);
    document.addEventListener('touchend', onUp);
    document.addEventListener('touchcancel', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onUp);
      document.removeEventListener('touchcancel', onUp);
      // 卸载时若还有没等到 click 的抑制器，必须摘掉：它是挂在 document 上的全局监听。
      dropClickSuppress();
    };
  }, [dropClickSuppress, endDrag, move, suppressNextClick]);

  // 窗口尺寸变化后把窗口夹回可视区域：缩窄浏览器不该让面板停在屏幕外。
  useEffect(() => {
    const onResize = () => {
      const current = drag.current;
      const panel = panelRef.current;
      setPosition((previous) => {
        if (!previous || !panel) return previous;
        return {
          left: clampToViewport(
            previous.left,
            window.innerWidth,
            panel.offsetWidth,
          ),
          top: clampToViewport(
            previous.top,
            window.innerHeight,
            panel.offsetHeight,
          ),
        };
      });
      // 未落定位置时无需处理；current 仅用于让 resize 不打断进行中的手势。
      void current;
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // 身份变化：丢掉拖动位置与手势引用（切账号不留旧窗口位置）。
  useEffect(() => {
    drag.current = null;
    setPosition(null);
  }, [identity]);

  const handleProps = createHandleProps(startDrag);

  return {
    panelRef,
    position,
    style: position
      ? {
          left: position.left,
          top: position.top,
          right: 'auto',
          bottom: 'auto',
        }
      : undefined,
    handleProps,
    reset: () => {
      drag.current = null;
      setPosition(null);
    },
  };
}

function createHandleProps(
  startDrag: (clientX: number, clientY: number) => void,
): FloatingDragApi['handleProps'] {
  return {
    onMouseDown: (event: React.MouseEvent) => {
      // 只认鼠标左键 / 单指；右键与多指手势不当作拖动起点。
      if (event.button !== 0) return;
      if (isInteractiveTarget(event.target)) return;
      event.preventDefault();
      startDrag(event.clientX, event.clientY);
    },
    onTouchStart: (event: React.TouchEvent) => {
      if (event.touches.length !== 1) return;
      if (isInteractiveTarget(event.target)) return;
      const touch = event.touches[0];
      startDrag(touch.clientX, touch.clientY);
    },
  };
}

/**
 * 手势落点是否落在可交互元素上（标题栏里的展开 / 关闭按钮）。
 *
 * 反过来判「必须精确命中手柄」是不行的：标题文字被一层 `flex:1` 的 Flex 铺满，
 * 那样的判据会把手柄缩成左右十几像素的 padding，触摸端基本抓不住。
 *
 * ## 规则（新增标题栏控件时必须遵守）
 *
 * 标题栏里**任何**可点击元素都必须是原生 `<button>`（或带 `role="button"` /
 * `contenteditable` 的元素）—— 因为本函数用的是白名单：不在名单里的元素会被
 * 当成标题文字，拖动窗口而不会响应点击。自绘 `<div onClick={…}>`、没有语义
 * 触发器的 antd `Dropdown` / `Trigger` 都会静默失灵，且没有任何测试会报错。
 * 自定义组件必须把真实 `<button>`（或 `role="button"`）包在自己内部再挂 onClick。
 *
 * 本轮不做结构性兜底：React 不会把 onClick 渲染成 DOM 属性，`[onclick]`
 * 选择器天然无效；改用「标题栏控件容器整体拒绝手势」需要改动 AiChatView 的
 * 结构契约，代价大于收益。规则本身已写在这里，由后继读者承担。
 */
function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return (
    target.closest(
      'button,a,input,textarea,select,[role="button"],[contenteditable="true"]',
    ) !== null
  );
}
