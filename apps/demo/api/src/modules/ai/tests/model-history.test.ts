import { describe, expect, it } from 'vitest'
import type { ChatMessage } from '../schemas/ai-chat.schema.js'
import { selectModelHistory } from '../services/model-history.js'

const user = (id: string, text = 'request'): ChatMessage => ({ id, role: 'user', parts: [{ type: 'text', text }] })
const assistant = (id: string): ChatMessage => ({ id, role: 'assistant', parts: [{ type: 'tool-query_business_data', toolCallId: id, state: 'output-available', input: {}, output: { ok: true } }] })

describe('bounded model history', () => {
  it('keeps complete recent user/assistant turns without mutating persisted history', () => {
    const history = [user('u1'), assistant('a1'), assistant('a1b'), user('u2'), assistant('a2'), user('u3')]
    const before = structuredClone(history)
    expect(selectModelHistory(history, { maxMessages: 4, maxCharacters: 10000 }).map(message => message.id)).toEqual(['u2', 'a2', 'u3'])
    expect(history).toEqual(before)
  })
  it('drops a large old tool-result turn as a unit and always keeps the current user request', () => {
    const old: ChatMessage = { id: 'large', role: 'assistant', parts: [{ type: 'text', text: 'x'.repeat(5000) }] }
    expect(selectModelHistory([user('old'), old, user('current')], { maxMessages: 32, maxCharacters: 1000 }).map(message => message.id)).toEqual(['current'])
  })
  it('never starts model context with an orphan assistant tool result', () => {
    expect(selectModelHistory([assistant('orphan'), user('current')]).map(message => message.id)).toEqual(['current'])
  })
})
