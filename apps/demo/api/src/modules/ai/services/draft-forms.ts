import { listAiCapabilities, type AiDraftAdapter, type AiDraftSubject } from '@yishan/core-api/ai-capabilities/catalog'
import type { TSchema } from '@sinclair/typebox'
import { currentSystemRuntime } from '@yishan/core-system-api'
import { aiError } from '../ai-chat-error.js'

export function listDraftAdapters(): readonly AiDraftAdapter[] {
  const adapters = new Map<string, AiDraftAdapter>()
  for (const capability of listAiCapabilities()) {
    if (capability.enabled && capability.draftAdapter) adapters.set(capability.draftAdapter.action, capability.draftAdapter)
  }
  return [...adapters.values()]
}

export function draftAdapter(action: string): AiDraftAdapter {
  const adapter = listDraftAdapters().find(adapter => adapter.action === action)
  if (!adapter) throw aiError(400, '不支持的表单目标')
  return adapter
}
export function draftFieldSchemas(action: string): Record<string, TSchema> {
  return draftAdapter(action).fieldSchemas as Record<string, TSchema>
}
export function draftForm(action: string) { return draftAdapter(action).form() }
export async function assertDraftAvailable(action: string): Promise<void> {
  const adapter = draftAdapter(action)
  // Core system routes are always installed and do not enter the optional module table.
  if (adapter.moduleId !== 'system' && !(await currentSystemRuntime().moduleState.enabledIds()).has(adapter.moduleId)) {
    throw aiError(400, '表单目标不可用')
  }
}
export async function authorizeDraft(action: string, subject: AiDraftSubject, fields: Record<string, unknown>): Promise<void> {
  await assertDraftAvailable(action)
  try { await draftAdapter(action).authorize(subject, fields) } catch (error) {
    if (error instanceof Error && error.constructor === Error) throw aiError(400, error.message)
    throw error
  }
}
