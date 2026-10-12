import { describe, expect, it } from 'vitest'
import { createSystemConfig } from '../src/config/create'

describe('explicit System infrastructure configuration', () => {
  it('retains TLS when a product supplies a rediss URL', () => {
    const config = createSystemConfig({ REDIS_URL: 'rediss://alice:secret%25@cache.example.test:6380/3' }, '/product')
    expect(config.REDIS_CONFIG).toMatchObject({ host: 'cache.example.test', port: 6380, username: 'alice', password: 'secret%', db: 3, tls: {} })
  })

  it('keeps ordinary Redis connections separate from secure connections', () => {
    const secure = createSystemConfig({ REDIS_URL: 'rediss://cache.example.test/1' }, '/a')
    const plain = createSystemConfig({ REDIS_URL: 'redis://127.0.0.1/2' }, '/b')
    expect(secure.REDIS_CONFIG).toHaveProperty('tls')
    expect(plain.REDIS_CONFIG).not.toHaveProperty('tls')
    expect(plain.REDIS_CONFIG.db).toBe(2)
    expect(secure.REDIS_CONFIG.db).toBe(1)
  })
})
