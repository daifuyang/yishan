/**
 * AI 助手模块（Admin 侧）公开契约。
 *
 * 产品只从这里安装 AI 全局 UI：Provider 挂在 rootContainer，Host 挂在
 * innerProvider 的稳定位置，IdentityBridge 提供身份与权限。模块不注册任何
 * 路由页面——入口是右下角悬浮宿主。
 */

export { AiChatHost } from './AiChatHost';
/**
 * 聊天 ↔ 原生表单的接线板。它没有「提交」能力：业务创建只在 `UserForm` 的 `onFinish`
 * 里发生。挂在 rootContainer，与 `AiChatHost` 同级。
 */
export { AiNativeFormBridge } from './components/AiNativeFormBridge';
export {
  AI_USE_PERMISSION,
  AiChatIdentityBridge,
} from './components/AiChatIdentityBridge';
export { AiChatProvider, type AiViewMode } from './context/AiChatProvider';
export { useAiChat } from './hooks/useAiChat';
