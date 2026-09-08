export const getLeadWorkspaceLayout = (isDesktop: boolean) => ({
  gridTemplateColumns: isDesktop ? 'minmax(0, 1fr) 420px' : 'minmax(0, 1fr)',
  width: '100%',
  minHeight: isDesktop ? 'calc(100dvh - 208px)' : 'auto',
  activityBorderLeft: isDesktop ? '1px solid #eaecf0' : undefined,
  activityPaddingLeft: isDesktop ? 28 : 0,
  detailMaxWidth: 880,
});

/**
 * 线索页所有 Modal/Dialog 的 z-index 基准值。
 *
 * 抽屉默认 z-index 是 1100 (`useZIndex('Drawer', …)` → `zIndexPopupBase 1000 + 100`)。
 * 直接调 `Modal` 不带 zIndex 时也是 1100，于是"查看 → 编辑"会卡在同 z 同级，
 * Drawer 与 Modal 谁先渲染谁就压住后开的——视觉上"层级错乱"。
 *
 * 统一把 Dialog 显式提到 1200（一层），保证：
 *   - 任何 Dialog 都压在 DetailDrawer 之上
 *   - 同时打开多个 Dialog 时，后开的那一个按 DOM 顺序自然更靠上（"一层一层"）
 *
 * 不要轻易调到更高：antd 内部组件 `Select / Dropdown / DatePicker` 等用的是
 * `zIndexPopupBase + 50`，调太高会反过来盖住它们的下拉。
 */
export const LEAD_DIALOG_Z_INDEX = 1200;
