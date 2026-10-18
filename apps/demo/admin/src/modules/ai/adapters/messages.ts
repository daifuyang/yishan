import type { BubbleListProps } from '@ant-design/x';
import type { UIMessage } from 'ai';
import dayjs from 'dayjs';

const codeLanguageAliases: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  sh: 'bash',
  py: 'python',
};

export function normalizeCodeLanguage(info?: string): string {
  const language = info?.trim().toLowerCase().split(/\s+/)[0] || 'text';
  return Object.hasOwn(codeLanguageAliases, language)
    ? codeLanguageAliases[language]
    : language;
}

export function messageText(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

export function hasMessageProgress(message: UIMessage): boolean {
  return message.parts.some(
    (part) =>
      (part.type === 'reasoning' && Boolean(part.text)) ||
      part.type.startsWith('tool-'),
  );
}

/**
 * 工具结果 part。
 *
 * AI SDK 把 `tool-<capability>` 形态的 part 直接放进 message.parts，
 * 这里按前缀识别并取出结构化 output。之前只 filter text 会把它们整个丢掉，
 * 于是模型查到的用户表格在界面上根本不存在。
 */
export function toolResults(message: UIMessage): {
  toolCallId: string;
  capability: string;
  output: Record<string, unknown>;
}[] {
  const results: {
    toolCallId: string;
    capability: string;
    output: Record<string, unknown>;
  }[] = [];
  for (const part of message.parts) {
    if (!part.type.startsWith('tool-')) continue;
    if ((part as { state?: string }).state !== 'output-available') continue;
    const output = (part as { output?: unknown }).output;
    const toolCallId = (part as { toolCallId?: string }).toolCallId;
    if (!toolCallId || !output || typeof output !== 'object') continue;
    results.push({
      toolCallId,
      capability: part.type.slice('tool-'.length),
      output: output as Record<string, unknown>,
    });
  }
  return results;
}

/**
 * 带结构化结果的 assistant 消息里，哪些正文要显示在卡片之外。
 *
 * **只去掉与卡片重复的那一句**：工具的 `summary` 已经由卡片原样显示，再渲染一次
 * 就是同一份数据出现两张表。除此之外的模型对话正文（「收到，我先存草稿」「后端
 * 查询异常，重试三次都一样」）必须照常显示 —— 曾经把它们整段折进「补充说明」，
 * 于是助手每轮都像一声不吭，而折叠条默认是关着的。
 *
 * 返回 `null` 表示这一条没有可显示的正文。
 */
export function visibleAssistantText(
  text: string,
  summaries: readonly (string | undefined)[],
): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed === '已处理。') return null;
  if (summaries.some((summary) => summary === trimmed)) return null;
  return trimmed;
}

export function toBubbleItems(
  messages: UIMessage[],
  busy: boolean,
): BubbleListProps['items'] {
  const lastMessage = messages.at(-1);
  const items: BubbleListProps['items'] = messages.map((message) => {
    const content = messageText(message);
    const streaming =
      busy && message.id === lastMessage?.id && message.role === 'assistant';
    return {
      key: message.id,
      role: message.role,
      content,
      streaming,
      status: streaming ? 'updating' : 'success',
      loading: streaming && !content && !hasMessageProgress(message),
    };
  });
  if (busy && lastMessage?.role !== 'assistant') {
    items.push({
      key: '$waiting',
      role: 'assistant',
      content: '',
      loading: true,
    });
  }
  return items;
}

export function conversationGroup(updatedAt: string): string {
  const date = dayjs(updatedAt);
  if (date.isSame(dayjs(), 'day')) return '今天';
  if (date.isSame(dayjs().subtract(1, 'day'), 'day')) return '昨天';
  return date.format('YYYY年MM月');
}
