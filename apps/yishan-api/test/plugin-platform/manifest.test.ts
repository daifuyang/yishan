import { describe, expect, it } from 'vitest'
import { validateManifest } from '../../src/core/plugin-platform/manifest'

describe('validateManifest', () => {
  it('rejects manifest missing permissions field', () => {
    const result = validateManifest({ pluginId: 'yishan/hello', name: 'hello', version: '1.0.0' })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('permissions is required'))).toBe(true)
  })

  it('rejects invalid manifest', () => {
    const result = validateManifest({ name: '', version: 1 })
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  // =========================================================================
  // 新方案：结构化权限对象校验（2026-07-14）
  // =========================================================================

  describe('permissions: structured object format', () => {
    it('accepts valid permission objects', () => {
      const result = validateManifest({
        pluginId: 'yishan/hello',
        name: 'hello',
        version: '1.0.0',
        dbNamespace: 'ys_hello',
        permissions: [
          { code: 'hello:read', label: '读取', description: '读取权限', group: 'hello' },
          { code: 'hello:write', label: '写入' },
        ],
      })
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it('accepts empty permissions array', () => {
      const result = validateManifest({
        pluginId: 'yishan/hello',
        name: 'hello',
        version: '1.0.0',
        dbNamespace: 'ys_hello',
        permissions: [],
      })
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it('rejects permissions as object (not array)', () => {
      const result = validateManifest({
        pluginId: 'yishan/hello',
        name: 'hello',
        version: '1.0.0',
        dbNamespace: 'ys_hello',
        permissions: {},
      })
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('must be an array'))).toBe(true)
    })

    it('rejects legacy string[] format', () => {
      const result = validateManifest({
        pluginId: 'yishan/hello',
        name: 'hello',
        version: '1.0.0',
        permissions: ['hello:read', 'hello:write'],
      })
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('must be an object, not a string'))).toBe(true)
    })

    it('rejects permission missing code', () => {
      const result = validateManifest({
        pluginId: 'yishan/hello',
        name: 'hello',
        version: '1.0.0',
        permissions: [
          { label: '读取' }, // missing code
        ],
      })
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('.code must be a non-empty string'))).toBe(true)
    })

    it('rejects permission missing label', () => {
      const result = validateManifest({
        pluginId: 'yishan/hello',
        name: 'hello',
        version: '1.0.0',
        permissions: [
          { code: 'hello:read' }, // missing label
        ],
      })
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('.label must be a non-empty string'))).toBe(true)
    })

    it('rejects permission with empty code', () => {
      const result = validateManifest({
        pluginId: 'yishan/hello',
        name: 'hello',
        version: '1.0.0',
        permissions: [
          { code: '', label: '读取' },
        ],
      })
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('.code must be a non-empty string'))).toBe(true)
    })

    it('rejects duplicate code within same manifest', () => {
      const result = validateManifest({
        pluginId: 'yishan/hello',
        name: 'hello',
        version: '1.0.0',
        permissions: [
          { code: 'hello:read', label: '读取1' },
          { code: 'hello:read', label: '读取2' }, // duplicate
        ],
      })
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('duplicate code'))).toBe(true)
    })

    it('accepts permission with optional description and group', () => {
      const result = validateManifest({
        pluginId: 'yishan/hello',
        name: 'hello',
        version: '1.0.0',
        dbNamespace: 'ys_hello',
        permissions: [
          { code: 'hello:read', label: '读取', description: 'Optional description', group: 'custom' },
        ],
      })
      expect(result.valid).toBe(true)
    })

    it('rejects invalid description type', () => {
      const result = validateManifest({
        pluginId: 'yishan/hello',
        name: 'hello',
        version: '1.0.0',
        permissions: [
          { code: 'hello:read', label: '读取', description: 123 }, // invalid type
        ],
      })
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('.description must be a string'))).toBe(true)
    })

    it('rejects invalid group type', () => {
      const result = validateManifest({
        pluginId: 'yishan/hello',
        name: 'hello',
        version: '1.0.0',
        permissions: [
          { code: 'hello:read', label: '读取', group: 123 }, // invalid type
        ],
      })
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('.group must be a string'))).toBe(true)
    })
  })
})
