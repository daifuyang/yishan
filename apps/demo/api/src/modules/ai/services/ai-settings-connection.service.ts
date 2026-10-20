import type { AiSettingsService, AiModelConfiguration } from './ai-settings.service.js'

const probeModel = async (configuration: AiModelConfiguration) => {
  const runtime = await import('../runtime/ai-sdk.mjs')
  await runtime.testConnection(configuration)
}

export async function testSavedAiConfiguration(settings: Pick<AiSettingsService, 'resolve'>, probe = probeModel) {
  const configuration = await settings.resolve()
  try {
    await probe(configuration)
    return { ok: true, message: '连接成功，模型可用' }
  } catch {
    return { ok: false, message: '连接失败，请检查 API 地址、模型名称和 API Key，或稍后重试' }
  }
}
