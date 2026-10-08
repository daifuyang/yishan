import { describe, expect, it } from 'vitest'
import { isModulePackedFromSource } from '../scripts/module-pack.mjs'

describe('isModulePackedFromSource', () => {
  it('treats omitted enabled as packed', () => {
    expect(isModulePackedFromSource(`export const meta = { id: 'shop' }`)).toBe(true)
  })

  it('packs enabled: true', () => {
    expect(
      isModulePackedFromSource(`export const meta = {\n  id: 'shop',\n  enabled: true,\n}`),
    ).toBe(true)
  })

  it('skips enabled: false', () => {
    expect(
      isModulePackedFromSource(`export const meta = {\n  id: 'shop',\n  enabled: false,\n}`),
    ).toBe(false)
  })
})
