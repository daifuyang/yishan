/**
 * 助手浮窗的层级与挂载约定（设计 §4）。
 *
 * 单一事实来源：入口、面板、子弹层都在这里定，组件里不写魔法数字。
 *
 * 层级：
 * - Ant Design Modal / Drawer 的遮罩与内容默认在 `zIndexPopupBase = 1000`；
 * - 助手浮窗必须**高于**业务弹层，否则入口会被遮罩吞掉（这正是旧实现的 900 的问题）；
 * - 助手**内部**的子弹层（Select 下拉、Tooltip、Popover）通过
 *   `ConfigProvider` 的 `zIndexPopupBase` 再抬一档，避免它们掉回 1050 落到
 *   业务 Modal 后面 —— 只抬入口 z-index 是不够的（设计 §4 明确要求）。
 *
 * 助手是**非模态**浮窗：没有任何 `mask`，不新增第二层全页遮罩。
 */

/** 助手入口与面板的层级，必须高于 Ant Design 弹层（1000）。 */
export const AI_OVERLAY_Z_INDEX = 1200;

/**
 * 助手子树内子弹层（Select / Tooltip / Popover）的基准层级。
 * 比面板本身再高两档，保证下拉选项永远浮在面板之上而不是被面板裁掉。
 */
export const AI_POPUP_Z_INDEX_BASE = 1400;

/** 全屏工作台的层级，与浮窗互斥，同时存在时也不会被业务弹层压住。 */
export const AI_FULLSCREEN_Z_INDEX = 1300;

/** 浮窗拖动时与视口边缘保留的间距（px），保证标题栏永远抓得住。 */
export const FLOATING_VIEWPORT_MARGIN = 8;
