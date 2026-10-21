import type { UIMessageChunk } from 'ai';

type ToolOutputChunk = Extract<UIMessageChunk, {
  type: 'tool-output-available' | 'tool-output-error' | 'tool-output-denied';
}>;
type ToolPhase = 'waiting' | 'streaming' | 'available' | 'approval' | 'responded' | 'preliminary' | 'terminal';
interface ToolLifecycle {
  phase: ToolPhase;
  pending?: ToolOutputChunk;
}

/** SDK 原地更新工具 part；在进入 SDK 前挡住迟到事件，避免终态被清空。 */
export function createToolLifecycleTransform() {
  const tools = new Map<string, ToolLifecycle>();
  const approvals = new Map<string, string>();
  const stepTools = new Set<string>();
  let messageId: string | undefined;
  let aborted = false;
  const emitOutput = (
    tool: ToolLifecycle,
    chunk: ToolOutputChunk,
    controller: TransformStreamDefaultController<UIMessageChunk>,
  ) => {
    tool.phase = chunk.type === 'tool-output-available' && chunk.preliminary
      ? 'preliminary' : 'terminal';
    tool.pending = undefined;
    controller.enqueue(chunk);
  };
  const flushPending = (controller: TransformStreamDefaultController<UIMessageChunk>) => {
    if (aborted) return;
    for (const tool of tools.values()) {
      if (tool.pending && tool.phase !== 'waiting')
        emitOutput(tool, tool.pending, controller);
    }
  };
  return new TransformStream<UIMessageChunk, UIMessageChunk>({
    transform(chunk, controller) {
      if (chunk.type === 'abort') aborted = true;
      if (aborted && ('toolCallId' in chunk || chunk.type === 'tool-approval-response')) return;
      if (chunk.type === 'start' && chunk.messageId !== undefined) {
        if (messageId !== undefined && messageId !== chunk.messageId) {
          tools.clear();
          approvals.clear();
          stepTools.clear();
        }
        messageId = chunk.messageId;
      }
      if (chunk.type === 'start-step') stepTools.clear();
      if (chunk.type === 'reset-step') {
        for (const id of stepTools) tools.delete(id);
        for (const [id, callId] of approvals) {
          if (stepTools.has(callId)) approvals.delete(id);
        }
        stepTools.clear();
      }
      if (chunk.type === 'finish' || chunk.type === 'finish-step') flushPending(controller);
      if (chunk.type === 'tool-approval-response') {
        const id = approvals.get(chunk.approvalId);
        const tool = id === undefined ? undefined : tools.get(id);
        if (tool?.phase !== 'approval') return;
        tool.phase = 'responded';
        controller.enqueue(chunk);
        return;
      }
      if ('toolCallId' in chunk) {
        let tool = tools.get(chunk.toolCallId);
        if (tool?.phase === 'terminal') return;
        switch (chunk.type) {
          case 'tool-input-start':
            if (tool && tool.phase !== 'waiting') return;
            tool ??= { phase: 'waiting' };
            tool.phase = 'streaming';
            tools.set(chunk.toolCallId, tool);
            stepTools.add(chunk.toolCallId);
            break;
          case 'tool-input-delta':
            // 增量没有事件 ID；相同文字可能是有效连续内容，不能按文字去重。
            if (tool?.phase !== 'streaming') return;
            break;
          case 'tool-input-available':
            if (tool && tool.phase !== 'waiting' && tool.phase !== 'streaming') return;
            tool ??= { phase: 'waiting' };
            tool.phase = 'available';
            tools.set(chunk.toolCallId, tool);
            stepTools.add(chunk.toolCallId);
            controller.enqueue(chunk);
            if (tool.pending) emitOutput(tool, tool.pending, controller);
            return;
          case 'tool-input-error':
            tools.set(chunk.toolCallId, { phase: 'terminal' });
            stepTools.add(chunk.toolCallId);
            break;
          case 'tool-approval-request':
            if (tool?.phase !== 'available') return;
            tool.phase = 'approval';
            approvals.set(chunk.approvalId, chunk.toolCallId);
            break;
          case 'tool-output-available':
          case 'tool-output-error':
          case 'tool-output-denied':
            tool ??= { phase: 'waiting' };
            tools.set(chunk.toolCallId, tool);
            stepTools.add(chunk.toolCallId);
            if (tool.phase === 'waiting' || tool.phase === 'streaming') {
              if (!tool.pending || (tool.pending.type === 'tool-output-available' && tool.pending.preliminary))
                tool.pending = chunk;
              return;
            }
            emitOutput(tool, chunk, controller);
            return;
        }
      }
      controller.enqueue(chunk);
    },
    flush: flushPending,
  });
}
