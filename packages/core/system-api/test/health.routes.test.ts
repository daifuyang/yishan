import Fastify from 'fastify'
import { describe, expect, it, vi } from './runtime-fixture'
import healthRoute from '../src/core/routes/api/health'
import { SystemService } from '../src/core/services/system.service'
import { SystemRepository } from '../src/core/repositories/system.repository'

describe('System health capability', () => {
  it('returns database latency and configured metadata without requiring authentication', async () => {
    vi.spyOn(SystemService, 'getDatabaseHealth').mockResolvedValue({ ok: true, latencyMs: 7 })
    const app = Fastify({ logger: false })
    await app.register(healthRoute, { prefix: '/api' })
    try {
      const response = await app.inject('/api/health')
      expect(response.statusCode).toBe(200)
      expect(response.json().data).toMatchObject({ status: 'ok', commitSha: 'unknown', db: { ok: true, latencyMs: 7 } })
    } finally { await app.close() }
  })

  it('retains the degraded health error and latency when the database probe fails', async () => {
    vi.spyOn(SystemRepository, 'probeDatabase').mockRejectedValue(new Error('local probe failed'))
    await expect(SystemService.getDatabaseHealth()).resolves.toMatchObject({ ok: false, error: 'local probe failed', latencyMs: expect.any(Number) })
  })
})
