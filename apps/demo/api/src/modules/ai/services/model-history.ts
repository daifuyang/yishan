import type { ChatMessage } from '../schemas/ai-chat.schema.js'
import { aiError } from '../ai-chat-error.js'

const MODEL_HISTORY_LIMITS = { maxMessages: 32, maxCharacters: 48000 }

/** 仅裁剪模型输入；一个用户请求及其全部助手/工具回复始终一起保留或移除。 */
export function selectModelHistory(history: readonly ChatMessage[], limits = MODEL_HISTORY_LIMITS): ChatMessage[] {
  const turns: ChatMessage[][] = []
  for (const message of history) {
    if (message.role === 'user') turns.push([message])
    else if (message.role === 'assistant' && turns.length) turns[turns.length - 1].push(message)
  }
  const selected: ChatMessage[][] = []
  let count = 0
  let characters = 2
  for (const turn of [...turns].reverse()) {
    const size = turn.reduce((sum, message) => sum + JSON.stringify(message).length + 1, 0)
    if (count + turn.length > limits.maxMessages || characters + size > limits.maxCharacters) {
      if (!selected.length) throw aiError(400, '当前轮消息过长，请缩短输入或新建对话')
      break
    }
    selected.unshift(turn)
    count += turn.length
    characters += size
  }
  return selected.flat()
}
