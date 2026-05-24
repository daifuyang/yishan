import { describe, expect, it } from 'vitest'
import { validateManifest } from '../../src/plugins-runtime/manifest'

describe('validateManifest', () => {
  it('accepts minimal valid manifest', () => {
    const result = validateManifest({ pluginId: '@yishan/hello', name: 'hello', version: '1.0.0' })
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('rejects invalid manifest', () => {
    const result = validateManifest({ name: '', version: 1 })
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })
})
