/**
 * AI 助手模块（Admin 侧）公开契约。
 *
 * 产品只从这里安装 AI 全局 UI：`AiAssistantLayer` 挂在 rootContainer /
 * innerProvider 的稳定位置，内部自带 IdentityBridge（身份与权限）。
 * 模块不注册任何路由页面——入口是右下角悬浮宿主。
 *
 * 这个入口必须保持「轻」：只导出懒加载边界与常量。
 * 任何直接依赖 AI SDK（`ai` / `@ai-sdk/react`）的实现都留在模块内部，
 * 由 `React.lazy` 切成独立 chunk —— 一旦在这里静态再导出它们，
 * AI SDK（实测 ~265K 未压缩）就会回到首屏主包。
 */

export { AiAssistantLayer } from './lazy';
export { AI_USE_PERMISSION } from './constants';
