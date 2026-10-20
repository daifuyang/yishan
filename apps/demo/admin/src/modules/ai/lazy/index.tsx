import React, { lazy, Suspense } from 'react';

/**
 * AI 助手的懒加载边界。
 *
 * 入口组件（`AiAssistantLayer`）必须走这里，不要在别处直接 import
 * `./AiAssistantLayer` 或 AI SDK —— 一旦被静态引用，AI SDK 就会回到首屏主包里。
 */
const AiAssistantLayerImpl = lazy(() =>
  import('./AiAssistantLayer').then((m) => ({ default: m.AiAssistantLayer })),
);

/**
 * 挂到 rootContainer / innerProvider 上的占位组件。
 *
 * 加载期间渲染 null：AI 助手是悬浮入口，晚几百毫秒出现不影响首屏渲染，
 * 而首屏主包能因此少掉 ~265K 未压缩的 AI SDK。
 */
export function AiAssistantLayer() {
  return (
    <Suspense fallback={null}>
      <AiAssistantLayerImpl />
    </Suspense>
  );
}
