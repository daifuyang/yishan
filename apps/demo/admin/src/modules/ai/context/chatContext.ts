import type { UIMessage } from 'ai';
import { createContext } from 'react';
import type { AiConversation } from '../services/aiChatService';
import type { AiFormAssistanceValue } from './formAssistance';
export type AiViewMode = 'closed' | 'floating' | 'fullscreen';

export interface AiChatContextValue {
  authorized: boolean;
  identity: string | null;
  setIdentity: (identity: string | null) => void;
  viewMode: AiViewMode;
  setViewMode: (mode: AiViewMode) => void;
  toggleFloating: () => void;
  expand: () => void;
  minimize: () => void;
  conversations: AiConversation[];
  activeId: string | null;
  messages: UIMessage[];
  draft: string;
  setDraft: (draft: string) => void;
  busy: boolean;
  loading: boolean;
  error: string;
  clearError: () => void;
  loadConversations: () => Promise<void>;
  selectConversation: (id: string) => Promise<void>;
  newConversation: () => void;
  rename: (id: string, title: string) => Promise<boolean>;
  removeConversation: (id: string) => Promise<void>;
  send: (text: string) => Promise<void>;
  regenerate: (messageId?: string) => Promise<void>;
  retry: () => Promise<void>;
  stop: () => Promise<void>;
  /**
   * 表单协作的**引用**。刻意不含表单状态：可见值只有原生表单一处（设计 §6）。
   * Bridge 挂载后把自己接进来，Provider 只负责「本轮结果」「身份 epoch」「结果回执」。
   */
  formAssistance: AiFormAssistanceValue;
}
export const AiChatContext = createContext<AiChatContextValue | null>(null);
