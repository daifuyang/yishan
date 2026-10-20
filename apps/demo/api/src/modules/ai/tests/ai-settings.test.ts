import { describe, expect, it } from 'vitest'
import { drizzle } from 'drizzle-orm/mysql-proxy'
import type { AppQueryDb } from '@yishan/core-system-api/database'
import { AiSettingsService } from '../services/ai-settings.service.js'
import { AiSettingsRepository, type AiSettingsRecord, type AiSettingsStore } from '../repositories/ai-settings.repository.js'

function fixture(initial: AiSettingsRecord | null = null, env = { AI_CHAT_API_KEY: 'env-key', AI_CHAT_MODEL: 'env-model' }) {
  let row = initial
  const store: AiSettingsStore = {
    async get() { return row },
    async save(input) {
      row = { ...input, id: 1, apiKey: input.apiKey || row?.apiKey || '', updatedAt: new Date() }
    },
  }
  return { service: new AiSettingsService(store, () => env), store, row: () => row }
}
const configured: AiSettingsRecord = { id: 1, baseUrl: 'https://gateway.example/v1', model: 'db-model', apiKey: 'db-key', updatedBy: 1, updatedAt: new Date() }

describe('AI singleton model settings', () => {
  it('resolves database configuration as a complete unit without exposing its key', async () => {
    const { service } = fixture(configured)
    expect(await service.resolve()).toEqual({ apiKey: 'db-key', model: 'db-model', baseUrl: 'https://gateway.example/v1' })
    expect(await service.read()).toEqual({ model: 'db-model', baseUrl: 'https://gateway.example/v1', hasApiKey: true, source: 'database' })
  })
  it('uses environment only when no database row exists', async () => {
    const { service } = fixture()
    expect(await service.resolve()).toEqual({ apiKey: 'env-key', model: 'env-model', baseUrl: 'https://api.anthropic.com/v1' })
    expect(await service.read()).toMatchObject({ model: 'env-model', hasApiKey: true, source: 'environment' })
  })
  it('does not combine incomplete database configuration with environment secrets', async () => {
    const { service } = fixture({ ...configured, apiKey: '' })
    await expect(service.resolve()).rejects.toMatchObject({ statusCode: 503 })
  })
  it('keeps a stored key on blank and omitted edits and records the actor', async () => {
    const f = fixture(configured)
    await f.service.save({ baseUrl: '', model: 'next', apiKey: '' }, 7)
    await f.service.save({ baseUrl: '', model: 'last' }, 8)
    expect(f.row()).toMatchObject({ apiKey: 'db-key', updatedBy: 8, model: 'last', baseUrl: 'https://api.anthropic.com/v1' })
  })
  it('requires a database key on initial save even if environment is configured', async () => {
    await expect(fixture().service.save({ baseUrl: '', model: 'model' }, 1)).rejects.toMatchObject({ statusCode: 400 })
  })
  it('requires a nonblank model even when a saved key exists', async () => {
    await expect(fixture(configured).service.save({ model: '  ' }, 1)).rejects.toMatchObject({ statusCode: 400 })
  })
  it.each(['secret key', ' secret', 'secret\n', 'secret\u0000'])('rejects invalid secret %j without reflecting it', async apiKey => {
    await expect(fixture().service.save({ baseUrl: '', model: 'model', apiKey }, 1)).rejects.toMatchObject({ statusCode: 400 })
  })
  it.each(['ftp://example.com', 'https://user:pass@example.com', 'https://example.com?key=x', 'https://example.com/#x'])('rejects unsafe base URL %s', async baseUrl => {
    await expect(fixture(configured).service.save({ baseUrl, model: 'model' }, 1)).rejects.toMatchObject({ statusCode: 400 })
  })
  it('accepts an HTTP localhost gateway', async () => {
    const f = fixture(configured)
    await f.service.save({ baseUrl: 'http://localhost:8080/v1', model: 'model' }, 1)
    expect((await f.service.resolve()).baseUrl).toBe('http://localhost:8080/v1')
  })
  it('reports unconfigured and rejects resolution when environment is incomplete', async () => {
    const { service } = fixture(null, { AI_CHAT_API_KEY: '', AI_CHAT_MODEL: 'model' })
    expect(await service.read()).toMatchObject({ source: 'unconfigured', hasApiKey: false })
    await expect(service.resolve()).rejects.toMatchObject({ statusCode: 503 })
  })
  it('propagates database failures instead of falling back', async () => {
    const f = fixture()
    f.store.get = async () => { throw new Error('database unavailable') }
    await expect(f.service.resolve()).rejects.toMatchObject({ statusCode: 503, message: 'AI 配置读取失败，请稍后重试' })
  })
  it('sanitizes database write failures that may contain credentials in SQL parameters', async () => {
    const f = fixture(configured)
    f.store.save = async () => { throw new Error('query params db-key') }
    await expect(f.service.save({ model: 'model' }, 1)).rejects.toMatchObject({ statusCode: 503, message: 'AI 配置保存失败，请稍后重试' })
  })
  it('retains the current database key in the same upsert rather than reading an old key', async () => {
    const queries: { sql: string; params: unknown[] }[] = []
    const db = drizzle(async (sql, params) => { queries.push({ sql, params }); return { rows: [{ insertId: 0, affectedRows: 1 }] } })
    const repo = new AiSettingsRepository(db as unknown as AppQueryDb)
    await repo.save({ model: 'model', baseUrl: 'http://localhost/v1', updatedBy: 2 })
    expect(queries).toHaveLength(1)
    expect(queries[0].sql).toMatch(/on duplicate key update.*`api_key` = `ai_model_settings`\.`api_key`/)
    expect(queries[0].sql).not.toMatch(/select /i)
  })
})

