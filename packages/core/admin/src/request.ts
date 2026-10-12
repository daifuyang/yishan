export function pickEnvelopeMessage(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null
  const envelope = body as { success?: unknown; message?: unknown }
  if (envelope.success !== false || typeof envelope.message !== 'string') return null
  return envelope.message.trim() || null
}

export function resolveMessageLevel(code: unknown): 'warning' | 'error' {
  return typeof code === 'number' && Number.isFinite(code) && code >= 21000 && code < 22000 ? 'warning' : 'error'
}
