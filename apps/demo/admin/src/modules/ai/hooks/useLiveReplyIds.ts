import type { UIMessage } from 'ai';
import { useEffect, useRef } from 'react';

/** 只为本次请求新增的回复启用逐字展示，读取历史和切换会话时不重播。 */
export function useLiveReplyIds(
  messages: UIMessage[],
  busy: boolean,
  loading: boolean,
  conversationId: string | null,
) {
  const previous = useRef({
    conversationId,
    known: new Set(messages.map((message) => message.id)),
    live: new Set<string>(),
    busy,
  });
  const sameConversation = previous.current.conversationId === conversationId;
  const live = new Set(
    sameConversation && !loading ? previous.current.live : [],
  );
  if (sameConversation && !loading && (busy || previous.current.busy)) {
    for (const message of messages) {
      if (
        message.role === 'assistant' &&
        !previous.current.known.has(message.id)
      )
        live.add(message.id);
    }
  }
  useEffect(() => {
    previous.current = {
      conversationId,
      known: new Set(messages.map((message) => message.id)),
      live,
      busy,
    };
  });
  return live;
}
