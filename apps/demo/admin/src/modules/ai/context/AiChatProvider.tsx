import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { collectFormPrefills } from '../adapters/formRequests';
import {
  clearAiPrefill,
  type AiPrefill,
} from '@yishan/core-system-admin/ai-prefill';
import { messageText, toolResults } from '../adapters/messages';
import {
  type AiConversation,
  chatError,
  createConversation,
  deleteConversation,
  getConversation,
  listConversations,
  renameConversation,
} from '../services/aiChatService';
import {
  AiFormAssistanceContext,
  type AiFormAssistanceHandlers,
  type AiFormAssistanceValue,
  type DraftOutcome,
  type FormUiRequest,
} from './formAssistance';

/**
 * 全局展示状态。悬浮与全屏只是同一份聊天状态的两种外层布局，
 * 不做任何路由跳转，也不销毁 Provider。
 */
export {
  AiChatContext,
  type AiChatContextValue,
  type AiViewMode,
} from './chatContext';

import {
  AiChatContext,
  type AiChatContextValue,
  type AiViewMode,
} from './chatContext';

const NEW_DRAFT = '$new';

export function AiChatProvider({ children }: React.PropsWithChildren) {
  const [identity, setIdentityState] = useState<string | null>(null);
  const identityRef = useRef<string | null>(null);
  const epoch = useRef(0);
  const activeRef = useRef<string | null>(null);
  const locked = useRef(false);
  const loaded = useRef(false);
  const operation = useRef<{
    cancelled: boolean;
    version: number;
    revision: number;
    text?: string;
  } | null>(null);
  const inputRevision = useRef(0);
  const stopping = useRef<Promise<void> | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState<AiViewMode>('closed');
  // ---- 表单协作引用：只有「本轮结果 / 身份 epoch / 结果回执」，没有任何表单状态 ----
  const formHandlers = useRef<AiFormAssistanceHandlers | null>(null);
  /** 非空 = 本轮 stream 正在跑；历史消息重放/刷新时它是 null，因此不会自动开表单。 */
  const turn = useRef<{ seen: Set<string>; identityEpoch: number } | null>(
    null,
  );
  const queued = useRef<FormUiRequest[]>([]);
  const queuedPrefills = useRef<AiPrefill[]>([]);
  const [outcomes, setOutcomes] = useState<Record<string, DraftOutcome>>({});

  /**
   * 从消息里挑出**没见过**的草稿结果。
   *
   * `seen` 在开轮时用当时已有的消息预热过，因此历史里那些 `action.draft` 永远进不来 ——
   * `get_action_draft` 这类**纯读**工具也会发 `action.draft`，让它自动弹表单就等于把
   * 「刷新页面 = 弹表单」。去重键是服务端给的 `uiRequestId`，一个 uiRequestId 只消费一次。
   */
  const collectDraftRequests = (
    messages: UIMessage[],
    seen: Set<string>,
  ): FormUiRequest[] => {
    const found: FormUiRequest[] = [];
    for (const message of messages) {
      if (message.role !== 'assistant') continue;
      for (const result of toolResults(message)) {
        const output = result.output as {
          ok?: unknown;
          render?: { kind?: string; payload?: Record<string, unknown> };
        };
        if (output.ok !== true) continue;
        if (output.render?.kind !== 'action.draft') continue;
        const payload = output.render.payload ?? {};
        const uiRequestId = String(payload.uiRequestId ?? '');
        const draftId = String(payload.draftId ?? '');
        if (!uiRequestId || !draftId || seen.has(uiRequestId)) continue;
        seen.add(uiRequestId);
        found.push({
          uiRequestId,
          draftId,
          draftVersion: Number(payload.draftVersion ?? 1),
          identityEpoch: epoch.current,
        });
      }
    }
    return found;
  };

  const beginTurn = () => {
    // 先把历史里已有的 uiRequestId 记成见过，再开始收集本轮的。
    turn.current = { seen: new Set(), identityEpoch: epoch.current };
    collectDraftRequests(chatRef.current.messages, turn.current.seen);
    collectFormPrefills(chatRef.current.messages, turn.current.seen);
    queuedPrefills.current = [];
    queued.current = [];
  };

  const endTurn = (version: number) => {
    if (turn.current?.identityEpoch !== version) return;
    const batch = queued.current;
    const prefills = operation.current?.cancelled ? [] : queuedPrefills.current;
    queuedPrefills.current = [];
    const active = turn.current;
    turn.current = null;
    queued.current = [];
    if (!active) return;
    const handlers = formHandlers.current;
    for (const prefill of prefills) handlers?.onPrefill?.(prefill);
    for (const request of batch) {
      // epoch 已经变了（换账号）就整批丢弃：旧身份的草稿不再驱动任何界面动作。
      if (request.identityEpoch !== epoch.current) continue;
      handlers?.onUiRequest(request);
    }
  };

  const setOutcome = useCallback((draftId: string, outcome: DraftOutcome) => {
    setOutcomes((values) => ({ ...values, [draftId]: outcome }));
  }, []);

  const bindFormHandlers = useCallback((handlers: AiFormAssistanceHandlers) => {
    formHandlers.current = handlers;
    return () => {
      if (formHandlers.current === handlers) formHandlers.current = null;
    };
  }, []);

  const requestRestore = useCallback((draftId: string) => {
    formHandlers.current?.onRestore(draftId);
  }, []);

  const flushDraftSync = useCallback(async () => {
    await formHandlers.current?.flush();
  }, []);

  const formAssistance: AiFormAssistanceValue = {
    identityEpoch: epoch.current,
    outcomes,
    setOutcome,
    bindHandlers: bindFormHandlers,
    requestRestore,
    requestPrefill: (request) => formHandlers.current?.onPrefill?.(request),
    flush: flushDraftSync,
  };
  // One transport and one useChat live above routes. The persisted conversation id is supplied per request.
  const [transport] = useState(
    () =>
      new DefaultChatTransport<UIMessage>({
        api: `${__API_BASE_URL__ || ''}/api/ai/v1/chat`,
        credentials: 'include',
        prepareSendMessagesRequest: ({ messages, trigger, messageId }) => ({
          body: { id: activeRef.current, messages, trigger, messageId },
        }),
      }),
  );
  const recordFailure = (cause: unknown) => {
    const current = operation.current;
    if (!current || current.version !== epoch.current) return;
    setError(chatError(cause));
    if (current.text !== undefined) {
      const key = activeRef.current || NEW_DRAFT;
      const text = current.text;
      setDrafts((values) =>
        current.revision === inputRevision.current
          ? { ...values, [key]: values[key] || text }
          : values,
      );
    }
  };
  const chat = useChat<UIMessage>({
    id: 'ai-chat',
    transport,
    onError: recordFailure,
    onFinish: ({ message, isAbort, isError }) => {
      if (!turn.current || isAbort || isError) return;
      queuedPrefills.current.push(
        ...collectFormPrefills([message], turn.current.seen),
      );
    },
  });
  const chatRef = useRef(chat);
  chatRef.current = chat;
  // 本轮 stream 的草稿结果：**只有**在本轮进行中才收集（`turn.current` 为空时不收），
  // 因此历史消息重放、刷新、切换会话都不会触发自动开表单。
  useEffect(() => {
    if (!turn.current) return;
    queued.current.push(
      ...collectDraftRequests(chat.messages, turn.current.seen),
    );
  }, [chat.messages]);
  const generating = chat.status === 'submitted' || chat.status === 'streaming';
  const busy = pending || generating;

  const setIdentity = useCallback((next: string | null) => {
    if (identityRef.current === next) return;
    const previous = identityRef.current;
    identityRef.current = next;
    epoch.current += 1;
    const version = epoch.current;
    if (operation.current) operation.current.cancelled = true;
    loaded.current = false;
    locked.current = false;
    activeRef.current = null;
    setIdentityState(next);
    setActiveId(null);
    setConversations([]);
    setDrafts({});
    setError('');
    setViewMode('closed');
    setPending(false);
    setLoading(false);
    queuedPrefills.current = [];
    clearAiPrefill();
    // 身份变了：旧草稿的协作引用与回执一并清掉（设计 §7）。
    turn.current = null;
    queued.current = [];
    setOutcomes({});
    const reset = () => {
      chatRef.current.setMessages([]);
      chatRef.current.clearError();
    };
    reset();
    if (previous !== null || stopping.current) {
      locked.current = true;
      setLoading(true);
      // A replacement identity must wait for the old engine's queued updates to settle.
      const stopped = stopping.current || chatRef.current.stop();
      stopping.current = stopped;
      void stopped.finally(() => {
        if (version !== epoch.current) return;
        stopping.current = null;
        reset();
        locked.current = false;
        setLoading(false);
      });
    }
  }, []);

  useEffect(
    () => () => {
      void chatRef.current.stop();
    },
    [],
  );

  const loadConversations = async () => {
    if (!identityRef.current || loaded.current) return;
    loaded.current = true;
    const version = epoch.current;
    try {
      const items = await listConversations();
      if (version === epoch.current) setConversations(items);
    } catch (cause) {
      if (version === epoch.current) {
        loaded.current = false;
        setError(chatError(cause));
      }
    }
  };
  const refresh = async (version: number) => {
    try {
      const items = await listConversations();
      if (version === epoch.current) setConversations(items);
    } catch (cause) {
      if (version === epoch.current) setError(chatError(cause));
    }
  };
  const newConversation = () => {
    if (!identityRef.current || locked.current || generating) return;
    activeRef.current = null;
    setActiveId(null);
    chat.setMessages([]);
    chat.clearError();
    setError('');
  };
  const selectConversation = async (id: string) => {
    if (
      !identityRef.current ||
      locked.current ||
      generating ||
      id === activeRef.current
    )
      return;
    locked.current = true;
    setLoading(true);
    const version = epoch.current;
    try {
      const detail = await getConversation(id);
      if (version !== epoch.current) return;
      activeRef.current = id;
      setActiveId(id);
      chat.setMessages(detail.messages);
      chat.clearError();
      setError('');
    } catch (cause) {
      if (version === epoch.current) setError(chatError(cause));
    } finally {
      if (version === epoch.current) {
        locked.current = false;
        setLoading(false);
      }
    }
  };
  const send = async (text: string) => {
    const content = text.trim();
    if (!content || !identityRef.current || locked.current || generating)
      return;
    if (content.length > 12000) {
      setError('每条消息不能超过12000个字符');
      return;
    }
    locked.current = true;
    setPending(true);
    setError('');
    chat.clearError();
    const version = epoch.current;
    const currentOperation = {
      cancelled: false,
      version,
      revision: inputRevision.current,
      text,
    };
    operation.current = currentOperation;
    try {
      // 发送下一轮之前先保证待同步的非敏感字段已经落地：模型下一轮读到的草稿必须
      // 是用户在表单里刚改完的那一版（设计 §6）。
      await formAssistance.flush();
      if (!activeRef.current) {
        const conversation = await createConversation();
        if (version !== epoch.current) return;
        activeRef.current = conversation.id;
        setActiveId(conversation.id);
        setConversations((items) => [conversation, ...items]);
        setDrafts((values) => ({
          ...values,
          [conversation.id]: values[NEW_DRAFT] || '',
          [NEW_DRAFT]: '',
        }));
      }
      if (currentOperation.cancelled) return;
      const id = activeRef.current;
      setDrafts((values) =>
        currentOperation.revision === inputRevision.current
          ? { ...values, [id]: '' }
          : values,
      );
      beginTurn();
      await chat.sendMessage({ text: content });
      if (version === epoch.current) {
        await refresh(version);
      }
    } catch (cause) {
      if (version === epoch.current) {
        recordFailure(cause);
      }
    } finally {
      endTurn(version);
      if (version === epoch.current) {
        operation.current = null;
        locked.current = false;
        setPending(false);
      }
    }
  };
  const regenerate = async (messageId?: string) => {
    if (
      !identityRef.current ||
      !activeRef.current ||
      locked.current ||
      generating ||
      !chat.messages.length
    )
      return;
    locked.current = true;
    setPending(true);
    setError('');
    chat.clearError();
    const version = epoch.current;
    operation.current = {
      cancelled: false,
      version,
      revision: inputRevision.current,
    };
    try {
      beginTurn();
      await formAssistance.flush();
      await chat.regenerate({ messageId });
      await refresh(version);
    } catch (cause) {
      if (version === epoch.current) setError(chatError(cause));
    } finally {
      endTurn(version);
      if (version === epoch.current) {
        operation.current = null;
        locked.current = false;
        setPending(false);
      }
    }
  };
  const retry = async () => {
    if (!identityRef.current || locked.current || generating) return;
    const userMessage = chat.messages.findLast((item) => item.role === 'user');
    if (!activeRef.current || !userMessage) {
      loaded.current = false;
      await loadConversations();
      return;
    }
    locked.current = true;
    setPending(true);
    setError('');
    chat.clearError();
    const version = epoch.current;
    const currentOperation = {
      cancelled: false,
      version,
      revision: inputRevision.current,
      text: messageText(userMessage),
    };
    operation.current = currentOperation;
    try {
      beginTurn();
      await formAssistance.flush();
      const detail = await getConversation(activeRef.current);
      if (version !== epoch.current || currentOperation.cancelled) return;
      setDrafts((values) =>
        currentOperation.revision === inputRevision.current &&
        values[detail.id]?.trim() === currentOperation.text
          ? { ...values, [detail.id]: '' }
          : values,
      );
      if (detail.messages.some((item) => item.id === userMessage.id)) {
        if (turn.current)
          collectFormPrefills(detail.messages, turn.current.seen);
        chat.setMessages(detail.messages);
        await chat.regenerate();
      } else {
        // SDK messageId replaces the failed local user message instead of appending a duplicate.
        await chat.sendMessage({
          messageId: userMessage.id,
          role: 'user',
          parts: userMessage.parts,
        });
      }
      if (version === epoch.current) await refresh(version);
    } catch (cause) {
      if (version === epoch.current) recordFailure(cause);
    } finally {
      endTurn(version);
      if (version === epoch.current) {
        operation.current = null;
        locked.current = false;
        setPending(false);
      }
    }
  };
  const rename = async (id: string, title: string) => {
    if (!identityRef.current || locked.current || generating || !title.trim())
      return false;
    const version = epoch.current;
    try {
      await renameConversation(id, title.trim());
      if (version !== epoch.current) return false;
      setConversations((items) =>
        items.map((item) =>
          item.id === id ? { ...item, title: title.trim() } : item,
        ),
      );
      return true;
    } catch (cause) {
      if (version === epoch.current) setError(chatError(cause));
      return false;
    }
  };
  const removeConversation = async (id: string) => {
    if (!identityRef.current || locked.current || generating) return;
    locked.current = true;
    setLoading(true);
    const version = epoch.current;
    try {
      await deleteConversation(id);
      if (version !== epoch.current) return;
      setConversations((items) => items.filter((item) => item.id !== id));
      setDrafts((values) => {
        const next = { ...values };
        delete next[id];
        return next;
      });
      if (activeRef.current === id) {
        activeRef.current = null;
        setActiveId(null);
        chat.setMessages([]);
        chat.clearError();
      }
    } catch (cause) {
      if (version === epoch.current) setError(chatError(cause));
    } finally {
      if (version === epoch.current) {
        locked.current = false;
        setLoading(false);
      }
    }
  };
  const value: AiChatContextValue = {
    authorized: identity !== null,
    /** 当前登录身份。浮窗用它判断「换账号了 → 丢掉旧拖动位置与焦点引用」。 */
    identity,
    setIdentity,
    viewMode,
    setViewMode,
    toggleFloating: () =>
      setViewMode((mode) => (mode === 'floating' ? 'closed' : 'floating')),
    expand: () => setViewMode('fullscreen'),
    minimize: () => setViewMode('floating'),
    conversations,
    activeId,
    messages: chat.messages,
    draft: drafts[activeId || NEW_DRAFT] || '',
    setDraft: (draft) => {
      inputRevision.current += 1;
      const key = activeRef.current || NEW_DRAFT;
      setDrafts((values) => ({
        ...values,
        [key]: draft,
      }));
    },
    busy,
    loading,
    error: error || (chat.error ? chatError(chat.error) : ''),
    clearError: () => {
      setError('');
      chat.clearError();
    },
    loadConversations,
    selectConversation,
    newConversation,
    rename,
    removeConversation,
    send,
    regenerate,
    retry,
    stop: () => {
      if (operation.current) operation.current.cancelled = true;
      return chat.stop();
    },
    formAssistance,
  };
  return (
    <AiFormAssistanceContext.Provider value={formAssistance}>
      <AiChatContext.Provider value={value}>{children}</AiChatContext.Provider>
    </AiFormAssistanceContext.Provider>
  );
}
