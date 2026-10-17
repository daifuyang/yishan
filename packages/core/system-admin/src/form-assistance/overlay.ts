/**
 * form-assistance 的**浮层与焦点协作**部分（设计 §4）。
 *
 * 与 {@link ./index.ts} 里的业务补丁契约严格分开：这里**没有任何业务数据**，
 * 只有「业务浮层是否开着」「助手面板的 DOM 在哪」「焦点该还给谁」。
 *
 * 之所以需要一个协作契约而不是全局关掉 Modal 的焦点保护：
 * Ant Design / rc-dialog 没有公开的「关闭焦点捕获」开关，全局关掉会让**所有**
 * Modal 失去键盘可达性（这是无障碍倒退）。因此这里采取显式、按目标注册的协作：
 *
 * - 参与协作的表单（首期只有 `user.create`）注册自己的浮层信息；
 * - 助手面板注册自己的 DOM 区域；
 * - 两侧只影响**彼此**，`Esc` 只处理当前持有焦点的那一层，
 *   关闭助手不会连带关闭业务表单的未保存数据。
 *
 * 刻意**不提供**：模拟点击、屏幕识别、CSS 选择器驱动的通用 DOM 操作、
 * 表单提交入口。这些仍然是设计 §5 禁止的能力。
 */

import { useEffect, useRef } from 'react';
// 仅类型导入：编译后擦除，避免 index ↔ overlay 的运行期循环依赖。
import type { UserFormAssistanceTarget } from './index';

/** 业务浮层此刻的可见状态与焦点归属信息。不含任何字段值。 */
export interface UserFormOverlayInfo {
  target: UserFormAssistanceTarget;
  /** 业务浮层当前是否打开。只有打开时才需要与助手做焦点协调。 */
  open: boolean;
  /**
   * 业务浮层的容器元素（Modal 内容节点），供助手做层级/避让判断。
   * 为 `null` 表示尚未挂载 —— 助手必须容忍这种情况，不得据此判定表单关闭。
   */
  container: HTMLElement | null;
  /**
   * 关闭助手后焦点应该回到哪个**元素**（通常是打开表单的那个按钮）。
   * 传元素而不是 CSS 选择器：选择器是设计 §5 禁止的通用 DOM 通道。
   */
  returnFocusTarget: HTMLElement | null;
}

type OverlayReader = () => UserFormOverlayInfo;

let activeOverlay: OverlayReader | null = null;
const overlayListeners = new Set<(info: UserFormOverlayInfo | null) => void>();
let assistantRegionReader: (() => HTMLElement | null) | null = null;

function readOverlay(): UserFormOverlayInfo | null {
  try {
    return activeOverlay?.() ?? null;
  } catch {
    return null;
  }
}

function emitOverlay(): void {
  const info = readOverlay();
  for (const listener of [...overlayListeners]) listener(info);
}

/**
 * 注册参与协作的业务表单浮层。返回注销函数。
 *
 * `read` 是**读取器**而不是快照：表单开关与焦点目标随时会变，
 * 助手随时能读到当前值，不需要表单在每次变化时反推刷新。
 */
export function registerUserFormOverlay(read: OverlayReader): () => void {
  activeOverlay = read;
  emitOverlay();
  return () => {
    if (activeOverlay === read) {
      activeOverlay = null;
      emitOverlay();
    }
  };
}

/** 供 `useSyncExternalStore` 使用：读取器返回的对象必须稳定。 */
export function peekUserFormOverlay(): UserFormOverlayInfo | null {
  return readOverlay();
}

/** 订阅业务浮层可见性变化。 */
export function subscribeUserFormOverlay(
  listener: (info: UserFormOverlayInfo | null) => void,
): () => void {
  overlayListeners.add(listener);
  return () => {
    overlayListeners.delete(listener);
  };
}

/**
 * 业务表单开合后主动通知一次。
 *
 * 注册的是读取器而不是快照，因此**字段值**变化不需要任何通知；
 * 只有「开/关」这一层可见性变化会改变助手的协调行为，才需要 emit。
 */
export function notifyUserFormOverlay(): void {
  emitOverlay();
}

/**
 * 助手面板注册自己的 DOM 区域。返回注销函数。
 *
 * 这是助手**唯一**需要暴露的东西：表单靠它判断「这次按键属于哪一层」。
 * 它不暴露助手的聊天状态，也不给表单任何操作助手的能力。
 */
export function registerAssistantRegion(read: () => HTMLElement | null): () => void {
  assistantRegionReader = read;
  return () => {
    if (assistantRegionReader === read) assistantRegionReader = null;
  };
}

/** 当前注册的助手区域；未注册或已卸载时为 `null`。 */
export function peekAssistantRegion(): HTMLElement | null {
  try {
    return assistantRegionReader?.() ?? null;
  } catch {
    return null;
  }
}

let assistantEscapeHandler: (() => boolean) | null = null;

/**
 * 助手登记「区域内的 Esc 该由谁处理」。
 *
 * 有了它，Esc 的仲裁就只有一个来源：参与协作的表单在 document 捕获阶段
 * 判断按键目标是否落在助手区域内，是则调用助手登记的处理函数并吞掉这次按键。
 * 因此「Esc 只处理当前获得焦点的那一层」是**结构上**成立的，而不是靠两个监听器
 * 互相猜注册顺序。
 */
export function registerAssistantEscape(handler: () => boolean): () => void {
  assistantEscapeHandler = handler;
  return () => {
    if (assistantEscapeHandler === handler) assistantEscapeHandler = null;
  };
}

/** 让助手处理区域内的 Esc。返回 `false` 表示没有助手在监听。 */
export function runAssistantEscape(): boolean {
  try {
    return assistantEscapeHandler?.() ?? false;
  } catch {
    return false;
  }
}

/** `event.target` 是否落在助手面板内部（含面板自身）。 */
export function isEventInsideAssistant(target: EventTarget | null): boolean {
  const region = peekAssistantRegion();
  if (!region || !(target instanceof Node)) return false;
  return region === target || region.contains(target);
}

/**
 * 参与协作的表单用它安装**作用域内**的 Esc 协调。
 *
 * 行为：捕获阶段挂在 `document` 上，只有当按键目标位于助手面板内时才
 * `stopPropagation`，因此业务 Modal 的 Esc 处理收不到这次按键 ——
 * 「Esc 只处理当前获得焦点的界面层」。其他任何来源的 Esc 完全不受影响，
 * 所有未参与协作的 Modal 保持 Ant Design 默认行为。
 */
export function useCoordinatedFormFocus(enabled: boolean): void {
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (!isEventInsideAssistant(event.target)) return;
      // 仲裁权在这里：交给助手处理（通常是收起助手），并且**吞掉**这次按键，
      // 业务 Modal / rc-dialog 的 Esc 处理因此收不到它 —— 不会连带关闭未保存表单。
      runAssistantEscape();
      event.stopPropagation();
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [enabled]);
}
