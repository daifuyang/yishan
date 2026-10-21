import type { UIMessageChunk } from 'ai';
import { ReadableStream, TransformStream } from 'node:stream/web';
import { createToolLifecycleTransform } from '../services/toolLifecycle';

Object.assign(globalThis, { TransformStream });

async function reconcile(chunks: UIMessageChunk[]) {
  const source = new ReadableStream<UIMessageChunk>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
  // node:stream/web 的流类型与 DOM lib 的同名类型不兼容，这里只在**边界**上做一次
  // 收敛，测试内部仍然是完整的类型检查。
  const reader = (
    source as unknown as {
      pipeThrough(transform: unknown): {
        getReader(): {
          read(): Promise<{ value: UIMessageChunk | undefined; done: boolean }>;
        };
      };
    }
  )
    .pipeThrough(createToolLifecycleTransform())
    .getReader();
  const result: UIMessageChunk[] = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return result;
    if (value) result.push(value);
  }
}

const input: UIMessageChunk = {
  type: 'tool-input-available',
  toolCallId: 'call-1',
  toolName: 'lookup_user',
  input: { id: 7 },
};
const output: UIMessageChunk = {
  type: 'tool-output-available',
  toolCallId: 'call-1',
  output: { ok: true, name: '阿伦' },
};

it('保留首次终态，丢弃重复结果和晚到的输入、错误及审批', async () => {
  expect(
    await reconcile([
      input,
      output,
      { type: 'tool-input-start', toolCallId: 'call-1', toolName: 'lookup_user' },
      input,
      { type: 'tool-input-delta', toolCallId: 'call-1', inputTextDelta: '{}' },
      output,
      { type: 'tool-output-error', toolCallId: 'call-1', errorText: '过期错误' },
      { type: 'tool-approval-request', toolCallId: 'call-1', approvalId: 'late' },
      { type: 'tool-approval-response', approvalId: 'late', approved: false },
    ]),
  ).toEqual([input, output]);
});

it('先到的结果等待工具输入，不让 SDK 因找不到调用而中断消息', async () => {
  expect(await reconcile([output, input, { type: 'finish' }])).toEqual([
    input,
    output,
    { type: 'finish' },
  ]);
});

it('输入流结束前允许相同文本的连续增量，输入就绪后忽略迟到增量', async () => {
  const start: UIMessageChunk = {
    type: 'tool-input-start', toolCallId: 'call-1', toolName: 'lookup_user',
  };
  const delta: UIMessageChunk = {
    type: 'tool-input-delta', toolCallId: 'call-1', inputTextDelta: 'a',
  };
  expect(await reconcile([start, start, delta, delta, input, delta, input, output]))
    .toEqual([start, delta, delta, input, output]);
});

it('预备输出可更新为最终输出，最终结果不会再被预备输出覆盖', async () => {
  const preliminary: UIMessageChunk = { ...output, preliminary: true };
  expect(await reconcile([input, preliminary, preliminary, output, preliminary]))
    .toEqual([input, preliminary, preliminary, output]);
});

it('保留独立工具和新的消息命名空间，不把 start-step 当作重置', async () => {
  const otherInput: UIMessageChunk = { ...input, toolCallId: 'call-2' };
  const otherOutput: UIMessageChunk = { ...output, toolCallId: 'call-2' };
  expect(await reconcile([
    { type: 'start', messageId: 'a' }, input, output,
    { type: 'start-step' }, input,
    otherInput, otherOutput,
    { type: 'start', messageId: 'b' }, input, output,
  ])).toEqual([
    { type: 'start', messageId: 'a' }, input, output,
    { type: 'start-step' }, otherInput, otherOutput,
    { type: 'start', messageId: 'b' }, input, output,
  ]);
});

it('孤立增量和没有工具输入的结果不终止其他消息，已开始工具的早到结果仍保留', async () => {
  const start: UIMessageChunk = {
    type: 'tool-input-start', toolCallId: 'call-1', toolName: 'lookup_user',
  };
  const text: UIMessageChunk = { type: 'text-start', id: 'text-1' };
  expect(await reconcile([
    { type: 'tool-input-delta', toolCallId: 'missing', inputTextDelta: '{}' },
    { type: 'tool-output-error', toolCallId: 'missing', errorText: 'orphan' },
    output, start, text, { type: 'finish' },
  ])).toEqual([start, text, output, { type: 'finish' }]);
});

it('输入失败也是终态，审批响应必须有本轮请求且只应用一次', async () => {
  const failure: UIMessageChunk = {
    type: 'tool-input-error', toolCallId: 'call-1', toolName: 'lookup_user',
    input: {}, errorText: '无效输入',
  };
  const approval: UIMessageChunk = {
    type: 'tool-approval-request', toolCallId: 'call-1', approvalId: 'approve-1',
  };
  const response: UIMessageChunk = {
    type: 'tool-approval-response', approvalId: 'approve-1', approved: false,
  };
  const denied: UIMessageChunk = { type: 'tool-output-denied', toolCallId: 'call-1' };
  expect(await reconcile([failure, input, output])).toEqual([failure]);
  expect(await reconcile([response, input, approval, approval, response, response, denied, input]))
    .toEqual([input, approval, response, denied]);
});

it('SDK 重置当前步骤后允许重新执行该步骤的调用，其他步骤的终态仍受保护', async () => {
  const nextInput: UIMessageChunk = { ...input, toolCallId: 'call-2' };
  const nextOutput: UIMessageChunk = { ...output, toolCallId: 'call-2' };
  expect(await reconcile([
    input, output, { type: 'start-step' }, nextInput, nextOutput,
    { type: 'reset-step' }, input, nextInput, nextOutput,
  ])).toEqual([
    input, output, { type: 'start-step' }, nextInput, nextOutput,
    { type: 'reset-step' }, nextInput, nextOutput,
  ]);
});

it('流中明确取消后丢弃尚未交付的结果和晚到工具事件', async () => {
  const start: UIMessageChunk = {
    type: 'tool-input-start', toolCallId: 'call-1', toolName: 'lookup_user',
  };
  expect(await reconcile([start, output, { type: 'abort' }, input, output, { type: 'finish' }]))
    .toEqual([start, { type: 'abort' }, { type: 'finish' }]);
});
