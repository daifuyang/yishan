import { describe, expect, it } from 'vitest'
import os from 'node:os'
import { getServerInfo } from '../services/server-info.service.js'

describe('server-info service', () => {
  it('returns module id demo', () => {
    const info = getServerInfo()
    expect(info.module).toBe('demo')
  })

  it('matches runtime facts', () => {
    const info = getServerInfo()
    expect(info.nodeVersion).toBe(process.version)
    expect(info.hostname).toBe(os.hostname())
    expect(info.platform).toBe(process.platform)
    expect(info.arch).toBe(process.arch)
    expect(info.cpus).toBeGreaterThan(0)
    expect(info.pid).toBe(process.pid)
    expect(info.uptimeSeconds).toBeGreaterThanOrEqual(0)
    expect(info.memory.total).toBe(os.totalmem())
  })

  it('emits an ISO timestamp', () => {
    const info = getServerInfo()
    expect(typeof info.timestamp).toBe('string')
    expect(Number.isFinite(Date.parse(info.timestamp))).toBe(true)
  })
})
