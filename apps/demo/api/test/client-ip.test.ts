import { describe, expect, it, vi } from 'vitest'
import type { ApiModule } from '@yishan/core-api'
import type { SystemRuntime } from '@yishan/core-system-api'
import { buildApp } from '../src/app'
import { loadConfig } from '../src/config'

vi.mock('@yishan/core-database', async () => {
  const { drizzleDb, dbManager } = await import('./mocks/drizzle')
  return {
    createDatabase: () => ({
      db: drizzleDb,
      connect: dbManager.connect,
      close: dbManager.disconnect,
      healthCheck: dbManager.healthCheck,
      getConnectionStatus: dbManager.getConnectionStatus,
      transaction: drizzleDb.transaction,
    }),
  }
})

const env = {
  NODE_ENV: 'test', LOG_LEVEL: 'silent',
  DATABASE_URL: 'mysql://unused@127.0.0.1/unused',
  JWT_SECRET: 'isolated-client-ip-test-secret-1234567890123456789',
}

const probe: ApiModule<SystemRuntime> = {
  contractVersion: 2, id: 'ip_probe', name: 'IP probe', version: '1.0.0', tablePrefix: 'ip_probe_',
  async register(router) {
    router.get('/__test/client-ip', request => ({ ip: request.ip }))
  },
  async initialize(runtime) {
    vi.spyOn(runtime.moduleState, 'enabledIds').mockResolvedValue(new Set(['ip_probe']))
  },
}

async function clientIp(trustedProxyIps: string | undefined, remoteAddress: string, forwardedFor?: string, realIp?: string) {
  const app = await buildApp(loadConfig({ ...env, TRUST_PROXY_IPS: trustedProxyIps }), [probe], { redis: false, staticAssets: false })
  try {
    const response = await app.inject({
      url: '/api/ip_probe/__test/client-ip', remoteAddress,
      headers: {
        ...(forwardedFor ? { 'x-forwarded-for': forwardedFor } : {}),
        ...(realIp ? { 'x-real-ip': realIp } : {}),
      },
    })
    expect(response.statusCode).toBe(200)
    return (response.json() as { ip: string }).ip
  } finally {
    await app.close()
  }
}

describe('Demo client IP at the product request boundary', () => {
  it('uses the client address forwarded by an explicitly trusted local proxy', async () => {
    expect(await clientIp('127.0.0.1,::1', '127.0.0.1', '203.0.113.42')).toBe('203.0.113.42')
  })

  it('ignores forwarded headers by default', async () => {
    expect(await clientIp(undefined, '198.51.100.8', '203.0.113.99')).toBe('198.51.100.8')
  })

  it('ignores forged headers from peers outside the trusted proxy list', async () => {
    expect(await clientIp('127.0.0.1,::1', '198.51.100.8', '203.0.113.99')).toBe('198.51.100.8')
  })

  it('stops at the nearest untrusted address instead of accepting a forged prefix', async () => {
    expect(await clientIp('127.0.0.1', '127.0.0.1', '203.0.113.99, 198.51.100.8')).toBe('198.51.100.8')
  })

  it.each([
    ['normal request', '198.51.100.8'],
    ['forged client prefix', '203.0.113.99, 198.51.100.8'],
    ['multiple forged hops', '203.0.113.99, 192.0.2.7, 198.51.100.8'],
  ])('uses the rightmost address appended by the FC proxy for %s', async (_name, forwardedFor) => {
    expect(await clientIp('21.0.0.1', '21.0.0.1', forwardedFor, '203.0.113.99')).toBe('198.51.100.8')
  })

  it('does not trust another peer in the FC proxy address range', async () => {
    expect(await clientIp('21.0.0.1', '21.0.0.2', '203.0.113.99')).toBe('21.0.0.2')
  })

  it('supports an explicitly configured proxy subnet without trusting every private network', async () => {
    expect(await clientIp('10.20.30.0/24', '10.20.30.5', '203.0.113.42')).toBe('203.0.113.42')
    expect(await clientIp('10.20.30.0/24', '10.40.50.5', '203.0.113.99')).toBe('10.40.50.5')
  })

  it('keeps the peer address when the trusted proxy supplies no forwarded IP', async () => {
    expect(await clientIp('127.0.0.1', '127.0.0.1')).toBe('127.0.0.1')
  })

  it.each(['true', '1', 'uniquelocal', '0.0.0.0/0', '::/0', '127.0.0.1/33', '::1/129', '127.0.0.1,', 'not-an-ip'])('rejects unsafe or invalid trusted proxy configuration: %s', value => {
    expect(() => loadConfig({ ...env, TRUST_PROXY_IPS: value })).toThrow(/TRUST_PROXY_IPS/)
  })
})
