import { DefaultChatTransport, type UIMessage } from 'ai';
import { createToolLifecycleTransform } from './toolLifecycle';

export class AiChatTransport extends DefaultChatTransport<UIMessage> {
  protected processResponseStream(stream: ReadableStream<Uint8Array<ArrayBufferLike>>) {
    return super.processResponseStream(stream).pipeThrough(createToolLifecycleTransform());
  }
}
