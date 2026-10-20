import React from 'react';
import { AiChatHost } from '../AiChatHost';
import { AiChatIdentityBridge } from '../components/AiChatIdentityBridge';
import { AiNativeFormBridge } from '../components/AiNativeFormBridge';
import { AiChatProvider } from '../context/AiChatProvider';

/**
 * AI 助手全局层 —— 重实现体。
 *
 * 这个文件是**唯一**允许直接 import AI SDK（`ai` / `@ai-sdk/react`）的地方，
 * 它由 `../lazy` 里的 React.lazy 边界包住，只有真正要加载助手时才下载。
 *
 * 为什么必须懒加载：Provider 里 `useChat` + `DefaultChatTransport` 会把整个
 * AI SDK 拖进首屏主包（实测 ai 105K + zod 116K + provider-utils 29K +
 * intl-messageformat-parser 23K ≈ 265K 未压缩），而助手只是每个页面右下角
 * 挂着的悬浮入口，绝大多数会话永远不会打开它。
 *
 * 结构说明：Provider 原来挂在 rootContainer（包住整个应用），但 AI 上下文
 * 只有模块内部消费（`useAiChat` 的调用方全在 `src/modules/ai` 内），所以把
 * Provider 收窄到只包 AI 自身这棵子树，对业务页面没有任何影响；
 * `AiNativeFormBridge` 通过 `@yishan/core-admin/form-assistance` 的全局
 * 订阅与原生表单通信，不依赖它在业务树的祖先位置。
 */
export function AiAssistantLayer() {
  return (
    <AiChatProvider>
      <AiChatIdentityBridge />
      {/* Bridge 不渲染任何界面：它把本轮草稿结果接到原生 UserForm 上，
          并注册「同步 + 锁定版本」的草稿链接。它无法提交表单。 */}
      <AiNativeFormBridge />
      {/* Host 在路由出口之外，业务路由切换不会重建它。 */}
      <AiChatHost />
    </AiChatProvider>
  );
}
