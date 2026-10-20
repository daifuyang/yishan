import type { UIMessage } from 'ai';
import {
  aiConversationsCreate,
  aiConversationsDelete,
  aiConversationsDetail,
  aiConversationsList,
  aiConversationsRename,
} from '@/services/generated/ai';

export interface AiConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}
export interface AiConversationDetail extends AiConversation {
  messages: UIMessage[];
}

interface Envelope<T> {
  success: boolean;
  data: T;
  message?: string;
}
const options = { skipErrorHandler: true };
function unwrap<T>(response: Envelope<T>): T {
  if (!response.success)
    throw new Error(response.message || '操作失败，请重试');
  return response.data;
}
export async function listConversations() {
  return unwrap(await aiConversationsList(options)).items;
}
export async function createConversation(): Promise<AiConversationDetail> {
  const data = unwrap(await aiConversationsCreate(options));
  // OpenAPI cannot express the SDK parts union; the server validates it before persistence.
  return { ...data, messages: data.messages as UIMessage[] };
}
export async function getConversation(
  id: string,
): Promise<AiConversationDetail> {
  const data = unwrap(await aiConversationsDetail({ id }, options));
  return { ...data, messages: data.messages as UIMessage[] };
}
export async function renameConversation(id: string, title: string) {
  return unwrap(await aiConversationsRename({ id }, { title }, options));
}
export async function deleteConversation(id: string) {
  unwrap(await aiConversationsDelete({ id }, options));
}

export { chatError } from './chatError';
