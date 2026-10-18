import { useContext } from 'react';
import { AiChatContext, type AiChatContextValue } from '../context/chatContext';

/**
 * 唯一的聊天状态读取入口。Provider 挂在 rootContainer，因此组件树任意位置
 * （浮窗、全屏工作台、身份桥）拿到的是同一份状态。
 */
export function useAiChat(): AiChatContextValue {
  const context = useContext(AiChatContext);
  if (!context) throw new Error('AiChatProvider is required');
  return context;
}
